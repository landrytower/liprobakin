"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import type { RosterPlayer } from "@/data/febaco";
import { franchises, franchisesWomen } from "@/data/febaco";
import { countries, codeForCountryName, flagFromCode, nameForCountryCode } from "@/data/countries";

// Helper function to get country flag emoji. Accepts country name, common alias, or ISO A2 code.
function getNationalityFlag(nationality: string): string {
  if (!nationality) return "🌍";
  const n = String(nationality).trim();
  // If it's already a 2-letter ISO code
  if (/^[A-Za-z]{2}$/.test(n)) return flagFromCode(n.toUpperCase());
  // Try exact name -> code
  const byNameCode = codeForCountryName(n);
  if (byNameCode) return flagFromCode(byNameCode);
  // Try to find a country whose name includes the query
  const found = countries.find((c) => c.name.toLowerCase() === n.toLowerCase() || c.name.toLowerCase().includes(n.toLowerCase()));
  if (found) return flagFromCode(found.code);
  // Handle a few common 3-letter aliases like USA
  if (n.toUpperCase() === "USA") return flagFromCode("US");
  if (n.toUpperCase() === "UK") return flagFromCode("GB");
  // fallback
  return "🌍";
}

type GameLog = {
  gameId: string;
  opponent: string;
  date: string;
  result: "W" | "L";
  pts: number;
  two_pm: number;
  two_pa: number;
  three_pm: number;
  three_pa: number;
  ft_m: number;
  ft_a: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  pf: number;
};

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const teamName = decodeURIComponent(params.teamName as string);
  const playerNumber = params.playerNumber as string;
  
  const [player, setPlayer] = useState<RosterPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState({ pts: 0, reb: 0, stl: 0, blk: 0 });
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);

  const allFranchises = [...franchises, ...franchisesWomen];
  const franchise = allFranchises.find((f) => {
    const franchiseName = f.city ? `${f.city} ${f.name}` : f.name;
    return franchiseName === teamName;
  });

  useEffect(() => {
    async function loadPlayer() {
      try {
        setLoading(true);
        
        // Find the specific team first
        const teamsRef = collection(firebaseDB, "teams");
        const teamsSnapshot = await getDocs(teamsRef);
        
        let foundPlayer: (RosterPlayer & { id: string }) | null = null;
        let playerTeamId = "";
        let targetTeamDoc = null;
        
        // Find the team document that matches our team name
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const teamDocName = teamData.name ?? "";
          const teamDocCity = teamData.city ?? "";
          const fullTeamName = teamDocCity ? `${teamDocCity} ${teamDocName}` : teamDocName;
          
          if (fullTeamName === teamName) {
            targetTeamDoc = teamDoc;
            playerTeamId = teamDoc.id;
            break;
          }
        }
        
        if (!targetTeamDoc) {
          setLoading(false);
          return;
        }
        
        // Fetch only the target team's roster
        const rosterRef = collection(firebaseDB, `teams/${playerTeamId}/roster`);
        const rosterSnapshot = await getDocs(rosterRef);
        const teamPlayers = rosterSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as RosterPlayer & { id: string }));
        
        foundPlayer = teamPlayers.find((p) => String(p.number) === playerNumber) || null;
        
        if (!foundPlayer) {
          setLoading(false);
          return;
        }
        
        setPlayer(foundPlayer);
        
        // Fetch all players only for ranking calculation (but in parallel with game logs)
        const rankingPromise = (async () => {
          const allRosterPromises = teamsSnapshot.docs.map(async (teamDoc) => {
            const rosterRef = collection(firebaseDB, `teams/${teamDoc.id}/roster`);
            const rosterSnapshot = await getDocs(rosterRef);
            return rosterSnapshot.docs.map((doc) => doc.data() as RosterPlayer);
          });
          
          const allRosters = await Promise.all(allRosterPromises);
          const allPlayers = allRosters.flat();
          
          const playerPts = parseFloat(foundPlayer!.stats.pts) || 0;
          const playerReb = parseFloat(foundPlayer!.stats.reb) || 0;
          const playerStl = parseFloat(foundPlayer!.stats.stl) || 0;
          const playerBlk = parseFloat((foundPlayer!.stats as any).blk || "0") || 0;
          
          const ptsRank = allPlayers.filter(p => (parseFloat(p.stats.pts) || 0) > playerPts).length + 1;
          const rebRank = allPlayers.filter(p => (parseFloat(p.stats.reb) || 0) > playerReb).length + 1;
          const stlRank = allPlayers.filter(p => (parseFloat(p.stats.stl) || 0) > playerStl).length + 1;
          const blkRank = allPlayers.filter(p => (parseFloat((p.stats as any).blk || "0") || 0) > playerBlk).length + 1;
          
          setRankings({ pts: ptsRank, reb: rebRank, stl: stlRank, blk: blkRank });
        })();

        // Fetch game logs in parallel
        const gameLogsPromise = (async () => {
          const gamesRef = collection(firebaseDB, "games");
          const q = query(gamesRef, where("winnerTeamId", "!=", null));
          const gamesSnapshot = await getDocs(q);
          
          const logs: GameLog[] = [];
          
          for (const gameDoc of gamesSnapshot.docs) {
            const gameData = gameDoc.data();
            
            // Check if player's team played in this game
            const playerTeamPlayed = gameData.homeTeamId === playerTeamId || gameData.awayTeamId === playerTeamId;
            if (!playerTeamPlayed) continue;
            
            // Find player's stats in this game
            const playerStats = (gameData.playerStats || []).find(
              (stat: any) => stat.playerId === foundPlayer!.id && stat.teamId === playerTeamId
            );
            
            if (playerStats) {
              // Determine opponent
              const opponent = gameData.homeTeamId === playerTeamId 
                ? gameData.awayTeamName 
                : gameData.homeTeamName;
              
              // Determine result
              const result = gameData.winnerTeamId === playerTeamId ? "W" : "L";
              
              logs.push({
                gameId: gameDoc.id,
                opponent,
                date: gameData.date,
                result,
                pts: playerStats.pts || 0,
                two_pm: playerStats.two_pm || 0,
                two_pa: playerStats.two_pa || 0,
                three_pm: playerStats.three_pm || 0,
                three_pa: playerStats.three_pa || 0,
                ft_m: playerStats.ft_m || 0,
                ft_a: playerStats.ft_a || 0,
                oreb: playerStats.oreb || 0,
                dreb: playerStats.dreb || 0,
                reb: playerStats.reb || 0,
                ast: playerStats.ast || 0,
                stl: playerStats.stl || 0,
                blk: playerStats.blk || 0,
                to: playerStats.to || 0,
                pf: playerStats.pf || 0,
              });
            }
          }
          
          // Sort by date descending and take last 5
          logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setGameLogs(logs.slice(0, 5));
        })();
        
        // Wait for both operations to complete
        await Promise.all([rankingPromise, gameLogsPromise]);
        
      } catch (error) {
        console.error("Error loading player:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPlayer();
  }, [teamName, playerNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading player profile...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-white text-2xl mb-4">Player not found</div>
        <button
          onClick={() => router.back()}
          className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300 transition hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-sm font-semibold uppercase tracking-wider text-slate-300 transition hover:text-white"
            >
              Home
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Player Hero Section */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/90 to-blue-800/90 sm:mb-8">
          <div className="p-6 sm:p-8 lg:p-12">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              {/* Player Photo */}
              {player.headshot ? (
                <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-2xl border-4 border-white/20 bg-black/40 sm:h-56 sm:w-56 sm:rounded-3xl lg:h-64 lg:w-64">
                  <Image
                    src={player.headshot}
                    alt={`${player.firstName} ${player.lastName}`}
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              ) : (
                <div className="flex h-40 w-40 flex-shrink-0 items-center justify-center rounded-2xl border-4 border-white/20 bg-white/10 text-5xl font-bold text-white sm:h-56 sm:w-56 sm:rounded-3xl sm:text-6xl lg:h-64 lg:w-64">
                  #{player.number}
                </div>
              )}

              {/* Player Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="mb-4 flex items-center justify-center gap-3 sm:justify-start">
                  {franchise?.logo && (
                    <Image
                      src={franchise.logo}
                      alt={teamName}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full border-2 border-white/20 object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">
                      {teamName}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-blue-300">#{player.number}</p>
                  </div>
                </div>
                
                <h1 className="mb-4 text-4xl font-bold text-white sm:mb-6 sm:text-5xl lg:text-6xl xl:text-7xl">
                  {player.firstName} {player.lastName}
                </h1>

                {/* Player Details Grid */}
                <div className="flex flex-wrap gap-2 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {player.nationality && (
                    <div className="flex-1 min-w-[110px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">Nationality</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate flex items-center gap-1.5">
                        <span className="text-base sm:text-xl">{flagFromCode(player.nationality)}</span>
                        {nameForCountryCode(player.nationality) || player.nationality}
                      </p>
                    </div>
                  )}
                  {player.nationality2 && (
                    <div className="flex-1 min-w-[110px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">Nationality</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate flex items-center gap-1.5">
                        <span className="text-base sm:text-xl">{flagFromCode(player.nationality2)}</span>
                        {nameForCountryCode(player.nationality2) || player.nationality2}
                      </p>
                    </div>
                  )}
                  {player.dateOfBirth && (
                    <div className="flex-1 min-w-[110px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">Date of Birth</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate">
                        {new Date(player.dateOfBirth).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                  <div className="flex-1 min-w-[90px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">Height</p>
                    <p className="text-xs font-semibold text-white sm:text-base">{player.height || "—"}</p>
                  </div>
                  {player.position && (
                    <div className="flex-1 min-w-[90px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">Position</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate">{player.position}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 lg:p-8">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wider text-slate-300 sm:mb-6 sm:text-xl lg:text-2xl">
            Season Statistics
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">Points Per Game</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.pts}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.pts} in League</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">Rebounds Per Game</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.reb}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.reb} in League</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">Steals Per Game</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.stl}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.stl} in League</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">Blocks Per Game</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{(player.stats as any).blk || "0.0"}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.blk} in League</p>
            </div>
          </div>
        </div>

        {/* Detailed Statistics - Last 5 Games */}
        {gameLogs.length > 0 && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 lg:p-8">
            <h2 className="mb-4 text-lg font-bold uppercase tracking-wider text-white sm:mb-6 sm:text-xl">
              Detailed Statistics
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Game(s)</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">PTS</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div>FG</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div>Shots</div>
                      <div className="mt-0.5 font-normal normal-case text-[10px] text-slate-500">3PT FG</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-0.5 font-normal normal-case text-[10px] text-slate-500">FT</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div>Rebounds</div>
                      <div className="mt-0.5 font-normal normal-case text-[10px] text-slate-500">OREB</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-0.5 font-normal normal-case text-[10px] text-slate-500">DREB</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-0.5 font-normal normal-case text-[10px] text-slate-500">REB</div>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">AST</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">PF</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">TO</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">STL</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">BLK</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">+/-</th>
                    <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">EFF</th>
                  </tr>
                </thead>
                <tbody>
                  {gameLogs.map((game, index) => {
                    const fgMade = game.two_pm + game.three_pm;
                    const fgAttempts = game.two_pa + game.three_pa;
                    const fgPct = fgAttempts > 0 ? ((fgMade / fgAttempts) * 100).toFixed(0) : "0";
                    const threePct = game.three_pa > 0 ? ((game.three_pm / game.three_pa) * 100).toFixed(0) : "0";
                    const ftPct = game.ft_a > 0 ? ((game.ft_m / game.ft_a) * 100).toFixed(0) : "0";
                    
                    // Calculate efficiency (simplified formula)
                    const eff = game.pts + game.reb + game.ast + game.stl + game.blk - (fgAttempts - fgMade) - (game.ft_a - game.ft_m) - game.to;
                    
                    return (
                      <tr key={game.gameId} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              game.result === "W" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              vs {game.result}
                            </span>
                            <span className="text-xs text-slate-300">
                              vs {game.opponent}, {new Date(game.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-center font-bold text-white">{game.pts}</td>
                        <td className="px-2 py-4 text-center">
                          <div className="text-white">{fgMade}/{fgAttempts}</div>
                          <div className="text-[10px] text-slate-500">{fgPct}%</div>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <div className="text-white">{game.three_pm}/{game.three_pa}</div>
                          <div className="text-[10px] text-slate-500">{threePct}%</div>
                        </td>
                        <td className="px-2 py-4 text-center">
                          <div className="text-white">{game.ft_m}/{game.ft_a}</div>
                          <div className="text-[10px] text-slate-500">{ftPct}%</div>
                        </td>
                        <td className="px-2 py-4 text-center text-white">{game.oreb}</td>
                        <td className="px-2 py-4 text-center text-white">{game.dreb}</td>
                        <td className="px-2 py-4 text-center text-white">{game.reb}</td>
                        <td className="px-2 py-4 text-center text-white">{game.ast}</td>
                        <td className="px-2 py-4 text-center text-white">{game.pf}</td>
                        <td className="px-2 py-4 text-center text-white">{game.to}</td>
                        <td className="px-2 py-4 text-center text-white">{game.stl}</td>
                        <td className="px-2 py-4 text-center text-white">{game.blk}</td>
                        <td className="px-2 py-4 text-center text-slate-500">—</td>
                        <td className="px-2 py-4 text-center font-bold text-white">{eff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
