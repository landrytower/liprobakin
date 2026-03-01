"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAdmin } from "../layout";
import { firebaseDB, firebaseStorage, firebaseAuth } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithEmailAndPassword } from "firebase/auth";
import { logAuditAction } from "@/lib/auditLog";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Team = {
  id: string;
  name: string;
  city?: string;
  gender: "men" | "women";
  colors?: string[];
  logo?: string;
  wins: number;
  losses: number;
  totalPoints?: number;
  venue?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Teams",
    subtitle: "Create teams, import logos, manage rosters and organize franchise directory.",
    manageTeams: "Manage Teams & Rosters",
    addTeam: "Add a Team",
    teamManagement: "Team Management",
    teamsSaved: "teams saved",
    clickToEdit: "Click on a team to open the editor",
    men: "Men",
    women: "Women",
    searchTeams: "Search teams...",
    noTeams: "No teams found",
    record: "Record",
    createTeam: "Create Team",
    teamName: "Team Name",
    gender: "Gender / Category",
    colors: "Team Colors",
    logo: "Logo",
    clear: "Clear",
    creating: "Creating...",
    cancel: "Cancel",
    deleteTeam: "Delete Team",
    confirmDelete: "Are you sure you want to delete this team? This cannot be undone.",
    deleting: "Deleting...",
    statsReset: "Stats Reset",
    statsResetDesc: "Reset or modify player and team statistics for the new season.",
    resetAllStats: "Reset All Stats",
    resetTeamStats: "Reset Team Stats",
    resetPlayerStats: "Reset Player Stats",
    adjustPlayerStats: "Adjust Player Stats",
    saveAdjustedStats: "Save Adjustments",
    quickTeamReset: "Team Reset",
    quickPlayerTools: "Player Tools",
    selectTeam: "Select Team",
    selectPlayer: "Select Player",
    resetting: "Resetting...",
    resetCompleteAll: "Reset complete! All stats reset to 0.",
    resetCompleteTeam: "Team stats reset successfully.",
    resetCompletePlayer: "Player stats reset successfully.",
    confirmPassword: "Confirm Password",
    enterPasswordToConfirm: "For security, please enter your admin password to confirm this action.",
    passwordPlaceholder: "Enter your password",
    verify: "Verify & Reset",
    verifying: "Verifying...",
    incorrectPassword: "Incorrect password",
    passwordRequired: "Please enter your password",
  },
  fr: {
    title: "Équipes",
    subtitle: "Créer des équipes, importer des logos, gérer les effectifs et organiser le répertoire des franchises.",
    manageTeams: "Gérer les équipes et les effectifs",
    addTeam: "Ajouter une équipe",
    teamManagement: "Gestion d'équipe",
    teamsSaved: "sauvegardes",
    clickToEdit: "Cliquez sur une équipe pour ouvrir l'éditeur",
    men: "Hommes",
    women: "Femmes",
    searchTeams: "Rechercher équipes...",
    noTeams: "Aucune équipe trouvée",
    record: "Bilan",
    createTeam: "Créer équipe",
    teamName: "Nom de l'équipe",
    gender: "Genre / Catégorie",
    colors: "Couleurs de l'équipe",
    logo: "Logo",
    clear: "Effacer",
    creating: "Création...",
    cancel: "Annuler",
    deleteTeam: "Supprimer l'équipe",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer cette équipe? Cette action est irréversible.",
    deleting: "Suppression...",
    statsReset: "Réinitialisation des Stats",
    statsResetDesc: "Réinitialisez ou modifiez les statistiques des joueurs et des équipes pour la nouvelle saison.",
    resetAllStats: "Réinitialiser toutes les stats",
    resetTeamStats: "Réinitialiser une équipe",
    resetPlayerStats: "Réinitialiser un joueur",
    adjustPlayerStats: "Ajuster les stats joueur",
    saveAdjustedStats: "Enregistrer les ajustements",
    quickTeamReset: "Reset équipe",
    quickPlayerTools: "Outils joueur",
    selectTeam: "Sélectionner équipe",
    selectPlayer: "Sélectionner joueur",
    resetting: "Réinitialisation...",
    resetCompleteAll: "Réinitialisation terminée! Toutes les stats ont été remises à 0.",
    resetCompleteTeam: "Stats de l'équipe réinitialisées avec succès.",
    resetCompletePlayer: "Stats du joueur réinitialisées avec succès.",
    confirmPassword: "Confirmer le mot de passe",
    enterPasswordToConfirm: "Pour plus de sécurité, veuillez entrer votre mot de passe administrateur pour confirmer cette action.",
    passwordPlaceholder: "Entrez votre mot de passe",
    verify: "Vérifier et réinitialiser",
    verifying: "Vérification...",
    incorrectPassword: "Mot de passe incorrect",
    passwordRequired: "Veuillez entrer votre mot de passe",
  },
};

