"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RosterPlayer } from "@/data/febaco";
import { franchises, franchisesWomen } from "@/data/febaco";
import { countries, codeForCountryName, flagFromCode, nameForCountryCode } from "@/data/countries";
import { useAuth } from "@/contexts/AuthContext";

const translations = {
  en: {
    loading: "Loading player profile...",
    playerNotFound: "Player not found",
    goBack: "Go Back",
    back: "Back",
    nationality: "Nationality",
    dateOfBirth: "Date of Birth",
    height: "Height",
    position: "Position",
    yourDashboard: "Your Player Dashboard",
    welcomeBack: "Welcome back",
    statsOverview: "Here's your personal stats overview.",
    performance: "Performance",
    gamesPlayed: "Games Played",
    avgPPG: "Avg PPG",
    avgRPG: "Avg RPG",
    rankings: "Rankings",
    pointsRank: "Points Rank",
    reboundsRank: "Rebounds Rank",
    stealsRank: "Steals Rank",
    seasonStats: "Season Stats",
    stealsPG: "Steals PG",
    blocksPG: "Blocks PG",
    totalGames: "Total Games",
    profileSettings: "Profile Settings",
    viewFullStats: "View Full Stats Report",
    seasonStatistics: "Season Statistics",
    pointsPerGame: "Points Per Game",
    reboundsPerGame: "Rebounds Per Game",
    stealsPerGame: "Steals Per Game",
    blocksPerGame: "Blocks Per Game",
    inLeague: "in League",
    detailedStatistics: "Detailed Statistics",
    games: "Game(s)",
    pts: "PTS",
    fg: "FG",
    shots: "Shots",
    threePtFg: "3PT FG",
    ft: "FT",
    rebounds: "Rebounds",
    oreb: "OREB",
    dreb: "DREB",
    reb: "REB",
    ast: "AST",
    pf: "PF",
    to: "TO",
    stl: "STL",
    blk: "BLK",
    plusMinus: "+/-",
    eff: "EFF",
    vs: "vs",
  },
  fr: {
    loading: "Chargement du profil du joueur...",
    playerNotFound: "Joueur introuvable",
    goBack: "Retour",
    back: "Retour",
    nationality: "Nationalité",
    dateOfBirth: "Date de Naissance",
    height: "Taille",
    position: "Position",
    yourDashboard: "Votre Tableau de Bord Joueur",
    welcomeBack: "Bon retour",
    statsOverview: "Voici un aperçu de vos statistiques personnelles.",
    performance: "Performance",
    gamesPlayed: "Matchs Joués",
    avgPPG: "PPM Moy.",
    avgRPG: "RPM Moy.",
    rankings: "Classements",
    pointsRank: "Rang Points",
    reboundsRank: "Rang Rebonds",
    stealsRank: "Rang Interceptions",
    seasonStats: "Stats de Saison",
    stealsPG: "Interceptions PM",
    blocksPG: "Contres PM",
    totalGames: "Total Matchs",
    profileSettings: "Paramètres du Profil",
    viewFullStats: "Voir le Rapport Complet des Stats",
    seasonStatistics: "Statistiques de Saison",
    pointsPerGame: "Points Par Match",
    reboundsPerGame: "Rebonds Par Match",
    stealsPerGame: "Interceptions Par Match",
    blocksPerGame: "Contres Par Match",
    inLeague: "dans la Ligue",
    detailedStatistics: "Statistiques Détaillées",
    games: "Match(s)",
    pts: "PTS",
    fg: "TC",
    shots: "Tirs",
    threePtFg: "3PT TC",
    ft: "LF",
    rebounds: "Rebonds",
    oreb: "RO",
    dreb: "RD",
    reb: "REB",
    ast: "PD",
    pf: "FP",
    to: "BP",
    stl: "INT",
    blk: "CT",
    plusMinus: "+/-",
    eff: "EFF",
    vs: "vs",
  },
};

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
  const { user, userProfile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const teamName = decodeURIComponent(params.teamName as string);
  const playerNumber = params.playerNumber as string;
  
  const [player, setPlayer] = useState<RosterPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState({ pts: 0, reb: 0, stl: 0, blk: 0 });
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  
  // Check if the logged-in user is viewing their own profile
  const isOwnProfile = user && userProfile && userProfile.teamName === teamName && userProfile.playerNumber?.toString() === playerNumber;

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
        <div className="text-white text-xl">{t.loading}</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-white text-2xl mb-4">{t.playerNotFound}</div>
        <button
          onClick={() => router.back()}
          className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
        >
          {t.goBack}
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
            <span className="text-2xl font-bold text-white">LIPROBAKIN</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="group relative h-11 w-11 flex items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:border-white/40 hover:bg-white/10"
                aria-label="Home"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 animate-shimmer" />
                <svg className="relative z-10 h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-sm hover:border-white/30 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t.back}
              </button>
            </div>
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
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">{t.nationality}</p>
                      <p className="text-xs font-semibold text-white sm:text-base flex items-center gap-2">
                        <img
                          src={`https://flagcdn.com/w40/${player.nationality.toLowerCase()}.png`}
                          alt={nameForCountryCode(player.nationality) || "Flag"}
                          width={32}
                          height={24}
                          className="rounded shadow-sm flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        {player.nationality2 ? (
                          <>
                            <img
                              src={`https://flagcdn.com/w40/${player.nationality2.toLowerCase()}.png`}
                              alt={nameForCountryCode(player.nationality2) || "Flag"}
                              width={32}
                              height={24}
                              className="rounded shadow-sm flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <span className="truncate">{player.nationality}, {player.nationality2}</span>
                          </>
                        ) : (
                          <span className="truncate">{nameForCountryCode(player.nationality) || player.nationality}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {player.dateOfBirth && (
                    <div className="flex-1 min-w-[110px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">{t.dateOfBirth}</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate">
                        {new Date(player.dateOfBirth).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                  <div className="flex-1 min-w-[90px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">{t.height}</p>
                    <p className="text-xs font-semibold text-white sm:text-base">{player.height || "—"}</p>
                  </div>
                  {player.position && (
                    <div className="flex-1 min-w-[90px] rounded-xl border border-white/20 bg-black/20 p-2.5 sm:p-4">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-200 sm:text-xs">{t.position}</p>
                      <p className="text-xs font-semibold text-white sm:text-base truncate">{player.position}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Player Dashboard - Only Visible to Logged-In Player */}
        {isOwnProfile && (
          <div className="mb-6 rounded-3xl border border-green-500/50 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/30">
                <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{t.yourDashboard}</h2>
                <p className="text-sm text-green-200/80">{t.welcomeBack}, {player.firstName}! {t.statsOverview}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">{t.performance}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.gamesPlayed}</span>
                    <span className="text-sm font-bold text-white">{gameLogs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.avgPPG}</span>
                    <span className="text-sm font-bold text-green-400">{player.stats.pts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.avgRPG}</span>
                    <span className="text-sm font-bold text-green-400">{player.stats.reb}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                    <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">{t.rankings}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.pointsRank}</span>
                    <span className="text-sm font-bold text-yellow-400">#{rankings.pts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.reboundsRank}</span>
                    <span className="text-sm font-bold text-yellow-400">#{rankings.reb}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.stealsRank}</span>
                    <span className="text-sm font-bold text-yellow-400">#{rankings.stl}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">{t.seasonStats}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.stealsPG}</span>
                    <span className="text-sm font-bold text-white">{player.stats.stl}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.blocksPG}</span>
                    <span className="text-sm font-bold text-white">{(player.stats as any).blk || "0.0"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{t.totalGames}</span>
                    <span className="text-sm font-bold text-white">{gameLogs.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/profile-settings`)}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.profileSettings}
              </button>
              <button
                className="flex items-center gap-2 rounded-xl border border-green-500/50 bg-gradient-to-r from-green-500/10 to-green-600/10 px-4 py-2.5 text-sm font-semibold text-green-400 transition hover:from-green-500/20 hover:to-green-600/20"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.viewFullStats}
              </button>
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 lg:p-8">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wider text-slate-300 sm:mb-6 sm:text-xl lg:text-2xl">
            {t.seasonStatistics}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">{t.pointsPerGame}</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.pts}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.pts} {t.inLeague}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">{t.reboundsPerGame}</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.reb}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.reb} {t.inLeague}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">{t.stealsPerGame}</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{player.stats.stl}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.stl} {t.inLeague}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-3 sm:p-6">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400 sm:mb-2 sm:text-sm">{t.blocksPerGame}</p>
              <p className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-5xl lg:text-6xl">{(player.stats as any).blk || "0.0"}</p>
              <p className="text-[10px] font-semibold text-emerald-400 sm:text-sm">#{rankings.blk} {t.inLeague}</p>
            </div>
          </div>
        </div>

        {/* Detailed Statistics - Last 5 Games */}
        {gameLogs.length > 0 && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 lg:p-8">
            <h2 className="mb-4 text-xl font-bold uppercase tracking-wider text-white sm:mb-6 sm:text-2xl">
              {t.detailedStatistics}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider">{t.games}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.pts}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div>{t.fg}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div>{t.shots}</div>
                      <div className="mt-1 font-normal normal-case text-[11px] text-slate-500">{t.threePtFg}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-1 font-normal normal-case text-[11px] text-slate-500">{t.ft}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div>{t.rebounds}</div>
                      <div className="mt-1 font-normal normal-case text-[11px] text-slate-500">{t.oreb}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-1 font-normal normal-case text-[11px] text-slate-500">{t.dreb}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                      <div className="opacity-0">.</div>
                      <div className="mt-1 font-normal normal-case text-[11px] text-slate-500">{t.reb}</div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.ast}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.pf}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.to}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.stl}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.blk}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.plusMinus}</th>
                    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider">{t.eff}</th>
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
                        <td className="px-3 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs font-bold ${
                              game.result === "W" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              {game.result}
                            </span>
                            <span className="text-sm text-slate-300">
                              {t.vs} {game.opponent}, {new Date(game.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: "numeric", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-5 text-center font-bold text-white text-base">{game.pts}</td>
                        <td className="px-3 py-5 text-center">
                          <div className="text-white text-sm">{fgMade}/{fgAttempts}</div>
                          <div className="text-xs text-slate-500">{fgPct}%</div>
                        </td>
                        <td className="px-3 py-5 text-center">
                          <div className="text-white text-sm">{game.three_pm}/{game.three_pa}</div>
                          <div className="text-xs text-slate-500">{threePct}%</div>
                        </td>
                        <td className="px-3 py-5 text-center">
                          <div className="text-white text-sm">{game.ft_m}/{game.ft_a}</div>
                          <div className="text-xs text-slate-500">{ftPct}%</div>
                        </td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.oreb}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.dreb}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.reb}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.ast}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.pf}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.to}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.stl}</td>
                        <td className="px-3 py-5 text-center text-white text-sm">{game.blk}</td>
                        <td className="px-3 py-5 text-center text-slate-500 text-sm">—</td>
                        <td className="px-3 py-5 text-center font-bold text-white text-base">{eff}</td>
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
