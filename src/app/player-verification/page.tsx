"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { countries, codeForCountryName, flagFromCode, nameForCountryCode } from "@/data/countries";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  teamId: string;
  teamName: string;
  teamGender: string;
  headshot?: string;
  position?: string;
  verificationStatus?: "unclaimed" | "pending" | "verified";
  linkedUserId?: string;
};

const translations = {
  en: {
    title: "Player Verification",
    subtitle: "Claim your player profile or create a new one",
    claimExisting: "Claim Existing Profile",
    claimExistingDesc: "Find and claim your player profile that the admin created",
    createNew: "Create New Profile",
    createNewDesc: "Request to be added as a new player to a team",
    searchPlayers: "Search Players",
    searchPlaceholder: "Search by name or number...",
    selectTeam: "Select Team",
    selectGender: "Select Gender",
    men: "Men",
    women: "Women",
    firstName: "First Name",
    lastName: "Last Name",
    jerseyNumber: "Jersey Number",
    position: "Position (optional)",
    height: "Height (optional)",
    weight: "Weight (optional)",
    birthdate: "Date of Birth (optional)",
    nationality: "Nationality (optional)",
    uploadId: "Upload ID (optional)",
    uploadIdDesc: "Upload a photo ID to verify your identity",
    submitRequest: "Submit Request",
    submitting: "Submitting...",
    requestSubmitted: "Request Submitted!",
    requestSubmittedDesc: "Your verification request has been sent to the admin for approval.",
    backToHome: "Back to Home",
    claimed: "Claimed",
    pending: "Pending Verification",
    available: "Available",
    claim: "Claim This Profile",
    noPlayers: "No players found",
    selectATeam: "Select a team first",
    fillRequired: "Please fill in all required fields",
    goBack: "Go Back",
  },
  fr: {
    title: "Vérification du Joueur",
    subtitle: "Réclamez votre profil de joueur ou créez-en un nouveau",
    claimExisting: "Réclamer un Profil Existant",
    claimExistingDesc: "Trouvez et réclamez votre profil de joueur créé par l'administrateur",
    createNew: "Créer un Nouveau Profil",
    createNewDesc: "Demandez à être ajouté comme nouveau joueur dans une équipe",
    searchPlayers: "Rechercher des Joueurs",
    searchPlaceholder: "Rechercher par nom ou numéro...",
    selectTeam: "Sélectionner une Équipe",
    selectGender: "Sélectionner le Genre",
    men: "Hommes",
    women: "Femmes",
    firstName: "Prénom",
    lastName: "Nom",
    jerseyNumber: "Numéro de Maillot",
    position: "Position (facultatif)",
    height: "Taille (facultatif)",
    weight: "Poids (facultatif)",
    birthdate: "Date de Naissance (facultatif)",
    nationality: "Nationalité (facultatif)",
    uploadId: "Télécharger une Pièce d'Identité (facultatif)",
    uploadIdDesc: "Téléchargez une photo d'identité pour vérifier votre identité",
    submitRequest: "Soumettre la Demande",
    submitting: "Envoi en cours...",
    requestSubmitted: "Demande Soumise!",
    requestSubmittedDesc: "Votre demande de vérification a été envoyée à l'administrateur pour approbation.",
    backToHome: "Retour à l'Accueil",
    claimed: "Réclamé",
    pending: "En Attente de Vérification",
    available: "Disponible",
    claim: "Réclamer ce Profil",
    noPlayers: "Aucun joueur trouvé",
    selectATeam: "Sélectionnez d'abord une équipe",
    fillRequired: "Veuillez remplir tous les champs obligatoires",
    goBack: "Retour",
  },
};

