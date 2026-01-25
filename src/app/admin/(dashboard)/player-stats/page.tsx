"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER STATS ENTRY PAGE - ENTER GAME STATS PER PLAYER
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { firebaseDB } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Game {
  id: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  date: Timestamp;
  status: string;
  statsSubmitted: boolean;
}

interface Team {
  id: string;
  name: string;
  logo?: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  teamId: string;
}

interface PlayerStatEntry {
  playerId: string;
  player: Player;
  minutes: number;
  started: boolean;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePtMade: number;
  threePtAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  reboundsOff: number;
  reboundsDef: number;
  assists: number;
  turnovers: number;
  blocks: number;
  steals: number;
  personalFouls: number;
  disqualifications: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerStatsEntryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Players for selected game
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStatEntry>>(
    new Map()
  );

  const functions = getFunctions();

  // ─── Load Teams ────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firebaseDB, "teams"), (snapshot) => {
      const teamsMap = new Map<string, Team>();
      snapshot.docs.forEach((doc) => {
        teamsMap.set(doc.id, {
          id: doc.id,
          name: doc.data().name,
          logo: doc.data().logo,
        });
      });
      setTeams(teamsMap);
    });

    return () => unsubscribe();
  }, []);

  // ─── Load Completed Games Without Stats ────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(firebaseDB, "games"),
      where("status", "==", "completed"),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Game[];

      setGames(gamesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Load Rosters When Game Selected ───────────────────────────────────────

  const loadRosters = useCallback(async (game: Game) => {
    // Load home roster
    const homeRosterSnap = await getDocs(
      collection(firebaseDB, "teams", game.homeTeamId, "roster")
    );
    const homePlayers = homeRosterSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      teamId: game.homeTeamId,
    })) as Player[];

    // Load away roster
    const awayRosterSnap = await getDocs(
      collection(firebaseDB, "teams", game.awayTeamId, "roster")
    );
    const awayPlayers = awayRosterSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      teamId: game.awayTeamId,
    })) as Player[];

    setHomeRoster(homePlayers.sort((a, b) => a.jerseyNumber - b.jerseyNumber));
    setAwayRoster(awayPlayers.sort((a, b) => a.jerseyNumber - b.jerseyNumber));

    // Initialize stats entries
    const statsMap = new Map<string, PlayerStatEntry>();
    [...homePlayers, ...awayPlayers].forEach((player) => {
      statsMap.set(player.id, {
        playerId: player.id,
        player,
        minutes: 0,
        started: false,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePtMade: 0,
        threePtAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        reboundsOff: 0,
        reboundsDef: 0,
        assists: 0,
        turnovers: 0,
        blocks: 0,
        steals: 0,
        personalFouls: 0,
        disqualifications: 0,
      });
    });
    setPlayerStats(statsMap);

    // Load existing stats if available
    if (game.statsSubmitted) {
      const existingStats = await getDocs(
        query(
          collection(firebaseDB, "playerGameStats"),
          where("gameId", "==", game.id)
        )
      );

      existingStats.docs.forEach((doc) => {
        const data = doc.data();
        const existing = statsMap.get(data.playerId);
        if (existing) {
          statsMap.set(data.playerId, {
            ...existing,
            minutes: data.minutes || 0,
            started: data.started || false,
            fieldGoalsMade: data.fieldGoalsMade || 0,
            fieldGoalsAttempted: data.fieldGoalsAttempted || 0,
            threePtMade: data.threePtMade || 0,
            threePtAttempted: data.threePtAttempted || 0,
            freeThrowsMade: data.freeThrowsMade || 0,
            freeThrowsAttempted: data.freeThrowsAttempted || 0,
            reboundsOff: data.reboundsOff || 0,
            reboundsDef: data.reboundsDef || 0,
            assists: data.assists || 0,
            turnovers: data.turnovers || 0,
            blocks: data.blocks || 0,
            steals: data.steals || 0,
            personalFouls: data.personalFouls || 0,
            disqualifications: data.disqualifications || 0,
          });
        }
      });
      setPlayerStats(new Map(statsMap));
    }
  }, []);

  useEffect(() => {
    if (selectedGame) {
      loadRosters(selectedGame);
    }
  }, [selectedGame, loadRosters]);

  // ─── Update Stat ───────────────────────────────────────────────────────────

  const updateStat = (
    playerId: string,
    field: keyof PlayerStatEntry,
    value: number | boolean
  ) => {
    setPlayerStats((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(playerId);
      if (entry) {
        newMap.set(playerId, {
          ...entry,
          [field]: value,
        });
      }
      return newMap;
    });
  };

  // ─── Submit Stats ──────────────────────────────────────────────────────────

  const handleSubmitStats = async () => {
    if (!selectedGame) return;

    setSaving(true);
    try {
      const statsArray = Array.from(playerStats.values())
        .filter(
          (s) =>
            s.minutes > 0 ||
            s.fieldGoalsMade > 0 ||
            s.assists > 0 ||
            s.reboundsOff > 0 ||
            s.reboundsDef > 0
        )
        .map((s) => ({
          playerId: s.playerId,
          minutes: s.minutes,
          started: s.started,
          fieldGoalsMade: s.fieldGoalsMade,
          fieldGoalsAttempted: s.fieldGoalsAttempted,
          threePtMade: s.threePtMade,
          threePtAttempted: s.threePtAttempted,
          freeThrowsMade: s.freeThrowsMade,
          freeThrowsAttempted: s.freeThrowsAttempted,
          reboundsOff: s.reboundsOff,
          reboundsDef: s.reboundsDef,
          assists: s.assists,
          turnovers: s.turnovers,
          blocks: s.blocks,
          steals: s.steals,
          personalFouls: s.personalFouls,
          disqualifications: s.disqualifications,
        }));

      const submitPlayerGameStats = httpsCallable(
        functions,
        "submitPlayerGameStats"
      );
      await submitPlayerGameStats({
        gameId: selectedGame.id,
        playerStats: statsArray,
      });

      alert("Stats submitted successfully!");
    } catch (error) {
      console.error("Error submitting stats:", error);
      alert("Failed to submit stats");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render Stat Input Row ─────────────────────────────────────────────────

  const renderPlayerRow = (player: Player) => {
    const stats = playerStats.get(player.id);
    if (!stats) return null;

    return (
      <tr key={player.id} className="border-b border-white/5 hover:bg-white/5">
        {/* Player Info */}
        <td className="px-2 py-2 sticky left-0 bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="w-6 text-center text-xs text-slate-500">
              #{player.jerseyNumber}
            </span>
            <span className="text-sm text-white truncate">
              {player.lastName}
            </span>
          </div>
        </td>

        {/* Started */}
        <td className="px-1 py-2 text-center">
          <input
            type="checkbox"
            checked={stats.started}
            onChange={(e) => updateStat(player.id, "started", e.target.checked)}
            className="w-4 h-4"
          />
        </td>

        {/* Minutes */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.minutes}
            onChange={(e) =>
              updateStat(player.id, "minutes", parseInt(e.target.value) || 0)
            }
            className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* FGM */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.fieldGoalsMade}
            onChange={(e) =>
              updateStat(
                player.id,
                "fieldGoalsMade",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* FGA */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.fieldGoalsAttempted}
            onChange={(e) =>
              updateStat(
                player.id,
                "fieldGoalsAttempted",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* 3PM */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.threePtMade}
            onChange={(e) =>
              updateStat(
                player.id,
                "threePtMade",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* 3PA */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.threePtAttempted}
            onChange={(e) =>
              updateStat(
                player.id,
                "threePtAttempted",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* FTM */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.freeThrowsMade}
            onChange={(e) =>
              updateStat(
                player.id,
                "freeThrowsMade",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* FTA */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.freeThrowsAttempted}
            onChange={(e) =>
              updateStat(
                player.id,
                "freeThrowsAttempted",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* OREB */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.reboundsOff}
            onChange={(e) =>
              updateStat(
                player.id,
                "reboundsOff",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* DREB */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.reboundsDef}
            onChange={(e) =>
              updateStat(
                player.id,
                "reboundsDef",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* AST */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.assists}
            onChange={(e) =>
              updateStat(player.id, "assists", parseInt(e.target.value) || 0)
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* TO */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.turnovers}
            onChange={(e) =>
              updateStat(player.id, "turnovers", parseInt(e.target.value) || 0)
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* STL */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.steals}
            onChange={(e) =>
              updateStat(player.id, "steals", parseInt(e.target.value) || 0)
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* BLK */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.blocks}
            onChange={(e) =>
              updateStat(player.id, "blocks", parseInt(e.target.value) || 0)
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
          />
        </td>

        {/* PF */}
        <td className="px-1 py-2">
          <input
            type="number"
            value={stats.personalFouls}
            onChange={(e) =>
              updateStat(
                player.id,
                "personalFouls",
                parseInt(e.target.value) || 0
              )
            }
            className="w-10 px-1 py-1 text-center text-sm bg-slate-800 border border-white/10 rounded text-white"
            min="0"
            max="6"
          />
        </td>
      </tr>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Game Statistics
        </p>
        <h1 className="text-2xl font-semibold text-white">
          Player Stats Entry
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Enter individual player statistics for completed games
        </p>
      </div>

      {/* Game Selector */}
      <div className="flex gap-4 flex-wrap">
        {games
          .filter((g) => !g.statsSubmitted)
          .slice(0, 10)
          .map((game) => {
            const homeTeam = teams.get(game.homeTeamId);
            const awayTeam = teams.get(game.awayTeamId);

            return (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className={`p-4 rounded-xl border transition-all ${
                  selectedGame?.id === game.id
                    ? "bg-white/10 border-white/30"
                    : "bg-black/20 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="text-xs text-slate-500 mb-1">
                  {game.date?.toDate().toLocaleDateString()}
                </div>
                <div className="text-sm font-medium text-white">
                  {awayTeam?.name || "Away"} @ {homeTeam?.name || "Home"}
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {game.awayScore} - {game.homeScore}
                </div>
              </button>
            );
          })}
      </div>

      {/* Stats Entry Form */}
      {selectedGame && (
        <div className="space-y-6">
          {/* Away Team */}
          <div className="bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-slate-900/50">
              <h3 className="text-lg font-semibold text-white">
                {teams.get(selectedGame.awayTeamId)?.name || "Away Team"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase">
                    <th className="px-2 py-2 text-left sticky left-0 bg-slate-900">
                      Player
                    </th>
                    <th className="px-1 py-2 text-center">GS</th>
                    <th className="px-1 py-2 text-center">MIN</th>
                    <th className="px-1 py-2 text-center">FGM</th>
                    <th className="px-1 py-2 text-center">FGA</th>
                    <th className="px-1 py-2 text-center">3PM</th>
                    <th className="px-1 py-2 text-center">3PA</th>
                    <th className="px-1 py-2 text-center">FTM</th>
                    <th className="px-1 py-2 text-center">FTA</th>
                    <th className="px-1 py-2 text-center">OR</th>
                    <th className="px-1 py-2 text-center">DR</th>
                    <th className="px-1 py-2 text-center">AST</th>
                    <th className="px-1 py-2 text-center">TO</th>
                    <th className="px-1 py-2 text-center">STL</th>
                    <th className="px-1 py-2 text-center">BLK</th>
                    <th className="px-1 py-2 text-center">PF</th>
                  </tr>
                </thead>
                <tbody>{awayRoster.map((player) => renderPlayerRow(player))}</tbody>
              </table>
            </div>
          </div>

          {/* Home Team */}
          <div className="bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-slate-900/50">
              <h3 className="text-lg font-semibold text-white">
                {teams.get(selectedGame.homeTeamId)?.name || "Home Team"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase">
                    <th className="px-2 py-2 text-left sticky left-0 bg-slate-900">
                      Player
                    </th>
                    <th className="px-1 py-2 text-center">GS</th>
                    <th className="px-1 py-2 text-center">MIN</th>
                    <th className="px-1 py-2 text-center">FGM</th>
                    <th className="px-1 py-2 text-center">FGA</th>
                    <th className="px-1 py-2 text-center">3PM</th>
                    <th className="px-1 py-2 text-center">3PA</th>
                    <th className="px-1 py-2 text-center">FTM</th>
                    <th className="px-1 py-2 text-center">FTA</th>
                    <th className="px-1 py-2 text-center">OR</th>
                    <th className="px-1 py-2 text-center">DR</th>
                    <th className="px-1 py-2 text-center">AST</th>
                    <th className="px-1 py-2 text-center">TO</th>
                    <th className="px-1 py-2 text-center">STL</th>
                    <th className="px-1 py-2 text-center">BLK</th>
                    <th className="px-1 py-2 text-center">PF</th>
                  </tr>
                </thead>
                <tbody>{homeRoster.map((player) => renderPlayerRow(player))}</tbody>
              </table>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmitStats}
              disabled={saving}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Player Stats"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
