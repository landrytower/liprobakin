"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { parseCongoDateTime } from "@/lib/congo-time";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LIVE_PIN_CHANGED_EVENT,
  clearPinnedLiveGameId,
  emitLivePinChanged,
  readPinnedLiveGameId,
  writePinnedLiveGameId,
} from "@/lib/live-pin";
import { useLiveScorePiP } from "@/hooks/useLiveScorePiP";

type PlayerStat = {
  playerId: string;
  playerName: string;
  firstName: string;
  lastName: string;
  number: number;
  headshot?: string;
  teamId: string;
  dnp?: boolean;
  started?: boolean;
  two_pm: number;
  two_pa: number;
  three_pm: number;
  three_pa: number;
  ft_m: number;
  ft_a: number;
  pts: number;
  ast: number;
  oreb: number;
  dreb: number;
  reb: number;
  stl: number;
  blk: number;
  min: number;
  pf: number;
  to: number;
  fd?: number;
  fgm?: number;
  fga?: number;
  plus_minus?: number;
  plusMinus?: number;
};

type GameData = {
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  date?: string;
  time?: string;
  venue?: string;
  winnerScore?: number;
  loserScore?: number;
  winnerTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  loserTeamId?: string;
  completed?: boolean;
  status?: string;
  period?: string | number;
  quarter?: string | number;
  gameClock?: string;
  clock?: string;
  timeRemaining?: string;
  gender?: string;
  playerStats?: PlayerStat[];
  highlightsVideoUrl?: string;
  highlightsUrl?: string;
  highlightVideoUrl?: string;
  highlightUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  streamUrl?: string;
  photoUrls?: string[];
  gamePhotos?: string[];
  photos?: string[];
  playByPlay?: unknown[];
  livePlays?: unknown[];
  scoreEvents?: unknown[];
  events?: unknown[];
  timeline?: unknown[];
  largestLead?: number;
  largestLeadTeamId?: string;
  largestLeadTeamName?: string;
  homeLargestLead?: number;
  awayLargestLead?: number;
  isHiddenFromPublic?: boolean;
  winByForfeit?: boolean;
  forfeitCaptainId?: string;
  forfeitCaptainName?: string;
  activeTimeout?: {
    side?: "home" | "away";
    startedAt?: unknown;
  } | null;
};

type NormalizedPlayEvent = {
  id: string;
  text: string;
  clock: string;
  period: string;
  points: number;
  side: "home" | "away" | null;
  timestampMs: number;
};

type ShotMarker = {
  id: string;
  side: "home" | "away";
  points: 1 | 2 | 3;
  positionClass: string;
};

const translations = {
  en: {
    loading: "Loading...",
    gameNotFound: "Game not found",
    backToHome: "← Back to Home",
    final: "FINAL",
    scheduled: "Scheduled",
    away: "Away",
    home: "Home",
    overview: "Overview",
    boxScore: "Box Score",
    highlights: "Highlight",
    pictures: "Pictures",
    gameLeaders: "Game Leaders",
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
    teamStats: "Team Stats",
    fgPercent: "FG%",
    threePercent: "3PT%",
    player: "Player",
    pts: "PTS",
    reb: "REB",
    ast: "AST",
    fg: "FG",
    threeP: "3PT",
    ft: "FT",
    unknownPlayer: "Unknown Player",
    highlightsVideo: "Game Highlights Video",
    noHighlights: "No highlight video uploaded for this game yet.",
    photosTitle: "Game Pictures",
    photosDesc: "Game pictures will be displayed here.",
    photosAdmin: "Administrators can upload pictures via the admin panel.",
    noPhotosUploaded: "No pictures uploaded for this game yet.",
    tapToExpand: "Tap to enlarge",
    close: "Close",
    previous: "Previous",
    next: "Next",
    language: "Language",
    liveNow: "Live Now",
    liveScore: "Live Score",
    liveClock: "Game Clock",
    noLiveStream: "Live stream is not available yet.",
    watchOnSite: "Watch directly on Liprobakin",
    enterFullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    scorePulse: "Score Pulse",
    largestLead: "Largest Lead",
    currentRun: "Current Run",
    leadChanges: "Lead Changes",
    playByPlay: "Play by Play",
    noEventFeed: "Waiting for detailed score events from live console.",
    scoreFlow: "Score Flow",
    lastScore: "Last score",
    winPerForfeit: "Win per forfeit",
    timeout: "Timeout",
    pinLiveScore: "Pin live score",
    unpinLiveScore: "Unpin live score",
    pinnedLiveScore: "Pinned",
    openPiP: "Pop out score",
    closePiP: "Close pop out",
    pipActive: "Pop out active",
    pipNotSupported: "Pop out not supported on this browser",
  },
  fr: {
    loading: "Chargement...",
    gameNotFound: "Match introuvable",
    backToHome: "← Retour à l'accueil",
    final: "FINAL",
    scheduled: "Programmé",
    away: "Visiteur",
    home: "Domicile",
    overview: "Aperçu",
    boxScore: "Feuille de Match",
    highlights: "Highlight",
    pictures: "Photos",
    gameLeaders: "Meilleurs Joueurs",
    points: "Points",
    rebounds: "Rebonds",
    assists: "Passes",
    teamStats: "Statistiques des Équipes",
    fgPercent: "Tirs %",
    threePercent: "3 Pts %",
    player: "Joueur",
    pts: "PTS",
    reb: "REB",
    ast: "PD",
    fg: "TIR",
    threeP: "3PT",
    ft: "LF",
    unknownPlayer: "Joueur inconnu",
    highlightsVideo: "Vidéo des temps forts du match",
    noHighlights: "Aucune vidéo des temps forts n'a encore été publiée pour ce match.",
    photosTitle: "Photos du Match",
    photosDesc: "Les photos de ce match seront affichées ici.",
    photosAdmin: "Les administrateurs peuvent télécharger des photos via le panneau d'administration.",
    noPhotosUploaded: "Aucune photo n'a encore été ajoutée pour ce match.",
    tapToExpand: "Touchez pour agrandir",
    close: "Fermer",
    previous: "Précédent",
    next: "Suivant",
    language: "Langue",
    liveNow: "En Direct",
    liveScore: "Score en direct",
    liveClock: "Chronomètre",
    noLiveStream: "Le direct n'est pas encore disponible.",
    watchOnSite: "Regardez directement sur Liprobakin",
    enterFullscreen: "Plein écran",
    exitFullscreen: "Quitter plein écran",
    scorePulse: "Pulse Score",
    largestLead: "Plus gros écart",
    currentRun: "Série en cours",
    leadChanges: "Changements de leader",
    playByPlay: "Play by Play",
    noEventFeed: "En attente des actions détaillées depuis la console live.",
    scoreFlow: "Flux du score",
    lastScore: "Dernier score",
    winPerForfeit: "Victoire par forfait",
    timeout: "Temps mort",
    pinLiveScore: "\u00c9pingler le score",
    unpinLiveScore: "D\u00e9s\u00e9pingler",
    pinnedLiveScore: "\u00c9pingl\u00e9",
    openPiP: "Score flottant",
    closePiP: "Fermer flottant",
    pipActive: "Flottant actif",
    pipNotSupported: "Non supporté sur ce navigateur",
  },
};

type TranslationCopy = typeof translations["fr"];

function normalizePlayerName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toEmbedVideoUrl(rawUrl: string): { type: "iframe" | "video"; url: string } {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();
  const buildYouTubeEmbed = (videoId: string) =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&controls=1`;

  if (lower.includes("youtube.com") || lower.includes("youtu.be/")) {
    try {
      const parsed = new URL(url);
      let videoId = "";

      if (parsed.pathname.includes("/embed/")) {
        const embeddedId = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        if (embeddedId) {
          return { type: "iframe", url: buildYouTubeEmbed(embeddedId) };
        }
        return { type: "iframe", url: url.replace("youtube-nocookie.com/embed/", "youtube.com/embed/") };
      }

      if (parsed.hostname.includes("studio.youtube.com") && parsed.pathname.includes("/video/")) {
        const studioMatch = parsed.pathname.match(/\/video\/([^/]+)/i);
        videoId = studioMatch?.[1] || "";
      } else if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").split("/")[0] || "";
      } else if (parsed.pathname.includes("/live/")) {
        videoId = parsed.pathname.split("/live/")[1]?.split("/")[0] || "";
      } else if (parsed.pathname.includes("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
      if (videoId) {
        return { type: "iframe", url: buildYouTubeEmbed(videoId) };
      }
    } catch {
      return { type: "iframe", url };
    }
  }

  if (lower.includes("vimeo.com/")) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match?.[1]) {
      return { type: "iframe", url: `https://player.vimeo.com/video/${match[1]}` };
    }
    return { type: "iframe", url };
  }

  return { type: "video", url };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTimestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (isRecord(value)) {
    const seconds = value.seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      return seconds * 1000;
    }
    const legacySeconds = value._seconds;
    if (typeof legacySeconds === "number" && Number.isFinite(legacySeconds)) {
      return legacySeconds * 1000;
    }
    const toMillisFn = value.toMillis;
    if (typeof toMillisFn === "function") {
      try {
        const result = (toMillisFn as () => unknown)();
        if (typeof result === "number" && Number.isFinite(result)) {
          return result;
        }
      } catch {
        return 0;
      }
    }
  }
  return 0;
}

