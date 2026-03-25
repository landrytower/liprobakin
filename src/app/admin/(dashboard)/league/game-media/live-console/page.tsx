"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useAdmin } from "../../../layout";
import { updateLiveGameWithAnnouncement } from "@/lib/liveAnnouncements";

type GameItem = {
  id: string;
  homeTeamName: string;
  homeTeamLogo?: string;
  awayTeamName: string;
  awayTeamLogo?: string;
  date?: string;
  time?: string;
  status?: string;
  completed?: boolean;
  liveAnnouncementId?: string;
  homeScore?: number;
  awayScore?: number;
  period?: string | number;
  quarter?: string | number;
  gameClock?: string;
  clock?: string;
  timeRemaining?: string;
  isHiddenFromPublic?: boolean;
  activeTimeout?: {
    side?: "home" | "away";
    startedAt?: unknown;
  } | null;
};

const copy = {
  en: {
    title: "Live Score Console",
    subtitle: "Full-page live scoring for media admins",
    noAccess: "You don't have permission to manage live score.",
    loading: "Loading live console...",
    backMedia: "Back to Media",
    selectGame: "Select game",
    live: "LIVE",
    status: "Status",
    period: "Period",
    editHint: "Tap Edit to set exact score",
    home: "Home",
    away: "Away",
    edit: "Edit",
    minusOne: "-1",
    undoLast: "Undo Last",
    scoreUpdated: "Live score updated",
    undoUpdated: "Last score action undone",
    quarterUpdated: "Quarter updated",
    hidePublic: "Hide from Public",
    showPublic: "Show Publicly",
    hiddenOn: "This game is hidden from public",
    hiddenOff: "This game is visible to public",
    hiddenUpdated: "Public visibility updated",
    goLive: "Set Live",
    endLive: "Remove from Live",
    liveStatusUpdated: "Live status updated",
    timeout: "Timeout",
    timeoutUpdated: "Timeout updated",
    updateFailed: "Failed to update live data",
  },
  fr: {
    title: "Console Score Live",
    subtitle: "Score live plein écran pour les admins média",
    noAccess: "Vous n'avez pas la permission de gérer le score live.",
    loading: "Chargement de la console live...",
    backMedia: "Retour aux Médias",
    selectGame: "Sélectionner un match",
    live: "LIVE",
    status: "Statut",
    period: "Période",
    editHint: "Touchez Modifier pour entrer le score exact",
    home: "Domicile",
    away: "Visiteur",
    edit: "Modifier",
    minusOne: "-1",
    undoLast: "Annuler dernier",
    scoreUpdated: "Score live mis à jour",
    undoUpdated: "Dernière action score annulée",
    quarterUpdated: "Période mise à jour",
    hidePublic: "Masquer du public",
    showPublic: "Rendre public",
    hiddenOn: "Ce match est masqué au public",
    hiddenOff: "Ce match est visible au public",
    hiddenUpdated: "Visibilité publique mise à jour",
    goLive: "Passer en direct",
    endLive: "Retirer du direct",
    liveStatusUpdated: "Statut live mis à jour",
    timeout: "Temps mort",
    timeoutUpdated: "Temps mort mis à jour",
    updateFailed: "Échec de la mise à jour live",
  },
} as const;