export default function TeamsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"men" | "women">("men");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Add team form state
  const [newTeamForm, setNewTeamForm] = useState({
    name: "",
    gender: "men" as "men" | "women",
    colorsInput: "#38bdf8, #a855f7",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Stats reset state
  const [statsResetOpen, setStatsResetOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<"all" | "team" | "player" | "adjust">("all");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [teamRoster, setTeamRoster] = useState<{ id: string; firstName: string; lastName: string; number: number | null }[]>([]);
  const [playerStatsForm, setPlayerStatsForm] = useState({
    pts: "0.0",
    reb: "0.0",
    ast: "0.0",
    stl: "0.0",
    blk: "0.0",
    gamesPlayed: "0",
  });
  const [resetting, setResetting] = useState(false);
  
  // Password verification modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firebaseDB, "teams"), orderBy("name", "asc")));
      
      // Fetch all games to calculate live records
      const gamesSnap = await getDocs(collection(firebaseDB, "games"));
      const gameRecords = new Map<string, { wins: number; losses: number }>();
      
      // Calculate wins/losses from actual games
      gamesSnap.docs.forEach((gameDoc) => {
        const game = gameDoc.data();
        if (game.winnerTeamId && game.loserTeamId) {
          const winnerRecord = gameRecords.get(game.winnerTeamId) || { wins: 0, losses: 0 };
          winnerRecord.wins++;
          gameRecords.set(game.winnerTeamId, winnerRecord);
          
          const loserRecord = gameRecords.get(game.loserTeamId) || { wins: 0, losses: 0 };
          loserRecord.losses++;
          gameRecords.set(game.loserTeamId, loserRecord);
        }
      });
      
      setTeams(
        snap.docs.map((d) => {
          const data = d.data();
          const record = gameRecords.get(d.id) || { wins: 0, losses: 0 };
          return {
            id: d.id,
            name: data.name || "",
            city: data.city || "",
            gender: normalizeTeamGender(data.gender, data.logo, "men"),
            colors: data.colors || [],
            logo: data.logo || "",
            wins: record.wins,
            losses: record.losses,
            totalPoints: data.totalPoints || 0,
            venue: data.venue || "",
          } as Team;
        })
      );
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Filter teams by gender and search
  const filteredTeams = teams.filter((team) => {
    const matchesGender = team.gender === genderFilter;
    const matchesSearch =
      searchQuery.trim() === "" || team.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGender && matchesSearch;
  });

  // Handle logo file change
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setLogoFile(f);
      setLogoPreview(URL.createObjectURL(f));
    }
  };

  // Clear logo selection
  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
  };

  // Create new team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamForm.name.trim()) {
      setStatus({ type: "error", message: "Team name is required" });
      return;
    }

    setSaving(true);
    setStatus({ type: "info", message: "Creating team..." });

    try {
      let logoUrl = "";
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const fileName = `team-logos/${newTeamForm.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${ext}`;
        const logoRef = storageRef(firebaseStorage, fileName);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      const colors = newTeamForm.colorsInput
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      await addDoc(collection(firebaseDB, "teams"), {
        name: newTeamForm.name.trim(),
        gender: newTeamForm.gender,
        colors,
        logo: logoUrl,
        wins: 0,
        losses: 0,
        totalPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logAuditAction(
        "team_created", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "team", 
        newTeamForm.name.trim(), 
        newTeamForm.name.trim(), 
        {
          gender: newTeamForm.gender,
          hasLogo: !!logoUrl,
          colors: colors.join(", "),
        }
      );

      setStatus({ type: "success", message: `Team "${newTeamForm.name}" created!` });
      setNewTeamForm({ name: "", gender: "men", colorsInput: "#38bdf8, #a855f7" });
      setLogoFile(null);
      setLogoPreview("");
      setShowAddForm(false);
      fetchTeams();
    } catch (error) {
      console.error("Error creating team:", error);
      setStatus({ type: "error", message: "Failed to create team" });
    } finally {
      setSaving(false);
    }
  };

  // Load roster when team selected for stats reset
  const handleSelectTeamForReset = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedPlayerId("");
    setTeamRoster([]);
    setPlayerStatsForm({ pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0", gamesPlayed: "0" });

    if (teamId) {
      try {
        const rosterSnap = await getDocs(collection(firebaseDB, `teams/${teamId}/roster`));
        const players = rosterSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            number: data.number ?? null,
          };
        });
        setTeamRoster(players);
      } catch (error) {
        console.error("Error loading roster:", error);
      }
    }
  };

  useEffect(() => {
    const loadSelectedPlayerStats = async () => {
      if (!selectedTeamId || !selectedPlayerId) {
        setPlayerStatsForm({ pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0", gamesPlayed: "0" });
        return;
      }

      try {
        const playerRef = doc(firebaseDB, `teams/${selectedTeamId}/roster/${selectedPlayerId}`);
        const playerSnap = await getDoc(playerRef);
        if (!playerSnap.exists()) return;
        const data = playerSnap.data();
        const stats = data.stats || {};
        setPlayerStatsForm({
          pts: String(stats.pts ?? "0.0"),
          reb: String(stats.reb ?? "0.0"),
          ast: String(stats.ast ?? "0.0"),
          stl: String(stats.stl ?? "0.0"),
          blk: String(stats.blk ?? "0.0"),
          gamesPlayed: String(data.gamesPlayed ?? "0"),
        });
      } catch (error) {
        console.error("Error loading selected player stats:", error);
      }
    };

    loadSelectedPlayerStats();
  }, [selectedTeamId, selectedPlayerId]);

  // Show password modal before reset
  const handleResetAllStats = async () => {
    if (!window.confirm("⚠️ This will delete ALL games and reset ALL team/player stats to 0. Are you sure?")) {
      return;
    }
    setShowPasswordModal(true);
  };

  // Verify password and perform reset
  const verifyPasswordAndReset = async () => {
    if (!currentAdminUser?.email || !passwordInput) {
      setPasswordError(language === "fr" ? "Veuillez entrer votre mot de passe" : "Please enter your password");
      return;
    }

    setVerifyingPassword(true);
    setPasswordError("");

    try {
      // Verify password by attempting to sign in
      await signInWithEmailAndPassword(firebaseAuth, currentAdminUser.email, passwordInput);
      
      // Password verified, close modal and proceed with reset
      setShowPasswordModal(false);
      setPasswordInput("");
      
      // Perform the actual reset
      await performStatsReset();
    } catch (error: unknown) {
      console.error("Password verification failed:", error);
      setPasswordError(
        language === "fr" 
          ? "Mot de passe incorrect" 
          : "Incorrect password"
      );
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Actual reset logic
  const performStatsReset = async () => {
    setResetting(true);
    setStatus({ type: "info", message: "Resetting all stats..." });

    try {
      // Delete all games
      const gamesSnap = await getDocs(collection(firebaseDB, "games"));
      await Promise.all(gamesSnap.docs.map((d) => deleteDoc(d.ref)));

      // Delete standings
      const standingsSnap = await getDocs(collection(firebaseDB, "standings"));
      await Promise.all(standingsSnap.docs.map((d) => deleteDoc(d.ref)));

      // Reset all teams and their rosters
      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
      await Promise.all(
        teamsSnap.docs.map(async (teamDoc) => {
          await updateDoc(teamDoc.ref, { wins: 0, losses: 0, totalPoints: 0, updatedAt: serverTimestamp() });
          const rosterSnap = await getDocs(collection(firebaseDB, `teams/${teamDoc.id}/roster`));
          await Promise.all(
            rosterSnap.docs.map((playerDoc) =>
              updateDoc(playerDoc.ref, {
                stats: { pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0" },
                gamesPlayed: 0,
                updatedAt: serverTimestamp(),
              })
            )
          );
        })
      );

      await logAuditAction(
        "all_stats_reset", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "system", 
        "all", 
        "Full Database Reset", 
        {
          gamesDeleted: gamesSnap.docs.length,
          teamsReset: teamsSnap.docs.length,
        }
      );

      setStatus({ type: "success", message: `✓ ${copy.resetCompleteAll} Deleted ${gamesSnap.docs.length} games, reset ${teamsSnap.docs.length} teams.` });
      fetchTeams();
    } catch (error) {
      console.error("Error resetting stats:", error);
      setStatus({ type: "error", message: "Failed to reset stats" });
    } finally {
      setResetting(false);
    }
  };

  // Reset team stats
  const handleResetTeamStats = async () => {
    if (!selectedTeamId) return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!window.confirm(`⚠️ Reset all player stats for ${team?.name}?`)) return;

    setResetting(true);
    setStatus({ type: "info", message: "Resetting team stats..." });

    try {
      await updateDoc(doc(firebaseDB, `teams/${selectedTeamId}`), {
        wins: 0,
        losses: 0,
        totalPoints: 0,
        updatedAt: serverTimestamp(),
      });

      const rosterSnap = await getDocs(collection(firebaseDB, `teams/${selectedTeamId}/roster`));
      await Promise.all(
        rosterSnap.docs.map((playerDoc) =>
          updateDoc(playerDoc.ref, {
            stats: { pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0" },
            gamesPlayed: 0,
            updatedAt: serverTimestamp(),
          })
        )
      );

      await logAuditAction(
        "team_stats_reset", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "team", 
        selectedTeamId, 
        team?.name || "Unknown", 
        {
          playersReset: rosterSnap.docs.length,
        }
      );

      setStatus({ type: "success", message: `✓ ${copy.resetCompleteTeam} (${rosterSnap.docs.length} players)` });
      await handleSelectTeamForReset(selectedTeamId);
      fetchTeams();
    } catch (error) {
      console.error("Error resetting team stats:", error);
      setStatus({ type: "error", message: "Failed to reset team stats" });
    } finally {
      setResetting(false);
    }
  };

  // Reset player stats
  const handleResetPlayerStats = async () => {
    if (!selectedTeamId || !selectedPlayerId) return;
    const player = teamRoster.find((p) => p.id === selectedPlayerId);
    if (!window.confirm(`⚠️ Reset stats for ${player?.firstName} ${player?.lastName}?`)) return;

    setResetting(true);
    setStatus({ type: "info", message: "Resetting player stats..." });

    try {
      await updateDoc(doc(firebaseDB, `teams/${selectedTeamId}/roster/${selectedPlayerId}`), {
        stats: { pts: "0.0", reb: "0.0", ast: "0.0", stl: "0.0", blk: "0.0" },
        gamesPlayed: 0,
        updatedAt: serverTimestamp(),
      });

      await logAuditAction(
        "player_stats_reset", 
        currentAdminUser?.id || "unknown", 
        currentAdminUser?.email || "unknown", 
        "player", 
        selectedPlayerId, 
        player ? `${player.firstName} ${player.lastName}` : "Unknown", 
        {
          teamName: teams.find(t => t.id === selectedTeamId)?.name,
          jerseyNumber: player?.number,
        }
      );

      setStatus({ type: "success", message: `✓ ${copy.resetCompletePlayer}` });
      setSelectedPlayerId("");
    } catch (error) {
      console.error("Error resetting player stats:", error);
      setStatus({ type: "error", message: "Failed to reset player stats" });
    } finally {
      setResetting(false);
    }
  };

  const handleAdjustPlayerStats = async () => {
    if (!selectedTeamId || !selectedPlayerId) return;

    const player = teamRoster.find((p) => p.id === selectedPlayerId);
    if (!window.confirm(`⚠️ Save adjusted stats for ${player?.firstName} ${player?.lastName}?`)) return;

    const normalizeStat = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed.toFixed(1) : "0.0";
    };

    const gamesPlayed = Number.parseInt(playerStatsForm.gamesPlayed, 10);
    const safeGamesPlayed = Number.isFinite(gamesPlayed) && gamesPlayed >= 0 ? gamesPlayed : 0;

    setResetting(true);
    setStatus({ type: "info", message: "Updating player stats..." });

    try {
      await updateDoc(doc(firebaseDB, `teams/${selectedTeamId}/roster/${selectedPlayerId}`), {
        stats: {
          pts: normalizeStat(playerStatsForm.pts),
          reb: normalizeStat(playerStatsForm.reb),
          ast: normalizeStat(playerStatsForm.ast),
          stl: normalizeStat(playerStatsForm.stl),
          blk: normalizeStat(playerStatsForm.blk),
        },
        gamesPlayed: safeGamesPlayed,
        updatedAt: serverTimestamp(),
      });

      await logAuditAction(
        "player_stats_modified",
        currentAdminUser?.id || "unknown",
        currentAdminUser?.email || "unknown",
        "player",
        selectedPlayerId,
        player ? `${player.firstName} ${player.lastName}` : "Unknown",
        {
          teamName: teams.find(t => t.id === selectedTeamId)?.name,
          stats: {
            pts: normalizeStat(playerStatsForm.pts),
            reb: normalizeStat(playerStatsForm.reb),
            ast: normalizeStat(playerStatsForm.ast),
            stl: normalizeStat(playerStatsForm.stl),
            blk: normalizeStat(playerStatsForm.blk),
            gamesPlayed: safeGamesPlayed,
          },
        }
      );

      setStatus({ type: "success", message: "✓ Player stats updated successfully." });
    } catch (error) {
      console.error("Error adjusting player stats:", error);
      setStatus({ type: "error", message: "Failed to update player stats" });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">🏀 {copy.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{copy.subtitle}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-full border border-cyan-400/60 bg-cyan-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-cyan-100 transition hover:bg-cyan-500/30"
        >
          {copy.addTeam}
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            status.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : status.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-blue-500/30 bg-blue-500/10 text-blue-200"
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Add Team Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTeam}
          className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">{copy.createTeam}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-slate-300">
              {copy.teamName}
              <input
                type="text"
                value={newTeamForm.name}
                onChange={(e) => setNewTeamForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                placeholder="New Gen"
                required
              />
            </label>
            <label className="block text-xs text-slate-300">
              {copy.gender}
              <select
                value={newTeamForm.gender}
                onChange={(e) => setNewTeamForm((f) => ({ ...f, gender: e.target.value as "men" | "women" }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="men">{copy.men}</option>
                <option value="women">{copy.women}</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-300">
            {copy.colors}
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                value={newTeamForm.colorsInput.split(",")[0]?.trim() || "#38bdf8"}
                onChange={(e) => {
                  const cols = newTeamForm.colorsInput.split(",").map((c) => c.trim());
                  cols[0] = e.target.value;
                  setNewTeamForm((f) => ({ ...f, colorsInput: cols.join(", ") }));
                }}
                className="h-10 w-16 cursor-pointer rounded-xl border border-white/10 bg-slate-800"
              />
              <input
                type="color"
                value={newTeamForm.colorsInput.split(",")[1]?.trim() || "#a855f7"}
                onChange={(e) => {
                  const cols = newTeamForm.colorsInput.split(",").map((c) => c.trim());
                  cols[1] = e.target.value;
                  setNewTeamForm((f) => ({ ...f, colorsInput: cols.join(", ") }));
                }}
                className="h-10 w-16 cursor-pointer rounded-xl border border-white/10 bg-slate-800"
              />
              <input
                type="text"
                value={newTeamForm.colorsInput}
                onChange={(e) => setNewTeamForm((f) => ({ ...f, colorsInput: e.target.value }))}
                className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </label>
          <label className="block text-xs text-slate-300">
            {copy.logo}
            <div className="mt-1 flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="flex-1 rounded-xl border border-dashed border-white/20 bg-slate-800 px-3 py-2 text-xs text-slate-300"
              />
              {logoPreview && (
                <>
                  <div className="relative h-12 w-12 rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                    <Image src={logoPreview} alt="Logo preview" fill className="object-contain p-1" unoptimized />
                  </div>
                  <button type="button" onClick={clearLogo} className="text-xs text-slate-400 hover:text-white">
                    {copy.clear}
                  </button>
                </>
              )}
            </div>
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {saving ? copy.creating : copy.createTeam}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-full border border-white/10 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 hover:bg-white/5"
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Teams Grid */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{copy.teamManagement}</p>
            <p className="text-sm text-slate-500">
              {teams.length} {copy.teamsSaved} · {copy.clickToEdit}
            </p>
          </div>
          {/* Gender filter tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setGenderFilter("men")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                genderFilter === "men"
                  ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              {copy.men}
            </button>
            <button
              onClick={() => setGenderFilter("women")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                genderFilter === "women"
                  ? "bg-pink-500/30 text-pink-200 border border-pink-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              {copy.women}
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={copy.searchTeams}
          className="mb-6 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500"
        />

        {/* Teams Grid */}
        {filteredTeams.length === 0 ? (
          <p className="text-center text-slate-500 py-8">{copy.noTeams}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 p-3 text-center transition hover:border-cyan-500/50 hover:bg-slate-800"
              >
                <Link href={`/admin/edit-team/${team.id}`} className="block">
                  <div className="relative mx-auto mb-3 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {team.logo ? (
                      <Image
                        src={team.logo}
                        alt={team.name}
                        fill
                        className="object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🏀</div>
                    )}
                  </div>
                  <h3 className="truncate text-sm font-semibold text-white">{team.name}</h3>
                  <p className="text-xs text-slate-500">{team.wins}-{team.losses}</p>
                </Link>

                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={async (event) => {
                      event.preventDefault();
                      setStatsResetOpen(true);
                      setStatsTab("team");
                      await handleSelectTeamForReset(team.id);
                    }}
                    className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-200 transition hover:bg-orange-500/20"
                  >
                    {copy.quickTeamReset}
                  </button>
                  <button
                    type="button"
                    onClick={async (event) => {
                      event.preventDefault();
                      setStatsResetOpen(true);
                      setStatsTab("adjust");
                      await handleSelectTeamForReset(team.id);
                    }}
                    className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-100 transition hover:bg-yellow-500/20"
                  >
                    {copy.quickPlayerTools}
                  </button>
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Reset Section */}
      <button
        type="button"
        onClick={() => setStatsResetOpen(!statsResetOpen)}
        className="group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-rose-600/20 to-orange-600/20 p-6 text-left shadow-xl transition hover:border-white/30"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">MODULE</p>
            <h2 className="mt-2 text-xl font-bold text-white">📊 {copy.statsReset}</h2>
            <p className="mt-1 text-sm text-slate-300">{copy.statsResetDesc}</p>
          </div>
          <span className="text-2xl text-white">{statsResetOpen ? "−" : "+"}</span>
        </div>
      </button>

      {statsResetOpen && (
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-6">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setStatsTab("all")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                statsTab === "all"
                  ? "bg-rose-500/30 text-rose-200 border border-rose-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              🔄 {copy.resetAllStats}
            </button>
            <button
              type="button"
              onClick={() => setStatsTab("team")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                statsTab === "team"
                  ? "bg-orange-500/30 text-orange-200 border border-orange-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              👥 {copy.resetTeamStats}
            </button>
            <button
              type="button"
              onClick={() => setStatsTab("player")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                statsTab === "player"
                  ? "bg-yellow-500/30 text-yellow-200 border border-yellow-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              👤 {copy.resetPlayerStats}
            </button>
            <button
              type="button"
              onClick={() => setStatsTab("adjust")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                statsTab === "adjust"
                  ? "bg-cyan-500/30 text-cyan-100 border border-cyan-500/50"
                  : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
              }`}
            >
              ✏️ {copy.adjustPlayerStats}
            </button>
          </div>

          {/* Reset All Tab */}
          {statsTab === "all" && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-2xl">
                  ⚠️
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-rose-200">
                    {language === "fr" ? "Réinitialisation complète de la saison" : "Complete Season Reset"}
                  </h3>
                  <p className="mt-2 text-sm text-rose-300/80">
                    {language === "fr"
                      ? "Cette action supprimera TOUS les matchs et réinitialisera les stats de tous les joueurs à 0."
                      : "This will delete ALL games and reset all player stats to 0."}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetAllStats}
                    disabled={resetting}
                    className="mt-4 rounded-full border border-rose-400/60 bg-rose-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                  >
                    {resetting ? copy.resetting : copy.resetAllStats}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Team Tab */}
          {statsTab === "team" && (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-orange-200">{copy.resetTeamStats}</h3>
              <label className="block text-xs text-slate-300">
                {copy.selectTeam}
                <select
                  value={selectedTeamId}
                  onChange={(e) => handleSelectTeamForReset(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">-- {copy.selectTeam} --</option>
                  {teams
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.gender === "men" ? copy.men : copy.women})
                      </option>
                    ))}
                </select>
              </label>
              {selectedTeamId && teamRoster.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-400 mb-2">
                    {language === "fr" ? "Joueurs:" : "Players:"} <span className="text-white font-semibold">{teamRoster.length}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {teamRoster.map((p) => (
                      <span key={p.id} className="inline-flex rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                        #{p.number || "?"} {p.firstName} {p.lastName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleResetTeamStats}
                disabled={resetting || !selectedTeamId}
                className="rounded-full border border-orange-400/60 bg-orange-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-orange-100 transition disabled:opacity-50"
              >
                {resetting ? copy.resetting : copy.resetTeamStats}
              </button>
            </div>
          )}

          {/* Reset Player Tab */}
          {statsTab === "player" && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-yellow-200">{copy.resetPlayerStats}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-300">
                  {copy.selectTeam}
                  <select
                    value={selectedTeamId}
                    onChange={(e) => handleSelectTeamForReset(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">-- {copy.selectTeam} --</option>
                    {teams
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.gender === "men" ? copy.men : copy.women})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  {copy.selectPlayer}
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    disabled={!selectedTeamId}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">-- {copy.selectPlayer} --</option>
                    {teamRoster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.number || "?"} {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={handleResetPlayerStats}
                disabled={resetting || !selectedPlayerId}
                className="rounded-full border border-yellow-400/60 bg-yellow-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-yellow-100 transition disabled:opacity-50"
              >
                {resetting ? copy.resetting : copy.resetPlayerStats}
              </button>
            </div>
          )}

          {statsTab === "adjust" && (
            <div className="space-y-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-6">
              <h3 className="text-lg font-semibold text-cyan-100">{copy.adjustPlayerStats}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-300">
                  {copy.selectTeam}
                  <select
                    value={selectedTeamId}
                    onChange={(e) => handleSelectTeamForReset(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">-- {copy.selectTeam} --</option>
                    {teams
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.gender === "men" ? copy.men : copy.women})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  {copy.selectPlayer}
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    disabled={!selectedTeamId}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">-- {copy.selectPlayer} --</option>
                    {teamRoster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.number || "?"} {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { key: "pts", label: "PTS" },
                  { key: "reb", label: "REB" },
                  { key: "ast", label: "AST" },
                  { key: "stl", label: "STL" },
                  { key: "blk", label: "BLK" },
                  { key: "gamesPlayed", label: "GP" },
                ].map((item) => (
                  <label key={item.key} className="block text-xs text-slate-300">
                    {item.label}
                    <input
                      type="number"
                      step={item.key === "gamesPlayed" ? "1" : "0.1"}
                      min="0"
                      value={playerStatsForm[item.key as keyof typeof playerStatsForm]}
                      onChange={(e) =>
                        setPlayerStatsForm((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      disabled={!selectedPlayerId}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAdjustPlayerStats}
                disabled={resetting || !selectedPlayerId}
                className="rounded-full border border-cyan-400/60 bg-cyan-500/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-cyan-100 transition disabled:opacity-50"
              >
                {resetting ? copy.resetting : copy.saveAdjustedStats}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-2xl">
                🔒
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{copy.confirmPassword}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {copy.enterPasswordToConfirm}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !verifyingPassword) {
                      verifyPasswordAndReset();
                    }
                  }}
                  placeholder={copy.passwordPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-2 text-sm text-red-400">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput("");
                    setPasswordError("");
                  }}
                  disabled={verifyingPassword}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={verifyPasswordAndReset}
                  disabled={verifyingPassword || !passwordInput}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {verifyingPassword ? copy.verifying : copy.verify}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
