"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";

type PlayerStat = {
  playerId: string;
  playerName: string;
  firstName: string;
  lastName: string;
  number: number;
  headshot?: string;
  teamId: string;
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
  loserTeamId?: string;
  completed?: boolean;
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

  if (lower.includes("youtube.com/watch") || lower.includes("youtu.be/") || lower.includes("youtube.com/shorts/")) {
    try {
      const parsed = new URL(url);
      let videoId = "";
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").split("/")[0] || "";
      } else if (parsed.pathname.includes("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
      if (videoId) {
        return { type: "iframe", url: `https://www.youtube.com/embed/${videoId}` };
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

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { language, setLanguage } = useLanguage();
  const t: TranslationCopy = translations[language as "fr" | "en"] ?? translations.fr;
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "boxscore" | "highlights" | "pictures">("overview");
  const [playerHeadshots, setPlayerHeadshots] = useState<Record<string, string>>({});
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameDoc = await getDoc(doc(firebaseDB, "games", gameId));
        if (gameDoc.exists()) {
          setGame(gameDoc.data() as GameData);
        }
      } catch (error) {
        console.error("Error fetching game:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
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
      setActivePhotoIndex(null);
      return;
    }
    if (activePhotoIndex >= gamePhotos.length) {
      setActivePhotoIndex(0);
    }
  }, [activePhotoIndex, gamePhotos.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <p className="text-white">{t.loading}</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">{t.gameNotFound}</p>
          <Link href="/" className="text-blue-400 hover:underline">{t.backToHome}</Link>
        </div>
      </div>
    );
  }

  const homeWon = game.winnerTeamId === game.homeTeamId;
  const homeScore = homeWon ? game.winnerScore : game.loserScore;
  const awayScore = !homeWon ? game.winnerScore : game.loserScore;

  // Get player stats
  const homeStats = game.playerStats?.filter(p => p.teamId === game.homeTeamId) || [];
  const awayStats = game.playerStats?.filter(p => p.teamId === game.awayTeamId) || [];

  // Find game leaders
  const allPlayers = [...homeStats, ...awayStats];
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

  // Format date in the appropriate language
  const formattedDate = game.date 
    ? new Date(game.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : '';

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

  const highlightsVideoSource =
    game.highlightsVideoUrl ||
    game.highlightsUrl ||
    game.highlightVideoUrl ||
    game.highlightUrl ||
    game.videoUrl ||
    game.youtubeUrl ||
    game.streamUrl ||
    "";

  const highlightEmbed = highlightsVideoSource ? toEmbedVideoUrl(highlightsVideoSource) : null;

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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
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

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Game Header - Score Display */}
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                game.completed ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}>
                {game.completed ? t.final : t.scheduled}
              </span>
              {game.date && (
                <span className="text-sm text-slate-400">
                  {formattedDate}
                </span>
              )}
            </div>
            
            {(game.time || game.venue) && (
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                {game.time && (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {game.time}
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-2 sm:gap-4 md:gap-8">
              {/* Away Team */}
              <div className={`flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 ${!homeWon && game.completed ? "opacity-100" : game.completed ? "opacity-60" : ""}`}>
                {game.awayTeamLogo && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                    <Image src={game.awayTeamLogo} alt={game.awayTeamName || "Away"} width={56} height={56} className="rounded-full border-2 border-white/20 object-cover w-full h-full" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{t.away}</p>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{game.awayTeamName}</h2>
                </div>
              </div>

              {/* Score Display */}
              {game.completed && (
                <div className="flex items-center gap-1 sm:gap-2 md:gap-4 text-center flex-shrink-0">
                  <div className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black ${!homeWon ? "text-orange-400" : "text-slate-500"}`}>{awayScore}</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-600">-</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black ${homeWon ? "text-orange-400" : "text-slate-500"}`}>{homeScore}</div>
                </div>
              )}

              {/* Home Team */}
              <div className={`flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 justify-end ${homeWon && game.completed ? "opacity-100" : game.completed ? "opacity-60" : ""}`}>
                <div className="text-right min-w-0 flex-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{t.home}</p>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{game.homeTeamName}</h2>
                </div>
                {game.homeTeamLogo && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                    <Image src={game.homeTeamLogo} alt={game.homeTeamName || "Home"} width={56} height={56} className="rounded-full border-2 border-white/20 object-cover w-full h-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {game.completed && game.playerStats && game.playerStats.length > 0 && (
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

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Game Leaders */}
                {pointsLeader && pointsLeader.pts > 0 && (
                  <div>
                    <h3 className="mb-4 text-base sm:text-lg font-bold uppercase tracking-wider text-slate-300">{t.gameLeaders}</h3>
                    <div className="grid gap-3 sm:gap-4 grid-cols-3">
                      {/* Points Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-3 sm:p-4 overflow-hidden">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.points}</p>
                          <div className="text-xl sm:text-2xl font-black text-white/90">{pointsLeader.pts}</div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {getPlayerHeadshot(pointsLeader) && (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                              <Image src={getPlayerHeadshot(pointsLeader)} alt={pointsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-sm sm:text-base">{getPlayerDisplayName(pointsLeader)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Rebounds Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-3 sm:p-4 overflow-hidden">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.rebounds}</p>
                          <div className="text-xl sm:text-2xl font-black text-white/90">{reboundsLeader.reb}</div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {getPlayerHeadshot(reboundsLeader) && (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                              <Image src={getPlayerHeadshot(reboundsLeader)} alt={reboundsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-sm sm:text-base">{getPlayerDisplayName(reboundsLeader)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Assists Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-3 sm:p-4 overflow-hidden">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.assists}</p>
                          <div className="text-xl sm:text-2xl font-black text-white/90">{assistsLeader.ast}</div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {getPlayerHeadshot(assistsLeader) && (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                              <Image src={getPlayerHeadshot(assistsLeader)} alt={assistsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-sm sm:text-base">{getPlayerDisplayName(assistsLeader)}</p>
                          </div>
                        </div>
                      </div>
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
                        <span className="font-bold">{awayTotals.fga > 0 ? ((awayTotals.fgm / awayTotals.fga) * 100).toFixed(1) : 0}%</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.fgPercent}</span>
                        <span className="font-bold">{homeTotals.fga > 0 ? ((homeTotals.fgm / homeTotals.fga) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayTotals.fga > 0 ? (awayTotals.fgm / awayTotals.fga) * 50 : 0}%` }} />
                        <div className="bg-orange-500 ml-auto" style={{ width: `${homeTotals.fga > 0 ? (homeTotals.fgm / homeTotals.fga) * 50 : 0}%` }} />
                      </div>
                    </div>

                    {/* 3PT% */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{awayTotals.tpa > 0 ? ((awayTotals.tpm / awayTotals.tpa) * 100).toFixed(1) : 0}%</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.threePercent}</span>
                        <span className="font-bold">{homeTotals.tpa > 0 ? ((homeTotals.tpm / homeTotals.tpa) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${awayTotals.tpa > 0 ? (awayTotals.tpm / awayTotals.tpa) * 50 : 0}%` }} />
                        <div className="bg-orange-500 ml-auto" style={{ width: `${homeTotals.tpa > 0 ? (homeTotals.tpm / homeTotals.tpa) * 50 : 0}%` }} />
                      </div>
                    </div>

                    {/* Rebounds */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{awayTotals.reb}</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.rebounds}</span>
                        <span className="font-bold">{homeTotals.reb}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${(awayTotals.reb / (awayTotals.reb + homeTotals.reb || 1)) * 100}%` }} />
                        <div className="bg-orange-500" style={{ width: `${(homeTotals.reb / (awayTotals.reb + homeTotals.reb || 1)) * 100}%` }} />
                      </div>
                    </div>

                    {/* Assists */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-bold">{awayTotals.ast}</span>
                        <span className="text-xs uppercase tracking-wider text-slate-400">{t.assists}</span>
                        <span className="font-bold">{homeTotals.ast}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-blue-500" style={{ width: `${(awayTotals.ast / (awayTotals.ast + homeTotals.ast || 1)) * 100}%` }} />
                        <div className="bg-orange-500" style={{ width: `${(homeTotals.ast / (awayTotals.ast + homeTotals.ast || 1)) * 100}%` }} />
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
                  <div className="overflow-x-auto rounded-xl border border-white/10 -mx-4 sm:mx-0">
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
                        {awayStats.map((player) => (
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
                                  <p className="font-medium text-[11px] sm:text-sm sm:hidden">{getPlayerLastName(player)}</p>
                                  <p className="font-medium text-xs sm:text-sm hidden sm:block">{getPlayerDisplayName(player)}</p>
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
                  <div className="overflow-x-auto rounded-xl border border-white/10 -mx-4 sm:mx-0">
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
                        {homeStats.map((player) => (
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
                                  <p className="font-medium text-[11px] sm:text-sm sm:hidden">{getPlayerLastName(player)}</p>
                                  <p className="font-medium text-xs sm:text-sm hidden sm:block">{getPlayerDisplayName(player)}</p>
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
          </>
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
    </div>
  );
}