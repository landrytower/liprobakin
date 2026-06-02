"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { useAdmin } from "../layout";

type Category = "menPlayers" | "womenPlayers" | "menCoaches" | "womenCoaches";
type SortKey = "votes" | "pctVoters" | "pctCategory" | "pctTotal" | "today";
type SortDir = "asc" | "desc";

type Entry = {
  id: string;
  name: string;
  teamName: string;
  votes: number;
  today: number;
  pctVoters: number;
  pctCategory: number;
  pctTotal: number;
};

type Results = Record<Category, Entry[]>;

const CATEGORIES: Category[] = ["menPlayers", "womenPlayers", "menCoaches", "womenCoaches"];

const LABELS: Record<Category, { en: string; fr: string; icon: string }> = {
  menPlayers:   { en: "Men — Players",   fr: "Hommes — Joueurs",      icon: "🏀" },
  womenPlayers: { en: "Women — Players", fr: "Femmes — Joueuses",     icon: "🏀" },
  menCoaches:   { en: "Men — Coaches",   fr: "Hommes — Entraîneurs",  icon: "📋" },
  womenCoaches: { en: "Women — Coaches", fr: "Femmes — Entraîneures", icon: "📋" },
};

const tr = {
  en: {
    title: "All-Star Votes",
    subtitle: "Fan voting results — 2026 All-Star Game",
    totalVoters: "Total Voters",
    totalVotes: "Total Votes",
    menNominees: "Men Nominees",
    womenNominees: "Women Nominees",
    voterProfiles: "Voter Profiles",
    voterProfilesDesc: "registered voters",
    voterProfilesComingSoon: "Email / Phone auth — coming soon",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    lastRefreshed: "Refreshed",
    name: "Name",
    team: "Team",
    votes: "Votes",
    pctVoters: "% of Voters",
    pctCategory: "% of Category",
    pctTotal: "Share of Total",
    today: "Today",
    trend: "Trend",
    noVotes: "No votes yet in this category.",
    loading: "Loading vote data…",
    justNow: "just now",
    minAgo: "min ago",
  },
  fr: {
    title: "Votes All-Star",
    subtitle: "Résultats du vote des fans — Match All-Star 2026",
    totalVoters: "Votants",
    totalVotes: "Votes exprimés",
    menNominees: "Nominees Hommes",
    womenNominees: "Nominees Femmes",
    voterProfiles: "Profils Votants",
    voterProfilesDesc: "votants enregistrés",
    voterProfilesComingSoon: "Auth Email / Téléphone — bientôt",
    refresh: "Actualiser",
    refreshing: "Actualisation…",
    lastRefreshed: "Actualisé",
    name: "Nom",
    team: "Équipe",
    votes: "Votes",
    pctVoters: "% Votants",
    pctCategory: "% Catégorie",
    pctTotal: "Part totale",
    today: "Auj.",
    trend: "Tendance",
    noVotes: "Aucun vote dans cette catégorie.",
    loading: "Chargement des votes…",
    justNow: "à l'instant",
    minAgo: "min",
  },
};

