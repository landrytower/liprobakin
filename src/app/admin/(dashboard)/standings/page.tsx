"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// STANDINGS PAGE - SEASON-BASED TEAM RANKINGS
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { firebaseDB } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
}

interface StandingsEntry {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  teamLogo?: string;
  wins: number;
  losses: number;
  winPct: number;
  pointsScored: number;
  pointsAllowed: number;
  pointDiff: number;
  gamesPlayed: number;
  streak?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StandingsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [loading, setLoading] = useState(true);

  // ─── Load Seasons ──────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(firebaseDB, "seasons"),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        isActive: doc.data().isActive,
      })) as Season[];

      setSeasons(data);

      // Auto-select active season
      const activeSeason = data.find((s) => s.isActive);
      if (activeSeason && !selectedSeasonId) {
        setSelectedSeasonId(activeSeason.id);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load Teams ────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firebaseDB, "teams"), (snapshot) => {
      const teamsMap = new Map<string, Team>();
      snapshot.docs.forEach((doc) => {
        teamsMap.set(doc.id, {
          id: doc.id,
          ...doc.data(),
        } as Team);
      });
      setTeams(teamsMap);
    });

    return () => unsubscribe();
  }, []);

  // ─── Load Standings for Selected Season ────────────────────────────────────

  useEffect(() => {
    if (!selectedSeasonId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(firebaseDB, "seasonTeamStats"),
      where("seasonId", "==", selectedSeasonId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const standingsData: StandingsEntry[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const team = teams.get(data.teamId);
        const wins = data.wins || 0;
        const losses = data.losses || 0;
        const gp = wins + losses;

        return {
          teamId: data.teamId,
          teamName: team?.name || "Unknown",
          teamAbbreviation: team?.abbreviation || "",
          teamLogo: team?.logo,
          wins,
          losses,
          winPct: gp > 0 ? wins / gp : 0,
          pointsScored: data.totalPointsScored || 0,
          pointsAllowed: data.totalPointsAllowed || 0,
          pointDiff: (data.totalPointsScored || 0) - (data.totalPointsAllowed || 0),
          gamesPlayed: gp,
        };
      });

      // Sort by win percentage, then point differential
      standingsData.sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.pointDiff - a.pointDiff;
      });

      setStandings(standingsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedSeasonId, teams]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            League Statistics
          </p>
          <h1 className="text-2xl font-semibold text-white">Standings</h1>
        </div>

        {/* Season Selector */}
        <select
          value={selectedSeasonId}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
          className="px-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white"
        >
          <option value="">Select Season</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name} {season.isActive ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Standings Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
        </div>
      ) : standings.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
          {selectedSeasonId
            ? "No standings data for this season"
            : "Select a season to view standings"}
        </div>
      ) : (
        <div className="bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  W
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  L
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  PCT
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  PF
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  PA
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  DIFF
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, index) => (
                <tr
                  key={entry.teamId}
                  className="border-b border-white/5 hover:bg-white/5 transition"
                >
                  {/* Rank */}
                  <td className="px-4 py-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-500/20 text-yellow-400"
                          : index === 1
                          ? "bg-slate-400/20 text-slate-300"
                          : index === 2
                          ? "bg-amber-700/20 text-amber-600"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>

                  {/* Team */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-lg bg-slate-800/70 overflow-hidden">
                        {entry.teamLogo ? (
                          <Image
                            src={entry.teamLogo}
                            alt={entry.teamName}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">
                            🏀
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {entry.teamName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.teamAbbreviation}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* W */}
                  <td className="px-4 py-3 text-center font-semibold text-green-400">
                    {entry.wins}
                  </td>

                  {/* L */}
                  <td className="px-4 py-3 text-center font-semibold text-red-400">
                    {entry.losses}
                  </td>

                  {/* PCT */}
                  <td className="px-4 py-3 text-center text-white">
                    {entry.winPct.toFixed(3).slice(1)}
                  </td>

                  {/* PF (Points For) */}
                  <td className="px-4 py-3 text-center text-slate-300">
                    {entry.pointsScored}
                  </td>

                  {/* PA (Points Against) */}
                  <td className="px-4 py-3 text-center text-slate-300">
                    {entry.pointsAllowed}
                  </td>

                  {/* Diff */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        entry.pointDiff > 0
                          ? "text-green-400"
                          : entry.pointDiff < 0
                          ? "text-red-400"
                          : "text-slate-400"
                      }
                    >
                      {entry.pointDiff > 0 ? "+" : ""}
                      {entry.pointDiff}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
