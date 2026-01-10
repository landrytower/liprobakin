"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const translations = {
  en: {
    loading: "Loading...",
    backToHome: "Back to Home",
    accountSettings: "Account Settings",
    signOut: "Sign Out",
    accountDetails: "Account Details",
    name: "Name",
    email: "Email",
    phoneNumber: "Phone Number",
    role: "Role",
    player: "Player",
    coach: "Coach",
    fan: "Fan",
    team: "Team",
    verificationStatus: "Verification Status",
    verified: "Verified",
    pending: "Pending",
    rejected: "Rejected",
    headshot: "Headshot",
    noHeadshot: "No headshot",
    headshotPreview: "Headshot preview",
    uploadNewHeadshot: "Upload a new headshot. Changes will remain pending until an admin approves them.",
    submitForApproval: "Submit for Approval",
    submitting: "Submitting...",
    adminApprovalRequired: "Admin approval required before it becomes public.",
    firstName: "First Name",
    lastName: "Last Name",
    editYourName: "Edit your name below. Any changes will require admin approval before they become public.",
    noChangesDetected: "No changes detected.",
    submitChanges: "Submit Changes",
    favoriteTeamMen: "Favorite Men's Team",
    favoriteTeamWomen: "Favorite Women's Team",
    favoritePlayerMen: "Favorite Men's Player",
    favoritePlayerWomen: "Favorite Women's Player",
    notSelected: "Not selected",
    accountCreated: "Account created on",
    playerStatistics: "Player Statistics",
    currentSeasonAverages: "Your current season averages",
    gamesPlayed: "games played",
    points: "Points",
    ppg: "PPG",
    rebounds: "Rebounds",
    rpg: "RPG",
    assists: "Assists",
    apg: "APG",
    steals: "Steals",
    spg: "SPG",
    shootingStatistics: "Shooting Statistics",
    twoPointFG: "2-Point FG",
    threePointFG: "3-Point FG",
    freeThrows: "Free Throws",
    blocks: "Blocks",
    turnovers: "Turnovers",
    minutes: "Minutes",
    fouls: "Fouls",
    reboundBreakdown: "Rebound Breakdown",
    offensive: "Offensive",
    defensive: "Defensive",
    total: "Total",
    viewFullProfile: "View Full Player Profile",
    noStatsAvailable: "No statistics available yet",
    profileInformation: "Your profile information and settings",
    requiresAdminApproval: "Requires admin approval",
    changesPendingApproval: "Changes stay pending until an admin approves.",
    jerseyNumber: "Jersey Number",
    position: "Position",
    editJerseyNumber: "Edit Jersey Number",
    currentJersey: "Current Jersey",
    newJersey: "New Jersey Number",
    jerseyChangeRequiresApproval: "Changing your jersey number requires admin approval. Your stats and profile will stay linked to you.",
    submitJerseyChange: "Submit Jersey Change",
  },
  fr: {
    loading: "Chargement...",
    backToHome: "Retour à l'Accueil",
    accountSettings: "Paramètres du Compte",
    signOut: "Déconnexion",
    accountDetails: "Détails du Compte",
    name: "Nom",
    email: "Email",
    phoneNumber: "Numéro de Téléphone",
    role: "Rôle",
    player: "Joueur",
    coach: "Entraîneur",
    fan: "Fan",
    team: "Équipe",
    verificationStatus: "Statut de Vérification",
    verified: "Vérifié",
    pending: "En Attente",
    rejected: "Rejeté",
    headshot: "Photo de Profil",
    noHeadshot: "Pas de photo",
    headshotPreview: "Aperçu de la photo",
    uploadNewHeadshot: "Téléchargez une nouvelle photo. Les modifications resteront en attente jusqu'à l'approbation d'un administrateur.",
    submitForApproval: "Soumettre pour Approbation",
    submitting: "Envoi en cours...",
    adminApprovalRequired: "Approbation de l'administrateur requise avant publication.",
    firstName: "Prénom",
    lastName: "Nom de Famille",
    editYourName: "Modifiez votre nom ci-dessous. Toute modification nécessitera l'approbation d'un administrateur avant de devenir publique.",
    noChangesDetected: "Aucune modification détectée.",
    submitChanges: "Soumettre les Modifications",
    favoriteTeamMen: "Équipe Masculine Favorite",
    favoriteTeamWomen: "Équipe Féminine Favorite",
    favoritePlayerMen: "Joueur Masculin Favori",
    favoritePlayerWomen: "Joueuse Féminine Favorite",
    notSelected: "Non sélectionné",
    accountCreated: "Compte créé le",
    playerStatistics: "Statistiques du Joueur",
    currentSeasonAverages: "Vos moyennes de saison actuelles",
    gamesPlayed: "matchs joués",
    points: "Points",
    ppg: "PPM",
    rebounds: "Rebonds",
    rpg: "RPM",
    assists: "Passes Décisives",
    apg: "PDM",
    steals: "Interceptions",
    spg: "IPM",
    shootingStatistics: "Statistiques de Tir",
    twoPointFG: "Paniers à 2 Points",
    threePointFG: "Paniers à 3 Points",
    freeThrows: "Lancers Francs",
    blocks: "Contres",
    turnovers: "Balles Perdues",
    minutes: "Minutes",
    fouls: "Fautes",
    reboundBreakdown: "Détails des Rebonds",
    offensive: "Offensif",
    defensive: "Défensif",
    total: "Total",
    viewFullProfile: "Voir le Profil Complet du Joueur",
    noStatsAvailable: "Aucune statistique disponible pour le moment",
    profileInformation: "Vos informations de profil et paramètres",
    requiresAdminApproval: "Approbation admin requise",
    changesPendingApproval: "Les modifications restent en attente jusqu'à l'approbation.",
    jerseyNumber: "Numéro de Maillot",
    position: "Position",    editJerseyNumber: "Modifier le Numéro de Maillot",
    currentJersey: "Maillot Actuel",
    newJersey: "Nouveau Numéro",
    jerseyChangeRequiresApproval: "Changer votre numéro de maillot nécessite l'approbation de l'administrateur. Vos statistiques et profil resteront liés à vous.",
    submitJerseyChange: "Soumettre le Changement",  },
};

