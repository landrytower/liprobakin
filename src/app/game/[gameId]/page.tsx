"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

type PlayerStat = {
  teamId?: string;
  teamName?: string;
  playerName?: string;
  headshot?: string;
  pts?: number;
  ast?: number;
  reb?: number;
  oreb?: number;
  dreb?: number;
  blk?: number;
  stl?: number;
  to?: number;
  pf?: number;
  two_pm?: number;
  two_pa?: number;
  three_pm?: number;
  three_pa?: number;
  ft_m?: number;
  ft_a?: number;
  position?: string;
  jerseyNumber?: number;
};

type TeamStats = {
  pts?: number;
  reb?: number;
  oreb?: number;
  dreb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  to?: number;
  pf?: number;
  fg2Made?: number;
  fg2Attempted?: number;
  fg3Made?: number;
  fg3Attempted?: number;
  ftMade?: number;
  ftAttempted?: number;
};

type GameData = {
  id: string;
  gender?: string;
  homeTeamId?: string;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  date?: string;
  time?: string;
  venue?: string;
  winnerTeamId?: string;
  winnerScore?: number;
  loserTeamId?: string;
  loserScore?: number;
  completed?: boolean;
  playerStats?: PlayerStat[];
  homeTeamStats?: TeamStats;
  awayTeamStats?: TeamStats;
};

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.gameId as string;
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "photos">("overview");

  useEffect(() => {
    const fetchGame = async () => {
      if (!gameId) return;

      try {
        const gameRef = doc(firebaseDB, "games", gameId);
        const gameSnap = await getDoc(gameRef);

        if (gameSnap.exists()) {
          setGame({
            id: gameSnap.id,
            ...gameSnap.data(),
          } as GameData);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Game not found</div>
      </div>
    );
  }

  const homeWon = game.winnerTeamId === game.homeTeamId;
  const awayWon = game.winnerTeamId === game.awayTeamId;
  const homeScore = homeWon ? game.winnerScore : game.loserScore;
  const awayScore = awayWon ? game.winnerScore : game.loserScore;

  const homeStats = game.playerStats?.filter(stat => stat.teamId === game.homeTeamId) || [];
  const awayStats = game.playerStats?.filter(stat => stat.teamId === game.awayTeamId) || [];

  // Calculate team totals from player stats
  const calculateTeamStats = (stats: PlayerStat[]): TeamStats => {
    return stats.reduce((acc, player) => ({
      pts: (acc.pts || 0) + (player.pts || 0),
      reb: (acc.reb || 0) + (player.reb || 0),
      oreb: (acc.oreb || 0) + (player.oreb || 0),
      dreb: (acc.dreb || 0) + (player.dreb || 0),
      ast: (acc.ast || 0) + (player.ast || 0),
      stl: (acc.stl || 0) + (player.stl || 0),
      blk: (acc.blk || 0) + (player.blk || 0),
      to: (acc.to || 0) + (player.to || 0),
      pf: (acc.pf || 0) + (player.pf || 0),
      fg2Made: (acc.fg2Made || 0) + (player.two_pm || 0),
      fg2Attempted: (acc.fg2Attempted || 0) + (player.two_pa || 0),
      fg3Made: (acc.fg3Made || 0) + (player.three_pm || 0),
      fg3Attempted: (acc.fg3Attempted || 0) + (player.three_pa || 0),
      ftMade: (acc.ftMade || 0) + (player.ft_m || 0),
      ftAttempted: (acc.ftAttempted || 0) + (player.ft_a || 0),
    }), {
      pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
      fg2Made: 0, fg2Attempted: 0, fg3Made: 0, fg3Attempted: 0, ftMade: 0, ftAttempted: 0
    } as TeamStats);
  };

  const homeTeamStats = calculateTeamStats(homeStats);
  const awayTeamStats = calculateTeamStats(awayStats);

  // Debug: Log the stats to see what we have
  console.log('Home Team Stats:', homeTeamStats);
  console.log('Away Team Stats:', awayTeamStats);
  console.log('Sample Home Player:', homeStats[0]);
  console.log('Sample Away Player:', awayStats[0]);

  // Calculate shooting percentages
  const calculatePercentage = (made: number, attempted: number) => {
    if (attempted === 0) return 0;
    return Math.round((made / attempted) * 100);
  };

  const homeOverallPct = calculatePercentage(
    (homeTeamStats.fg2Made || 0) + (homeTeamStats.fg3Made || 0) + (homeTeamStats.ftMade || 0),
    (homeTeamStats.fg2Attempted || 0) + (homeTeamStats.fg3Attempted || 0) + (homeTeamStats.ftAttempted || 0)
  );
  const awayOverallPct = calculatePercentage(
    (awayTeamStats.fg2Made || 0) + (awayTeamStats.fg3Made || 0) + (awayTeamStats.ftMade || 0),
    (awayTeamStats.fg2Attempted || 0) + (awayTeamStats.fg3Attempted || 0) + (awayTeamStats.ftAttempted || 0)
  );

  // Field Goal % (2PT + 3PT combined, excluding FT)
  const homeFgPct = calculatePercentage(
    (homeTeamStats.fg2Made || 0) + (homeTeamStats.fg3Made || 0),
    (homeTeamStats.fg2Attempted || 0) + (homeTeamStats.fg3Attempted || 0)
  );
  const awayFgPct = calculatePercentage(
    (awayTeamStats.fg2Made || 0) + (awayTeamStats.fg3Made || 0),
    (awayTeamStats.fg2Attempted || 0) + (awayTeamStats.fg3Attempted || 0)
  );

  const home2PtPct = calculatePercentage(homeTeamStats.fg2Made || 0, homeTeamStats.fg2Attempted || 0);
  const away2PtPct = calculatePercentage(awayTeamStats.fg2Made || 0, awayTeamStats.fg2Attempted || 0);

  const home3PtPct = calculatePercentage(homeTeamStats.fg3Made || 0, homeTeamStats.fg3Attempted || 0);
  const away3PtPct = calculatePercentage(awayTeamStats.fg3Made || 0, awayTeamStats.fg3Attempted || 0);

  const homeFtPct = calculatePercentage(homeTeamStats.ftMade || 0, homeTeamStats.ftAttempted || 0);
  const awayFtPct = calculatePercentage(awayTeamStats.ftMade || 0, awayTeamStats.ftAttempted || 0);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Game Header */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white">Game Details</h1>
        </div>

        {/* Score Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              FINAL
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center mb-4">
            {/* Away Team */}
            <div className="flex flex-col items-center gap-3">
              {game.awayTeamLogo && (
                <Image
                  src={game.awayTeamLogo}
                  alt={game.awayTeamName || "Away team"}
                  width={60}
                  height={60}
                  className="rounded-full border border-white/10 bg-white/5 object-cover"
                />
              )}
              <div className="text-center">
                <h2 className={`text-xl font-bold ${awayWon ? "text-white" : "text-slate-400"}`}>
                  {game.awayTeamName}
                </h2>
                <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">
                  {game.gender === "men" ? "MEN BBC" : game.gender === "women" ? "WOMEN BBC" : ""}
                </p>
              </div>
            </div>

            {/* Score */}
            <div className="text-center px-6">
              <div className="flex items-center gap-3">
                <span className={`text-5xl font-bold ${awayWon ? "text-white" : "text-slate-500"}`}>
                  {awayScore ?? 0}
                </span>
                <span className="text-3xl text-slate-600">-</span>
                <span className={`text-5xl font-bold ${homeWon ? "text-white" : "text-slate-500"}`}>
                  {homeScore ?? 0}
                </span>
              </div>
            </div>

            {/* Home Team */}
            <div className="flex flex-col items-center gap-3">
              {game.homeTeamLogo && (
                <Image
                  src={game.homeTeamLogo}
                  alt={game.homeTeamName || "Home team"}
                  width={60}
                  height={60}
                  className="rounded-full border border-white/10 bg-white/5 object-cover"
                />
              )}
              <div className="text-center">
                <h2 className={`text-xl font-bold ${homeWon ? "text-white" : "text-slate-400"}`}>
                  {game.homeTeamName}
                </h2>
                <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">
                  {game.gender === "men" ? "MEN BBC" : game.gender === "women" ? "WOMEN BBC" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Game Info */}
          <div className="flex items-center justify-center gap-6 text-sm text-slate-400 border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">
                {game.date ? new Date(game.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) : "Date TBD"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">{game.venue || "Venue TBD"}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "overview"
                ? "text-white border-b-2 border-orange-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "stats"
                ? "text-white border-b-2 border-orange-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Game Stats
          </button>
          <button
            onClick={() => setActiveTab("photos")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "photos"
                ? "text-white border-b-2 border-orange-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Photos
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Away Team Stats */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-800/50 border-b border-white/10">
                {game.awayTeamLogo && (
                  <Image
                    src={game.awayTeamLogo}
                    alt={game.awayTeamName || ""}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
                <h3 className="text-base font-semibold text-white">{game.awayTeamName}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-800/30">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">PLAYER</th>
                      <th className="text-center py-3 px-3 font-semibold">PTS</th>
                      <th className="text-center py-3 px-3 font-semibold">REB</th>
                      <th className="text-center py-3 px-3 font-semibold">AST</th>
                      <th className="text-center py-3 px-3 font-semibold">STL</th>
                      <th className="text-center py-3 px-3 font-semibold">BLK</th>
                      <th className="text-center py-3 px-3 font-semibold">TO</th>
                      <th className="text-center py-3 px-3 font-semibold">PF</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {awayStats.length > 0 ? (
                      awayStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-medium">{stat.playerName || "Unknown"}</td>
                          <td className="text-center py-3 px-3">{stat.pts ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.reb ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.ast ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.stl ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.blk ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.to ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.pf ?? 0}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500">
                          No player stats available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Home Team Stats */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-800/50 border-b border-white/10">
                {game.homeTeamLogo && (
                  <Image
                    src={game.homeTeamLogo}
                    alt={game.homeTeamName || ""}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
                <h3 className="text-base font-semibold text-white">{game.homeTeamName}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-800/30">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">PLAYER</th>
                      <th className="text-center py-3 px-3 font-semibold">PTS</th>
                      <th className="text-center py-3 px-3 font-semibold">REB</th>
                      <th className="text-center py-3 px-3 font-semibold">AST</th>
                      <th className="text-center py-3 px-3 font-semibold">STL</th>
                      <th className="text-center py-3 px-3 font-semibold">BLK</th>
                      <th className="text-center py-3 px-3 font-semibold">TO</th>
                      <th className="text-center py-3 px-3 font-semibold">PF</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {homeStats.length > 0 ? (
                      homeStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-medium">{stat.playerName || "Unknown"}</td>
                          <td className="text-center py-3 px-3">{stat.pts ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.reb ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.ast ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.stl ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.blk ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.to ?? 0}</td>
                          <td className="text-center py-3 px-3">{stat.pf ?? 0}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500">
                          No player stats available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-4">
            {/* Shooting Percentage */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-base font-semibold text-white mb-6">Shooting Percentage</h3>
              
              {/* FG% Circles */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Away Team Circle */}
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-3">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-slate-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 58}`}
                        strokeDashoffset={`${2 * Math.PI * 58 * (1 - awayFgPct / 100)}`}
                        className="text-blue-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 uppercase mb-0.5">FG %</span>
                      <span className="text-3xl font-bold text-white">{awayFgPct}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-300">{game.awayTeamName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(awayTeamStats.fg2Made || 0) + (awayTeamStats.fg3Made || 0)}/{(awayTeamStats.fg2Attempted || 0) + (awayTeamStats.fg3Attempted || 0)}
                  </p>
                </div>

                {/* Home Team Circle */}
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-3">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-slate-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 58}`}
                        strokeDashoffset={`${2 * Math.PI * 58 * (1 - homeFgPct / 100)}`}
                        className="text-red-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 uppercase mb-0.5">FG %</span>
                      <span className="text-3xl font-bold text-white">{homeFgPct}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-300">{game.homeTeamName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(homeTeamStats.fg2Made || 0) + (homeTeamStats.fg3Made || 0)}/{(homeTeamStats.fg2Attempted || 0) + (homeTeamStats.fg3Attempted || 0)}
                  </p>
                </div>
              </div>

              {/* Field Goals Bars */}
              <div className="space-y-4">
                {/* 2PT FG */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-blue-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{awayTeamStats.fg2Made || 0}</span>
                      </div>
                      <span className="text-xs text-slate-400">{awayTeamStats.fg2Made || 0}/{awayTeamStats.fg2Attempted || 0}</span>
                    </div>
                    <span className="text-sm font-medium text-white">2PT FG</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{homeTeamStats.fg2Made || 0}/{homeTeamStats.fg2Attempted || 0}</span>
                      <div className="w-8 h-6 rounded bg-red-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{homeTeamStats.fg2Made || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-l overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${away2PtPct}%` }}
                      />
                    </div>
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-r overflow-hidden flex justify-end">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${home2PtPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3PT FG */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-blue-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{awayTeamStats.fg3Made || 0}</span>
                      </div>
                      <span className="text-xs text-slate-400">{awayTeamStats.fg3Made || 0}/{awayTeamStats.fg3Attempted || 0}</span>
                    </div>
                    <span className="text-sm font-medium text-white">3PT FG</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{homeTeamStats.fg3Made || 0}/{homeTeamStats.fg3Attempted || 0}</span>
                      <div className="w-8 h-6 rounded bg-red-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{homeTeamStats.fg3Made || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-l overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${away3PtPct}%` }}
                      />
                    </div>
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-r overflow-hidden flex justify-end">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${home3PtPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* FT */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-blue-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{awayTeamStats.ftMade || 0}</span>
                      </div>
                      <span className="text-xs text-slate-400">{awayTeamStats.ftMade || 0}/{awayTeamStats.ftAttempted || 0}</span>
                    </div>
                    <span className="text-sm font-medium text-white">FT</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{homeTeamStats.ftMade || 0}/{homeTeamStats.ftAttempted || 0}</span>
                      <div className="w-8 h-6 rounded bg-red-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{homeTeamStats.ftMade || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-l overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${awayFtPct}%` }}
                      />
                    </div>
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-r overflow-hidden flex justify-end">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${homeFtPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-base font-semibold text-white mb-4">Key Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'PTS', away: awayTeamStats.pts || 0, home: homeTeamStats.pts || 0 },
                  { label: 'REB', away: awayTeamStats.reb || 0, home: homeTeamStats.reb || 0 },
                  { label: 'OREB', away: awayTeamStats.oreb || 0, home: homeTeamStats.oreb || 0 },
                  { label: 'DREB', away: awayTeamStats.dreb || 0, home: homeTeamStats.dreb || 0 },
                  { label: 'AST', away: awayTeamStats.ast || 0, home: homeTeamStats.ast || 0 },
                  { label: 'STL', away: awayTeamStats.stl || 0, home: homeTeamStats.stl || 0 },
                  { label: 'BLK', away: awayTeamStats.blk || 0, home: homeTeamStats.blk || 0 },
                  { label: 'TO', away: awayTeamStats.to || 0, home: homeTeamStats.to || 0 },
                  { label: 'PF', away: awayTeamStats.pf || 0, home: homeTeamStats.pf || 0 },
                ].map((stat) => {
                  const total = stat.away + stat.home || 1;
                  const awayPercent = (stat.away / total) * 100;
                  const homePercent = (stat.home / total) * 100;
                  
                  return (
                    <div key={stat.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-5 rounded bg-blue-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{stat.away}</span>
                        </div>
                        <span className="text-sm font-medium text-white">{stat.label}</span>
                        <div className="w-7 h-5 rounded bg-red-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{stat.home}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-5 bg-slate-700 rounded-l overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${awayPercent}%` }}
                          />
                        </div>
                        <div className="flex-1 h-5 bg-slate-700 rounded-r overflow-hidden">
                          <div 
                            className="h-full bg-red-500 transition-all duration-500 ml-auto"
                            style={{ width: `${homePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "photos" && (
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-8 text-center">
            <p className="text-sm text-slate-400">No photos available for this game.</p>
          </div>
        )}
      </div>
    </div>
  );
}