export default function LiveConsolePage() {
  const { language, currentAdminUser } = useAdmin();
  const t = copy[language];
  const params = useSearchParams();
  const initialSelectedGameId = params.get("gameId") || "";

  const [games, setGames] = useState<GameItem[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(initialSelectedGameId);
  const [editingSide, setEditingSide] = useState<"home" | "away" | null>(null);
  const [scoreDraft, setScoreDraft] = useState("");
  const [lastScoreSnapshot, setLastScoreSnapshot] = useState<{ homeScore: number; awayScore: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canManage = currentAdminUser?.permissions?.canManageGameMedia || currentAdminUser?.roles?.includes("master");

  useEffect(() => {
    const gamesQuery = query(collection(firebaseDB, "games"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((gameDoc) => ({
          id: gameDoc.id,
          ...(gameDoc.data() as Omit<GameItem, "id">),
        }));

        setGames(next);
        setLoading(false);

        if (!selectedGameId && next.length > 0) {
          setSelectedGameId(next[0].id);
        }
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [selectedGameId]);

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) || null, [games, selectedGameId]);

  const updateLive = async (patch: Partial<GameItem>, successMessage: string) => {
    if (!selectedGame) return;

    const optimistic = {
      ...patch,
      status: "live",
      completed: false,
      isHiddenFromPublic: false,
    };

    setGames((prev) => prev.map((game) => (game.id === selectedGame.id ? { ...game, ...optimistic } : game)));

    try {
      const alreadyLive = String(selectedGame.status || "").toLowerCase() === "live";
      const hasAnnouncement = typeof selectedGame.liveAnnouncementId === "string" && selectedGame.liveAnnouncementId.trim().length > 0;

      if (alreadyLive && hasAnnouncement) {
        await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
          ...optimistic,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateLiveGameWithAnnouncement({
          gameId: selectedGame.id,
          homeTeamName: selectedGame.homeTeamName,
          awayTeamName: selectedGame.awayTeamName,
          patch: optimistic,
        });
      }
      setStatus({ type: "success", message: successMessage });
    } catch (error) {
      console.error("Live update failed:", error);
      setStatus({ type: "error", message: t.updateFailed });
    }
  };

  const toggleTimeout = async (side: "home" | "away") => {
    if (!selectedGame) return;

    const currentSide = selectedGame.activeTimeout?.side ?? null;
    const nextValue = currentSide === side ? null : { side, startedAt: serverTimestamp() };

    setGames((prev) =>
      prev.map((game) => (game.id === selectedGame.id ? { ...game, activeTimeout: nextValue } : game))
    );

    try {
      await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
        activeTimeout: nextValue,
        updatedAt: serverTimestamp(),
      });
      setStatus({ type: "success", message: t.timeoutUpdated });
    } catch (error) {
      console.error("Timeout update failed:", error);
      setStatus({ type: "error", message: t.updateFailed });
    }
  };

  const adjustScore = async (side: "home" | "away", delta: number) => {
    if (!selectedGame) return;

    const homeCurrent = typeof selectedGame.homeScore === "number" ? selectedGame.homeScore : 0;
    const awayCurrent = typeof selectedGame.awayScore === "number" ? selectedGame.awayScore : 0;

    setLastScoreSnapshot({ homeScore: homeCurrent, awayScore: awayCurrent });

    const nextHome = side === "home" ? Math.max(0, homeCurrent + delta) : homeCurrent;
    const nextAway = side === "away" ? Math.max(0, awayCurrent + delta) : awayCurrent;

    await updateLive(
      {
        homeScore: nextHome,
        awayScore: nextAway,
      },
      t.scoreUpdated
    );
  };

  const undoLastScoreAction = async () => {
    if (!selectedGame || !lastScoreSnapshot) return;

    await updateLive(
      {
        homeScore: lastScoreSnapshot.homeScore,
        awayScore: lastScoreSnapshot.awayScore,
      },
      t.undoUpdated
    );

    setLastScoreSnapshot(null);
  };

  const setQuarter = async (quarterValue: "Q1" | "Q2" | "Q3" | "Q4" | "OT" | "HT" | "MT") => {
    await updateLive(
      {
        period: quarterValue,
        quarter: quarterValue,
      },
      t.quarterUpdated
    );
  };

  const togglePublicVisibility = async (hidden: boolean) => {
    await updateLive(
      {
        isHiddenFromPublic: hidden,
      },
      t.hiddenUpdated
    );
  };

  const toggleLiveStatus = async (nextLive: boolean) => {
    if (!selectedGame) return;

    const optimistic = {
      status: nextLive ? "live" : "scheduled",
      completed: false,
      ...(nextLive ? { isHiddenFromPublic: false } : {}),
    };

    setGames((prev) => prev.map((game) => (game.id === selectedGame.id ? { ...game, ...optimistic } : game)));

    try {
      if (nextLive) {
        await updateLiveGameWithAnnouncement({
          gameId: selectedGame.id,
          homeTeamName: selectedGame.homeTeamName,
          awayTeamName: selectedGame.awayTeamName,
          patch: optimistic,
        });
      } else {
        await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
          ...optimistic,
          updatedAt: serverTimestamp(),
        });
      }
      setStatus({ type: "success", message: t.liveStatusUpdated });
    } catch (error) {
      console.error("Live status update failed:", error);
      setStatus({ type: "error", message: t.updateFailed });
    }
  };

  const beginManualEdit = (side: "home" | "away") => {
    if (!selectedGame) return;
    const current = side === "home" ? selectedGame.homeScore : selectedGame.awayScore;
    setEditingSide(side);
    setScoreDraft(String(typeof current === "number" ? current : 0));
  };

  const commitManualEdit = async (side: "home" | "away") => {
    if (!selectedGame) return;

    const parsed = Number.parseInt(scoreDraft, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setEditingSide(null);
      setScoreDraft("");
      return;
    }

    const homeCurrent = typeof selectedGame.homeScore === "number" ? selectedGame.homeScore : 0;
    const awayCurrent = typeof selectedGame.awayScore === "number" ? selectedGame.awayScore : 0;
    setLastScoreSnapshot({ homeScore: homeCurrent, awayScore: awayCurrent });

    await updateLive(
      {
        homeScore: side === "home" ? parsed : homeCurrent,
        awayScore: side === "away" ? parsed : awayCurrent,
      },
      t.scoreUpdated
    );

    setEditingSide(null);
    setScoreDraft("");
  };

  if (!canManage) {
    return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">{t.noAccess}</div>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <span className="ml-3 text-slate-300">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-sm text-slate-400">{t.subtitle}</p>
        </div>
        <Link href="/admin/league/game-media" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:text-white hover:border-white/30 transition">
          ← {t.backMedia}
        </Link>
      </div>

      {status && (
        <div className={`rounded-xl border p-3 text-sm ${status.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {status.message}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t.selectGame}</label>
        <select
          aria-label={t.selectGame}
          value={selectedGameId}
          onChange={(event) => {
            setEditingSide(null);
            setScoreDraft("");
            setSelectedGameId(event.target.value);
          }}
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-3 text-base text-white focus:border-orange-500/40 focus:outline-none"
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.awayTeamName} vs {game.homeTeamName} — {game.date || "—"} {game.time || ""}
            </option>
          ))}
        </select>
      </div>

      {selectedGame && (
        <section className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-slate-900/70 to-slate-900/70 p-3 sm:p-6">
          <div className="mb-4 flex items-center justify-between sticky top-2 z-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
            <span className="rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-200">{t.live}</span>
            <span className="text-xs uppercase tracking-wide text-slate-300">{t.status}: {String(selectedGame.status || "live").toUpperCase()}</span>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleLiveStatus(true)}
              disabled={String(selectedGame.status || "").toLowerCase() === "live"}
              className="min-h-11 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-200 hover:bg-red-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              🔴 {t.goLive}
            </button>
            <button
              type="button"
              onClick={() => toggleLiveStatus(false)}
              disabled={String(selectedGame.status || "").toLowerCase() !== "live"}
              className="min-h-11 rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 hover:border-white/30 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ⚪ {t.endLive}
            </button>
            {String(selectedGame.status || "").toLowerCase() !== "live" && (
              <>
                <button
                  type="button"
                  onClick={() => togglePublicVisibility(!Boolean(selectedGame.isHiddenFromPublic))}
                  className="min-h-11 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/25 active:scale-95"
                >
                  {selectedGame.isHiddenFromPublic ? t.showPublic : t.hidePublic}
                </button>
                <span className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selectedGame.isHiddenFromPublic ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
                  {selectedGame.isHiddenFromPublic ? t.hiddenOn : t.hiddenOff}
                </span>
              </>
            )}
            {String(selectedGame.status || "").toLowerCase() === "live" && !selectedGame.isHiddenFromPublic && (
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                ✓ {t.hiddenOff}
              </span>
            )}
            {String(selectedGame.status || "").toLowerCase() === "live" && selectedGame.isHiddenFromPublic && (
              <button
                type="button"
                onClick={() => togglePublicVisibility(false)}
                className="min-h-11 animate-pulse rounded-lg border border-red-500/60 bg-red-500/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-100 hover:bg-red-500/40 active:scale-95"
              >
                ⚠️ {t.showPublic}
              </button>
            )}
          </div>

          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t.editHint}</p>

          <div className="grid gap-3 md:gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-6">
              <div className="mb-3 flex min-w-0 items-center gap-3">
                {selectedGame.awayTeamLogo ? <Image src={selectedGame.awayTeamLogo} alt={selectedGame.awayTeamName || "Away"} width={44} height={44} className="h-11 w-11 rounded-full object-cover" unoptimized /> : null}
                <p className="min-w-0 flex-1 truncate text-lg font-semibold text-white" title={selectedGame.awayTeamName || ""}>
                  {selectedGame.awayTeamName}
                </p>
              </div>
              {editingSide === "away" ? (
                <input
                  autoFocus
                  type="number"
                  min="0"
                  aria-label={`${t.away} score`}
                  placeholder="0"
                  value={scoreDraft}
                  onChange={(event) => setScoreDraft(event.target.value)}
                  onBlur={() => commitManualEdit("away")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void commitManualEdit("away");
                    }
                    if (event.key === "Escape") {
                      setEditingSide(null);
                      setScoreDraft("");
                    }
                  }}
                  className="mx-auto block w-36 rounded-lg border border-white/20 bg-slate-800/80 px-3 py-3 text-center text-5xl font-black tabular-nums text-white focus:border-orange-500/50 focus:outline-none"
                />
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto block rounded-lg px-4 text-center text-6xl font-black tabular-nums text-white sm:text-7xl">
                    {selectedGame.awayScore ?? 0}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginManualEdit("away")}
                    className="mx-auto block min-h-10 rounded-lg border border-white/20 bg-slate-800/80 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 active:scale-95"
                  >
                    {t.edit}
                  </button>
                </div>
              )}
              <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
                <button onClick={() => adjustScore("away", -1)} className="min-h-14 rounded-xl border border-white/25 bg-slate-800/90 px-2 py-3 text-xl font-black text-white hover:bg-slate-700 active:scale-95">{t.minusOne}</button>
                <button onClick={() => adjustScore("away", 1)} className="min-h-14 rounded-xl border border-orange-500/40 bg-orange-500/20 px-2 py-3 text-2xl font-black text-white hover:bg-orange-500/30 active:scale-95">+1</button>
                <button onClick={() => adjustScore("away", 2)} className="min-h-14 rounded-xl border border-orange-500/40 bg-orange-500/20 px-2 py-3 text-2xl font-black text-white hover:bg-orange-500/30 active:scale-95">+2</button>
                <button onClick={() => adjustScore("away", 3)} className="min-h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-2 py-3 text-2xl font-black text-white active:scale-95">+3</button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center sticky bottom-2 md:static z-20">
              {(() => {
                const activeSide = selectedGame.activeTimeout?.side ?? null;
                const timeoutLabel = t.timeout;

                return (
                  <>
                    {activeSide && (
                      <div className="mb-3">
                        <span className="inline-flex items-center justify-center rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                          {timeoutLabel} {activeSide === "home" ? selectedGame.homeTeamName : selectedGame.awayTeamName}
                        </span>
                      </div>
                    )}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTimeout("away")}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          activeSide === "away"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                            : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/25"
                        }`}
                      >
                        {timeoutLabel} {selectedGame.awayTeamName}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTimeout("home")}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          activeSide === "home"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                            : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/25"
                        }`}
                      >
                        {timeoutLabel} {selectedGame.homeTeamName}
                      </button>
                    </div>
                  </>
                );
              })()}
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t.period}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["Q1", "Q2", "Q3", "Q4", "OT", language === "fr" ? "MT" : "HT"] as const).map((quarter) => {
                  const selectedPeriod = String(selectedGame.period ?? selectedGame.quarter ?? "").toUpperCase();
                  const active =
                    selectedPeriod === quarter ||
                    (quarter === "HT" && selectedPeriod === "MT") ||
                    (quarter === "MT" && selectedPeriod === "HT");
                  return (
                    <button
                      key={quarter}
                      type="button"
                      onClick={() => setQuarter(quarter === "MT" ? "MT" : quarter)}
                      className={`rounded-lg px-3 py-2 text-sm font-bold ${active ? "bg-orange-500 text-white" : "border border-white/20 bg-slate-800/80 text-white hover:bg-slate-700"}`}
                    >
                      {quarter}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={undoLastScoreAction}
                disabled={!lastScoreSnapshot}
                className="mt-3 min-h-12 w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↩ {t.undoLast}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-6">
              <div className="mb-3 flex min-w-0 items-center gap-3">
                {selectedGame.homeTeamLogo ? <Image src={selectedGame.homeTeamLogo} alt={selectedGame.homeTeamName || "Home"} width={44} height={44} className="h-11 w-11 rounded-full object-cover" unoptimized /> : null}
                <p className="min-w-0 flex-1 truncate text-lg font-semibold text-white" title={selectedGame.homeTeamName || ""}>
                  {selectedGame.homeTeamName}
                </p>
              </div>
              {editingSide === "home" ? (
                <input
                  autoFocus
                  type="number"
                  min="0"
                  aria-label={`${t.home} score`}
                  placeholder="0"
                  value={scoreDraft}
                  onChange={(event) => setScoreDraft(event.target.value)}
                  onBlur={() => commitManualEdit("home")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void commitManualEdit("home");
                    }
                    if (event.key === "Escape") {
                      setEditingSide(null);
                      setScoreDraft("");
                    }
                  }}
                  className="mx-auto block w-36 rounded-lg border border-white/20 bg-slate-800/80 px-3 py-3 text-center text-5xl font-black tabular-nums text-white focus:border-orange-500/50 focus:outline-none"
                />
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto block rounded-lg px-4 text-center text-6xl font-black tabular-nums text-white sm:text-7xl">
                    {selectedGame.homeScore ?? 0}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginManualEdit("home")}
                    className="mx-auto block min-h-10 rounded-lg border border-white/20 bg-slate-800/80 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 active:scale-95"
                  >
                    {t.edit}
                  </button>
                </div>
              )}
              <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
                <button onClick={() => adjustScore("home", -1)} className="min-h-14 rounded-xl border border-white/25 bg-slate-800/90 px-2 py-3 text-xl font-black text-white hover:bg-slate-700 active:scale-95">{t.minusOne}</button>
                <button onClick={() => adjustScore("home", 1)} className="min-h-14 rounded-xl border border-orange-500/40 bg-orange-500/20 px-2 py-3 text-2xl font-black text-white hover:bg-orange-500/30 active:scale-95">+1</button>
                <button onClick={() => adjustScore("home", 2)} className="min-h-14 rounded-xl border border-orange-500/40 bg-orange-500/20 px-2 py-3 text-2xl font-black text-white hover:bg-orange-500/30 active:scale-95">+2</button>
                <button onClick={() => adjustScore("home", 3)} className="min-h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-2 py-3 text-2xl font-black text-white active:scale-95">+3</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
