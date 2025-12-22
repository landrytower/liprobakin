"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import type { UserProfile } from "@/types/user";

interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  blk: number;
  stl: number;
  gamesPlayed: number;
}

interface NextGame {
  opponent: string;
  date: string;
  time: string;
  venue: string;
  isHome: boolean;
}

interface PlayerProfilePopupProps {
  userProfile: UserProfile;
  onClose: () => void;
}

export default function PlayerProfilePopup({ userProfile, onClose }: PlayerProfilePopupProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [nextGame, setNextGame] = useState<NextGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<{ name: string; number: string; headshot: string; position: string } | null>(null);

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        console.log("🔍 PlayerProfilePopup Debug:", {
          linkedPlayerId: userProfile.linkedPlayerId,
          linkedPlayerName: userProfile.linkedPlayerName,
          teamId: userProfile.teamId,
          teamName: userProfile.teamName,
          playerNumber: userProfile.playerNumber
        });

        // First priority: Use linkedPlayerName if available (this is set during verification)
        if (userProfile.linkedPlayerName) {
          console.log("✅ Using linkedPlayerName:", userProfile.linkedPlayerName);
          setPlayerData({
            name: userProfile.linkedPlayerName,
            number: userProfile.playerNumber || "",
            headshot: "",
            position: userProfile.position || "Player",
          });

          // Try to fetch additional data like headshot from roster if we have teamId
          if (userProfile.linkedPlayerId && userProfile.teamId) {
            try {
              const rosterRef = collection(firebaseDB, "teams", userProfile.teamId, "roster");
              const rosterSnapshot = await getDocs(rosterRef);
              
              const matchingPlayer = rosterSnapshot.docs.find(doc => doc.id === userProfile.linkedPlayerId);
              
              if (matchingPlayer) {
                const data = matchingPlayer.data();
                console.log("✅ Found roster data:", data);
                setPlayerData(prev => ({
                  ...prev!,
                  headshot: data.headshot || prev!.headshot,
                  position: data.position || prev!.position,
                }));
              } else {
                console.log("⚠️ No matching roster player found for ID:", userProfile.linkedPlayerId);
              }
            } catch (error) {
              console.error("Error fetching roster data:", error);
            }
          }
        } else {
          console.log("❌ No linkedPlayerName found, falling back to registration name");
          setPlayerData({
            name: `${userProfile.firstName} ${userProfile.lastName}`,
            number: userProfile.playerNumber || "",
            headshot: "",
            position: userProfile.position || "Player",
          });
        }

        // Fetch player stats using the linked player's number
        const gamesRef = collection(firebaseDB, "games");
        const completedGamesQuery = query(
          gamesRef,
          where("completed", "==", true),
          orderBy("date", "desc"),
          limit(10)
        );
        
        const gamesSnapshot = await getDocs(completedGamesQuery);
        
        let totalPts = 0;
        let totalReb = 0;
        let totalAst = 0;
        let totalBlk = 0;
        let totalStl = 0;
        let gamesPlayed = 0;

        gamesSnapshot.docs.forEach((doc) => {
          const gameData = doc.data();
          const playerStats = gameData.playerStats || [];
          
          // Find the linked player's stats using their number and team
          const myStats = playerStats.find((p: { jerseyNumber: number; teamName: string; pts?: number; reb?: number; ast?: number; blk?: number; stl?: number }) => 
            p.jerseyNumber === parseInt(userProfile.playerNumber || "0") &&
            p.teamName === userProfile.teamName
          );

          if (myStats) {
            totalPts += myStats.pts || 0;
            totalReb += myStats.reb || 0;
            totalAst += myStats.ast || 0;
            totalBlk += myStats.blk || 0;
            totalStl += myStats.stl || 0;
            gamesPlayed++;
          }
        });

        if (gamesPlayed > 0) {
          setStats({
            pts: Math.round((totalPts / gamesPlayed) * 10) / 10,
            reb: Math.round((totalReb / gamesPlayed) * 10) / 10,
            ast: Math.round((totalAst / gamesPlayed) * 10) / 10,
            blk: Math.round((totalBlk / gamesPlayed) * 10) / 10,
            stl: Math.round((totalStl / gamesPlayed) * 10) / 10,
            gamesPlayed,
          });
        }

        // Fetch next game
        const upcomingGamesQuery = query(
          gamesRef,
          where("completed", "==", false),
          orderBy("date", "asc"),
          limit(20)
        );

        const upcomingSnapshot = await getDocs(upcomingGamesQuery);
        
        for (const doc of upcomingSnapshot.docs) {
          const gameData = doc.data();
          
          // Check if this is the linked player's team game
          if (gameData.homeTeamName === userProfile.teamName || 
              gameData.awayTeamName === userProfile.teamName) {
            
            const isHome = gameData.homeTeamName === userProfile.teamName;
            const opponent = isHome ? gameData.awayTeamName : gameData.homeTeamName;
            
            setNextGame({
              opponent,
              date: gameData.date,
              time: gameData.time,
              venue: gameData.venue || "TBD",
              isHome,
            });
            break;
          }
        }
      } catch (error) {
        console.error("Error fetching player data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile.role === "player" && userProfile.teamName) {
      fetchPlayerData();
    } else {
      setLoading(false);
    }
  }, [userProfile]);

  // Only show for verified players
  if (userProfile.verificationStatus !== "approved" || userProfile.role !== "player") {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative w-80 rounded-2xl border border-white/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all hover:scale-110"
          type="button"
          aria-label="Close player profile"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Profile Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            {/* Player Photo */}
            <div className="relative h-20 w-20 rounded-full overflow-hidden ring-4 ring-blue-500/50 flex-shrink-0">
              {playerData?.headshot || userProfile.verificationImageUrl ? (
                <Image
                  src={playerData?.headshot || userProfile.verificationImageUrl || ""}
                  alt={playerData?.name || userProfile.linkedPlayerName || `${userProfile.firstName} ${userProfile.lastName}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {playerData?.name?.[0] || userProfile.firstName[0]}{playerData?.name?.split(' ')[1]?.[0] || userProfile.lastName[0]}
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">
                {playerData?.name || userProfile.linkedPlayerName || `${userProfile.firstName} ${userProfile.lastName}`}
              </h3>
              <p className="text-sm text-slate-300">
                #{playerData?.number || userProfile.playerNumber} • {playerData?.position || userProfile.position || "Player"}
              </p>
              <p className="text-xs text-slate-400 truncate">{userProfile.teamName}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 pb-6 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            {stats && (
              <div className="px-6 pb-4">
                <div className="rounded-xl bg-slate-950/60 border border-white/10 p-4">
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">PTS</div>
                      <div className="text-lg font-bold text-white">{stats.pts}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">REB</div>
                      <div className="text-lg font-bold text-white">{stats.reb}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">AST</div>
                      <div className="text-lg font-bold text-white">{stats.ast}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">BLK</div>
                      <div className="text-lg font-bold text-white">{stats.blk}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">STL</div>
                      <div className="text-lg font-bold text-white">{stats.stl}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 text-center">
                    <span className="text-xs text-slate-400">Averages • Last {stats.gamesPlayed} games</span>
                  </div>
                </div>
              </div>
            )}

            {/* Next Game */}
            {nextGame && (
              <div className="px-6 pb-6">
                <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 p-4">
                  <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">
                    Next Game
                  </div>
                  <div className="text-white font-bold mb-1">
                    {nextGame.isHome ? "vs" : "@"} {nextGame.opponent}
                  </div>
                  <div className="text-sm text-slate-300">
                    {new Date(nextGame.date).toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric" 
                    })} • {nextGame.time}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{nextGame.venue}</div>
                </div>
              </div>
            )}

            {!stats && !nextGame && (
              <div className="px-6 pb-6 text-center text-sm text-slate-400">
                No stats or upcoming games yet
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
