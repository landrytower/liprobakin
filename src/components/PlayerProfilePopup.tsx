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
  const [isClosing, setIsClosing] = useState(false);
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

  // Handle smooth close animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 400); // Match animation duration
  };

  // Only show for verified players
  if (userProfile.verificationStatus !== "approved" || userProfile.role !== "player") {
    return null;
  }

  return (
    <div 
      className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 transition-all duration-400 ease-out ${
        isClosing 
          ? 'opacity-0 translate-y-[-20px] scale-95' 
          : 'animate-in slide-in-from-top-4 fade-in duration-500'
      }`}
    >
      <div className="relative w-64 sm:w-72 rounded-2xl border border-white/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
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
          <div className="flex flex-row items-center gap-3">
            {/* Player Photo - Fixed small size on left */}
            <div className="w-12 h-12 min-w-[48px] flex-shrink-0">
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

            {/* Player Info - Always on right side of headshot */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="text-sm font-bold text-white leading-tight truncate" title={fullName}>
                {fullName}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                #{playerData?.number || userProfile.playerNumber} • {playerData?.position || userProfile.position || "Player"}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{userProfile.teamName}</p>
              
              {/* Download Card Button */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                      const downloadCard = async () => {
                        try {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          
                          // Mobile-friendly portrait size
                          canvas.width = 400;
                          canvas.height = 700;
                          
                          // Dark blue background
                          ctx.fillStyle = '#1e293b';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          
                          // Decorative circles (top-right and bottom corners)
                          ctx.beginPath();
                          ctx.arc(canvas.width + 30, -30, 120, 0, 2 * Math.PI);
                          ctx.fillStyle = '#334155';
                          ctx.fill();
                          
                          ctx.beginPath();
                          ctx.arc(-40, canvas.height - 100, 100, 0, 2 * Math.PI);
                          ctx.fillStyle = '#475569';
                          ctx.fill();
                          
                          ctx.beginPath();
                          ctx.arc(canvas.width - 50, canvas.height - 50, 80, 0, 2 * Math.PI);
                          ctx.fillStyle = '#9a6b4c';
                          ctx.fill();
                          
                          // "LIPROBAKIN" header
                          ctx.fillStyle = '#f59e0b';
                          ctx.font = 'bold 24px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText('LIPROBAKIN', canvas.width / 2, 45);
                          
                          // Circular photo area
                          const photoSize = 140;
                          const photoX = canvas.width / 2;
                          const photoY = 150;
                          
                          // Gold ring around photo
                          ctx.beginPath();
                          ctx.arc(photoX, photoY, photoSize / 2 + 5, 0, 2 * Math.PI);
                          ctx.strokeStyle = '#f59e0b';
                          ctx.lineWidth = 4;
                          ctx.stroke();
                          
                          // Dark circle background
                          ctx.beginPath();
                          ctx.arc(photoX, photoY, photoSize / 2, 0, 2 * Math.PI);
                          ctx.fillStyle = '#334155';
                          ctx.fill();
                          
                          // Try to load player headshot
                          let imageLoaded = false;
                          if (playerData?.headshot) {
                            try {
                              const img = document.createElement('img');
                              img.crossOrigin = 'anonymous';
                              
                              imageLoaded = await new Promise<boolean>((resolve) => {
                                img.onload = () => {
                                  ctx.save();
                                  ctx.beginPath();
                                  ctx.arc(photoX, photoY, photoSize / 2 - 2, 0, 2 * Math.PI);
                                  ctx.clip();
                                  ctx.drawImage(img, photoX - photoSize/2 + 2, photoY - photoSize/2 + 2, photoSize - 4, photoSize - 4);
                                  ctx.restore();
                                  resolve(true);
                                };
                                img.onerror = () => resolve(false);
                                img.src = playerData.headshot + '?t=' + new Date().getTime();
                              });
                            } catch {
                              console.log('Could not load player image');
                            }
                          }
                          
                          // If no image, show initials
                          if (!imageLoaded) {
                            const initials = fullName.split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase();
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 56px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(initials, photoX, photoY + 18);
                          }
                          
                          // Jersey number badge
                          const badgeY = photoY + photoSize / 2 + 10;
                          const badgeWidth = 60;
                          const badgeHeight = 28;
                          
                          // Draw badge background
                          ctx.beginPath();
                          ctx.roundRect(photoX - badgeWidth/2, badgeY, badgeWidth, badgeHeight, 14);
                          ctx.fillStyle = '#f59e0b';
                          ctx.fill();
                          
                          // Jersey number text
                          ctx.fillStyle = '#1e293b';
                          ctx.font = 'bold 16px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText(`#${playerData?.number || userProfile.playerNumber || '00'}`, photoX, badgeY + 20);
                          
                          // Player name
                          ctx.fillStyle = '#ffffff';
                          ctx.font = 'bold 28px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText(fullName, canvas.width / 2, badgeY + 70);
                          
                          // Team name
                          ctx.fillStyle = '#f59e0b';
                          ctx.font = '18px Arial';
                          ctx.fillText(userProfile.teamName || '', canvas.width / 2, badgeY + 100);
                          
                          // Stats boxes
                          const statsY = badgeY + 140;
                          const boxWidth = 100;
                          const boxHeight = 80;
                          const boxSpacing = 15;
                          const totalBoxWidth = (boxWidth * 3) + (boxSpacing * 2);
                          const startX = (canvas.width - totalBoxWidth) / 2;
                          
                          const statsData = [
                            { label: 'PTS', value: stats?.pts ?? 0 },
                            { label: 'REB', value: stats?.reb ?? 0 },
                            { label: 'AST', value: stats?.ast ?? 0 }
                          ];
                          
                          statsData.forEach((stat, index) => {
                            const boxX = startX + (index * (boxWidth + boxSpacing));
                            
                            // Draw rounded box
                            ctx.beginPath();
                            ctx.roundRect(boxX, statsY, boxWidth, boxHeight, 12);
                            ctx.fillStyle = '#334155';
                            ctx.fill();
                            
                            // Stat value
                            ctx.fillStyle = '#ffffff';
                            ctx.font = 'bold 28px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(stat.value.toFixed(1), boxX + boxWidth/2, statsY + 38);
                            
                            // Stat label
                            ctx.fillStyle = '#94a3b8';
                            ctx.font = '12px Arial';
                            ctx.fillText(stat.label, boxX + boxWidth/2, statsY + 60);
                          });
                          
                          // Website footer
                          ctx.fillStyle = '#64748b';
                          ctx.font = '14px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText('liprobakin.com', canvas.width / 2, canvas.height - 25);
                          
                          // Download the image
                          canvas.toBlob((blob) => {
                            if (!blob) return;
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${fullName.replace(/\s+/g, '_')}_card.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }, 'image/png');
                          
                        } catch (error) {
                          console.error('Error creating share card:', error);
                        }
                      };
                      
                      downloadCard();
                    }}
                    className="group flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:scale-110 hover:shadow-lg hover:shadow-green-500/20"
                    aria-label="Download Share Card"
                  >
                    <svg className="w-3 h-3 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  </button>
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