function normalizePlayEvent(
  raw: unknown,
  index: number,
  homeTeamName: string,
  awayTeamName: string,
  homeTeamId?: string,
  awayTeamId?: string
): NormalizedPlayEvent | null {
  const safeHomeName = homeTeamName || "Home";
  const safeAwayName = awayTeamName || "Away";

  if (typeof raw === "string") {
    return {
      id: `event-${index}`,
      text: raw,
      clock: "",
      period: "",
      points: 0,
      side: null,
      timestampMs: 0,
    };
  }

  if (!isRecord(raw)) return null;

  const text = [raw.text, raw.description, raw.event, raw.label, raw.title]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim() || "";

  const period = [raw.period, raw.quarter]
    .find((value): value is string | number => (typeof value === "string" && value.trim().length > 0) || typeof value === "number")
    ?.toString() || "";

  const clock = [raw.clock, raw.gameClock, raw.timeRemaining, raw.time]
    .find((value): value is string | number => (typeof value === "string" && value.trim().length > 0) || typeof value === "number")
    ?.toString() || "";

  const directPoints = [raw.points, raw.value, raw.delta]
    .find((value): value is number => typeof value === "number" && Number.isFinite(value)) || 0;

  let points = directPoints;
  if (!points && text) {
    const plusMatch = text.match(/\+(\d+)/);
    if (plusMatch?.[1]) {
      points = Number(plusMatch[1]);
    }
  }

  const teamId = typeof raw.teamId === "string" ? raw.teamId : typeof raw.scoringTeamId === "string" ? raw.scoringTeamId : "";
  const teamName = [raw.teamName, raw.team, raw.scoringTeamName]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim() || "";

  const textLower = text.toLowerCase();
  const side: "home" | "away" | null =
    (homeTeamId && teamId === homeTeamId) || teamName === safeHomeName || textLower.includes(safeHomeName.toLowerCase())
      ? "home"
      : (awayTeamId && teamId === awayTeamId) || teamName === safeAwayName || textLower.includes(safeAwayName.toLowerCase())
        ? "away"
        : null;

  const timestampMs = toTimestampMs(raw.timestamp ?? raw.createdAt ?? raw.updatedAt ?? raw.at);

  if (!text && !points && !clock && !period) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : `event-${index}`,
    text: text || `${side === "home" ? safeHomeName : side === "away" ? safeAwayName : "Score"} +${points || 0}`,
    clock,
    period,
    points: points > 0 ? points : 0,
    side,
    timestampMs,
  };
}

function hashFromString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

const LEFT_SHOT_POSITIONS: Record<1 | 2 | 3, string[]> = {
  1: [
    "left-[8%] top-[47%]",
    "left-[9%] top-[53%]",
    "left-[10%] top-[44%]",
    "left-[11%] top-[58%]",
    "left-[12%] top-[49%]",
    "left-[13%] top-[54%]",
  ],
  2: [
    "left-[18%] top-[35%]",
    "left-[20%] top-[42%]",
    "left-[22%] top-[58%]",
    "left-[25%] top-[48%]",
    "left-[21%] top-[65%]",
    "left-[27%] top-[38%]",
    "left-[30%] top-[53%]",
    "left-[24%] top-[30%]",
  ],
  3: [
    "left-[4%] top-[12%]",
    "left-[6%] top-[22%]",
    "left-[8%] top-[76%]",
    "left-[10%] top-[86%]",
    "left-[31%] top-[17%]",
    "left-[34%] top-[26%]",
    "left-[36%] top-[74%]",
    "left-[33%] top-[83%]",
    "left-[42%] top-[35%]",
    "left-[44%] top-[62%]",
  ],
};

