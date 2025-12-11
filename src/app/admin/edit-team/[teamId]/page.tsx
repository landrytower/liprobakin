"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, deleteDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { firebaseDB, firebaseAuth, firebaseStorage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { getAdminUser } from "@/lib/adminAuth";
import type { AdminUser } from "@/types/admin";
import Image from "next/image";

type Player = {
  id: string;
  teamId: string;
  teamName: string;
  number: number;
  firstName: string;
  lastName: string;
  position: string;
  height: string;
  dateOfBirth: string;
  nationality: string;
  nationality2?: string;
  playerLicense?: string;
  headshot: string;
  stats: {
    pts: string;
    ast: string;
    reb: string;
    stl: string;
    blk: string;
    gp: string;
  };
};

type Team = {
  id: string;
  name: string;
  city: string;
  gender: string;
  colors: string[];
  logo: string;
  wins: number;
  losses: number;
  totalPoints: number;
};

export default function EditTeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [playerHeadshotFile, setPlayerHeadshotFile] = useState<File | null>(null);
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);

  const [teamForm, setTeamForm] = useState({
    name: "",
    city: "",
    gender: "",
    color1: "",
    color2: "",
    logo: "",
  });

  // Persist teamForm changes to sessionStorage
  useEffect(() => {
    if (teamId && editingTeam && teamForm.name) {
      const savedFormKey = `teamForm_${teamId}`;
      sessionStorage.setItem(savedFormKey, JSON.stringify(teamForm));
    }
  }, [teamForm, teamId, editingTeam]);

  const [newPlayerForm, setNewPlayerForm] = useState({
    firstName: "",
    lastName: "",
    number: "",
    position: "",
    height: "",
    dateOfBirth: "",
    nationality: "",
    nationality2: "",
    playerLicense: "",
    headshot: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setUser(user);
        const admin = await getAdminUser(user.uid);
        if (!admin || !admin.permissions.canManageTeams) {
          router.push("/admin");
          return;
        }
        setAdminUser(admin);
      } else {
        router.push("/admin");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Real-time listener for all teams (for navigation)
  useEffect(() => {
    if (!user || !adminUser) return;

    const teamsQuery = query(collection(firebaseDB, "teams"));
    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setAllTeams(teamsData.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, [user, adminUser]);

  useEffect(() => {
    if (user && adminUser) {
      loadData();
    }
  }, [user, adminUser, teamId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load current team
      const teamDoc = await getDoc(doc(firebaseDB, "teams", teamId));
      if (teamDoc.exists()) {
        const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
        setTeam(teamData);
        
        // Check if there's a saved editing state for this team
        const savedFormKey = `teamForm_${teamId}`;
        const savedForm = sessionStorage.getItem(savedFormKey);
        
        if (savedForm) {
          // Restore the saved form state (preserves user edits like gender toggle)
          setTeamForm(JSON.parse(savedForm));
        } else {
          // Load fresh data from database
          setTeamForm({
            name: teamData.name || "",
            city: teamData.city || "",
            gender: teamData.gender || "",
            color1: teamData.colors?.[0] || "",
            color2: teamData.colors?.[1] || "",
            logo: teamData.logo || "",
          });
        }
      }

      // Load players for this team
      const playersQuery = query(
        collection(firebaseDB, "teams", teamId as string, "roster"),
        orderBy("number", "asc")
      );
      const playersSnapshot = await getDocs(playersQuery);
      const playersData = playersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(playersData.sort((a, b) => a.number - b.number));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTeamEdit = () => {
    if (!team) return;
    // Clear saved form state and restore original data
    const savedFormKey = `teamForm_${team.id}`;
    sessionStorage.removeItem(savedFormKey);
    setTeamForm({
      name: team.name || "",
      city: team.city || "",
      gender: team.gender || "",
      color1: team.colors?.[0] || "",
      color2: team.colors?.[1] || "",
      logo: team.logo || "",
    });
    setTeamLogoFile(null);
    setEditingTeam(false);
  };

  const handleDeleteTeam = async () => {
    if (!team || !confirm(`Are you sure you want to delete ${team.name}? This will also delete all players in the roster.`)) return;
    
    try {
      setSaving(true);
      
      // Delete all players in roster
      const rosterSnapshot = await getDocs(collection(firebaseDB, "teams", team.id, "roster"));
      const deletePromises = rosterSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Delete team document
      await deleteDoc(doc(firebaseDB, "teams", team.id));
      
      alert("Team deleted successfully!");
      router.push("/admin");
    } catch (error) {
      console.error("Error deleting team:", error);
      alert("Failed to delete team. Please try again.");
      setSaving(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!team) return;
    try {
      setSaving(true);
      
      const oldTeamName = team.name;
      const newTeamName = teamForm.name;
      const teamNameChanged = oldTeamName !== newTeamName;
      
      // Upload logo if file selected
      let logoUrl = teamForm.logo;
      if (teamLogoFile) {
        const storageRefPath = ref(firebaseStorage, `team-logos/${Date.now()}_${teamLogoFile.name}`);
        await uploadBytes(storageRefPath, teamLogoFile);
        logoUrl = await getDownloadURL(storageRefPath);
      }
      
      // Update team document
      await updateDoc(doc(firebaseDB, "teams", team.id), {
        name: teamForm.name,
        city: teamForm.city,
        gender: teamForm.gender,
        colors: [teamForm.color1, teamForm.color2],
        logo: logoUrl,
      });
      
      // If team name changed, update all references
      if (teamNameChanged) {
        // Update all players in roster with new teamName
        const rosterSnapshot = await getDocs(collection(firebaseDB, "teams", team.id, "roster"));
        const rosterUpdates = rosterSnapshot.docs.map(playerDoc => 
          updateDoc(doc(firebaseDB, "teams", team.id, "roster", playerDoc.id), {
            teamName: newTeamName
          })
        );
        await Promise.all(rosterUpdates);
        
        // Update all games that reference this team
        const gamesSnapshot = await getDocs(collection(firebaseDB, "games"));
        const gameUpdates = gamesSnapshot.docs.map(async (gameDoc) => {
          const gameData = gameDoc.data();
          const updates: any = {};
          
          if (gameData.homeTeamId === team.id) {
            updates.homeTeamName = newTeamName;
          }
          if (gameData.awayTeamId === team.id) {
            updates.awayTeamName = newTeamName;
          }
          
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(firebaseDB, "games", gameDoc.id), updates);
          }
        });
        await Promise.all(gameUpdates);
      }
      
      // Clear saved form state after successful save
      const savedFormKey = `teamForm_${team.id}`;
      sessionStorage.removeItem(savedFormKey);
      
      // Reload data immediately to show changes
      await loadData();
      setEditingTeam(false);
      alert("Team updated successfully! All references have been synced.");
    } catch (error) {
      console.error("Error saving team:", error);
      alert("Error saving team. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;

    try {
      setSaving(true);

      let headshotUrl = "";
      if (playerHeadshotFile) {
        const storageRef = ref(firebaseStorage, `players/${Date.now()}_${playerHeadshotFile.name}`);
        await uploadBytes(storageRef, playerHeadshotFile);
        headshotUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(firebaseDB, "teams", team.id, "roster"), {
        number: parseInt(newPlayerForm.number),
        firstName: newPlayerForm.firstName,
        lastName: newPlayerForm.lastName,
        position: newPlayerForm.position,
        height: newPlayerForm.height,
        dateOfBirth: newPlayerForm.dateOfBirth,
        nationality: newPlayerForm.nationality,
        nationality2: newPlayerForm.nationality2 || null,
        playerLicense: newPlayerForm.playerLicense || null,
        headshot: headshotUrl,
        stats: {
          pts: 0,
          ast: 0,
          reb: 0,
          stl: 0,
          blk: 0,
          gp: 0,
        },
      });

      setNewPlayerForm({
        firstName: "",
        lastName: "",
        number: "",
        position: "",
        height: "",
        dateOfBirth: "",
        nationality: "",
        nationality2: "",
        playerLicense: "",
        headshot: "",
      });
      setPlayerHeadshotFile(null);
      setAddingPlayer(false);
      await loadData();
    } catch (error) {
      console.error("Error adding player:", error);
      alert("Error adding player");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!team || !confirm("Are you sure you want to delete this player?")) return;
    
    try {
      await deleteDoc(doc(firebaseDB, "teams", team.id, "roster", playerId));
      await loadData();
    } catch (error) {
      console.error("Error deleting player:", error);
      alert("Error deleting player");
    }
  };

  const handleSavePlayer = async (player: Player) => {
    if (!team) return;
    try {
      await updateDoc(doc(firebaseDB, "teams", team.id, "roster", player.id), player);
      await loadData();
      setEditingPlayerId(null);
    } catch (error) {
      console.error("Error saving player:", error);
    }
  };

  const navigateToTeam = (direction: "prev" | "next") => {
    const currentIndex = allTeams.findIndex((t) => t.id === teamId);
    let nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex < 0) nextIndex = allTeams.length - 1;
    if (nextIndex >= allTeams.length) nextIndex = 0;
    
    router.push(`/admin/edit-team/${allTeams[nextIndex].id}`);
  };

  if (loading || !team) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const currentTeamIndex = allTeams.findIndex((t) => t.id === teamId);

  return (
    <div className="fixed inset-0 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin")}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white transition hover:bg-white/10"
                title="Back to Admin"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {team.logo && (
                <img src={team.logo} alt={team.name} className="h-12 w-12 rounded-lg object-contain" />
              )}
              
              <div>
                <h1 className="text-2xl font-bold text-white">{team.name}</h1>
                <p className="text-sm text-slate-400">
                  {team.city} • {team.gender} • {team.wins}W - {team.losses}L
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToTeam("prev")}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <span className="text-sm text-slate-400">
                {currentTeamIndex + 1} / {allTeams.length}
              </span>
              
              <button
                onClick={() => navigateToTeam("next")}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {/* Team Details Section */}
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Team Details</h2>
            {!editingTeam && (
              <button
                onClick={() => setEditingTeam(true)}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
              >
                Edit Team
              </button>
            )}
          </div>

          {editingTeam ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Team Name</label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                <input
                  type="text"
                  value={teamForm.city}
                  onChange={(e) => setTeamForm({ ...teamForm, city: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                <select
                  value={teamForm.gender}
                  onChange={(e) => setTeamForm({ ...teamForm, gender: e.target.value })}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                >
                  <option value="Males">Males</option>
                  <option value="Females">Females</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Team Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTeamLogoFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-2 text-slate-300 text-sm"
                />
                {teamLogoFile && (
                  <p className="mt-1 text-xs text-emerald-400">✓ {teamLogoFile.name}</p>
                )}
                {!teamLogoFile && teamForm.logo && (
                  <p className="mt-1 text-xs text-slate-400">Current: {teamForm.logo.substring(0, 50)}...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={teamForm.color1}
                    onChange={(e) => setTeamForm({ ...teamForm, color1: e.target.value })}
                    className="h-12 w-20 rounded-lg border border-white/20 bg-white/5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={teamForm.color1}
                    onChange={(e) => setTeamForm({ ...teamForm, color1: e.target.value })}
                    className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={teamForm.color2}
                    onChange={(e) => setTeamForm({ ...teamForm, color2: e.target.value })}
                    className="h-12 w-20 rounded-lg border border-white/20 bg-white/5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={teamForm.color2}
                    onChange={(e) => setTeamForm({ ...teamForm, color2: e.target.value })}
                    className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2 flex gap-2 justify-between">
                <button
                  onClick={handleDeleteTeam}
                  disabled={saving}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  Delete Team
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelTeamEdit}
                    className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTeam}
                    disabled={saving}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-400">City</div>
                <div className="text-white">{team.city}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Gender</div>
                <div className="text-white">{team.gender}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Record</div>
                <div className="text-white">{team.wins}W - {team.losses}L</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Colors</div>
                <div className="flex gap-2">
                  {team.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Players Section */}
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Roster ({players.length} Players)
            </h2>
            {!addingPlayer && (
              <button
                onClick={() => setAddingPlayer(true)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                + Add Player
              </button>
            )}
          </div>

          {/* Add Player Form */}
          {addingPlayer && (
            <form onSubmit={handleAddPlayer} className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Add New Player</h3>
                <button
                  type="button"
                  onClick={() => {
                    setAddingPlayer(false);
                    setNewPlayerForm({
                      firstName: "",
                      lastName: "",
                      number: "",
                      position: "",
                      height: "",
                      dateOfBirth: "",
                      nationality: "",
                      nationality2: "",
                      playerLicense: "",
                      headshot: "",
                    });
                    setPlayerHeadshotFile(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newPlayerForm.firstName}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, firstName: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newPlayerForm.lastName}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, lastName: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Jersey # *</label>
                  <input
                    type="number"
                    value={newPlayerForm.number}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, number: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Position *</label>
                  <select
                    value={newPlayerForm.position}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, position: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    required
                  >
                    <option value="">Select position</option>
                    <option value="Point Guard">Point Guard</option>
                    <option value="Shooting Guard">Shooting Guard</option>
                    <option value="Small Forward">Small Forward</option>
                    <option value="Power Forward">Power Forward</option>
                    <option value="Center">Center</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Height</label>
                  <input
                    type="text"
                    value={newPlayerForm.height}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, height: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    placeholder="6'2&quot;"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={newPlayerForm.dateOfBirth}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, dateOfBirth: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={newPlayerForm.nationality}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, nationality: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    placeholder="USA"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Second Nationality</label>
                  <input
                    type="text"
                    value={newPlayerForm.nationality2}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, nationality2: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Player License</label>
                  <input
                    type="text"
                    value={newPlayerForm.playerLicense}
                    onChange={(e) => setNewPlayerForm({ ...newPlayerForm, playerLicense: e.target.value })}
                    className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-slate-300 mb-1">Headshot Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPlayerHeadshotFile(e.target.files?.[0] || null)}
                  className="w-full rounded border border-dashed border-white/20 bg-white/5 px-3 py-2 text-slate-300 text-xs"
                />
                {playerHeadshotFile && (
                  <p className="mt-1 text-xs text-emerald-400">✓ {playerHeadshotFile.name}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAddingPlayer(false);
                    setNewPlayerForm({
                      firstName: "",
                      lastName: "",
                      number: "",
                      position: "",
                      height: "",
                      dateOfBirth: "",
                      nationality: "",
                      nationality2: "",
                      playerLicense: "",
                      headshot: "",
                    });
                    setPlayerHeadshotFile(null);
                  }}
                  className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Player"}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {players.map((player) => {
              const isEditing = editingPlayerId === player.id;
              
              return (
                <div
                  key={player.id}
                  className="rounded-lg border border-white/10 bg-slate-800/50 p-4 transition hover:bg-slate-800/70"
                >
                  {!isEditing ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={player.headshot || "/placeholder-player.png"}
                        alt={`${player.firstName} ${player.lastName}`}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      
                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <div>
                          <div className="text-xs text-slate-400">Number</div>
                          <div className="text-lg font-bold text-white">#{player.number}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Name</div>
                          <div className="text-white">{player.firstName} {player.lastName}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Position</div>
                          <div className="text-white">{player.position}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Height</div>
                          <div className="text-white">{player.height}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Nationality</div>
                          <div className="text-white">{player.nationality}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-center">
                        <div>
                          <div className="text-xs text-slate-400">PPG</div>
                          <div className="text-white font-medium">{player.stats.pts}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">RPG</div>
                          <div className="text-white font-medium">{player.stats.reb}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">APG</div>
                          <div className="text-white font-medium">{player.stats.ast}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">SPG</div>
                          <div className="text-white font-medium">{player.stats.stl}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">BPG</div>
                          <div className="text-white font-medium">{player.stats.blk}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingPlayerId(player.id)}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PlayerEditForm
                      player={player}
                      onSave={handleSavePlayer}
                      onCancel={() => setEditingPlayerId(null)}
                    />
                  )}
                </div>
              );
            })}

            {players.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                No players found for this team
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerEditForm({
  player,
  onSave,
  onCancel,
}: {
  player: Player;
  onSave: (player: Player) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(player);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Jersey #</label>
          <input
            type="number"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: parseInt(e.target.value) })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">First Name</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Last Name</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Position</label>
          <input
            type="text"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Height</label>
          <input
            type="text"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date of Birth</label>
          <input
            type="text"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nationality</label>
          <input
            type="text"
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Headshot URL</label>
          <input
            type="text"
            value={form.headshot}
            onChange={(e) => setForm({ ...form, headshot: e.target.value })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">PPG</label>
          <input
            type="text"
            value={form.stats.pts}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, pts: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">RPG</label>
          <input
            type="text"
            value={form.stats.reb}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, reb: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">APG</label>
          <input
            type="text"
            value={form.stats.ast}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, ast: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">SPG</label>
          <input
            type="text"
            value={form.stats.stl}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, stl: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">BPG</label>
          <input
            type="text"
            value={form.stats.blk}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, blk: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">GP</label>
          <input
            type="text"
            value={form.stats.gp}
            onChange={(e) => setForm({ ...form, stats: { ...form.stats, gp: e.target.value } })}
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Save Player
        </button>
      </div>
    </div>
  );
}