function PctBar({ pct, color }: { pct: number; color: "gold" | "blue" | "green" | "gray" }) {
  const gradients = {
    gold:  "bg-gradient-to-r from-yellow-500 to-amber-400",
    blue:  "bg-gradient-to-r from-blue-500 to-blue-400",
    green: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    gray:  "bg-slate-600",
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${gradients[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${color === "gold" ? "text-yellow-400" : color === "blue" ? "text-blue-400" : color === "green" ? "text-emerald-400" : "text-slate-400"}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-3 text-[10px] uppercase tracking-wider font-semibold cursor-pointer select-none whitespace-nowrap transition-colors ${active ? "text-orange-400" : "text-slate-500 hover:text-slate-300"} text-${align}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 opacity-70">{active ? (dir === "desc" ? "↓" : "↑") : "↕"}</span>
    </th>
  );
}

export default function AllStarVotesPage() {
  const { language } = useAdmin();
  const t = tr[language as "en" | "fr"] ?? tr.en;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Category>("menPlayers");
  const [totalVoters, setTotalVoters] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("votes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [results, setResults] = useState<Results>({
    menPlayers: [], womenPlayers: [], menCoaches: [], womenCoaches: [],
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const now = Date.now();
    const ONE_DAY = 86_400_000;

    // 1. Aggregate all votes
    const votesSnap = await getDocs(collection(firebaseDB, "allStarVotes"));
    const voterCount = votesSnap.size;
    setTotalVoters(voterCount);

    const counts: Record<Category, Record<string, number>> = {
      menPlayers: {}, womenPlayers: {}, menCoaches: {}, womenCoaches: {},
    };
    const todayCounts: Record<Category, Record<string, number>> = {
      menPlayers: {}, womenPlayers: {}, menCoaches: {}, womenCoaches: {},
    };
    let totalCast = 0;

    for (const d of votesSnap.docs) {
      const data = d.data();
      const lastMod = (data.lastModified as Timestamp | undefined)?.toDate?.()?.getTime() ?? 0;
      const isToday = now - lastMod < ONE_DAY;

      for (const cat of CATEGORIES) {
        const ids: string[] = data[cat] || [];
        totalCast += ids.length;
        for (const id of ids) {
          counts[cat][id] = (counts[cat][id] || 0) + 1;
          if (isToday) todayCounts[cat][id] = (todayCounts[cat][id] || 0) + 1;
        }
      }
    }
    setTotalVotes(totalCast);

    // Category totals for % of category
    const catTotals: Record<Category, number> = {
      menPlayers:   Object.values(counts.menPlayers).reduce((a, b) => a + b, 0),
      womenPlayers: Object.values(counts.womenPlayers).reduce((a, b) => a + b, 0),
      menCoaches:   Object.values(counts.menCoaches).reduce((a, b) => a + b, 0),
      womenCoaches: Object.values(counts.womenCoaches).reduce((a, b) => a + b, 0),
    };

    // 2. Build name/team lookup from rosters
    const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
    const playerMap: Record<string, { name: string; teamName: string }> = {};
    const coachMap:  Record<string, { name: string; teamName: string }> = {};

    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const td = teamDoc.data();
        const teamName = [td.city, td.name].filter(Boolean).join(" ");
        const [rosterSnap, coachSnap] = await Promise.all([
          getDocs(collection(firebaseDB, "teams", teamDoc.id, "roster")),
          getDocs(collection(firebaseDB, "teams", teamDoc.id, "coachStaff")),
        ]);
        for (const p of rosterSnap.docs) {
          const pd = p.data();
          playerMap[p.id] = {
            name: `${pd.firstName || ""} ${pd.lastName || ""}`.trim() || pd.name || p.id,
            teamName,
          };
        }
        for (const c of coachSnap.docs) {
          const cd = c.data();
          coachMap[c.id] = {
            name: `${cd.firstName || ""} ${cd.lastName || ""}`.trim() || c.id,
            teamName,
          };
        }
      })
    );

    // 3. Resolve entries with all computed stats
    const resolve = (
      countMap: Record<string, number>,
      todayMap: Record<string, number>,
      lookup: Record<string, { name: string; teamName: string }>,
      catTotal: number,
    ): Entry[] =>
      Object.entries(countMap)
        .map(([id, votes]) => ({
          id,
          name: lookup[id]?.name ?? id,
          teamName: lookup[id]?.teamName ?? "—",
          votes,
          today: todayMap[id] ?? 0,
          pctVoters:   voterCount > 0  ? parseFloat(((votes / voterCount)  * 100).toFixed(1)) : 0,
          pctCategory: catTotal > 0    ? parseFloat(((votes / catTotal)    * 100).toFixed(1)) : 0,
          pctTotal:    totalCast > 0   ? parseFloat(((votes / totalCast)   * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.votes - a.votes);

    setResults({
      menPlayers:   resolve(counts.menPlayers,   todayCounts.menPlayers,   playerMap, catTotals.menPlayers),
      womenPlayers: resolve(counts.womenPlayers,  todayCounts.womenPlayers, playerMap, catTotals.womenPlayers),
      menCoaches:   resolve(counts.menCoaches,    todayCounts.menCoaches,   coachMap,  catTotals.menCoaches),
      womenCoaches: resolve(counts.womenCoaches,  todayCounts.womenCoaches, coachMap,  catTotals.womenCoaches),
    });

    setLastRefreshed(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Rows sorted by votes first (determines rank badge), then re-sorted by user choice for display
  const rankedRows = results[tab];
  const displayRows = [...rankedRows].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return mul * (a[sortKey] - b[sortKey]);
  });
  const voteRankOf = (id: string) => rankedRows.findIndex((r) => r.id === id) + 1;

  const lastRefreshedLabel = (() => {
    if (!lastRefreshed) return null;
    const mins = Math.floor((Date.now() - lastRefreshed.getTime()) / 60_000);
    if (mins < 1) return t.justNow;
    return `${mins} ${t.minAgo}`;
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            ⭐ {t.title}
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {lastRefreshedLabel && (
            <span className="text-xs text-slate-500">
              {t.lastRefreshed} {lastRefreshedLabel}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? t.refreshing : t.refresh}
          </button>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.totalVoters}</p>
          <p className="text-3xl font-black text-orange-400 mt-1">{loading ? "—" : totalVoters.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.totalVotes}</p>
          <p className="text-3xl font-black text-blue-400 mt-1">{loading ? "—" : totalVotes.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.menNominees}</p>
          <p className="text-3xl font-black text-emerald-400 mt-1">{loading ? "—" : results.menPlayers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">{language === "fr" ? "candidats" : "nominees"}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.womenNominees}</p>
          <p className="text-3xl font-black text-purple-400 mt-1">{loading ? "—" : results.womenPlayers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">{language === "fr" ? "candidates" : "nominees"}</p>
        </div>
      </div>

      {/* ── Voter profiles strip ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-800/40 border border-white/5 rounded-xl text-sm">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold shrink-0">
          {t.voterProfiles}
        </span>
        <span className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-3 py-1 text-xs text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {loading ? "—" : totalVoters.toLocaleString()} {t.voterProfilesDesc}
        </span>
        <span className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-3 py-1 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
          {t.voterProfilesComingSoon}
        </span>
        <span className="ml-auto text-xs text-slate-600 hidden sm:block">→ {language === "fr" ? "Analytique de profil" : "Profile analytics"}</span>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setTab(cat)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === cat
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/5"
            }`}
          >
            <span>{LABELS[cat].icon}</span>
            {LABELS[cat][language as "en" | "fr"] ?? LABELS[cat].en}
            {!loading && results[cat].length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === cat ? "bg-white/20" : "bg-white/10"}`}>
                {results[cat].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Analytical sortable table ── */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t.loading}
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <span className="text-4xl">🗳️</span>
            <p className="text-sm">{t.noVotes}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-800/80 border-b border-white/5">
                <tr>
                  <th className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-left w-10">#</th>
                  <th className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-left">{t.name}</th>
                  <th className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-left hidden sm:table-cell">{t.team}</th>
                  <SortHeader label={t.votes}      sortKey="votes"       active={sortKey === "votes"}       dir={sortDir} onSort={toggleSort} />
                  <SortHeader label={t.pctVoters}  sortKey="pctVoters"   active={sortKey === "pctVoters"}   dir={sortDir} onSort={toggleSort} />
                  <SortHeader label={t.pctCategory} sortKey="pctCategory" active={sortKey === "pctCategory"} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label={t.pctTotal}   sortKey="pctTotal"    active={sortKey === "pctTotal"}    dir={sortDir} onSort={toggleSort} />
                  <SortHeader label={t.today}      sortKey="today"       active={sortKey === "today"}       dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 text-right">{t.trend}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((entry) => {
                  const rank = voteRankOf(entry.id);
                  const isTop3 = rank <= 3;
                  const rankBadge =
                    rank === 1 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black" :
                    rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-black" :
                    rank === 3 ? "bg-gradient-to-br from-orange-600 to-orange-800 text-white" :
                    "bg-slate-800 text-slate-500";
                  const barColor: "gold" | "blue" | "green" | "gray" =
                    rank === 1 ? "gold" : rank === 2 ? "blue" : rank === 3 ? "green" : "gray";
                  const todayColor =
                    entry.today > 0 ? "text-emerald-400" :
                    entry.today < 0 ? "text-red-400" : "text-slate-500";
                  const trendIcon =
                    entry.today >= 5 ? "↑↑" :
                    entry.today > 0  ? "↑"  :
                    entry.today < 0  ? "↓"  : "—";
                  const trendColor =
                    entry.today >= 5 ? "text-emerald-400 font-black" :
                    entry.today > 0  ? "text-emerald-500" :
                    entry.today < 0  ? "text-red-400" : "text-slate-600";

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-black ${rankBadge}`}>
                          {rank}
                        </span>
                      </td>
                      {/* Name */}
                      <td className="px-3 py-3.5">
                        <span className={`font-semibold ${isTop3 ? "text-white" : "text-slate-300"}`}>
                          {entry.name}
                        </span>
                      </td>
                      {/* Team */}
                      <td className="px-3 py-3.5 text-slate-500 text-xs hidden sm:table-cell">
                        {entry.teamName}
                      </td>
                      {/* Votes */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={`font-black text-base tabular-nums ${isTop3 ? "text-orange-400" : "text-slate-300"}`}>
                          {entry.votes}
                        </span>
                      </td>
                      {/* % of Voters */}
                      <td className="px-3 py-3.5">
                        <PctBar pct={entry.pctVoters} color={barColor} />
                      </td>
                      {/* % of Category */}
                      <td className="px-3 py-3.5">
                        <PctBar pct={entry.pctCategory} color={barColor} />
                      </td>
                      {/* Share of Total */}
                      <td className="px-3 py-3.5 text-right">
                        <span className="text-xs font-semibold text-slate-400 tabular-nums">
                          {entry.pctTotal.toFixed(1)}%
                        </span>
                      </td>
                      {/* Today delta */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={`text-sm font-bold tabular-nums ${todayColor}`}>
                          {entry.today > 0 ? `+${entry.today}` : entry.today === 0 ? "—" : entry.today}
                        </span>
                      </td>
                      {/* Trend */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={`text-sm ${trendColor}`}>{trendIcon}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
