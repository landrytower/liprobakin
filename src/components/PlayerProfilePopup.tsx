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
  language: string;
}

export default function PlayerProfilePopup({ userProfile, onClose, language }: PlayerProfilePopupProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [nextGame, setNextGame] = useState<NextGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<{ name: string; number: string; headshot: string; position: string } | null>(null);

  const fullName = playerData?.name || userProfile.linkedPlayerName || `${userProfile.firstName} ${userProfile.lastName}`;
  const firstNameOnly = (playerData?.name || userProfile.linkedPlayerName || userProfile.firstName || "").split(" ")[0];

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
          orderBy("date", "desc"),
          limit(50)
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
          // Filter completed games in memory
          if (!gameData.completed) return;
          
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
          orderBy("date", "asc"),
          limit(50)
        );

        const upcomingSnapshot = await getDocs(upcomingGamesQuery);
        
        for (const doc of upcomingSnapshot.docs) {
          const gameData = doc.data();
          
          // Skip completed games
          if (gameData.completed) continue;
          
          // Check if this is the linked player's team game
          if (gameData.homeTeamName === userProfile.teamName || 
              gameData.awayTeamName === userProfile.teamName) {
            
            const isHome = gameData.homeTeamName === userProfile.teamName;
            const opponent = isHome ? gameData.awayTeamName : gameData.homeTeamName;
            
            const normalizedDate = typeof gameData.date?.toDate === "function" ? gameData.date.toDate() : gameData.date;
            setNextGame({
              opponent,
              date: normalizedDate,
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
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="relative w-64 sm:w-72 rounded-2xl border border-white/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-2xl">
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

        {/* Profile Header - Horizontal layout: photo left, info right */}
        <div className="p-4 pb-3 sm:p-5">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px" }}>
            {/* Player Photo - Fixed small size */}
            <div style={{ width: "48px", height: "48px", minWidth: "48px", flexShrink: 0 }}>
              <div className="relative w-full h-full rounded-full overflow-hidden ring-2 ring-blue-500/50">
                {playerData?.headshot || userProfile.verificationImageUrl ? (
                  <Image
                    src={playerData?.headshot || userProfile.verificationImageUrl || ""}
                    alt={playerData?.name || userProfile.linkedPlayerName || `${userProfile.firstName} ${userProfile.lastName}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {playerData?.name?.[0] || userProfile.firstName[0]}{playerData?.name?.split(' ')[1]?.[0] || userProfile.lastName[0]}
                  </div>
                )}
              </div>
            </div>

            {/* Player Info - Right side of headshot */}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <h3 className="text-sm font-bold text-white leading-tight truncate" title={fullName}>
                {fullName}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                #{playerData?.number || userProfile.playerNumber} • {playerData?.position || userProfile.position || "Player"}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{userProfile.teamName}</p>
              
              {/* Social Media Icons */}
              <div className="flex gap-2 mt-2">
                <a
                  href="#"
                  className="group flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:scale-110 hover:shadow-lg hover:shadow-pink-500/20"
                  aria-label="Instagram"
                >
                  <svg className="w-3 h-3 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="#"
                  className="group flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20"
                  aria-label="Facebook"
                >
                  <svg className="w-3 h-3 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
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
              <div className="px-5 pb-3">
                <div className="rounded-xl bg-slate-950/60 border border-white/10 p-3">
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">PTS</div>
                      <div className="text-sm font-bold text-white">{stats.pts}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">REB</div>
                      <div className="text-sm font-bold text-white">{stats.reb}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">AST</div>
                      <div className="text-sm font-bold text-white">{stats.ast}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">BLK</div>
                      <div className="text-sm font-bold text-white">{stats.blk}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">STL</div>
                      <div className="text-sm font-bold text-white">{stats.stl}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10 text-center">
                    <span className="text-[10px] text-slate-400">Averages • Last {stats.gamesPlayed} games</span>
                  </div>
                </div>
              </div>
            )}

            {/* Next Game */}
            {nextGame && (
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                      {language === 'fr' ? 'Prochain match' : 'Next Game'}
                    </span>
                    <span className="text-sm text-white font-bold">
                      {nextGame.isHome ? "vs" : "@"} {nextGame.opponent}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {(() => {
                      const rawDate = nextGame.date as unknown;
                      let parsedDate: Date | null = null;

                      if (rawDate instanceof Date) {
                        parsedDate = rawDate;
                      } else if (typeof rawDate === "string" || typeof rawDate === "number") {
                        const candidate = new Date(rawDate);
                        parsedDate = isNaN(candidate.getTime()) ? null : candidate;
                      } else if (rawDate && typeof rawDate === "object" && "toDate" in rawDate) {
                        const candidate = (rawDate as { toDate?: () => Date }).toDate?.();
                        parsedDate = candidate && !isNaN(candidate.getTime()) ? candidate : null;
                      }

                      if (!parsedDate) {
                        return typeof rawDate === "string" ? rawDate : "TBD";
                      }

                      const dateStr = parsedDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });

                      const timeStr = parsedDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      });

                      return `${dateStr} • ${timeStr}`;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{nextGame.venue}</div>
                </div>
              </div>
            )}

            {!stats && !nextGame && (
              <div className="px-5 pb-5 text-center text-xs text-slate-400">
                No stats or upcoming games yet
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
