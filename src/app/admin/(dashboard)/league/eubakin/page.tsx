"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "../../layout";
import { firebaseDB } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { logAuditAction } from "@/lib/auditLog";

type EubakinConference = "west" | "east";
type EubakinGender = "men" | "women";

type EubakinTeam = {
  id: string;
  name: string;
  conference: EubakinConference;
  gender: EubakinGender;
  wins?: number;
  losses?: number;
  createdAt?: Date | null;
};

type EubakinGame = {
  id: string;
  conference: EubakinConference;
  gender: EubakinGender;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  gameDate: string;
  gameTime: string;
  homeScore?: number;
  awayScore?: number;
  status?: "scheduled" | "final";
};

const copy = {
  en: {
    title: "EUBAKIN Teams",
    subtitle: "Add teams by conference and category so they appear on the main EUBAKIN page.",
    back: "← Back to League",
    setupTitle: "Setup Actions",
    actionAddTeam: "Add Team",
    actionAddTeamDesc: "Pick conference + category, then create a team.",
    actionScheduleGame: "Schedule a Game",
    actionScheduleGameDesc: "Pick conference + category, then schedule a matchup.",
    actionScoreGame: "Record Score",
    actionScoreGameDesc: "Select a scheduled game and save the final score.",
    addTeam: "Add Team",
    teamName: "Team name",
    scheduleGame: "Schedule Game",
    date: "Date",
    time: "Time",
    homeTeam: "Home team",
    awayTeam: "Away team",
    saveGame: "Save game",
    scoreGame: "Record Game Score",
    game: "Game",
    homeScore: "Home score",
    awayScore: "Away score",
    saveScore: "Save score",
    scoreSaved: "Score saved successfully.",
    requiredScoreFields: "Please select a game and enter both scores.",
    noScheduledGames: "No scheduled games available.",
    gameSaved: "Game scheduled successfully.",
    selectTeam: "Select team",
    teamsMustDiffer: "Home and away teams must be different.",
    requiredGameFields: "Please complete conference, category, date, time, and both teams.",
    upcomingGames: "Scheduled games",
    noGames: "No games scheduled yet.",
    conference: "Conference",
    gender: "Category",
    west: "West",
    east: "East",
    men: "Men",
    women: "Women",
    save: "Save team",
    saving: "Saving...",
    chooseConference: "Choose conference",
    chooseGender: "Choose category",
    addedTeams: "Added teams",
    noTeams: "No EUBAKIN teams yet.",
    delete: "Delete",
    confirmDelete: "Delete this EUBAKIN team?",
    requiredName: "Team name is required.",
    created: "Team added successfully.",
    deleted: "Team deleted.",
    failed: "Action failed. Please try again.",
    all: "All",
    accessDeniedTitle: "Access denied",
    accessDeniedDesc: "You don't have permission to manage EUBAKIN.",
  },
  fr: {
    title: "Équipes EUBAKIN",
    subtitle: "Ajoutez des équipes par conférence et catégorie pour qu'elles apparaissent sur la page principale EUBAKIN.",
    back: "← Retour Ligue",
    setupTitle: "Actions de configuration",
    actionAddTeam: "Ajouter une équipe",
    actionAddTeamDesc: "Choisissez conférence + catégorie, puis créez l'équipe.",
    actionScheduleGame: "Programmer un match",
    actionScheduleGameDesc: "Choisissez conférence + catégorie, puis programmez l'affiche.",
    actionScoreGame: "Enregistrer score",
    actionScoreGameDesc: "Choisissez un match programmé puis enregistrez le score final.",
    addTeam: "Ajouter une équipe",
    teamName: "Nom de l'équipe",
    scheduleGame: "Programmer un match",
    date: "Date",
    time: "Heure",
    homeTeam: "Équipe domicile",
    awayTeam: "Équipe extérieure",
    saveGame: "Enregistrer le match",
    scoreGame: "Enregistrer le score",
    game: "Match",
    homeScore: "Score domicile",
    awayScore: "Score extérieur",
    saveScore: "Enregistrer score",
    scoreSaved: "Score enregistré avec succès.",
    requiredScoreFields: "Veuillez choisir un match et saisir les deux scores.",
    noScheduledGames: "Aucun match programmé disponible.",
    gameSaved: "Match programmé avec succès.",
    selectTeam: "Sélectionner équipe",
    teamsMustDiffer: "Les équipes domicile et extérieure doivent être différentes.",
    requiredGameFields: "Veuillez compléter conférence, catégorie, date, heure et les deux équipes.",
    upcomingGames: "Matchs programmés",
    noGames: "Aucun match programmé pour le moment.",
    conference: "Conférence",
    gender: "Catégorie",
    west: "Ouest",
    east: "Est",
    men: "Messieur",
    women: "Dames",
    save: "Enregistrer l'équipe",
    saving: "Enregistrement...",
    chooseConference: "Choisir conférence",
    chooseGender: "Choisir catégorie",
    addedTeams: "Équipes ajoutées",
    noTeams: "Aucune équipe EUBAKIN pour le moment.",
    delete: "Supprimer",
    confirmDelete: "Supprimer cette équipe EUBAKIN ?",
    requiredName: "Le nom de l'équipe est requis.",
    created: "Équipe ajoutée avec succès.",
    deleted: "Équipe supprimée.",
    failed: "Action échouée. Veuillez réessayer.",
    all: "Toutes",
    accessDeniedTitle: "Accès refusé",
    accessDeniedDesc: "Vous n'avez pas la permission de gérer EUBAKIN.",
  },
};