type PlayerStats = {
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  two_pm: string;
  two_pa: string;
  three_pm: string;
  three_pa: string;
  ft_m: string;
  ft_a: string;
  oreb: string;
  dreb: string;
  min: string;
  pf: string;
  to: string;
};

type PlayerData = {
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  height?: string;
  birthdate?: string;
  nationality?: string;
  headshot?: string;
  stats: PlayerStats;
  gamesPlayed?: number;
};

export default function AccountPage() {
  const { user, userProfile, signOut } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const router = useRouter();
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [headshotSubmitting, setHeadshotSubmitting] = useState(false);
  const [headshotMessage, setHeadshotMessage] = useState("\u00a0");
  const [headshotError, setHeadshotError] = useState("");
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>("");
  const [editLastName, setEditLastName] = useState<string>("");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameMessage, setNameMessage] = useState("\u00a0");
  const [nameError, setNameError] = useState("");
  const [newJerseyNumber, setNewJerseyNumber] = useState<string>("");
  const [jerseySubmitting, setJerseySubmitting] = useState(false);
  const [jerseyMessage, setJerseyMessage] = useState("\u00a0");
  const [jerseyError, setJerseyError] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  // Initialize name fields from profile
  useEffect(() => {
    if (userProfile) {
      setEditFirstName(userProfile.firstName || "");
      setEditLastName(userProfile.lastName || "");
    }
  }, [userProfile]);

  // Build/revoke headshot preview when a file is selected
  useEffect(() => {
    if (!headshotFile) {
      setHeadshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(headshotFile);
    setHeadshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [headshotFile]);

  // Submit headshot update request (requires admin approval)
  const handleHeadshotSubmit = async () => {
    if (!user || !userProfile || !headshotFile) {
      setHeadshotError("Please select a headshot to upload.");
      return;
    }

    if (userProfile.role !== "player" || userProfile.verificationStatus !== "approved" || !userProfile.linkedPlayerId || !userProfile.teamId) {
      setHeadshotError("Headshot updates are available only for verified players.");
      return;
    }

    setHeadshotSubmitting(true);
    setHeadshotError("");
    setHeadshotMessage("\u00a0");

    try {
      const playerFullName = `${userProfile.firstName}_${userProfile.lastName}`.replace(/\s+/g, '_');
      const fileExtension = headshotFile.name.split('.').pop();
      const storageRef = ref(firebaseStorage, `player-headshot-updates/${playerFullName}_${Date.now()}.${fileExtension}`);
      await uploadBytes(storageRef, headshotFile);
      const newHeadshotUrl = await getDownloadURL(storageRef);

      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile.email || "",
        userFirstName: userProfile.firstName,
        userLastName: userProfile.lastName,
        userPhone: userProfile.phoneNumber || "",
        role: "player",
        teamId: userProfile.teamId,
        teamName: userProfile.teamName || "",
        requestType: "update_headshot",
        existingPlayerId: userProfile.linkedPlayerId,
        existingPlayerName: `${userProfile.firstName} ${userProfile.lastName}`,
        previousHeadshotUrl: playerData?.headshot || null,
        newHeadshotUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      setHeadshotMessage("Headshot submitted for admin approval.");
      setHeadshotFile(null);
    } catch (error) {
      console.error("Error submitting headshot:", error);
      setHeadshotError("Failed to submit headshot. Please try again.");
    } finally {
      setHeadshotSubmitting(false);
    }
  };

  // Submit name change request (requires admin approval)
  const handleNameSubmit = async () => {
    if (!user || !userProfile) {
      setNameError("You must be signed in.");
      return;
    }

    if (userProfile.role !== "player" || userProfile.verificationStatus !== "approved" || !userProfile.linkedPlayerId || !userProfile.teamId) {
      setNameError("Name changes are available only for verified players.");
      return;
    }

    if (!editFirstName.trim() || !editLastName.trim()) {
      setNameError("First and last name are required.");
      return;
    }

    if (editFirstName.trim() === userProfile.firstName && editLastName.trim() === userProfile.lastName) {
      setNameError("No changes detected.");
      return;
    }

    setNameSubmitting(true);
    setNameError("");
    setNameMessage("\u00a0");

    try {
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile.email || "",
        userFirstName: userProfile.firstName,
        userLastName: userProfile.lastName,
        userPhone: userProfile.phoneNumber || "",
        role: "player",
        teamId: userProfile.teamId,
        teamName: userProfile.teamName || "",
        requestType: "update_name",
        existingPlayerId: userProfile.linkedPlayerId,
        existingPlayerName: `${userProfile.firstName} ${userProfile.lastName}`,
        previousFirstName: userProfile.firstName,
        previousLastName: userProfile.lastName,
        newFirstName: editFirstName.trim(),
        newLastName: editLastName.trim(),
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      setNameMessage("Name change submitted for admin approval.");
    } catch (error) {
      console.error("Error submitting name change:", error);
      setNameError("Failed to submit name change. Please try again.");
    } finally {
      setNameSubmitting(false);
    }
  };

  // Submit jersey number change request (requires admin approval)
  const handleJerseyNumberSubmit = async () => {
    if (!user || !userProfile || !newJerseyNumber.trim()) {
      setJerseyError("Please enter a new jersey number.");
      return;
    }

    if (userProfile.role !== "player" || userProfile.verificationStatus !== "approved" || !userProfile.linkedPlayerId || !userProfile.teamId) {
      setJerseyError("Jersey number changes are available only for verified players.");
      return;
    }

    const jerseyNum = parseInt(newJerseyNumber.trim(), 10);
    if (isNaN(jerseyNum) || jerseyNum < 0 || jerseyNum > 99) {
      setJerseyError("Please enter a valid jersey number (0-99).");
      return;
    }

    if (playerData && jerseyNum === playerData.number) {
      setJerseyError("The new jersey number is the same as your current number.");
      return;
    }

    setJerseySubmitting(true);
    setJerseyError("");
    setJerseyMessage("\u00a0");

    try {
      await addDoc(collection(firebaseDB, "verificationRequests"), {
        userId: user.uid,
        userEmail: user.email || userProfile.email || "",
        userFirstName: userProfile.firstName,
        userLastName: userProfile.lastName,
        userPhone: userProfile.phoneNumber || "",
        teamId: userProfile.teamId,
        teamName: userProfile.teamName || "",
        requestType: "update_jersey",
        existingPlayerId: userProfile.linkedPlayerId,
        existingPlayerName: `${userProfile.firstName} ${userProfile.lastName}`,
        previousJerseyNumber: playerData?.number || 0,
        newJerseyNumber: jerseyNum,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      setJerseyMessage("Jersey number change submitted for admin approval.");
      setNewJerseyNumber("");
    } catch (error) {
      console.error("Error submitting jersey change:", error);
      setJerseyError("Failed to submit jersey change. Please try again.");
    } finally {
      setJerseySubmitting(false);
    }
  };

  // Fetch player stats if verified
  useEffect(() => {
    async function fetchPlayerStats() {
      if (!userProfile || !userProfile.linkedPlayerId || !userProfile.teamId) {
        console.log('[Account] Missing data:', {
          hasProfile: !!userProfile,
          linkedPlayerId: userProfile?.linkedPlayerId,
          teamId: userProfile?.teamId,
          verificationStatus: userProfile?.verificationStatus,
        });
        return;
      }

      if (userProfile.verificationStatus !== 'approved') {
        console.log('[Account] Verification not approved:', userProfile.verificationStatus);
        return;
      }

      console.log('[Account] Fetching stats for player:', {
        teamId: userProfile.teamId,
        linkedPlayerId: userProfile.linkedPlayerId,
      });

      setLoadingStats(true);
      try {
        const playerRef = doc(firebaseDB, "teams", userProfile.teamId, "roster", userProfile.linkedPlayerId);
        const playerDoc = await getDoc(playerRef);
        
        if (playerDoc.exists()) {
          const data = playerDoc.data();
          console.log('[Account] Player data found:', data);
          setPlayerData({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            number: data.number || 0,
            position: data.position || "",
            height: data.height,
            birthdate: data.birthdate,
            nationality: data.nationality,
            headshot: data.headshot,
            stats: data.stats || {
              pts: "0.0",
              reb: "0.0",
              ast: "0.0",
              stl: "0.0",
              blk: "0.0",
              two_pm: "0.0",
              two_pa: "0.0",
              three_pm: "0.0",
              three_pa: "0.0",
              ft_m: "0.0",
              ft_a: "0.0",
              oreb: "0.0",
              dreb: "0.0",
              min: "0.0",
              pf: "0.0",
              to: "0.0",
            },
            gamesPlayed: data.gamesPlayed || 0,
          });
        } else {
          console.log('[Account] Player document not found');
        }
      } catch (error) {
        console.error("Error fetching player stats:", error);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchPlayerStats();
  }, [userProfile]);

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <p className="text-white">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(circle,_rgba(56,189,248,0.35),_transparent_60%)] blur-3xl" aria-hidden />
      
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-8 px-4 sm:px-6 py-4 sm:py-5 md:px-12">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 text-sm sm:text-xl font-semibold tracking-[0.2em] sm:tracking-[0.3em] text-white hover:text-blue-400 transition">
            ← {t.backToHome}
          </Link>
          <h1 className="text-base sm:text-2xl font-bold truncate">{t.accountSettings}</h1>
          <div className="w-16 sm:w-32"></div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 md:px-12">
        {/* Sign Out Button at Top */}
        <div className="mb-6 sm:mb-8 flex justify-end">
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="rounded-lg bg-red-600 hover:bg-red-700 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition shadow-lg"
            type="button"
          >
            🚪 {t.signOut}
          </button>
        </div>

        {/* Account Details Card */}
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 pb-6 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t.accountDetails}</h2>
            <p className="text-sm sm:text-base text-slate-400">{t.profileInformation}</p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Name with admin-approval edit */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <label className="text-xs font-semibold text-blue-300 uppercase tracking-wider">{t.name}</label>
                <span className="text-[10px] uppercase tracking-widest text-blue-300">{t.requiresAdminApproval}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder={t.firstName}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                />
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder={t.lastName}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleNameSubmit}
                  disabled={nameSubmitting}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {nameSubmitting ? t.submitting : t.submitForApproval}
                </button>
                <p className="text-xs text-slate-400">{t.changesPendingApproval}</p>
              </div>
              {nameError && <p className="text-xs text-red-400">{nameError}</p>}
              {nameMessage.trim() && nameMessage !== '\u00a0' && (
                <p className="text-xs text-green-400">{nameMessage}</p>
              )}
            </div>

            {/* Email */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.email}</label>
              <p className="text-base sm:text-lg text-white font-medium break-all">{user.email}</p>
            </div>

            {/* Phone */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.phoneNumber}</label>
              <p className="text-base sm:text-lg text-white font-medium">{userProfile.phoneNumber}</p>
            </div>

            {/* Role */}
            {userProfile.role && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.role}</label>
                <p className="text-base sm:text-lg text-white font-medium capitalize">{t[userProfile.role as keyof typeof t] || userProfile.role}</p>
              </div>
            )}

            {/* Team */}
            {userProfile.teamName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.team}</label>
                <p className="text-base sm:text-lg text-white font-medium">{userProfile.teamName}</p>
              </div>
            )}

            {/* Jersey Number */}
            {userProfile.playerNumber && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.jerseyNumber}</label>
                <p className="text-base sm:text-lg text-white font-medium">#{userProfile.playerNumber}</p>
              </div>
            )}

            {/* Position */}
            {userProfile.position && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.position}</label>
                <p className="text-base sm:text-lg text-white font-medium">{userProfile.position}</p>
              </div>
            )}

            {/* Verification Status */}
            {userProfile.verificationStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.verificationStatus}</label>
                <p className={`text-base sm:text-lg font-bold flex items-center gap-2 ${
                  userProfile.verificationStatus === 'approved' ? 'text-green-400' :
                  userProfile.verificationStatus === 'pending' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {userProfile.verificationStatus === 'approved' ? (
                    <>
                      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {t.verified}
                    </>
                  ) : userProfile.verificationStatus === 'pending' ? (
                    <>
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.pending}
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {t.rejected}
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Headshot update (requires admin approval) */}
            {userProfile.role === 'player' && userProfile.verificationStatus === 'approved' && userProfile.linkedPlayerId && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2 block">{t.headshot}</label>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                    {headshotPreview || playerData?.headshot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headshotPreview || playerData?.headshot || ""}
                        alt={t.headshotPreview}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400 text-center px-2">{t.noHeadshot}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <p className="text-xs sm:text-sm text-slate-300">{t.uploadNewHeadshot}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setHeadshotFile(e.target.files?.[0] || null)}
                      className="w-full text-xs sm:text-sm text-slate-200 file:mr-2 sm:file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-600 file:to-green-500 file:px-3 sm:file:px-4 file:py-1.5 sm:file:py-2 file:text-xs sm:file:text-sm file:font-semibold file:text-white hover:file:shadow-lg cursor-pointer"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        onClick={handleHeadshotSubmit}
                        disabled={headshotSubmitting || !headshotFile}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                      >
                        {headshotSubmitting ? t.submitting : t.submitForApproval}
                      </button>
                      <p className="text-xs text-slate-400">{t.adminApprovalRequired}</p>
                    </div>
                    {headshotError && <p className="text-xs text-red-400">{headshotError}</p>}
                    {headshotMessage.trim() && headshotMessage !== '\u00a0' && (
                      <p className="text-xs text-green-400">{headshotMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Jersey Number Change (requires admin approval) */}
            {userProfile.role === 'player' && userProfile.verificationStatus === 'approved' && userProfile.linkedPlayerId && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 block">{t.editJerseyNumber}</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">{t.currentJersey}</p>
                      <p className="text-2xl font-bold text-white">#{playerData?.number || '?'}</p>
                    </div>
                    <div className="text-slate-500 text-2xl">→</div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 mb-1 block">{t.newJersey}</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={newJerseyNumber}
                        onChange={(e) => setNewJerseyNumber(e.target.value)}
                        placeholder="00"
                        className="w-24 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-lg font-bold text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300">{t.jerseyChangeRequiresApproval}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      onClick={handleJerseyNumberSubmit}
                      disabled={jerseySubmitting || !newJerseyNumber.trim()}
                      className="rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      {jerseySubmitting ? t.submitting : t.submitJerseyChange}
                    </button>
                    <p className="text-xs text-slate-400">{t.adminApprovalRequired}</p>
                  </div>
                  {jerseyError && <p className="text-xs text-red-400">{jerseyError}</p>}
                  {jerseyMessage.trim() && jerseyMessage !== '\u00a0' && (
                    <p className="text-xs text-green-400">{jerseyMessage}</p>
                  )}
                </div>
              </div>
            )}

            {/* Favorite Men's Team */}
            {userProfile.role === 'fan' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.favoriteTeamMen}</label>
                <p className="text-base sm:text-lg text-white font-medium">
                  {userProfile.favoriteTeamMenName ? `⭐ ${userProfile.favoriteTeamMenName}` : t.notSelected}
                </p>
              </div>
            )}

            {/* Favorite Men's Player */}
            {userProfile.role === 'fan' && userProfile.favoritePlayerMenName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.favoritePlayerMen}</label>
                <p className="text-base sm:text-lg text-white font-medium">🏀 {userProfile.favoritePlayerMenName}</p>
              </div>
            )}

            {/* Favorite Women's Team */}
            {userProfile.role === 'fan' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.favoriteTeamWomen}</label>
                <p className="text-base sm:text-lg text-white font-medium">
                  {userProfile.favoriteTeamWomenName ? `⭐ ${userProfile.favoriteTeamWomenName}` : t.notSelected}
                </p>
              </div>
            )}

            {/* Favorite Women's Player */}
            {userProfile.role === 'fan' && userProfile.favoritePlayerWomenName && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.favoritePlayerWomen}</label>
                <p className="text-base sm:text-lg text-white font-medium">🏀 {userProfile.favoritePlayerWomenName}</p>
              </div>
            )}
          </div>

          {/* Account Created Date */}
          <div className="mt-6 sm:mt-8 pt-6 border-t border-white/10">
            <p className="text-xs sm:text-sm text-slate-400">
              {t.accountCreated} {userProfile.createdAt?.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        {/* Player Stats Card - Only show for verified players */}
        {userProfile.role === 'player' && userProfile.verificationStatus === 'approved' && userProfile.linkedPlayerId && (
          <div className="mt-6 sm:mt-8 rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 pb-4 sm:pb-6 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">⭐ {t.playerStatistics}</h2>
              <p className="text-sm sm:text-base text-slate-400">{t.currentSeasonAverages} {playerData && `(${playerData.gamesPlayed || 0} ${t.gamesPlayed})`}</p>
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : playerData ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Key Stats */}
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 sm:p-5 text-center">
                    <label className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 block">{t.points}</label>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{playerData.stats.pts}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.ppg}</p>
                  </div>

                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 sm:p-5 text-center">
                    <label className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 block">{t.rebounds}</label>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{playerData.stats.reb}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.rpg}</p>
                  </div>

                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 sm:p-5 text-center">
                    <label className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2 block">{t.assists}</label>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{playerData.stats.ast}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.apg}</p>
                  </div>

                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 sm:p-5 text-center">
                    <label className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2 block">{t.steals}</label>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{playerData.stats.stl}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.spg}</p>
                  </div>
                </div>

                {/* Shooting Stats */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    🎯 {t.shootingStatistics}
                  </h3>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.twoPointFG}</label>
                      <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.two_pm}/{playerData.stats.two_pa}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {parseFloat(playerData.stats.two_pa) > 0 
                          ? `${((parseFloat(playerData.stats.two_pm) / parseFloat(playerData.stats.two_pa)) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.threePointFG}</label>
                      <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.three_pm}/{playerData.stats.three_pa}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {parseFloat(playerData.stats.three_pa) > 0 
                          ? `${((parseFloat(playerData.stats.three_pm) / parseFloat(playerData.stats.three_pa)) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.freeThrows}</label>
                      <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.ft_m}/{playerData.stats.ft_a}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {parseFloat(playerData.stats.ft_a) > 0 
                          ? `${((parseFloat(playerData.stats.ft_m) / parseFloat(playerData.stats.ft_a)) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 text-center">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.blocks}</label>
                    <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.blk}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 text-center">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.turnovers}</label>
                    <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.to}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 text-center">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.minutes}</label>
                    <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.min}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 text-center">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.fouls}</label>
                    <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.pf}</p>
                  </div>
                </div>

                {/* Rebound Breakdown */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">📊 {t.reboundBreakdown}</h3>
                  <div className="grid gap-3 sm:gap-4 grid-cols-3">
                    <div className="text-center">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.offensive}</label>
                      <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.oreb}</p>
                    </div>

                    <div className="text-center">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.defensive}</label>
                      <p className="text-xl sm:text-2xl font-bold text-white">{playerData.stats.dreb}</p>
                    </div>

                    <div className="text-center">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t.total}</label>
                      <p className="text-xl sm:text-2xl font-bold text-green-400">{playerData.stats.reb}</p>
                    </div>
                  </div>
                </div>

                {/* Link to Full Profile */}
                <div className="pt-4 border-t border-white/10">
                  <Link 
                    href={`/player/${userProfile.teamName}/${playerData.number}`}
                    className="inline-flex items-center gap-2 text-sm sm:text-base text-blue-400 hover:text-blue-300 transition font-semibold"
                  >
                    {t.viewFullProfile} →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-slate-400">
                <p className="text-sm sm:text-base">{t.noStatsAvailable}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
