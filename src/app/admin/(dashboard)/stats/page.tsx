"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdmin } from "../layout";
import { firebaseDB } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Game = {
  id: string;
  homeTeamId: string; homeTeamName: string; homeTeamLogo?: string;
  awayTeamId: string; awayTeamName: string; awayTeamLogo?: string;
  date: string; time: string; venue: string; gender: string;
  completed?: boolean; winnerTeamId?: string; winnerScore?: number; loserScore?: number;
};

type PlayerStat = { playerId: string; name: string; points: number; rebounds: number; assists: number; steals: number; blocks: number; fouls: number; minutes: number; };

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Game Statistics",
    subtitle: "Collect and manage game stats",
    availableGames: "Available Games",
    readyForStats: "Games ready for stats collection",
    noGames: "No games available",
    gamesNote: "Games appear 45 minutes after start time",
    homeTeam: "Home", awayTeam: "Away",
    collectStats: "Collect Stats", editStats: "Edit Stats",
    selectWinner: "Select Winner",
    finalScore: "Final Score",
    save: "Save", cancel: "Cancel",
    complete: "Complete",
    points: "PTS", rebounds: "REB", assists: "AST", steals: "STL", blocks: "BLK", fouls: "PF", minutes: "MIN",
    playerStats: "Player Statistics",
  },
  fr: {
    title: "Statistiques des Matchs",
    subtitle: "Collecter et gérer les statistiques",
    availableGames: "Matchs Disponibles",
    readyForStats: "Matchs prêts pour la collecte de statistiques",
    noGames: "Aucun match disponible",
    gamesNote: "Les matchs apparaissent 45 minutes après le début",
    homeTeam: "Domicile", awayTeam: "Extérieur",
    collectStats: "Collecter", editStats: "Modifier",
    selectWinner: "Sélectionner le Gagnant",
    finalScore: "Score Final",
    save: "Enregistrer", cancel: "Annuler",
    complete: "Terminé",
    points: "PTS", rebounds: "REB", assists: "AST", steals: "INT", blocks: "CTR", fouls: "FT", minutes: "MIN",
    playerStats: "Statistiques Joueurs",
  },
};

