"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
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
};

const translations = {
  en: {
    loading: "Loading...",
    gameNotFound: "Game not found",
    backToHome: "← Back to Home",
    final: "FINAL",
    away: "Away",
    home: "Home",
    overview: "Overview",
    boxScore: "Box Score",
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
  },
  fr: {
    loading: "Chargement...",
    gameNotFound: "Match introuvable",
    backToHome: "← Retour à l'accueil",
    final: "FINAL",
    away: "Visiteur",
    home: "Domicile",
    overview: "Aperçu",
    boxScore: "Feuille de Match",
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
  },
};

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { language } = useLanguage();
  const t = translations[language];
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "boxscore">("overview");

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

  // Format date in the appropriate language
  const formattedDate = game.date 
    ? new Date(game.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-[#020407] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logos/liprobakin.png" alt="Liprobakin" width={32} height={32} className="rounded-full" />
              <span className="text-xl font-bold tracking-wider">LIPROBAKIN</span>
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
              ← Back
            </Link>
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
                {game.completed ? t.final : "Scheduled"}
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
            <div className="mb-6 flex gap-4 border-b border-white/10">
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
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Game Leaders */}
                {pointsLeader && pointsLeader.pts > 0 && (
                  <div>
                    <h3 className="mb-4 text-lg font-bold uppercase tracking-wider text-slate-300">{t.gameLeaders}</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Points Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 overflow-hidden">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.points}</p>
                        <div className="flex items-center gap-3">
                          {pointsLeader.headshot && (
                            <div className="w-12 h-12 flex-shrink-0">
                              <Image src={pointsLeader.headshot} alt={pointsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{pointsLeader.playerName}</p>
                            <p className="text-xs text-slate-400">#{pointsLeader.number}</p>
                          </div>
                          <div className="text-2xl font-black text-orange-400">{pointsLeader.pts}</div>
                        </div>
                      </div>

                      {/* Rebounds Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 overflow-hidden">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.rebounds}</p>
                        <div className="flex items-center gap-3">
                          {reboundsLeader.headshot && (
                            <div className="w-12 h-12 flex-shrink-0">
                              <Image src={reboundsLeader.headshot} alt={reboundsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{reboundsLeader.playerName}</p>
                            <p className="text-xs text-slate-400">#{reboundsLeader.number}</p>
                          </div>
                          <div className="text-2xl font-black text-blue-400">{reboundsLeader.reb}</div>
                        </div>
                      </div>

                      {/* Assists Leader */}
                      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 overflow-hidden">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.assists}</p>
                        <div className="flex items-center gap-3">
                          {assistsLeader.headshot && (
                            <div className="w-12 h-12 flex-shrink-0">
                              <Image src={assistsLeader.headshot} alt={assistsLeader.playerName} width={48} height={48} className="rounded-full object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{assistsLeader.playerName}</p>
                            <p className="text-xs text-slate-400">#{assistsLeader.number}</p>
                          </div>
                          <div className="text-2xl font-black text-green-400">{assistsLeader.ast}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Stats Comparison */}
                <div>
                  <h3 className="mb-4 text-lg font-bold uppercase tracking-wider text-slate-300">{t.teamStats}</h3>
                  <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 overflow-hidden">
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
              <div className="space-y-8">
                {/* Away Team */}
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                    {game.awayTeamLogo && <Image src={game.awayTeamLogo} alt="" width={32} height={32} className="rounded-full border-2 border-white/20 object-cover" />}
                    {game.awayTeamName}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full">
                      <thead className="border-b border-white/10 bg-white/5">
                        <tr className="text-xs uppercase text-slate-400">
                          <th className="p-3 text-left font-semibold">{t.player}</th>
                          <th className="p-3 text-center font-semibold">{t.pts}</th>
                          <th className="p-3 text-center font-semibold">{t.reb}</th>
                          <th className="p-3 text-center font-semibold">{t.ast}</th>
                          <th className="p-3 text-center font-semibold">{t.fg}</th>
                          <th className="p-3 text-center font-semibold">{t.threeP}</th>
                          <th className="p-3 text-center font-semibold">{t.ft}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {awayStats.map((player) => (
                          <tr key={player.playerId} className="hover:bg-white/5">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {player.headshot && (
                                  <div className="w-8 h-8 flex-shrink-0">
                                    <Image src={player.headshot} alt="" width={32} height={32} className="rounded-full object-cover w-full h-full" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">
                                    <span className="md:hidden">{player.lastName}</span>
                                    <span className="hidden md:inline">{player.playerName}</span>
                                  </p>
                                  <p className="text-xs text-slate-500">#{player.number}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold">{player.pts}</td>
                            <td className="p-3 text-center">{player.reb}</td>
                            <td className="p-3 text-center">{player.ast}</td>
                            <td className="p-3 text-center text-sm">{player.two_pm + player.three_pm}-{player.two_pa + player.three_pa}</td>
                            <td className="p-3 text-center text-sm">{player.three_pm}-{player.three_pa}</td>
                            <td className="p-3 text-center text-sm">{player.ft_m}-{player.ft_a}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Home Team */}
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                    {game.homeTeamLogo && <Image src={game.homeTeamLogo} alt="" width={32} height={32} className="rounded-full border-2 border-white/20 object-cover" />}
                    {game.homeTeamName}
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full">
                      <thead className="border-b border-white/10 bg-white/5">
                        <tr className="text-xs uppercase text-slate-400">
                          <th className="p-3 text-left font-semibold">{t.player}</th>
                          <th className="p-3 text-center font-semibold">{t.pts}</th>
                          <th className="p-3 text-center font-semibold">{t.reb}</th>
                          <th className="p-3 text-center font-semibold">{t.ast}</th>
                          <th className="p-3 text-center font-semibold">{t.fg}</th>
                          <th className="p-3 text-center font-semibold">{t.threeP}</th>
                          <th className="p-3 text-center font-semibold">{t.ft}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {homeStats.map((player) => (
                          <tr key={player.playerId} className="hover:bg-white/5">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {player.headshot && (
                                  <div className="w-8 h-8 flex-shrink-0">
                                    <Image src={player.headshot} alt="" width={32} height={32} className="rounded-full object-cover w-full h-full" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">
                                    <span className="md:hidden">{player.lastName}</span>
                                    <span className="hidden md:inline">{player.playerName}</span>
                                  </p>
                                  <p className="text-xs text-slate-500">#{player.number}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold">{player.pts}</td>
                            <td className="p-3 text-center">{player.reb}</td>
                            <td className="p-3 text-center">{player.ast}</td>
                            <td className="p-3 text-center text-sm">{player.two_pm + player.three_pm}-{player.two_pa + player.three_pa}</td>
                            <td className="p-3 text-center text-sm">{player.three_pm}-{player.three_pa}</td>
                            <td className="p-3 text-center text-sm">{player.ft_m}-{player.ft_a}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}