export default function EubakinLeaguePage() {
  const { language, currentAdminUser } = useAdmin();
  const t = copy[language];
  const hasEubakinAccess =
    currentAdminUser?.permissions?.canManageEubakin || currentAdminUser?.roles?.includes("master");

  const [teams, setTeams] = useState<EubakinTeam[]>([]);
  const [games, setGames] = useState<EubakinGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingGame, setSavingGame] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [activeAction, setActiveAction] = useState<"team" | "game" | "score">("team");

  const [conferenceFilter, setConferenceFilter] = useState<"all" | EubakinConference>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | EubakinGender>("all");

  const [form, setForm] = useState({
    name: "",
    conference: "west" as EubakinConference,
    gender: "men" as EubakinGender,
  });

  const [gameForm, setGameForm] = useState({
    conference: "west" as EubakinConference,
    gender: "men" as EubakinGender,
    gameDate: "",
    gameTime: "",
    homeTeamId: "",
    awayTeamId: "",
  });

  const [scoreForm, setScoreForm] = useState({
    gameId: "",
    homeScore: "",
    awayScore: "",
  });

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firebaseDB, "eubakinTeams"), orderBy("name", "asc")));
      setTeams(
        snap.docs.map((item) => ({
          id: item.id,
          name: item.data().name || "",
          conference: (item.data().conference || "west") as EubakinConference,
          gender: (item.data().gender || "men") as EubakinGender,
          wins: typeof item.data().wins === "number" ? item.data().wins : 0,
          losses: typeof item.data().losses === "number" ? item.data().losses : 0,
          createdAt: item.data().createdAt?.toDate() || null,
        }))
      );
    } catch (error) {
      console.error("Error loading EUBAKIN teams", error);
      setStatus({ type: "error", message: t.failed });
    } finally {
      setLoading(false);
    }
  }, [t.failed]);

  useEffect(() => {
    if (!hasEubakinAccess) {
      setLoading(false);
      return;
    }
    fetchTeams();
  }, [fetchTeams, hasEubakinAccess]);

  const fetchGames = useCallback(async () => {
    try {
      const snap = await getDocs(collection(firebaseDB, "eubakinGames"));
      setGames(
        snap.docs.map((item) => ({
          id: item.id,
          conference: (item.data().conference || "west") as EubakinConference,
          gender: (item.data().gender || "men") as EubakinGender,
          homeTeamId: item.data().homeTeamId || "",
          homeTeamName: item.data().homeTeamName || "",
          awayTeamId: item.data().awayTeamId || "",
          awayTeamName: item.data().awayTeamName || "",
          gameDate: item.data().gameDate || "",
          gameTime: item.data().gameTime || "",
          homeScore: typeof item.data().homeScore === "number" ? item.data().homeScore : undefined,
          awayScore: typeof item.data().awayScore === "number" ? item.data().awayScore : undefined,
          status: (item.data().status || "scheduled") as "scheduled" | "final",
        })).sort((a, b) => {
          const dateCompare = (a.gameDate || "").localeCompare(b.gameDate || "");
          if (dateCompare !== 0) return dateCompare;
          return (a.gameTime || "").localeCompare(b.gameTime || "");
        })
      );
    } catch (error) {
      console.error("Error loading EUBAKIN games", error);
    }
  }, []);

  useEffect(() => {
    if (!hasEubakinAccess) {
      return;
    }
    fetchGames();
  }, [fetchGames, hasEubakinAccess]);

  const filteredTeams = teams.filter((team) => {
    const conferenceOk = conferenceFilter === "all" || team.conference === conferenceFilter;
    const genderOk = genderFilter === "all" || team.gender === genderFilter;
    return conferenceOk && genderOk;
  });

  const availableTeamsForGame = teams.filter(
    (team) => team.conference === gameForm.conference && team.gender === gameForm.gender
  );

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setStatus({ type: "error", message: t.requiredName });
      return;
    }

    setSavingTeam(true);
    setStatus({ type: "info", message: t.saving });

    try {
      const created = await addDoc(collection(firebaseDB, "eubakinTeams"), {
        name: form.name.trim(),
        conference: form.conference,
        gender: form.gender,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (currentAdminUser) {
        await logAuditAction(
          "team_created",
          currentAdminUser.id,
          currentAdminUser.email || "unknown",
          "team",
          created.id,
          form.name.trim(),
          {
            conference: form.conference,
            gender: form.gender,
          }
        );
      }

      setForm({ name: "", conference: "west", gender: "men" });
      setStatus({ type: "success", message: t.created });
      fetchTeams();
    } catch (error) {
      console.error("Error creating EUBAKIN team", error);
      setStatus({ type: "error", message: t.failed });
    } finally {
      setSavingTeam(false);
    }
  };

  const handleScheduleGame = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!gameForm.gameDate || !gameForm.gameTime || !gameForm.homeTeamId || !gameForm.awayTeamId) {
      setStatus({ type: "error", message: t.requiredGameFields });
      return;
    }

    if (gameForm.homeTeamId === gameForm.awayTeamId) {
      setStatus({ type: "error", message: t.teamsMustDiffer });
      return;
    }

    const homeTeam = availableTeamsForGame.find((team) => team.id === gameForm.homeTeamId);
    const awayTeam = availableTeamsForGame.find((team) => team.id === gameForm.awayTeamId);
    if (!homeTeam || !awayTeam) {
      setStatus({ type: "error", message: t.requiredGameFields });
      return;
    }

    setSavingGame(true);
    setStatus({ type: "info", message: t.saving });

    try {
      const created = await addDoc(collection(firebaseDB, "eubakinGames"), {
        conference: gameForm.conference,
        gender: gameForm.gender,
        gameDate: gameForm.gameDate,
        gameTime: gameForm.gameTime,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (currentAdminUser) {
        await logAuditAction(
          "game_created",
          currentAdminUser.id,
          currentAdminUser.email || "unknown",
          "game",
          created.id,
          `${homeTeam.name} vs ${awayTeam.name}`,
          {
            conference: gameForm.conference,
            gender: gameForm.gender,
            gameDate: gameForm.gameDate,
            gameTime: gameForm.gameTime,
          }
        );
      }

      setGameForm({
        conference: "west",
        gender: "men",
        gameDate: "",
        gameTime: "",
        homeTeamId: "",
        awayTeamId: "",
      });
      setStatus({ type: "success", message: t.gameSaved });
      fetchGames();
    } catch (error) {
      console.error("Error scheduling EUBAKIN game", error);
      setStatus({ type: "error", message: t.failed });
    } finally {
      setSavingGame(false);
    }
  };

  const scoreEditableGames = games;

  useEffect(() => {
    if (!scoreForm.gameId) return;
    const selected = games.find((game) => game.id === scoreForm.gameId);
    if (!selected) return;

    setScoreForm((prev) => ({
      ...prev,
      homeScore: typeof selected.homeScore === "number" ? String(selected.homeScore) : "",
      awayScore: typeof selected.awayScore === "number" ? String(selected.awayScore) : "",
    }));
  }, [games, scoreForm.gameId]);

  const handleSaveScore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!scoreForm.gameId || scoreForm.homeScore === "" || scoreForm.awayScore === "") {
      setStatus({ type: "error", message: t.requiredScoreFields });
      return;
    }

    const homeScore = Number(scoreForm.homeScore);
    const awayScore = Number(scoreForm.awayScore);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      setStatus({ type: "error", message: t.requiredScoreFields });
      return;
    }

    const selectedGame = games.find((game) => game.id === scoreForm.gameId);
    if (!selectedGame) {
      setStatus({ type: "error", message: t.requiredScoreFields });
      return;
    }

    setSavingGame(true);
    setStatus({ type: "info", message: t.saving });

    try {
      const gameRef = doc(firebaseDB, "eubakinGames", scoreForm.gameId);
      const homeTeamRef = doc(firebaseDB, "eubakinTeams", selectedGame.homeTeamId);
      const awayTeamRef = doc(firebaseDB, "eubakinTeams", selectedGame.awayTeamId);

      await runTransaction(firebaseDB, async (transaction) => {
        const [gameSnap, homeSnap, awaySnap] = await Promise.all([
          transaction.get(gameRef),
          transaction.get(homeTeamRef),
          transaction.get(awayTeamRef),
        ]);

        if (!gameSnap.exists() || !homeSnap.exists() || !awaySnap.exists()) {
          throw new Error("Missing game or team document");
        }

        const gameData = gameSnap.data() as {
          status?: "scheduled" | "final";
          homeScore?: number | null;
          awayScore?: number | null;
        };

        let homeWins = typeof homeSnap.data().wins === "number" ? homeSnap.data().wins : 0;
        let homeLosses = typeof homeSnap.data().losses === "number" ? homeSnap.data().losses : 0;
        let awayWins = typeof awaySnap.data().wins === "number" ? awaySnap.data().wins : 0;
        let awayLosses = typeof awaySnap.data().losses === "number" ? awaySnap.data().losses : 0;

        const applyResult = (h: number, a: number, factor: 1 | -1) => {
          if (h === a) {
            return;
          }

          if (h > a) {
            homeWins += factor;
            awayLosses += factor;
          } else {
            awayWins += factor;
            homeLosses += factor;
          }
        };

        if (
          gameData.status === "final" &&
          typeof gameData.homeScore === "number" &&
          typeof gameData.awayScore === "number"
        ) {
          applyResult(gameData.homeScore, gameData.awayScore, -1);
        }

        applyResult(homeScore, awayScore, 1);

        homeWins = Math.max(0, homeWins);
        homeLosses = Math.max(0, homeLosses);
        awayWins = Math.max(0, awayWins);
        awayLosses = Math.max(0, awayLosses);

        transaction.update(homeTeamRef, {
          wins: homeWins,
          losses: homeLosses,
          updatedAt: serverTimestamp(),
        });

        transaction.update(awayTeamRef, {
          wins: awayWins,
          losses: awayLosses,
          updatedAt: serverTimestamp(),
        });

        transaction.update(gameRef, {
          homeScore,
          awayScore,
          status: "final",
          updatedAt: serverTimestamp(),
        });
      });

      if (currentAdminUser) {
        await logAuditAction(
          "game_updated",
          currentAdminUser.id,
          currentAdminUser.email || "unknown",
          "game",
          scoreForm.gameId,
          `${selectedGame.homeTeamName} vs ${selectedGame.awayTeamName}`,
          { homeScore, awayScore }
        );
      }

      setScoreForm({ gameId: "", homeScore: "", awayScore: "" });
      setStatus({ type: "success", message: t.scoreSaved });
      fetchGames();
      fetchTeams();
    } catch (error) {
      console.error("Error saving game score", error);
      setStatus({ type: "error", message: t.failed });
    } finally {
      setSavingGame(false);
    }
  };

  const handleDeleteTeam = async (team: EubakinTeam) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      await deleteDoc(doc(firebaseDB, "eubakinTeams", team.id));
      if (currentAdminUser) {
        await logAuditAction(
          "team_deleted",
          currentAdminUser.id,
          currentAdminUser.email || "unknown",
          "team",
          team.id,
          team.name,
          {
            conference: team.conference,
            gender: team.gender,
          }
        );
      }
      setStatus({ type: "success", message: t.deleted });
      fetchTeams();
    } catch (error) {
      console.error("Error deleting EUBAKIN team", error);
      setStatus({ type: "error", message: t.failed });
    }
  };

  if (!hasEubakinAccess) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/league" className="text-sm text-slate-400 transition hover:text-white">
            {t.back}
          </Link>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
          <h1 className="text-xl font-semibold text-rose-200">{t.accessDeniedTitle}</h1>
          <p className="mt-2 text-sm text-rose-100/80">{t.accessDeniedDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/league" className="text-sm text-slate-400 transition hover:text-white">
          {t.back}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">{t.setupTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveAction("team")}
            className={`rounded-2xl border p-5 text-left transition ${
              activeAction === "team"
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-white/10 bg-slate-950/40 hover:border-white/20"
            }`}
          >
            <p className="text-lg font-semibold text-white">{t.actionAddTeam}</p>
            <p className="mt-1 text-sm text-slate-400">{t.actionAddTeamDesc}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveAction("game")}
            className={`rounded-2xl border p-5 text-left transition ${
              activeAction === "game"
                ? "border-cyan-400/50 bg-cyan-500/10"
                : "border-white/10 bg-slate-950/40 hover:border-white/20"
            }`}
          >
            <p className="text-lg font-semibold text-white">{t.actionScheduleGame}</p>
            <p className="mt-1 text-sm text-slate-400">{t.actionScheduleGameDesc}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveAction("score")}
            className={`rounded-2xl border p-5 text-left transition ${
              activeAction === "score"
                ? "border-emerald-400/50 bg-emerald-500/10"
                : "border-white/10 bg-slate-950/40 hover:border-white/20"
            }`}
          >
            <p className="text-lg font-semibold text-white">{t.actionScoreGame}</p>
            <p className="mt-1 text-sm text-slate-400">{t.actionScoreGameDesc}</p>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
          {activeAction === "team" ? (
            <form onSubmit={handleCreateTeam} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.teamName}</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-amber-300/60"
                  placeholder={t.teamName}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.conference}</span>
                <select
                  value={form.conference}
                  onChange={(e) => setForm((prev) => ({ ...prev, conference: e.target.value as EubakinConference }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-amber-300/60"
                >
                  <option value="west">{t.west}</option>
                  <option value="east">{t.east}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.gender}</span>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as EubakinGender }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-amber-300/60"
                >
                  <option value="men">{t.men}</option>
                  <option value="women">{t.women}</option>
                </select>
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-60"
                >
                  {savingTeam ? t.saving : t.save}
                </button>
              </div>
            </form>
          ) : activeAction === "game" ? (
            <form onSubmit={handleScheduleGame} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.conference}</span>
                <select
                  value={gameForm.conference}
                  onChange={(e) =>
                    setGameForm((prev) => ({ ...prev, conference: e.target.value as EubakinConference, homeTeamId: "", awayTeamId: "" }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                >
                  <option value="west">{t.west}</option>
                  <option value="east">{t.east}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.gender}</span>
                <select
                  value={gameForm.gender}
                  onChange={(e) =>
                    setGameForm((prev) => ({ ...prev, gender: e.target.value as EubakinGender, homeTeamId: "", awayTeamId: "" }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                >
                  <option value="men">{t.men}</option>
                  <option value="women">{t.women}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.date}</span>
                <input
                  type="date"
                  value={gameForm.gameDate}
                  onChange={(e) => setGameForm((prev) => ({ ...prev, gameDate: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.time}</span>
                <input
                  type="time"
                  value={gameForm.gameTime}
                  onChange={(e) => setGameForm((prev) => ({ ...prev, gameTime: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.homeTeam}</span>
                <select
                  value={gameForm.homeTeamId}
                  onChange={(e) => setGameForm((prev) => ({ ...prev, homeTeamId: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                >
                  <option value="">{t.selectTeam}</option>
                  {availableTeamsForGame.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.awayTeam}</span>
                <select
                  value={gameForm.awayTeamId}
                  onChange={(e) => setGameForm((prev) => ({ ...prev, awayTeamId: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                >
                  <option value="">{t.selectTeam}</option>
                  {availableTeamsForGame.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={savingGame}
                  className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-60"
                >
                  {savingGame ? t.saving : t.saveGame}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveScore} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.game}</span>
                <select
                  value={scoreForm.gameId}
                  onChange={(e) => setScoreForm((prev) => ({ ...prev, gameId: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-emerald-300/60"
                >
                  <option value="">{scoreEditableGames.length === 0 ? t.noScheduledGames : t.selectTeam}</option>
                  {scoreEditableGames.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.gameDate} {game.gameTime} — {game.homeTeamName} vs {game.awayTeamName}{game.status === "final" ? " (final)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.homeScore}</span>
                <input
                  type="number"
                  min={0}
                  value={scoreForm.homeScore}
                  onChange={(e) => setScoreForm((prev) => ({ ...prev, homeScore: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-emerald-300/60"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-300">{t.awayScore}</span>
                <input
                  type="number"
                  min={0}
                  value={scoreForm.awayScore}
                  onChange={(e) => setScoreForm((prev) => ({ ...prev, awayScore: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-emerald-300/60"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={savingGame || scoreEditableGames.length === 0}
                  className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  {savingGame ? t.saving : t.saveScore}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {status ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : status.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-sky-500/30 bg-sky-500/10 text-sky-300"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">{t.addedTeams}</h2>
          <div className="flex items-center gap-2">
            <select
              value={conferenceFilter}
              onChange={(e) => setConferenceFilter(e.target.value as "all" | EubakinConference)}
              aria-label={t.chooseConference}
              title={t.chooseConference}
              className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">{t.chooseConference}: {t.all}</option>
              <option value="west">{t.west}</option>
              <option value="east">{t.east}</option>
            </select>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as "all" | EubakinGender)}
              aria-label={t.chooseGender}
              title={t.chooseGender}
              className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">{t.chooseGender}: {t.all}</option>
              <option value="men">{t.men}</option>
              <option value="women">{t.women}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-sm text-slate-400">Loading...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-8 text-sm text-slate-400">{t.noTeams}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeams.map((team) => (
              <div key={team.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{team.name}</p>
                    <p className="text-xs text-slate-500">
                      {team.conference === "west" ? t.west : t.east} • {team.gender === "men" ? t.men : t.women}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeam(team)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">{t.upcomingGames}</h2>
        {games.length === 0 ? (
          <div className="py-6 text-sm text-slate-400">{t.noGames}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {games.map((game) => (
              <div key={game.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="font-semibold text-white">{game.homeTeamName} vs {game.awayTeamName}</p>
                <p className="text-xs text-slate-400 mt-1">{game.gameDate} • {game.gameTime}</p>
                <p className="text-xs text-slate-500 mt-1">{game.conference === "west" ? t.west : t.east} • {game.gender === "men" ? t.men : t.women}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