const RIGHT_SHOT_POSITIONS: Record<1 | 2 | 3, string[]> = {
  1: [
    "right-[8%] top-[47%]",
    "right-[9%] top-[53%]",
    "right-[10%] top-[44%]",
    "right-[11%] top-[58%]",
    "right-[12%] top-[49%]",
    "right-[13%] top-[54%]",
  ],
  2: [
    "right-[18%] top-[35%]",
    "right-[20%] top-[42%]",
    "right-[22%] top-[58%]",
    "right-[25%] top-[48%]",
    "right-[21%] top-[65%]",
    "right-[27%] top-[38%]",
    "right-[30%] top-[53%]",
    "right-[24%] top-[30%]",
  ],
  3: [
    "right-[4%] top-[12%]",
    "right-[6%] top-[22%]",
    "right-[8%] top-[76%]",
    "right-[10%] top-[86%]",
    "right-[31%] top-[17%]",
    "right-[34%] top-[26%]",
    "right-[36%] top-[74%]",
    "right-[33%] top-[83%]",
    "right-[42%] top-[35%]",
    "right-[44%] top-[62%]",
  ],
};

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { language, setLanguage } = useLanguage();
  const t: TranslationCopy = translations[language as "fr" | "en"] ?? translations.fr;
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLivePinned, setIsLivePinned] = useState(false);
  const liveScorePiP = useLiveScorePiP({ width: 340, height: 160 });
  const [activeTab, setActiveTab] = useState<"overview" | "boxscore" | "highlights" | "pictures">("overview");
  const [playerHeadshots, setPlayerHeadshots] = useState<Record<string, string>>({});
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const livePlayerContainerRef = useRef<HTMLDivElement | null>(null);
  const tabContentRef = useRef<HTMLDivElement | null>(null);
  const [isLivePlayerFullscreen, setIsLivePlayerFullscreen] = useState(false);
  const [overviewAnimationProgress, setOverviewAnimationProgress] = useState(0);
  const allowLocalHiddenPreview = process.env.NEXT_PUBLIC_LOCAL_LIVE_SANDBOX === "true";

  useEffect(() => {
    const gameRef = doc(firebaseDB, "games", gameId);
    const unsubscribe = onSnapshot(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setGame(snapshot.data() as GameData);
        } else {
          setGame(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to game:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  useEffect(() => {
    const syncPinned = () => setIsLivePinned(readPinnedLiveGameId() === gameId);
    syncPinned();
    window.addEventListener(LIVE_PIN_CHANGED_EVENT, syncPinned);
    window.addEventListener("storage", syncPinned);
    return () => {
      window.removeEventListener(LIVE_PIN_CHANGED_EVENT, syncPinned);
      window.removeEventListener("storage", syncPinned);
    };
  }, [gameId]);

  useEffect(() => {
    const fetchRosterHeadshots = async () => {
      if (!game?.homeTeamId && !game?.awayTeamId) return;

      try {
        const teamIds = [game?.homeTeamId, game?.awayTeamId].filter(Boolean) as string[];
        const snapshots = await Promise.all(
          teamIds.map((teamId) => getDocs(collection(firebaseDB, `teams/${teamId}/roster`)))
        );

        const map: Record<string, string> = {};
        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((playerDoc) => {
            const data = playerDoc.data() as { headshot?: string; firstName?: string; lastName?: string; number?: number | string };
            const headshot = data.headshot || "";
            if (!headshot) return;

            map[playerDoc.id] = headshot;
            const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
            if (fullName) {
              map[`name:${normalizePlayerName(fullName)}`] = headshot;
            }
            if (data.number !== undefined && data.number !== null) {
              map[`number:${String(data.number)}`] = headshot;
            }
          });
        });

        setPlayerHeadshots(map);
      } catch (error) {
        console.error("Error fetching roster headshots:", error);
      }
    };

    fetchRosterHeadshots();
  }, [game?.homeTeamId, game?.awayTeamId]);

  const gamePhotos = [game?.photoUrls, game?.gamePhotos, game?.photos].find((field) => Array.isArray(field)) || [];
  const teamGender = game?.gender === "women" ? "women" : "men";
  const awayTeamHref = game?.awayTeamName ? `/team/${encodeURIComponent(game.awayTeamName)}?gender=${teamGender}` : "/";
  const homeTeamHref = game?.homeTeamName ? `/team/${encodeURIComponent(game.homeTeamName)}?gender=${teamGender}` : "/";

  useEffect(() => {
    if (activePhotoIndex === null || gamePhotos.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePhotoIndex(null);
      }
      if (event.key === "ArrowLeft") {
        setActivePhotoIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + gamePhotos.length) % gamePhotos.length;
        });
      }
      if (event.key === "ArrowRight") {
        setActivePhotoIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % gamePhotos.length;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhotoIndex, gamePhotos.length]);

  useEffect(() => {
    if (activePhotoIndex === null) return;
    if (gamePhotos.length === 0) {
      const frameId = window.requestAnimationFrame(() => {
        setActivePhotoIndex(null);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
    if (activePhotoIndex >= gamePhotos.length) {
      const frameId = window.requestAnimationFrame(() => {
        setActivePhotoIndex(0);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [activePhotoIndex, gamePhotos.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      const fullscreenElement = document.fullscreenElement || docWithWebkit.webkitFullscreenElement || null;
      setIsLivePlayerFullscreen(fullscreenElement === livePlayerContainerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!tabContentRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const animation = tabContentRef.current.animate(
      [
        { opacity: 0, transform: "translate3d(28px, 0, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      }
    );

    return () => animation.cancel();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "overview" || !game) {
      const frameId = window.requestAnimationFrame(() => {
        setOverviewAnimationProgress(0);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frameId = window.requestAnimationFrame(() => {
        setOverviewAnimationProgress(1);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    let animationFrameId = 0;
    const duration = 1800;
    const startTime = performance.now();
    const initialFrameId = window.requestAnimationFrame(() => {
      setOverviewAnimationProgress(0);
    });

    const animate = (now: number) => {
      const rawProgress = Math.min((now - startTime) / duration, 1);
      const fastPhase = 1 - Math.pow(1 - rawProgress, 3);
      const tailStart = 0.65;
      let easedProgress = fastPhase;

      if (rawProgress > tailStart) {
        const tailStartValue = 1 - Math.pow(1 - tailStart, 3);
        const tailT = (rawProgress - tailStart) / (1 - tailStart);
        const slowTail = tailT * tailT * (3 - 2 * tailT);
        easedProgress = tailStartValue + (1 - tailStartValue) * slowTail;
      }

      setOverviewAnimationProgress(easedProgress);

      if (rawProgress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(initialFrameId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeTab, gameId, game]);

  // Update PiP window when game data changes
  useEffect(() => {
    if (!liveScorePiP.isOpen || !game) return;

    const liveStatusPiP = String(game.status || "").toLowerCase() === "live";
    if (!liveStatusPiP) {
      liveScorePiP.close();
      return;
    }

    const homeScorePiP = game.homeScore ?? game.winnerScore ?? 0;
    const awayScorePiP = game.awayScore ?? game.loserScore ?? 0;
    const periodPiP = game.period || game.quarter || "";
    const clockPiP = game.gameClock || game.clock || game.timeRemaining || "";

    liveScorePiP.render({
      homeTeam: game.homeTeamName || "Home",
      awayTeam: game.awayTeamName || "Away",
      homeScore: typeof homeScorePiP === "number" ? homeScorePiP : Number(homeScorePiP) || 0,
      awayScore: typeof awayScorePiP === "number" ? awayScorePiP : Number(awayScorePiP) || 0,
      period: String(periodPiP),
      clock: String(clockPiP),
    });
  }, [liveScorePiP, game]);

  // Handle PiP button click
  const handleTogglePiP = async () => {
    if (liveScorePiP.isOpen) {
      liveScorePiP.close();
      return;
    }

    const opened = await liveScorePiP.open();
    if (!opened || !game) return;

    const homeScorePiP = game.homeScore ?? game.winnerScore ?? 0;
    const awayScorePiP = game.awayScore ?? game.loserScore ?? 0;
    const periodPiP = game.period || game.quarter || "";
    const clockPiP = game.gameClock || game.clock || game.timeRemaining || "";

    liveScorePiP.render({
      homeTeam: game.homeTeamName || "Home",
      awayTeam: game.awayTeamName || "Away",
      homeScore: typeof homeScorePiP === "number" ? homeScorePiP : Number(homeScorePiP) || 0,
      awayScore: typeof awayScorePiP === "number" ? awayScorePiP : Number(awayScorePiP) || 0,
      period: String(periodPiP),
      clock: String(clockPiP),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <p className="text-white">{t.loading}</p>
      </div>
    );
  }

  const toNumberOrNull = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const winnerScoreValue = toNumberOrNull(game?.winnerScore);
  const loserScoreValue = toNumberOrNull(game?.loserScore);
  const hasOfficialFinalScore = winnerScoreValue !== null && loserScoreValue !== null;
  const hasStatsModuleData = Array.isArray(game?.playerStats) && game.playerStats.length > 0;

  const normalizedStatus = String(game?.status || "").toLowerCase();
  const isFinishedGame = Boolean(
    hasOfficialFinalScore &&
      hasStatsModuleData &&
      (game?.completed ||
        normalizedStatus === "completed" ||
        normalizedStatus === "final" ||
        normalizedStatus === "finished")
  );

  if (!game || (game.isHiddenFromPublic && !allowLocalHiddenPreview && !isFinishedGame)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">{t.gameNotFound}</p>
          <Link href="/" className="text-blue-400 hover:underline">{t.backToHome}</Link>
        </div>
      </div>
    );
  }

  const hasDirectHomeAwayScores =
    typeof game.homeScore === "number" && typeof game.awayScore === "number";
  const hasWinnerLoserScores =
    winnerScoreValue !== null && loserScoreValue !== null;

  const homeScore = hasDirectHomeAwayScores
    ? game.homeScore
    : hasWinnerLoserScores
      ? game.winnerTeamId === game.homeTeamId
        ? winnerScoreValue
        : loserScoreValue
      : undefined;

  const awayScore = hasDirectHomeAwayScores
    ? game.awayScore
    : hasWinnerLoserScores
      ? game.winnerTeamId === game.awayTeamId
        ? winnerScoreValue
        : loserScoreValue
      : undefined;

  const homeWon =
    game.winnerTeamId === game.homeTeamId ||
    (typeof homeScore === "number" && typeof awayScore === "number" && homeScore > awayScore);

  const liveStatus = normalizedStatus === "live";
  const livePeriod = [game.period, game.quarter]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== "")
    ?.toString();
  const formattedLivePeriod = (() => {
    const raw = String(livePeriod || "").trim();
    if (!raw) return "";
    if (/^(ht|mt|half|halftime|mi[-\s]?temps|pause|break)$/i.test(raw)) {
      return language === "fr" ? "MT" : "HT";
    }
    if (/^q/i.test(raw)) {
      return raw.toUpperCase();
    }
    return `Q${raw}`;
  })();
  const liveClockDisplay =
    game.gameClock || game.clock || game.timeRemaining || "";

  const activeTimeoutSide =
    game.activeTimeout && typeof game.activeTimeout === "object"
      ? (game.activeTimeout as { side?: "home" | "away" }).side
      : undefined;

  const activeTimeoutTeamName =
    activeTimeoutSide === "home"
      ? game.homeTeamName || t.home
      : activeTimeoutSide === "away"
        ? game.awayTeamName || t.away
        : "";

  const pinButtonLabel = isLivePinned ? t.unpinLiveScore : t.pinLiveScore;
  const pinBadgeLabel = isLivePinned ? t.pinnedLiveScore : "";

  const togglePinnedLiveScore = () => {
    if (isLivePinned) {
      clearPinnedLiveGameId();
    } else {
      writePinnedLiveGameId(gameId);
    }
    emitLivePinChanged();
    setIsLivePinned(!isLivePinned);
  };

  const rawPlayByPlay = ([game.playByPlay, game.livePlays, game.scoreEvents, game.events, game.timeline].find(Array.isArray) as unknown[] | undefined) || [];
  const normalizedPlayByPlay = rawPlayByPlay
    .map((entry, index) => normalizePlayEvent(entry, index, game.homeTeamName || "", game.awayTeamName || "", game.homeTeamId, game.awayTeamId))
    .filter((entry): entry is NormalizedPlayEvent => entry !== null)
    .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

  // Get player stats
  const homeStats = game.playerStats?.filter(p => p.teamId === game.homeTeamId) || [];
  const awayStats = game.playerStats?.filter(p => p.teamId === game.awayTeamId) || [];
  const sortByPointsDesc = (stats: PlayerStat[]) =>
    [...stats].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  // Filter out DNP players from box score display
  const homeStatsSorted = sortByPointsDesc(homeStats).filter(p => !p.dnp);
  const awayStatsSorted = sortByPointsDesc(awayStats).filter(p => !p.dnp);

  // Find game leaders (exclude DNP players)
  const allPlayers = [...homeStats, ...awayStats].filter(p => !p.dnp);
  const pointsLeader = allPlayers.reduce((max, p) => p.pts > max.pts ? p : max, allPlayers[0] || { pts: 0 } as PlayerStat);
  const reboundsLeader = allPlayers.reduce((max, p) => p.reb > max.reb ? p : max, allPlayers[0] || { reb: 0 } as PlayerStat);
  const assistsLeader = allPlayers.reduce((max, p) => p.ast > max.ast ? p : max, allPlayers[0] || { ast: 0 } as PlayerStat);

  // Calculate team totals
  const calculateTeamTotals = (stats: PlayerStat[]) => {
    return stats.reduce((acc, p) => ({
      fgm: acc.fgm + p.two_pm + p.three_pm,
      fga: acc.fga + p.two_pa + p.three_pa,
      tpm: acc.tpm + p.three_pm,
      tpa: acc.tpa + p.three_pa,
      ftm: acc.ftm + p.ft_m,
      fta: acc.fta + p.ft_a,
      reb: acc.reb + p.reb,
      ast: acc.ast + p.ast,
      stl: acc.stl + p.stl,
      blk: acc.blk + p.blk,
      to: acc.to + p.to,
    }), { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 });
  };

  const homeTotals = calculateTeamTotals(homeStats);
  const awayTotals = calculateTeamTotals(awayStats);

  const awayFgPct = awayTotals.fga > 0 ? (awayTotals.fgm / awayTotals.fga) * 100 : 0;
  const homeFgPct = homeTotals.fga > 0 ? (homeTotals.fgm / homeTotals.fga) * 100 : 0;
  const awayThreePct = awayTotals.tpa > 0 ? (awayTotals.tpm / awayTotals.tpa) * 100 : 0;
  const homeThreePct = homeTotals.tpa > 0 ? (homeTotals.tpm / homeTotals.tpa) * 100 : 0;
  const totalRebounds = awayTotals.reb + homeTotals.reb || 1;
  const totalAssists = awayTotals.ast + homeTotals.ast || 1;

  const animatedPoints = Math.round((pointsLeader?.pts || 0) * overviewAnimationProgress);
  const animatedRebounds = Math.round((reboundsLeader?.reb || 0) * overviewAnimationProgress);
  const animatedAssists = Math.round((assistsLeader?.ast || 0) * overviewAnimationProgress);
  const animatedAwayFgPct = (awayFgPct * overviewAnimationProgress).toFixed(1);
  const animatedHomeFgPct = (homeFgPct * overviewAnimationProgress).toFixed(1);
  const animatedAwayThreePct = (awayThreePct * overviewAnimationProgress).toFixed(1);
  const animatedHomeThreePct = (homeThreePct * overviewAnimationProgress).toFixed(1);
  const animatedAwayRebounds = Math.round(awayTotals.reb * overviewAnimationProgress);
  const animatedHomeRebounds = Math.round(homeTotals.reb * overviewAnimationProgress);
  const animatedAwayAssists = Math.round(awayTotals.ast * overviewAnimationProgress);
  const animatedHomeAssists = Math.round(homeTotals.ast * overviewAnimationProgress);

  const scoreMargin = Math.abs((homeScore || 0) - (awayScore || 0));
  const leadingSide = (homeScore || 0) === (awayScore || 0) ? null : (homeScore || 0) > (awayScore || 0) ? "home" : "away";
  const leadingTeamName = leadingSide === "home" ? (game.homeTeamName || "Home") : leadingSide === "away" ? (game.awayTeamName || "Away") : "";

  const homeLargestLead = toNumberOrNull(game.homeLargestLead);
  const awayLargestLead = toNumberOrNull(game.awayLargestLead);
  const genericLargestLead = toNumberOrNull(game.largestLead);
  const explicitLargestLeadSide: "home" | "away" | null =
    game.largestLeadTeamId && game.homeTeamId && game.largestLeadTeamId === game.homeTeamId
      ? "home"
      : game.largestLeadTeamId && game.awayTeamId && game.largestLeadTeamId === game.awayTeamId
        ? "away"
        : game.largestLeadTeamName && game.homeTeamName && game.largestLeadTeamName === game.homeTeamName
          ? "home"
          : game.largestLeadTeamName && game.awayTeamName && game.largestLeadTeamName === game.awayTeamName
            ? "away"
            : null;

  const resolvedLargestLead = (() => {
    if (typeof homeLargestLead === "number" || typeof awayLargestLead === "number") {
      const homeValue = homeLargestLead || 0;
      const awayValue = awayLargestLead || 0;
      if (homeValue >= awayValue) {
        return { side: "home" as const, value: homeValue };
      }
      return { side: "away" as const, value: awayValue };
    }
    if (typeof genericLargestLead === "number") {
      return {
        side: explicitLargestLeadSide || leadingSide || "home",
        value: genericLargestLead,
      };
    }
    return {
      side: leadingSide || "home",
      value: scoreMargin,
    };
  })();

  let currentRunSide: "home" | "away" | null = null;
  let currentRunPoints = 0;
  for (let index = normalizedPlayByPlay.length - 1; index >= 0; index -= 1) {
    const event = normalizedPlayByPlay[index];
    if (!event.side || !event.points) continue;
    if (!currentRunSide) {
      currentRunSide = event.side;
      currentRunPoints = event.points;
      continue;
    }
    if (event.side === currentRunSide) {
      currentRunPoints += event.points;
      continue;
    }
    break;
  }

  let leadChanges = 0;
  if (normalizedPlayByPlay.length > 0) {
    let runningHome = 0;
    let runningAway = 0;
    let previousLeader: "home" | "away" | "tie" = "tie";
    normalizedPlayByPlay.forEach((event) => {
      if (!event.side || !event.points) return;
      if (event.side === "home") runningHome += event.points;
      if (event.side === "away") runningAway += event.points;
      const nextLeader: "home" | "away" | "tie" =
        runningHome === runningAway ? "tie" : runningHome > runningAway ? "home" : "away";
      if (previousLeader !== "tie" && nextLeader !== "tie" && previousLeader !== nextLeader) {
        leadChanges += 1;
      }
      previousLeader = nextLeader;
    });
  }

  const latestPlayByPlay = normalizedPlayByPlay.slice(-8).reverse();
  const lastScoreEvent = latestPlayByPlay.find((event) => event.points > 0 && event.side);
  const shotAnimation =
    lastScoreEvent && lastScoreEvent.side && (lastScoreEvent.points === 1 || lastScoreEvent.points === 2 || lastScoreEvent.points === 3)
      ? {
          eventKey: `${lastScoreEvent.id}-${lastScoreEvent.timestampMs}-${lastScoreEvent.points}-${lastScoreEvent.side}`,
          side: lastScoreEvent.side,
          points: lastScoreEvent.points as 1 | 2 | 3,
        }
      : null;

  const shotMarkers: ShotMarker[] = normalizedPlayByPlay
    .filter((event) => event.side && (event.points === 1 || event.points === 2 || event.points === 3))
    .slice(-26)
    .map((event) => {
      const points = event.points as 1 | 2 | 3;
      const side = event.side as "home" | "away";
      const pool = side === "away" ? LEFT_SHOT_POSITIONS[points] : RIGHT_SHOT_POSITIONS[points];
      const markerHash = hashFromString(`${event.id}-${event.timestampMs}-${event.side}-${event.points}`);
      return {
        id: `${event.id}-${event.timestampMs}-${event.side}`,
        side,
        points,
        positionClass: pool[markerHash % pool.length],
      };
    });

  const synthesizedPlayByPlay = [
    {
      id: "synthetic-live-score",
      period: formattedLivePeriod,
      clock: liveClockDisplay,
      text: `${game.awayTeamName || "Away"} ${awayScore ?? 0} - ${homeScore ?? 0} ${game.homeTeamName || "Home"}`,
    },
    {
      id: "synthetic-largest-lead",
      period: "",
      clock: "",
      text: `${resolvedLargestLead.side === "home" ? game.homeTeamName || "Home" : game.awayTeamName || "Away"} +${resolvedLargestLead.value}`,
    },
    {
      id: "synthetic-top-scorer",
      period: "",
      clock: "",
      text: pointsLeader && pointsLeader.pts > 0
        ? `${pointsLeader.playerName || pointsLeader.lastName || pointsLeader.firstName || t.unknownPlayer} ${pointsLeader.pts} PTS`
        : `${t.liveScore}: ${awayScore ?? 0}-${homeScore ?? 0}`,
    },
  ];

  const awayFgBarWidth = (awayFgPct * 0.5) * overviewAnimationProgress;
  const homeFgBarWidth = (homeFgPct * 0.5) * overviewAnimationProgress;
  const awayThreeBarWidth = (awayThreePct * 0.5) * overviewAnimationProgress;
  const homeThreeBarWidth = (homeThreePct * 0.5) * overviewAnimationProgress;
  const awayReboundsBarWidth = ((awayTotals.reb / totalRebounds) * 100) * overviewAnimationProgress;
  const homeReboundsBarWidth = ((homeTotals.reb / totalRebounds) * 100) * overviewAnimationProgress;
  const awayAssistsBarWidth = ((awayTotals.ast / totalAssists) * 100) * overviewAnimationProgress;
  const homeAssistsBarWidth = ((homeTotals.ast / totalAssists) * 100) * overviewAnimationProgress;

  const boxScoreColumns: Array<{
    key: string;
    label: string;
    value: (player: PlayerStat) => string | number;
    className?: string;
  }> = [
    { key: "pts", label: "PTS", value: (player) => player.pts, className: "font-bold text-sm sm:text-base" },
    { key: "min", label: "MIN", value: (player) => player.min || 0 },
    { key: "reb", label: "REB", value: (player) => player.reb },
    { key: "oreb", label: "RO", value: (player) => player.oreb || 0 },
    { key: "dreb", label: "RD", value: (player) => player.dreb || 0 },
    { key: "ast", label: "AST", value: (player) => player.ast },
    { key: "stl", label: "INT", value: (player) => player.stl },
    { key: "blk", label: "CTR", value: (player) => player.blk },
    { key: "to", label: "BP", value: (player) => player.to },
    { key: "pf", label: "FT", value: (player) => player.pf },
    { key: "fd", label: "FD", value: (player) => player.fd || 0 },
    { key: "fgm", label: "TMR", value: (player) => (player.fgm ?? (player.two_pm + player.three_pm)) },
    { key: "fga", label: "TTR", value: (player) => (player.fga ?? (player.two_pa + player.three_pa)) },
    { key: "two_pm", label: "2PM", value: (player) => player.two_pm },
    { key: "two_pa", label: "2PA", value: (player) => player.two_pa },
    { key: "three_pm", label: "3PM", value: (player) => player.three_pm },
    { key: "three_pa", label: "3PA", value: (player) => player.three_pa },
    { key: "ft_m", label: "LFM", value: (player) => player.ft_m },
    { key: "ft_a", label: "LFA", value: (player) => player.ft_a },
    { key: "plus_minus", label: "+/-", value: (player) => (player.plus_minus ?? player.plusMinus ?? 0) },
  ];

  // Format date in the appropriate language — convert from Congo TZ to user's local TZ
  const gameDateObj = parseCongoDateTime(game.date, game.time);
  const formattedDate = gameDateObj
    ? gameDateObj.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : '';
  const formattedTime = gameDateObj
    ? gameDateObj.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: language !== 'fr',
      })
    : (game.time || '');

  const getPlayerDisplayName = (player: PlayerStat) => {
    const fullName = `${player.firstName || ""} ${player.lastName || ""}`.trim();
    if (fullName) return fullName;
    if (player.playerName && player.playerName.trim()) return player.playerName.trim();
    if (player.lastName && player.lastName.trim()) return player.lastName.trim();
    if (player.firstName && player.firstName.trim()) return player.firstName.trim();
    return t.unknownPlayer;
  };

  const getPlayerLastName = (player: PlayerStat) => {
    if (player.lastName && player.lastName.trim()) return player.lastName.trim();
    const full = getPlayerDisplayName(player);
    const parts = full.split(" ").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : full;
  };

  const getPlayerHeadshot = (player: PlayerStat) => {
    if (player.headshot) return player.headshot;
    if (player.playerId && playerHeadshots[player.playerId]) return playerHeadshots[player.playerId];
    const normalizedName = normalizePlayerName(getPlayerDisplayName(player));
    if (normalizedName && playerHeadshots[`name:${normalizedName}`]) return playerHeadshots[`name:${normalizedName}`];
    if (player.number !== undefined && player.number !== null && playerHeadshots[`number:${String(player.number)}`]) {
      return playerHeadshots[`number:${String(player.number)}`];
    }
    return "";
  };

  const getPlayerTeamName = (player: PlayerStat) => {
    if (player.teamId && player.teamId === game.homeTeamId) return game.homeTeamName || "";
    if (player.teamId && player.teamId === game.awayTeamId) return game.awayTeamName || "";
    return "";
  };

  const getPlayerProfileHref = (player: PlayerStat) => {
    const teamName = getPlayerTeamName(player);
    const hasNumber = player.number !== undefined && player.number !== null && String(player.number).trim() !== "";
    const routeTeamId =
      player.teamId && (player.teamId === game.homeTeamId || player.teamId === game.awayTeamId)
        ? player.teamId
        : "";
    const routeTeamToken = routeTeamId || teamName;
    const routeGender = game.gender === "women" ? "women" : "men";

    if (teamName && hasNumber) {
      return `/player/${encodeURIComponent(teamName)}/${encodeURIComponent(String(player.number))}`;
    }

    if (routeTeamToken) {
      return `/team/${encodeURIComponent(routeTeamToken)}?gender=${routeGender}`;
    }

    return "/";
  };

  const highlightsVideoSource =
    game.highlightsVideoUrl ||
    game.highlightsUrl ||
    game.highlightVideoUrl ||
    game.highlightUrl ||
    game.videoUrl ||
    game.youtubeUrl ||
    game.streamUrl ||
    "";

  const liveStreamSource =
    game.streamUrl ||
    game.youtubeUrl ||
    game.highlightsVideoUrl ||
    game.highlightVideoUrl ||
    "";

  const highlightEmbed = highlightsVideoSource ? toEmbedVideoUrl(highlightsVideoSource) : null;
  const liveEmbed = liveStreamSource ? toEmbedVideoUrl(liveStreamSource) : null;
  const hasLiveScoreData = typeof homeScore === "number" && typeof awayScore === "number";
  const shouldShowLiveScorePanel = !isFinishedGame && (liveStatus || hasLiveScoreData);
  const shouldShowLiveEmbed = !isFinishedGame && liveStatus && Boolean(liveEmbed);

  const toggleLivePlayerFullscreen = async () => {
    const container = livePlayerContainerRef.current;
    if (!container) return;

    const docWithWebkit = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const elementWithWebkit = container as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const isContainerFullscreen =
      document.fullscreenElement === container || docWithWebkit.webkitFullscreenElement === container;

    try {
      if (isContainerFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (docWithWebkit.webkitExitFullscreen) {
          await docWithWebkit.webkitExitFullscreen();
        }
      } else {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (elementWithWebkit.webkitRequestFullscreen) {
          await elementWithWebkit.webkitRequestFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  };

  const closePhotoViewer = () => setActivePhotoIndex(null);
  const showPreviousPhoto = () => {
    if (!gamePhotos.length || activePhotoIndex === null) return;
    setActivePhotoIndex((activePhotoIndex - 1 + gamePhotos.length) % gamePhotos.length);
  };
  const showNextPhoto = () => {
    if (!gamePhotos.length || activePhotoIndex === null) return;
    setActivePhotoIndex((activePhotoIndex + 1) % gamePhotos.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 live-pin-offset z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <Image src="/logos/liprobakin.png" alt="Liprobakin" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
              <span className="hidden sm:inline text-lg sm:text-xl font-bold tracking-wider">LIPROBAKIN</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/60 p-1" aria-label={t.language}>
                <button
                  type="button"
                  onClick={() => setLanguage("fr")}
                  className={`rounded px-2 py-1 text-xs font-semibold transition ${
                    language === "fr" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
                  }`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`rounded px-2 py-1 text-xs font-semibold transition ${
                    language === "en" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
                  }`}
                >
                  EN
                </button>
              </div>
              <Link href="/" className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-400 hover:text-white hover:border-white/30 transition-colors">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden xs:inline">{t.backToHome.replace('← ', '')}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="live-pin-content-offset mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        {/* Game Header - Score Display */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                isFinishedGame
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : liveStatus
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}>
                {isFinishedGame ? t.final : liveStatus ? t.liveNow : t.scheduled}
              </span>
              {liveStatus && (
                <button
                  type="button"
                  onClick={togglePinnedLiveScore}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                    isLivePinned
                      ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {pinButtonLabel}
                  {pinBadgeLabel ? (
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-100">
                      {pinBadgeLabel}
                    </span>
                  ) : null}
                </button>
              )}
              {liveStatus && liveScorePiP.isSupported && (
                <button
                  type="button"
                  onClick={handleTogglePiP}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                    liveScorePiP.isOpen
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                  title={liveScorePiP.isOpen ? t.closePiP : t.openPiP}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {liveScorePiP.isOpen ? t.pipActive : t.openPiP}
                </button>
              )}
              {isFinishedGame && game.winByForfeit === true && (
                <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider bg-orange-500/15 text-orange-200 border border-orange-500/30">
                  {t.winPerForfeit}
                </span>
              )}
              {liveStatus && activeTimeoutSide && (
                <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-200 border border-amber-500/30">
                  {t.timeout} {activeTimeoutTeamName}
                </span>
              )}
              {game.date && (
                <span className="text-xs sm:text-sm text-slate-400">
                  {formattedDate}
                </span>
              )}
            </div>
            
            {(game.time || game.venue) && (
              <div className="flex flex-wrap gap-2.5 text-xs text-slate-400 sm:gap-4 sm:text-sm">
                {game.time && (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formattedTime}
                  </div>
                )}
                {game.venue && (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {game.venue}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Score Cards - Teams side by side */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6 overflow-hidden">
            <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between sm:gap-4 md:gap-8">
              {/* Away Team */}
              <div className={`order-1 flex items-center gap-2 sm:gap-3 md:gap-4 sm:flex-1 min-w-0 ${!homeWon && isFinishedGame ? "opacity-100" : isFinishedGame ? "opacity-60" : ""}`}>
                <Link
                  href={awayTeamHref}
                  className="group flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0"
                  aria-label={game.awayTeamName ? `View ${game.awayTeamName}` : "View away team"}
                >
                {game.awayTeamLogo && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                    <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={56} height={56} className="rounded-full border-2 border-white/20 object-cover w-full h-full transition group-hover:border-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{t.away}</p>
                  <h2 className="text-base sm:text-xl md:text-2xl font-bold truncate transition group-hover:text-orange-300">{game.awayTeamName}</h2>
                </div>
                </Link>
              </div>

              {/* Score Display */}
              {(isFinishedGame || shouldShowLiveScorePanel) && (
                <div className="order-2 flex items-center justify-center gap-1 sm:gap-2 md:gap-4 text-center flex-shrink-0">
                  <div className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black ${!homeWon ? "text-orange-400" : "text-slate-500"}`}>{awayScore ?? 0}</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-600">-</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black ${homeWon ? "text-orange-400" : "text-slate-500"}`}>{homeScore ?? 0}</div>
                </div>
              )}

              {/* Home Team */}
              <div className={`order-3 flex items-center gap-2 sm:gap-3 md:gap-4 sm:flex-1 min-w-0 justify-end ${homeWon && isFinishedGame ? "opacity-100" : isFinishedGame ? "opacity-60" : ""}`}>
                <Link
                  href={homeTeamHref}
                  className="group flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0"
                  aria-label={game.homeTeamName ? `View ${game.homeTeamName}` : "View home team"}
                >
                  <div className="text-right min-w-0 flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{t.home}</p>
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold truncate transition group-hover:text-orange-300">{game.homeTeamName}</h2>
                  </div>
                  {game.homeTeamLogo && (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                      <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={56} height={56} className="rounded-full border-2 border-white/20 object-cover w-full h-full transition group-hover:border-white/40" />
                    </div>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {shouldShowLiveScorePanel && !shouldShowLiveEmbed && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-red-300">{t.liveNow}</p>
                <h3 className="text-base font-bold text-white sm:text-lg">{t.liveScore}</h3>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                LIVE
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#6a4b2d]">
              <div className="relative mx-auto aspect-[16/8] w-full max-w-4xl bg-[linear-gradient(180deg,rgba(194,151,101,0.95),rgba(153,113,74,0.95))]">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0,rgba(255,255,255,0.05)_2%,transparent_4%,transparent_6%,rgba(255,255,255,0.05)_8%,transparent_10%,transparent_100%)] opacity-30" />
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" />
                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55" />

                <div className="absolute left-[2.2%] top-[20%] h-[60%] w-[12%] border-2 border-white/60" />
                <div className="absolute right-[2.2%] top-[20%] h-[60%] w-[12%] border-2 border-white/60" />
                <div className="absolute left-[14.2%] top-1/2 h-[42%] w-[11%] -translate-y-1/2 rounded-r-full border-y-2 border-r-2 border-white/60" />
                <div className="absolute right-[14.2%] top-1/2 h-[42%] w-[11%] -translate-y-1/2 rounded-l-full border-y-2 border-l-2 border-white/60" />
                <div className="absolute left-[7.2%] top-[48.5%] h-[3%] w-[0.9%] rounded-full bg-white/75" />
                <div className="absolute right-[7.2%] top-[48.5%] h-[3%] w-[0.9%] rounded-full bg-white/75" />

                <div className="absolute left-[1.5%] top-[8%] h-[84%] w-[44%] rounded-r-full border-y-2 border-r-2 border-white/60" />
                <div className="absolute right-[1.5%] top-[8%] h-[84%] w-[44%] rounded-l-full border-y-2 border-l-2 border-white/60" />
                <div className="absolute left-[1.5%] top-[13%] h-[74%] w-[2.3%] border-y-2 border-r-2 border-white/60" />
                <div className="absolute right-[1.5%] top-[13%] h-[74%] w-[2.3%] border-y-2 border-l-2 border-white/60" />

                <div className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 opacity-85">
                  <Image src="/logos/liprobakin.png" alt="Liprobakin" width={72} height={72} className="h-14 w-14 rounded-full border border-white/35 object-cover shadow-[0_0_18px_rgba(0,0,0,0.3)] sm:h-16 sm:w-16" />
                </div>

                {shotMarkers.map((marker) => (
                  <div
                    key={marker.id}
                    className={`absolute z-[5] ${marker.positionClass} flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[8px] font-black leading-none ${
                      marker.side === "away"
                        ? "border-slate-300/80 bg-slate-800/75 text-slate-100"
                        : "border-cyan-200/80 bg-cyan-500/70 text-white"
                    }`}
                  >
                    {marker.points === 3 ? "3" : "•"}
                  </div>
                ))}

                {shotAnimation && (
                  <div key={shotAnimation.eventKey} className="pointer-events-none absolute inset-0 z-20">
                    <div
                      className={`shot-track ${shotAnimation.side === "away" ? `shot-left-${shotAnimation.points}` : `shot-right-${shotAnimation.points}`}`}
                    >
                      <span className="shot-ball">🏀</span>
                      <span className="shot-points">+{shotAnimation.points}</span>
                    </div>
                  </div>
                )}

                <div className="absolute inset-y-0 left-0 flex w-1/2 items-center justify-center px-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white/40 bg-black/20 sm:h-16 sm:w-16">
                      {game.awayTeamLogo ? (
                        <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={64} height={64} className="h-full w-full object-cover" unoptimized />
                      ) : null}
                    </div>
                    <p className="max-w-[160px] truncate text-xs font-bold uppercase tracking-[0.14em] text-white sm:text-sm">{game.awayTeamName || "Away"}</p>
                    <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{awayScore ?? 0}</p>
                  </div>
                </div>

                <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center px-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white/40 bg-black/20 sm:h-16 sm:w-16">
                      {game.homeTeamLogo ? (
                        <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={64} height={64} className="h-full w-full object-cover" unoptimized />
                      ) : null}
                    </div>
                    <p className="max-w-[160px] truncate text-xs font-bold uppercase tracking-[0.14em] text-white sm:text-sm">{game.homeTeamName || "Home"}</p>
                    <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{homeScore ?? 0}</p>
                  </div>
                </div>

                <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-white/35 bg-black/45 px-3 py-1.5 text-sm font-black tabular-nums text-white sm:text-base">
                  {awayScore ?? 0} - {homeScore ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.largestLead}</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {(resolvedLargestLead.side === "home" ? game.homeTeamName : game.awayTeamName) || "Team"} +{resolvedLargestLead.value}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.currentRun}</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {currentRunSide
                    ? `${currentRunSide === "home" ? game.homeTeamName || "Home" : game.awayTeamName || "Away"} +${currentRunPoints}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.leadChanges}</p>
                <p className="mt-1 text-sm font-bold text-white">{leadChanges}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.lastScore}</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {lastScoreEvent && lastScoreEvent.side
                    ? `${lastScoreEvent.side === "home" ? game.homeTeamName || "Home" : game.awayTeamName || "Away"} +${lastScoreEvent.points}`
                    : "—"}
                </p>
              </div>
            </div>

            {(formattedLivePeriod || liveClockDisplay) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                {formattedLivePeriod ? (
                  <span className="rounded border border-white/15 bg-white/5 px-2 py-1 font-semibold uppercase tracking-[0.14em]">
                    {formattedLivePeriod}
                  </span>
                ) : null}
                {liveClockDisplay ? (
                  <span className="rounded border border-white/15 bg-white/5 px-2 py-1 font-semibold tabular-nums">
                    {t.liveClock}: {liveClockDisplay}
                  </span>
                ) : null}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/65 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{t.playByPlay}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.scoreFlow}</p>
              </div>

              <div className="space-y-2">
                {(latestPlayByPlay.length > 0
                  ? latestPlayByPlay.map((event) => ({
                      id: event.id,
                      period: event.period,
                      clock: event.clock,
                      text: event.side && event.points
                        ? `${event.side === "home" ? game.homeTeamName || "Home" : game.awayTeamName || "Away"} +${event.points}${event.text ? ` • ${event.text}` : ""}`
                        : event.text,
                    }))
                  : synthesizedPlayByPlay
                ).map((event) => (
                  <div key={event.id} className="flex items-start gap-2 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-200">
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {[event.period, event.clock].filter(Boolean).join(" • ") || "LIVE"}
                    </span>
                    <span className="min-w-0 flex-1">{event.text}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* Tabs */}
        {isFinishedGame && game.playerStats && game.playerStats.length > 0 && (
          <>
            <div className="mb-6 overflow-x-auto">
              <div className="flex min-w-max gap-4 border-b border-white/10">
              <button
                onClick={() => setActiveTab("overview")}
                className={`pb-3 px-1 text-sm font-semibold uppercase tracking-wider transition border-b-2 ${
                  activeTab === "overview" 
                    ? "border-orange-500 text-white" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.overview}
              </button>
              <button
                onClick={() => setActiveTab("boxscore")}
                className={`pb-3 px-1 text-sm font-semibold uppercase tracking-wider transition border-b-2 ${
                  activeTab === "boxscore" 
                    ? "border-orange-500 text-white" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.boxScore}
              </button>
              <button
                onClick={() => setActiveTab("highlights")}
                className={`pb-3 px-1 text-sm font-semibold uppercase tracking-wider transition border-b-2 ${
                  activeTab === "highlights" 
                    ? "border-orange-500 text-white" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.highlights}
              </button>
              <button
                onClick={() => setActiveTab("pictures")}
                className={`pb-3 px-1 text-sm font-semibold uppercase tracking-wider transition border-b-2 ${
                  activeTab === "pictures" 
                    ? "border-orange-500 text-white" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.pictures}
              </button>
              </div>
            </div>

            <div ref={tabContentRef} className="will-change-transform">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Game Leaders */}
                {pointsLeader && pointsLeader.pts > 0 && (
                  <div>
                    <h3 className="mb-4 text-base sm:text-lg font-bold uppercase tracking-wider text-slate-300">{t.gameLeaders}</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                      {/* Points Leader */}
                      <Link
                        href={getPlayerProfileHref(pointsLeader)}
                        className="group min-h-[170px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 sm:min-h-[190px] sm:p-5 overflow-hidden transition hover:border-white/30 hover:bg-white/[0.07]"
                      >
                        <div className="mb-3 flex items-center justify-between sm:mb-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 sm:text-xs sm:tracking-wider">{t.points}</p>
                          <div className="text-2xl font-black text-white/90 sm:text-3xl">{animatedPoints}</div>
                        </div>
                        <div className="flex min-h-[96px] flex-col items-center justify-center gap-2 text-center sm:min-h-[108px] sm:gap-2.5">
                          <div className="h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16">
                            <Image src={getPlayerHeadshot(pointsLeader) || "/logos/liprobakin.png"} alt={pointsLeader.playerName} width={56} height={56} className="h-full w-full rounded-full border border-white/15 object-cover" />
                          </div>
                          <p className="max-w-full px-1 text-sm font-semibold leading-snug text-white break-words sm:text-base">
                            {getPlayerDisplayName(pointsLeader)}
                          </p>
                        </div>
                      </Link>

                      {/* Rebounds Leader */}
                      <Link
                        href={getPlayerProfileHref(reboundsLeader)}
                        className="group min-h-[170px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 sm:min-h-[190px] sm:p-5 overflow-hidden transition hover:border-white/30 hover:bg-white/[0.07]"
                      >
                        <div className="mb-3 flex items-center justify-between sm:mb-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 sm:text-xs sm:tracking-wider">{t.rebounds}</p>
                          <div className="text-2xl font-black text-white/90 sm:text-3xl">{animatedRebounds}</div>
                        </div>
                        <div className="flex min-h-[96px] flex-col items-center justify-center gap-2 text-center sm:min-h-[108px] sm:gap-2.5">
                          <div className="h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16">
                            <Image src={getPlayerHeadshot(reboundsLeader) || "/logos/liprobakin.png"} alt={reboundsLeader.playerName} width={56} height={56} className="h-full w-full rounded-full border border-white/15 object-cover" />
                          </div>
                          <p className="max-w-full px-1 text-sm font-semibold leading-snug text-white break-words sm:text-base">
                            {getPlayerDisplayName(reboundsLeader)}
                          </p>
                        </div>
                      </Link>

                      {/* Assists Leader */}
                      <Link
                        href={getPlayerProfileHref(assistsLeader)}
                        className="group min-h-[170px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 sm:min-h-[190px] sm:p-5 overflow-hidden transition hover:border-white/30 hover:bg-white/[0.07]"
                      >
                        <div className="mb-3 flex items-center justify-between sm:mb-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 sm:text-xs sm:tracking-wider">{t.assists}</p>
                          <div className="text-2xl font-black text-white/90 sm:text-3xl">{animatedAssists}</div>
                        </div>
                        <div className="flex min-h-[96px] flex-col items-center justify-center gap-2 text-center sm:min-h-[108px] sm:gap-2.5">
                          <div className="h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16">
                            <Image src={getPlayerHeadshot(assistsLeader) || "/logos/liprobakin.png"} alt={assistsLeader.playerName} width={56} height={56} className="h-full w-full rounded-full border border-white/15 object-cover" />
                          </div>
                          <p className="max-w-full px-1 text-sm font-semibold leading-snug text-white break-words sm:text-base">
                            {getPlayerDisplayName(assistsLeader)}
                          </p>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Team Stats Comparison */}
                <div>
                  <h3 className="mb-4 text-base sm:text-lg font-bold uppercase tracking-wider text-slate-300">{t.teamStats}</h3>
                  <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6 overflow-hidden">
                    {/* FG% */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{animatedAwayFgPct}%</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.fgPercent}</span>
                        <span className="font-bold">{animatedHomeFgPct}%</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayFgBarWidth}%` }} />
                        <div className="bg-orange-500 ml-auto" style={{ width: `${homeFgBarWidth}%` }} />
                      </div>
                    </div>

                    {/* 3PT% */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{animatedAwayThreePct}%</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.threePercent}</span>
                        <span className="font-bold">{animatedHomeThreePct}%</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayThreeBarWidth}%` }} />
                        <div className="bg-orange-500 ml-auto" style={{ width: `${homeThreeBarWidth}%` }} />
                      </div>
                    </div>

                    {/* Rebounds */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{animatedAwayRebounds}</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.rebounds}</span>
                        <span className="font-bold">{animatedHomeRebounds}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayReboundsBarWidth}%` }} />
                        <div className="bg-orange-500" style={{ width: `${homeReboundsBarWidth}%` }} />
                      </div>
                    </div>

                    {/* Assists */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{animatedAwayAssists}</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.assists}</span>
                        <span className="font-bold">{animatedHomeAssists}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayAssistsBarWidth}%` }} />
                        <div className="bg-orange-500" style={{ width: `${homeAssistsBarWidth}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Box Score Tab */}
            {activeTab === "boxscore" && (
              <div className="space-y-6 sm:space-y-8">
                {/* Away Team */}
                <div>
                  <h3 className="mb-3 sm:mb-4 flex items-center gap-2 text-base sm:text-lg font-bold">
                    {game.awayTeamLogo && <Image src={game.awayTeamLogo} alt="" width={32} height={32} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white/20 object-cover" />}
                    <span className="truncate">{game.awayTeamName}</span>
                  </h3>
                  <div className="space-y-2 sm:hidden">
                    {awayStatsSorted.map((player) => {
                      const shotLine = `${player.two_pm + player.three_pm}/${player.two_pa + player.three_pa}`;
                      return (
                        <div key={player.playerId} className="rounded-lg border border-white/10 bg-slate-900/60 p-2.5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-white">
                                #{player.number || 0} {getPlayerDisplayName(player)}
                                {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                              </p>
                            </div>
                            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{t.pts}: {player.pts}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-[10px] text-slate-300">
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">MIN {player.min || 0}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">REB {player.reb}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">AST {player.ast}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">FG {shotLine}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/10 -mx-4 sm:mx-0">
                    <table className="w-full min-w-[1600px]">
                      <thead className="border-b border-white/10 bg-white/5">
                        <tr className="text-xs uppercase text-slate-400">
                          <th className="px-1.5 py-2 sm:p-3 text-center font-semibold sticky left-0 z-40 bg-slate-800 w-[30px] sm:w-[56px]">#</th>
                          <th className="px-1.5 py-2 sm:p-3 text-left font-semibold sticky left-[30px] sm:left-[56px] z-30 bg-slate-800 w-[1%] whitespace-nowrap">{t.player}</th>
                          {boxScoreColumns.map((column) => (
                            <th key={column.key} className="p-2 sm:p-3 text-center font-semibold">{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {awayStatsSorted.map((player) => (
                          <tr key={player.playerId} className="hover:bg-white/5">
                            <td className="px-1.5 py-2 sm:p-3 text-center sticky left-0 bg-slate-900 z-20 text-slate-300 tabular-nums w-[30px] sm:w-[56px]">
                              {player.number || 0}
                            </td>
                            <td className="px-1.5 py-2 sm:p-3 sticky left-[30px] sm:left-[56px] bg-slate-900 whitespace-nowrap z-10 w-[1%]">
                              <div className="flex items-center gap-1 sm:gap-2">
                                {player.headshot && (
                                  <div className="hidden sm:block w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                                    <Image src={player.headshot} alt="" width={32} height={32} className="rounded-full object-cover w-full h-full" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-[11px] sm:text-sm sm:hidden">
                                    {getPlayerLastName(player)}
                                    {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                                  </p>
                                  <p className="font-medium text-xs sm:text-sm hidden sm:block">
                                    {getPlayerDisplayName(player)}
                                    {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                                  </p>
                                </div>
                              </div>
                            </td>
                            {boxScoreColumns.map((column) => (
                              <td key={column.key} className={`p-2 sm:p-3 text-center text-xs sm:text-sm tabular-nums ${column.className || ""}`}>
                                {column.value(player)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Home Team */}
                <div>
                  <h3 className="mb-3 sm:mb-4 flex items-center gap-2 text-base sm:text-lg font-bold">
                    {game.homeTeamLogo && <Image src={game.homeTeamLogo} alt="" width={32} height={32} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white/20 object-cover" />}
                    <span className="truncate">{game.homeTeamName}</span>
                  </h3>
                  <div className="space-y-2 sm:hidden">
                    {homeStatsSorted.map((player) => {
                      const shotLine = `${player.two_pm + player.three_pm}/${player.two_pa + player.three_pa}`;
                      return (
                        <div key={player.playerId} className="rounded-lg border border-white/10 bg-slate-900/60 p-2.5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-white">
                                #{player.number || 0} {getPlayerDisplayName(player)}
                                {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                              </p>
                            </div>
                            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{t.pts}: {player.pts}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-[10px] text-slate-300">
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">MIN {player.min || 0}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">REB {player.reb}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">AST {player.ast}</div>
                            <div className="rounded bg-white/5 px-1.5 py-1 text-center">FG {shotLine}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/10 -mx-4 sm:mx-0">
                    <table className="w-full min-w-[1600px]">
                      <thead className="border-b border-white/10 bg-white/5">
                        <tr className="text-xs uppercase text-slate-400">
                          <th className="px-1.5 py-2 sm:p-3 text-center font-semibold sticky left-0 z-40 bg-slate-800 w-[30px] sm:w-[56px]">#</th>
                          <th className="px-1.5 py-2 sm:p-3 text-left font-semibold sticky left-[30px] sm:left-[56px] z-30 bg-slate-800 w-[1%] whitespace-nowrap">{t.player}</th>
                          {boxScoreColumns.map((column) => (
                            <th key={column.key} className="p-2 sm:p-3 text-center font-semibold">{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {homeStatsSorted.map((player) => (
                          <tr key={player.playerId} className="hover:bg-white/5">
                            <td className="px-1.5 py-2 sm:p-3 text-center sticky left-0 bg-slate-900 z-20 text-slate-300 tabular-nums w-[30px] sm:w-[56px]">
                              {player.number || 0}
                            </td>
                            <td className="px-1.5 py-2 sm:p-3 sticky left-[30px] sm:left-[56px] bg-slate-900 whitespace-nowrap z-10 w-[1%]">
                              <div className="flex items-center gap-1 sm:gap-2">
                                {player.headshot && (
                                  <div className="hidden sm:block w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                                    <Image src={player.headshot} alt="" width={32} height={32} className="rounded-full object-cover w-full h-full" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-[11px] sm:text-sm sm:hidden">
                                    {getPlayerLastName(player)}
                                    {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                                  </p>
                                  <p className="font-medium text-xs sm:text-sm hidden sm:block">
                                    {getPlayerDisplayName(player)}
                                    {player.started ? <span className="ml-1 text-orange-300" title="Starter">★</span> : null}
                                  </p>
                                </div>
                              </div>
                            </td>
                            {boxScoreColumns.map((column) => (
                              <td key={column.key} className={`p-2 sm:p-3 text-center text-xs sm:text-sm tabular-nums ${column.className || ""}`}>
                                {column.value(player)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Highlights Tab */}
            {activeTab === "highlights" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">{t.highlightsVideo}</p>
                  {highlightEmbed ? (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                      <div className="relative w-full aspect-video">
                        {highlightEmbed.type === "iframe" ? (
                          <iframe
                            src={highlightEmbed.url}
                            title={t.highlightsVideo}
                            className="absolute left-0 top-0 h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        ) : (
                          <video controls className="absolute left-0 top-0 h-full w-full" src={highlightEmbed.url} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t.noHighlights}</p>
                  )}
                </div>
              </div>
            )}

            {/* Pictures Tab */}
            {activeTab === "pictures" && (
              <div className="space-y-6">
                {gamePhotos.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {gamePhotos.map((photoUrl, index) => (
                      <button
                        key={`${photoUrl}-${index}`}
                        type="button"
                        onClick={() => setActivePhotoIndex(index)}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left"
                        aria-label={`${t.tapToExpand} ${index + 1}`}
                      >
                        <Image
                          src={photoUrl}
                          alt={`${t.photosTitle} ${index + 1}`}
                          width={480}
                          height={320}
                          className="h-44 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          unoptimized
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-1.5 text-[11px] text-slate-200 opacity-0 transition-opacity group-hover:opacity-100">
                          {t.tapToExpand}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                    <div className="mb-6">
                      <svg className="mx-auto h-16 w-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-white">
                      {t.photosTitle}
                    </h3>
                    <p className="text-sm text-slate-400 mb-3">
                      {t.noPhotosUploaded}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.photosAdmin}
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        )}

        {shouldShowLiveEmbed && liveEmbed && (
          <section className="mb-6 sm:mb-8">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-300">{t.liveNow}</p>
                  <h3 className="text-base font-bold text-white sm:text-lg">{t.watchOnSite}</h3>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  LIVE
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <div
                  ref={livePlayerContainerRef}
                  className={`relative w-full bg-black ${isLivePlayerFullscreen ? "h-full" : "aspect-video"}`}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/90 via-black/75 to-transparent sm:h-20" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-8 bg-black sm:h-9" />

                  <div className="absolute inset-x-0 top-0 z-20 px-2 pt-2 sm:px-3 sm:pt-3">
                    <div className="pointer-events-auto flex items-start justify-between gap-2">
                      <div className="inline-flex min-w-0 max-w-[72%] items-center gap-2 rounded-lg border border-white/20 bg-black/75 px-3 py-2 backdrop-blur sm:max-w-[68%] sm:gap-2.5 sm:px-3.5 sm:py-2.5">
                        {game.homeTeamLogo ? (
                          <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={24} height={24} className="h-6 w-6 rounded-full object-cover sm:h-7 sm:w-7" unoptimized />
                        ) : null}
                        <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-white sm:text-xs">
                          {game.homeTeamName || "Home"} vs {game.awayTeamName || "Away"}
                        </span>
                        {game.awayTeamLogo ? (
                          <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={24} height={24} className="h-6 w-6 rounded-full object-cover sm:h-7 sm:w-7" unoptimized />
                        ) : null}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/85 px-2.5 py-1.5 backdrop-blur sm:px-3 sm:py-2">
                        <Image src="/logos/liprobakin.png" alt="Liprobakin TV" width={40} height={40} className="h-9 w-9 rounded-full border border-white/30 object-cover sm:h-11 sm:w-11" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white sm:text-xs">LIPROBAKIN TV</span>
                      </div>
                    </div>
                  </div>

                  <div className={`pointer-events-none absolute inset-x-0 z-20 ${isLivePlayerFullscreen ? "bottom-4 px-4" : "bottom-2 px-2 sm:bottom-3 sm:px-3"}`}>
                    <div className={`mx-auto flex w-full max-w-[98%] items-center justify-between rounded-xl border border-white/20 bg-black/80 backdrop-blur ${isLivePlayerFullscreen ? "gap-4 px-4 py-3" : "gap-2 px-2.5 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5"}`}>
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        {game.awayTeamLogo ? (
                          <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={24} height={24} className={`${isLivePlayerFullscreen ? "h-8 w-8" : "h-6 w-6 sm:h-7 sm:w-7"} rounded-full object-cover`} unoptimized />
                        ) : null}
                        <span className={`truncate font-semibold uppercase tracking-[0.12em] text-white/90 ${isLivePlayerFullscreen ? "text-xs" : "text-[10px] sm:text-[11px]"}`}>
                          {game.awayTeamName || "Away"}
                        </span>
                        <span className={`font-black tabular-nums text-white ${isLivePlayerFullscreen ? "text-2xl" : "text-lg sm:text-xl"}`}>{awayScore ?? 0}</span>
                      </div>

                      <div className="inline-flex flex-col items-center rounded-md border border-red-500/40 bg-red-500/20 px-2 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-200">{liveStatus ? "LIVE" : t.liveNow.toUpperCase()}</span>
                        {formattedLivePeriod && (
                          <span className="text-[9px] font-semibold tracking-wide text-white/90">
                            {formattedLivePeriod}
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className={`font-black tabular-nums text-white ${isLivePlayerFullscreen ? "text-2xl" : "text-lg sm:text-xl"}`}>{homeScore ?? 0}</span>
                        <span className={`truncate text-right font-semibold uppercase tracking-[0.12em] text-white/90 ${isLivePlayerFullscreen ? "text-xs" : "text-[10px] sm:text-[11px]"}`}>
                          {game.homeTeamName || "Home"}
                        </span>
                        {game.homeTeamLogo ? (
                          <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={24} height={24} className={`${isLivePlayerFullscreen ? "h-8 w-8" : "h-6 w-6 sm:h-7 sm:w-7"} rounded-full object-cover`} unoptimized />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {liveEmbed.type === "iframe" ? (
                    <iframe
                      src={liveEmbed.url}
                      title={t.liveNow}
                      className="absolute left-0 top-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    />
                  ) : (
                    <video controls className="absolute left-0 top-0 h-full w-full" src={liveEmbed.url} />
                  )}

                  <button
                    type="button"
                    onClick={toggleLivePlayerFullscreen}
                    className={`absolute z-30 inline-flex items-center gap-1 rounded-md border border-white/30 bg-black/70 font-bold uppercase tracking-[0.14em] text-white hover:bg-black/85 ${isLivePlayerFullscreen ? "bottom-4 right-4 px-4 py-2 text-xs" : "bottom-2 right-2 px-3 py-1.5 text-xs sm:bottom-3 sm:right-3 sm:px-3.5 sm:py-2"}`}
                  >
                    {isLivePlayerFullscreen ? t.exitFullscreen : t.enterFullscreen}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {activePhotoIndex !== null && gamePhotos[activePhotoIndex] && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm">
          <button
            type="button"
            onClick={closePhotoViewer}
            className="absolute right-4 top-4 z-20 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/70"
          >
            {t.close}
          </button>

          {gamePhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-white hover:bg-black/70"
                aria-label={t.previous}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-white hover:bg-black/70"
                aria-label={t.next}
              >
                ›
              </button>
            </>
          )}

          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border border-white/20 bg-black/50 px-3 py-1 text-xs text-white">
            {activePhotoIndex + 1} / {gamePhotos.length}
          </div>

          <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
            <Image
              src={gamePhotos[activePhotoIndex]}
              alt={`${t.photosTitle} ${activePhotoIndex + 1}`}
              width={1600}
              height={1200}
              className="max-h-full max-w-full rounded-lg object-contain"
              unoptimized
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        .shot-track {
          position: absolute;
          top: 52%;
          left: 50%;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transform: translate(-50%, -50%);
          opacity: 0;
        }

        .shot-ball {
          font-size: 20px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
        }

        .shot-points {
          border: 1px solid rgba(251, 146, 60, 0.7);
          background: rgba(251, 146, 60, 0.2);
          color: #fed7aa;
          border-radius: 9999px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .shot-left-1 { animation: shotLeftOne 1.25s ease-out forwards; }
        .shot-left-2 { animation: shotLeftTwo 1.25s ease-out forwards; }
        .shot-left-3 { animation: shotLeftThree 1.25s ease-out forwards; }
        .shot-right-1 { animation: shotRightOne 1.25s ease-out forwards; }
        .shot-right-2 { animation: shotRightTwo 1.25s ease-out forwards; }
        .shot-right-3 { animation: shotRightThree 1.25s ease-out forwards; }

        @keyframes shotLeftOne {
          0% { transform: translate(-52%, 40%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-18%, -8%); opacity: 1; }
          100% { transform: translate(-8%, -12%); opacity: 0; }
        }
        @keyframes shotLeftTwo {
          0% { transform: translate(-95%, 55%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-18%, -8%); opacity: 1; }
          100% { transform: translate(-8%, -12%); opacity: 0; }
        }
        @keyframes shotLeftThree {
          0% { transform: translate(-132%, 62%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-18%, -8%); opacity: 1; }
          100% { transform: translate(-8%, -12%); opacity: 0; }
        }
        @keyframes shotRightOne {
          0% { transform: translate(-48%, 40%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-82%, -8%); opacity: 1; }
          100% { transform: translate(-92%, -12%); opacity: 0; }
        }
        @keyframes shotRightTwo {
          0% { transform: translate(-10%, 55%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-82%, -8%); opacity: 1; }
          100% { transform: translate(-92%, -12%); opacity: 0; }
        }
        @keyframes shotRightThree {
          0% { transform: translate(30%, 62%); opacity: 0; }
          20% { opacity: 1; }
          65% { transform: translate(-82%, -8%); opacity: 1; }
          100% { transform: translate(-92%, -12%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}