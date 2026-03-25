"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase/firestore";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LIVE_PIN_CHANGED_EVENT,
  clearPinnedLiveGameId,
  emitLivePinChanged,
  readPinnedLiveGameId,
} from "@/lib/live-pin";

type LivePinnedGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  livePeriod: string;
  liveClock: string;
  activeTimeoutSide?: "home" | "away";
};

function toNumberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export default function LivePinnedScore() {
  const { language } = useLanguage();
  const [liveGame, setLiveGame] = useState<LivePinnedGame | null>(null);
  const [pinnedGameId, setPinnedGameId] = useState<string | null>(null);

  const visibleGame = pinnedGameId ? liveGame : null;

  const clearPinned = () => {
    clearPinnedLiveGameId();
    emitLivePinChanged();
  };

  useEffect(() => {
    const syncPinned = () => setPinnedGameId(readPinnedLiveGameId());
    syncPinned();

    window.addEventListener(LIVE_PIN_CHANGED_EVENT, syncPinned);
    window.addEventListener("storage", syncPinned);

    return () => {
      window.removeEventListener(LIVE_PIN_CHANGED_EVENT, syncPinned);
      window.removeEventListener("storage", syncPinned);
    };
  }, []);

  useEffect(() => {
    if (!pinnedGameId) return;

    const safePinnedId = pinnedGameId.trim();
    if (!safePinnedId || safePinnedId.includes("/") || /\s/.test(safePinnedId)) {
      clearPinned();
      return;
    }

    let unsubscribe: (() => void) | null = null;
    try {
      const gameRef = doc(firebaseDB, "games", safePinnedId);
      unsubscribe = onSnapshot(
        gameRef,
        (snapshot) => {
        if (!snapshot.exists()) {
          clearPinned();
          setLiveGame(null);
          return;
        }

        const data = snapshot.data() as Record<string, unknown>;
        if (data?.isHiddenFromPublic === true || data?.completed === true) {
          clearPinned();
          setLiveGame(null);
          return;
        }
        const status = String(data?.status || "").toLowerCase();
        if (status !== "live") {
          clearPinned();
          setLiveGame(null);
          return;
        }

        const homeScoreValue = data.homeScore;
        const awayScoreValue = data.awayScore;
        const winnerScoreValue = data.winnerScore;
        const loserScoreValue = data.loserScore;

        const homeScoreDirect = toNumberOrZero(homeScoreValue);
        const awayScoreDirect = toNumberOrZero(awayScoreValue);

        const hasDirectScores =
          (typeof homeScoreValue === "number" || typeof homeScoreValue === "string") &&
          (typeof awayScoreValue === "number" || typeof awayScoreValue === "string");

        const winnerScore = toNumberOrZero(winnerScoreValue);
        const loserScore = toNumberOrZero(loserScoreValue);
        const hasWinnerLoserScores =
          (typeof winnerScoreValue === "number" || typeof winnerScoreValue === "string") &&
          (typeof loserScoreValue === "number" || typeof loserScoreValue === "string");

        const homeTeamId = String(data.homeTeamId || "");
        const awayTeamId = String(data.awayTeamId || "");
        const winnerTeamId = String(data.winnerTeamId || "");

        const homeScore = hasDirectScores
          ? homeScoreDirect
          : hasWinnerLoserScores
            ? winnerTeamId && homeTeamId && winnerTeamId === homeTeamId
              ? winnerScore
              : loserScore
            : 0;

        const awayScore = hasDirectScores
          ? awayScoreDirect
          : hasWinnerLoserScores
            ? winnerTeamId && awayTeamId && winnerTeamId === awayTeamId
              ? winnerScore
              : loserScore
            : 0;

        const livePeriodSource = [data.period, data.quarter]
          .find((value) => value !== undefined && value !== null && String(value).trim() !== "");

        const rawPeriod = livePeriodSource ? String(livePeriodSource) : "";
        const livePeriod = rawPeriod.trim();
        const liveClock = String(data.gameClock || data.clock || data.timeRemaining || "").trim();

        const activeTimeoutRaw = data.activeTimeout as unknown;
        const activeTimeoutSide =
          activeTimeoutRaw && typeof activeTimeoutRaw === "object"
            ? (activeTimeoutRaw as { side?: "home" | "away" }).side
            : undefined;

        setLiveGame({
          id: safePinnedId,
          homeTeam: String(data.homeTeam || data.team1 || data.homeTeamName || ""),
          awayTeam: String(data.awayTeam || data.team2 || data.awayTeamName || ""),
          homeScore,
          awayScore,
          livePeriod,
          liveClock,
          activeTimeoutSide,
        });
        },
        (error) => {
          console.error("Error subscribing to pinned live game:", error);
          setLiveGame(null);
        }
      );
    } catch (error) {
      console.error("Invalid pinned live game id:", error);
      clearPinned();
      setLiveGame(null);
      return;
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [pinnedGameId]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (visibleGame) {
      document.documentElement.setAttribute("data-live-pin", "1");
    } else {
      document.documentElement.removeAttribute("data-live-pin");
    }

    return () => {
      document.documentElement.removeAttribute("data-live-pin");
    };
  }, [visibleGame]);

  const timeoutLabel = useMemo(() => {
    if (!visibleGame?.activeTimeoutSide) return null;
    const verb = language === "fr" ? "Temps mort" : "Timeout";
    const teamName =
      visibleGame.activeTimeoutSide === "home" ? visibleGame.homeTeam || "Team A" : visibleGame.awayTeam || "Team B";
    return `${verb} ${teamName}`;
  }, [language, visibleGame]);

  if (!visibleGame) return null;

  const periodPart = visibleGame.livePeriod ? String(visibleGame.livePeriod).toUpperCase() : "";
  const clockPart = visibleGame.liveClock;
  const meta = periodPart && clockPart ? `${periodPart} • ${clockPart}` : periodPart || clockPart;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <Link
        href={`/game/${encodeURIComponent(visibleGame.id)}`}
        className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-8"
        aria-label={language === "fr" ? "Voir le match en direct" : "View live game"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live
          </span>
          <span className="min-w-0 truncate text-xs font-semibold text-white sm:hidden">
            {visibleGame.awayTeam.split(" ").pop()} {visibleGame.awayScore} – {visibleGame.homeScore} {visibleGame.homeTeam.split(" ").pop()}
          </span>
          <span className="hidden min-w-0 truncate text-xs font-semibold text-white sm:inline">
            {visibleGame.awayTeam} {visibleGame.awayScore} – {visibleGame.homeScore} {visibleGame.homeTeam}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {timeoutLabel && (
            <span className="hidden sm:inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              {timeoutLabel}
            </span>
          )}
          {meta && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
              {meta}
            </span>
          )}
          <svg className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}