export default function StatsPage() {
  const { language, currentAdminUser } = useAdmin();
  const copy = t[language];
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [winnerId, setWinnerId] = useState("");
  const [winnerScore, setWinnerScore] = useState("");
  const [loserScore, setLoserScore] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const snap = await getDocs(query(collection(firebaseDB, "games"), where("date", "<=", cutoff.split("T")[0]), orderBy("date", "desc")));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Game));
      setGames(list.slice(0, 50));
    } catch (error) { console.error("Error fetching games:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const openGameStats = (game: Game) => {
    setSelectedGame(game);
    setWinnerId(game.winnerTeamId || "");
    setWinnerScore(game.winnerScore?.toString() || "");
    setLoserScore(game.loserScore?.toString() || "");
  };

  const saveGameStats = async () => {
    if (!selectedGame || !winnerId || !winnerScore || !loserScore) return;
    setSaving(true);
    try {
      const loserId = winnerId === selectedGame.homeTeamId ? selectedGame.awayTeamId : selectedGame.homeTeamId;
      await updateDoc(doc(firebaseDB, "games", selectedGame.id), {
        completed: true,
        winnerTeamId: winnerId,
        loserTeamId: loserId,
        winnerScore: parseInt(winnerScore),
        loserScore: parseInt(loserScore),
        updatedAt: serverTimestamp(),
      });
      setSelectedGame(null);
      fetchGames();
    } catch (error) { console.error("Error saving game stats:", error); }
    finally { setSaving(false); }
  };

  const canManageStats = currentAdminUser?.permissions?.canManageGames;

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Available Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">{copy.availableGames}</h2><p className="text-xs text-slate-400">{copy.readyForStats}</p></div>
          <div className="rounded-xl bg-emerald-500/10 px-4 py-2 border border-emerald-500/30"><span className="text-lg font-bold text-emerald-300">{games.length}</span><span className="text-xs text-slate-400 ml-1">games</span></div>
        </div>

        {games.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-16 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-base font-semibold text-slate-300">{copy.noGames}</p>
            <p className="text-sm text-slate-500 mt-2">{copy.gamesNote}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <button key={game.id} type="button" onClick={() => canManageStats && openGameStats(game)} disabled={!canManageStats}
                className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all ${game.completed ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"} disabled:opacity-50`}>
                <div className="p-5">
                  <div className="flex items-center gap-6">
                    <div className="flex-1 flex items-center justify-between gap-4">
                      {/* Away */}
                      <div className="flex items-center gap-3 flex-1">
                        {game.awayTeamLogo && (<Image src={game.awayTeamLogo} alt={game.awayTeamName} width={48} height={48} className="rounded-xl ring-2 ring-white/10" unoptimized />)}
                        <div><div className="font-bold text-white">{game.awayTeamName}</div><div className="text-xs text-slate-400">{copy.awayTeam}</div></div>
                      </div>
                      {/* Score */}
                      {game.completed ? (
                        <div className="flex items-center gap-2 px-4">
                          <span className={`text-2xl font-black ${game.winnerTeamId === game.awayTeamId ? "text-emerald-400" : "text-slate-500"}`}>{game.winnerTeamId === game.awayTeamId ? game.winnerScore : game.loserScore}</span>
                          <span className="text-lg text-slate-600">-</span>
                          <span className={`text-2xl font-black ${game.winnerTeamId === game.homeTeamId ? "text-emerald-400" : "text-slate-500"}`}>{game.winnerTeamId === game.homeTeamId ? game.winnerScore : game.loserScore}</span>
                        </div>
                      ) : (<div className="text-xl font-bold text-slate-600 px-4">VS</div>)}
                      {/* Home */}
                      <div className="flex items-center gap-3 flex-1 flex-row-reverse">
                        {game.homeTeamLogo && (<Image src={game.homeTeamLogo} alt={game.homeTeamName} width={48} height={48} className="rounded-xl ring-2 ring-white/10" unoptimized />)}
                        <div className="text-right"><div className="font-bold text-white">{game.homeTeamName}</div><div className="text-xs text-slate-400">{copy.homeTeam}</div></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><div className="text-xs text-slate-400">{game.date} • {game.time}</div><div className="text-xs text-slate-500">{game.venue}</div></div>
                      <div className={`rounded-xl px-4 py-2 font-bold ${game.completed ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
                        <span className="text-sm">{game.completed ? copy.editStats : copy.collectStats}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {game.completed && (<div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></div><span className="text-[10px] font-bold uppercase text-emerald-300">{copy.complete}</span></div>)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Stats Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">{selectedGame.awayTeamName} vs {selectedGame.homeTeamName}</h3>
              <p className="text-sm text-slate-400">{selectedGame.date} • {selectedGame.venue}</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{copy.selectWinner}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setWinnerId(selectedGame.awayTeamId)} className={`p-4 rounded-xl border text-center transition ${winnerId === selectedGame.awayTeamId ? "border-emerald-500 bg-emerald-500/20" : "border-white/10 hover:border-white/30"}`}>
                    {selectedGame.awayTeamLogo && <Image src={selectedGame.awayTeamLogo} alt="" width={40} height={40} className="mx-auto mb-2 rounded-lg" unoptimized />}
                    <div className="text-white font-semibold text-sm">{selectedGame.awayTeamName}</div>
                  </button>
                  <button type="button" onClick={() => setWinnerId(selectedGame.homeTeamId)} className={`p-4 rounded-xl border text-center transition ${winnerId === selectedGame.homeTeamId ? "border-emerald-500 bg-emerald-500/20" : "border-white/10 hover:border-white/30"}`}>
                    {selectedGame.homeTeamLogo && <Image src={selectedGame.homeTeamLogo} alt="" width={40} height={40} className="mx-auto mb-2 rounded-lg" unoptimized />}
                    <div className="text-white font-semibold text-sm">{selectedGame.homeTeamName}</div>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{copy.finalScore}</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">Winner</label>
                    <input type="number" value={winnerScore} onChange={(e) => setWinnerScore(e.target.value)} placeholder="0" title="Winner score" className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-2xl text-center font-bold" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Loser</label>
                    <input type="number" value={loserScore} onChange={(e) => setLoserScore(e.target.value)} placeholder="0" title="Loser score" className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-2xl text-center font-bold" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={() => setSelectedGame(null)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700">{copy.cancel}</button>
              <button onClick={saveGameStats} disabled={saving || !winnerId || !winnerScore || !loserScore} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 disabled:opacity-50">{saving ? "..." : copy.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