export default function PlayerVerificationPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [mode, setMode] = useState<"choice" | "claim" | "create" | "success">("choice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Claim existing player
  const [selectedGender, setSelectedGender] = useState<"men" | "women" | "">("");
  const [teams, setTeams] = useState<Array<{ id: string; name: string; city: string; gender: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Create new player
  const [newPlayerForm, setNewPlayerForm] = useState({
    firstName: "",
    lastName: "",
    number: "",
    position: "",
    height: "",
    birthdate: "",
    nationality: "CD",
    nationality2: "",
    playerLicense: "",
  });
  const [idImage, setIdImage] = useState<File | null>(null);
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState(185);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [nationality2Search, setNationality2Search] = useState("");
  const [showNationalityDropdown, setShowNationalityDropdown] = useState(false);
  const [showNationality2Dropdown, setShowNationality2Dropdown] = useState(false);
  const [showSecondNationality, setShowSecondNationality] = useState(false);

  // Height conversion helper
  const cmToFeetInches = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    // If user already has a role, redirect
    if (userProfile?.role) {
      router.push("/");
    }
  }, [user, userProfile, router]);

  useEffect(() => {
    const fetchTeams = async () => {
      const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
      const teamsList = teamsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "",
        city: doc.data().city || "",
        gender: normalizeTeamGender(doc.data().gender, doc.data().logo, "men"),
      }));
      setTeams(teamsList);
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    if (mode === "claim" && selectedGender) {
      fetchPlayers();
    }
  }, [mode, selectedGender]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const genderTeams = teams.filter((t) => t.gender === selectedGender);
      const playersList: Player[] = [];

      for (const team of genderTeams) {
        const rosterRef = collection(firebaseDB, `teams/${team.id}/roster`);
        const rosterSnapshot = await getDocs(rosterRef);

        rosterSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          playersList.push({
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            number: data.number || 0,
            teamId: team.id,
            teamName: team.city ? `${team.city} ${team.name}` : team.name,
            teamGender: team.gender,
            headshot: data.headshot,
            position: data.position,
            verificationStatus: data.verificationStatus || "unclaimed",
            linkedUserId: data.linkedUserId,
          });
        });
      }

      setAllPlayers(playersList);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching players:", err);
      setLoading(false);
    }
  };

  const filteredPlayers = allPlayers.filter((player) => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || player.number.toString().includes(search);
    
    // Only show players from selected team if a team is selected
    if (selectedTeamId) {
      return matchesSearch && player.teamId === selectedTeamId;
    }
    
    return matchesSearch;
  });

  const handleClaimPlayer = async (player: Player) => {
    if (!user || !userProfile) return;

    setSelectedPlayer(player);
    setLoading(true);

    try {
      // Upload ID image if provided
      let idImageUrl = "";
      if (idImage) {
        const imageRef = ref(firebaseStorage, `verification-ids/${user.uid}-${Date.now()}.jpg`);
        await uploadBytes(imageRef, idImage);
        idImageUrl = await getDownloadURL(imageRef);
      }

      // Create verification request
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: userProfile.email || "",
        userFirstName: userProfile.firstName,
        userLastName: userProfile.lastName,
        userPhone: userProfile.phoneNumber,
        requestType: "claim_existing",
        role: "player",
        teamId: player.teamId,
        teamName: player.teamName,
        teamGender: player.teamGender,
        existingPlayerId: player.id,
        existingPlayerName: `${player.firstName} ${player.lastName}`,
        existingPlayerNumber: player.number,
        idImageUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      setMode("success");
    } catch (err) {
      console.error("Error submitting claim:", err);
      setError("Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewPlayer = async () => {
    if (!user || !userProfile || !selectedTeamId) {
      setError(t.fillRequired);
      return;
    }

    if (!newPlayerForm.firstName || !newPlayerForm.lastName || !newPlayerForm.number || !newPlayerForm.position) {
      setError(t.fillRequired);
      return;
    }

    setLoading(true);

    try {
      const selectedTeam = teams.find((t) => t.id === selectedTeamId);
      if (!selectedTeam) return;

      // Upload headshot if provided
      let headshotUrl = "";
      if (headshotFile) {
        const headshotRef = ref(firebaseStorage, `player-headshots/${Date.now()}-${headshotFile.name}`);
        await uploadBytes(headshotRef, headshotFile);
        headshotUrl = await getDownloadURL(headshotRef);
      }

      // Upload ID image if provided
      let idImageUrl = "";
      if (idImage) {
        const imageRef = ref(firebaseStorage, `verification-ids/${user.uid}-${Date.now()}.jpg`);
        await uploadBytes(imageRef, idImage);
        idImageUrl = await getDownloadURL(imageRef);
      }

      // Create verification request for new player
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: userProfile.email || "",
        userFirstName: userProfile.firstName,
        userLastName: userProfile.lastName,
        userPhone: userProfile.phoneNumber,
        requestType: "create_new",
        role: "player",
        teamId: selectedTeamId,
        teamName: selectedTeam.city ? `${selectedTeam.city} ${selectedTeam.name}` : selectedTeam.name,
        teamGender: selectedTeam.gender,
        newPlayerData: {
          firstName: newPlayerForm.firstName,
          lastName: newPlayerForm.lastName,
          number: parseInt(newPlayerForm.number),
          position: newPlayerForm.position,
          height: newPlayerForm.height,
          ...(newPlayerForm.birthdate && { birthdate: newPlayerForm.birthdate }),
          nationality: newPlayerForm.nationality,
          ...(newPlayerForm.nationality2 && { nationality2: newPlayerForm.nationality2 }),
          ...(newPlayerForm.playerLicense && { playerLicense: newPlayerForm.playerLicense }),
          ...(headshotUrl && { headshot: headshotUrl }),
        },
        ...(idImageUrl && { idImageUrl }),
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      setMode("success");
    } catch (err) {
      console.error("Error creating player request:", err);
      setError("Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {mode === "success" ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
            <div className="mb-4 text-6xl">✓</div>
            <h1 className="mb-2 text-3xl font-bold text-green-400">{t.requestSubmitted}</h1>
            <p className="mb-6 text-slate-300">{t.requestSubmittedDesc}</p>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600"
            >
              {t.backToHome}
            </button>
          </div>
        ) : mode === "choice" ? (
          <div>
            <h1 className="mb-2 text-4xl font-bold">{t.title}</h1>
            <p className="mb-8 text-slate-400">{t.subtitle}</p>

            <div className="grid gap-6 md:grid-cols-2">
              <button
                onClick={() => setMode("claim")}
                className="group rounded-2xl border border-white/10 bg-slate-800/50 p-8 text-left transition hover:border-blue-500/50 hover:bg-slate-800"
              >
                <div className="mb-4 text-5xl">🔍</div>
                <h2 className="mb-2 text-2xl font-bold group-hover:text-blue-400">{t.claimExisting}</h2>
                <p className="text-slate-400">{t.claimExistingDesc}</p>
              </button>

              <button
                onClick={() => setMode("create")}
                className="group rounded-2xl border border-white/10 bg-slate-800/50 p-8 text-left transition hover:border-green-500/50 hover:bg-slate-800"
              >
                <div className="mb-4 text-5xl">➕</div>
                <h2 className="mb-2 text-2xl font-bold group-hover:text-green-400">{t.createNew}</h2>
                <p className="text-slate-400">{t.createNewDesc}</p>
              </button>
            </div>
          </div>
        ) : mode === "claim" ? (
          <div>
            <button onClick={() => setMode("choice")} className="mb-6 text-blue-400 hover:underline">
              ← {t.goBack}
            </button>

            <h1 className="mb-6 text-3xl font-bold">{t.claimExisting}</h1>

            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold">{t.selectGender}</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedGender("men")}
                    className={`flex-1 rounded-lg border px-4 py-3 font-semibold transition ${
                      selectedGender === "men"
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-white/10 bg-slate-800/50 text-white hover:bg-slate-800"
                    }`}
                  >
                    {t.men}
                  </button>
                  <button
                    onClick={() => setSelectedGender("women")}
                    className={`flex-1 rounded-lg border px-4 py-3 font-semibold transition ${
                      selectedGender === "women"
                        ? "border-pink-500 bg-pink-500/20 text-pink-400"
                        : "border-white/10 bg-slate-800/50 text-white hover:bg-slate-800"
                    }`}
                  >
                    {t.women}
                  </button>
                </div>
              </div>

              {selectedGender && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">{t.selectTeam}</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                    >
                      <option value="">All Teams</option>
                      {teams
                        .filter((t) => t.gender === selectedGender)
                        .map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.city ? `${team.city} ${team.name}` : team.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">{t.searchPlayers}</label>
                    <input
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                    />
                  </div>
                </>
              )}
            </div>

            {!selectedGender ? (
              <div className="text-center py-12 text-slate-400">{t.selectGender}</div>
            ) : loading ? (
              <div className="text-center py-12 text-slate-400">Loading players...</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">{t.noPlayers}</div>
            ) : (
              <div className="space-y-3">
                {filteredPlayers.map((player) => {
                  const status = player.verificationStatus || "unclaimed";
                  const isAvailable = status === "unclaimed";
                  const isPending = status === "pending";

                  return (
                    <div
                      key={`${player.teamId}-${player.id}`}
                      className={`flex items-center gap-4 rounded-lg border p-4 ${
                        isAvailable
                          ? "border-white/10 bg-slate-800/50"
                          : isPending
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-green-500/30 bg-green-500/5 opacity-60"
                      }`}
                    >
                      <img
                        src={player.headshot || "/players/default-avatar.png"}
                        alt={`${player.firstName} ${player.lastName}`}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {player.firstName} {player.lastName} #{player.number}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {player.teamName} {player.position ? `• ${player.position}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {isPending ? t.pending : isAvailable ? t.available : t.claimed}
                        </p>
                      </div>
                      {isAvailable && (
                        <button
                          onClick={() => handleClaimPlayer(player)}
                          disabled={loading}
                          className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          {loading && selectedPlayer?.id === player.id ? t.submitting : t.claim}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold">{t.uploadId}</label>
              <p className="mb-2 text-xs text-slate-400">{t.uploadIdDesc}</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
              />
            </div>

            {error && <p className="mt-4 text-red-400">{error}</p>}
          </div>
        ) : (
          <div>
            <button onClick={() => setMode("choice")} className="mb-6 text-blue-400 hover:underline">
              ← {t.goBack}
            </button>

            <h1 className="mb-6 text-3xl font-bold">{t.createNew}</h1>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.firstName} *</label>
                  <input
                    type="text"
                    required
                    value={newPlayerForm.firstName}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, firstName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.lastName} *</label>
                  <input
                    type="text"
                    required
                    value={newPlayerForm.lastName}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, lastName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">{t.selectGender} *</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedGender("men")}
                    className={`flex-1 rounded-lg border px-4 py-3 font-semibold transition ${
                      selectedGender === "men"
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-white/10 bg-slate-800/50 text-white hover:bg-slate-800"
                    }`}
                  >
                    {t.men}
                  </button>
                  <button
                    onClick={() => setSelectedGender("women")}
                    className={`flex-1 rounded-lg border px-4 py-3 font-semibold transition ${
                      selectedGender === "women"
                        ? "border-pink-500 bg-pink-500/20 text-pink-400"
                        : "border-white/10 bg-slate-800/50 text-white hover:bg-slate-800"
                    }`}
                  >
                    {t.women}
                  </button>
                </div>
              </div>

              {selectedGender && (
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.selectTeam} *</label>
                  <select
                    required
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  >
                    <option value="">Select a team</option>
                    {teams
                      .filter((t) => t.gender === selectedGender)
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.city ? `${team.city} ${team.name}` : team.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.jerseyNumber} *</label>
                  <input
                    type="number"
                    required
                    value={newPlayerForm.number}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, number: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.position} *</label>
                  <select
                    required
                    value={newPlayerForm.position}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, position: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white cursor-pointer hover:border-white/20 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-colors appearance-none bg-no-repeat bg-right pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundSize: '1.5rem',
                      backgroundPosition: 'right 0.75rem center'
                    }}
                  >
                    <option value="" className="bg-slate-800 text-slate-400">Select position</option>
                    <option value="Point Guard" className="bg-slate-800 text-white">Point Guard</option>
                    <option value="Shooting Guard" className="bg-slate-800 text-white">Shooting Guard</option>
                    <option value="Small Forward" className="bg-slate-800 text-white">Small Forward</option>
                    <option value="Power Forward" className="bg-slate-800 text-white">Power Forward</option>
                    <option value="Center" className="bg-slate-800 text-white">Center</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <label className="mb-2 block text-sm font-semibold">{t.height}</label>
                  <div
                    onClick={() => setShowHeightPicker(!showHeightPicker)}
                    onBlur={() => {
                      setTimeout(() => setShowHeightPicker(false), 200);
                    }}
                    tabIndex={0}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white cursor-pointer flex justify-between items-center"
                  >
                    <span>{heightCm} cm</span>
                    <span className="text-slate-400">
                      {cmToFeetInches(heightCm).feet}'{cmToFeetInches(heightCm).inches}"
                    </span>
                  </div>
                  
                  {showHeightPicker && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/20 bg-slate-800 shadow-lg">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-semibold">Select Height</span>
                          <button
                            type="button"
                            onClick={() => setShowHeightPicker(false)}
                            className="text-slate-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="h-48 overflow-y-scroll border border-white/10 rounded bg-white/5 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                          {Array.from({ length: 101 }, (_, i) => 150 + i).map((cm) => {
                            const { feet, inches } = cmToFeetInches(cm);
                            return (
                              <button
                                key={cm}
                                type="button"
                                onClick={() => {
                                  setHeightCm(cm);
                                  setNewPlayerForm({ ...newPlayerForm, height: `${feet}'${inches}"` });
                                  setShowHeightPicker(false);
                                }}
                                className={`w-full px-4 py-2 text-left hover:bg-white/10 flex justify-between items-center ${
                                  heightCm === cm ? 'bg-white/20 text-white font-semibold' : 'text-slate-300'
                                }`}
                              >
                                <span>{cm} cm</span>
                                <span className="text-slate-400">{feet}'{inches}"</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t.birthdate}</label>
                  <input
                    type="date"
                    value={newPlayerForm.birthdate}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, birthdate: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <label className="mb-2 block text-sm font-semibold">{t.nationality}</label>
                  <div className="relative">
                    <div className="flex items-center gap-2 w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3">
                      {!nationalitySearch && newPlayerForm.nationality && (
                        <span className="text-lg">{flagFromCode(newPlayerForm.nationality)}</span>
                      )}
                      <input
                        type="text"
                        value={nationalitySearch !== "" ? nationalitySearch : (newPlayerForm.nationality ? nameForCountryCode(newPlayerForm.nationality) || newPlayerForm.nationality : "")}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNationalitySearch(value);
                          if (value === "") {
                            setNewPlayerForm({ ...newPlayerForm, nationality: "" });
                          }
                          setShowNationalityDropdown(true);
                        }}
                        onFocus={() => setShowNationalityDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowNationalityDropdown(false), 200);
                        }}
                        className="flex-1 bg-transparent text-white outline-none"
                        placeholder="Search country..."
                      />
                    </div>
                    {showNationalityDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-white/20 bg-slate-800 shadow-lg">
                        {countries
                          .filter((c) =>
                            c.name.toLowerCase().includes((nationalitySearch || "").toLowerCase()) ||
                            c.code.toLowerCase().includes((nationalitySearch || "").toLowerCase())
                          )
                          .sort((a, b) => {
                            if (a.code === "CD") return -1;
                            if (b.code === "CD") return 1;
                            return 0;
                          })
                          .map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setNewPlayerForm({ ...newPlayerForm, nationality: country.code });
                                setNationalitySearch("");
                                setShowNationalityDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                            >
                              <span className="text-xl">{flagFromCode(country.code)}</span>
                              <span>{country.name} ({country.code})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                {!showSecondNationality ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSecondNationality(true)}
                      className="w-10 h-10 rounded-lg border-2 border-white/20 bg-slate-800 hover:border-white/40 hover:bg-white/10 transition-colors flex items-center justify-center"
                    >
                      <span className="text-lg text-slate-400">+</span>
                    </button>
                    <label className="text-sm text-slate-400 cursor-pointer" onClick={() => setShowSecondNationality(true)}>
                      Second Nationality
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="mb-2 block text-sm font-semibold">Second Nationality</label>
                    <div className="relative">
                      <div className="flex items-center gap-2 w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3">
                        {!nationality2Search && newPlayerForm.nationality2 && (
                          <span className="text-lg">{flagFromCode(newPlayerForm.nationality2)}</span>
                        )}
                        <input
                          type="text"
                          value={nationality2Search || (newPlayerForm.nationality2 ? nameForCountryCode(newPlayerForm.nationality2) || newPlayerForm.nationality2 : "")}
                          onChange={(e) => {
                            setNationality2Search(e.target.value);
                            setShowNationality2Dropdown(true);
                          }}
                          onFocus={() => setShowNationality2Dropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowNationality2Dropdown(false), 200);
                          }}
                          className="flex-1 bg-transparent text-white outline-none"
                          placeholder="Optional"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSecondNationality(false);
                            setNewPlayerForm({ ...newPlayerForm, nationality2: "" });
                            setNationality2Search("");
                          }}
                          className="text-slate-400 hover:text-red-400 text-lg"
                        >
                          ✕
                        </button>
                      </div>
                      {showNationality2Dropdown && (
                        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-white/20 bg-slate-800 shadow-lg">
                          {countries
                            .filter((c) =>
                              c.name.toLowerCase().includes((nationality2Search || "").toLowerCase()) ||
                              c.code.toLowerCase().includes((nationality2Search || "").toLowerCase())
                            )
                            .sort((a, b) => {
                              if (a.code === "CD") return -1;
                              if (b.code === "CD") return 1;
                              return 0;
                            })
                            .map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setNewPlayerForm({ ...newPlayerForm, nationality2: country.code });
                                  setNationality2Search("");
                                  setShowNationality2Dropdown(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                              >
                                <span className="text-xl">{flagFromCode(country.code)}</span>
                                <span>{country.name} ({country.code})</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Player License</label>
                <input
                  type="text"
                  value={newPlayerForm.playerLicense}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, playerLicense: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Headshot Photo</label>
                <input
                  type="file"
                  id="headshot-upload"
                  accept="image/*"
                  onChange={(e) => setHeadshotFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {headshotFile ? (
                  <div className="space-y-2">
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-white/20 bg-white/5">
                      <Image
                        src={URL.createObjectURL(headshotFile)}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setHeadshotFile(null)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="headshot-upload"
                    className="w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-white/20 bg-slate-800 rounded-lg cursor-pointer hover:border-white/40 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-4xl mb-2">📷</span>
                    <span className="text-xs text-slate-400">Upload Photo</span>
                  </label>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">{t.uploadId}</label>
                <p className="mb-2 text-xs text-slate-400">{t.uploadIdDesc}</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-white"
                />
              </div>

              {error && <p className="text-red-400">{error}</p>}

              <button
                onClick={handleCreateNewPlayer}
                disabled={loading}
                className="w-full rounded-lg bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? t.submitting : t.submitRequest}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
