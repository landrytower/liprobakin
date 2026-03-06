"use client";
"use no memo";

import React, { useEffect, useState, useMemo, useCallback, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import Image from "next/image";
import { firebaseDB } from "@/lib/firebase";
import { parseCongoDateTime } from "@/lib/congo-time";
import {
  collection,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { useAdmin } from "../layout";
import "./pulse.css";

/* ─────────────────── ERROR BOUNDARY ─────────────────── */

interface EBState { hasError: boolean; error: Error | null }

class PulseErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LeaguePulse] render error:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-12">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 text-lg font-bold mb-2">Dashboard Error</p>
            <p className="text-sm text-slate-400 mb-4">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <pre className="text-xs text-slate-500 text-left overflow-auto max-h-48 bg-slate-900 rounded-lg p-4">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────── TYPES ─────────────────────── */

interface DashTeam {
  id: string;
  name: string;
  city?: string;
  gender?: string;
  colors?: string[];
  logo?: string;
  wins: number;
  losses: number;
  totalPoints?: number;
}

interface GamePlayerStat {
  playerId?: string;
  playerName?: string;
  firstName?: string;
  lastName?: string;
  number?: number;
  headshot?: string;
  teamId?: string;
  pts?: number;
  ast?: number;
  reb?: number;
  oreb?: number;
  dreb?: number;
  stl?: number;
  blk?: number;
  min?: number;
  pf?: number;
  to?: number;
  two_pm?: number;
  two_pa?: number;
  three_pm?: number;
  three_pa?: number;
  ft_m?: number;
  ft_a?: number;
}

interface DashGame {
  id: string;
  gender?: string;
  week?: number;
  homeTeamId?: string;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  date?: string;
  time?: string;
  venue?: string;
  completed?: boolean;
  winnerTeamId?: string;
  winnerScore?: number;
  loserTeamId?: string;
  loserScore?: number;
  playerStats?: GamePlayerStat[];
}

interface DashPlayer {
  id: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  teamColors?: string[];
  firstName?: string;
  lastName?: string;
  number?: number;
  position?: string;
  headshot?: string;
  gamesPlayed?: number;
  stats?: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    min?: number;
    to?: number;
  };
}

interface HotPlayer {
  id: string;
  name: string;
  headshot?: string;
  teamName: string;
  teamLogo?: string;
  teamColors?: string[];
  pts: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
  heatIndex: number;
  gameDate?: string;
}

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

type ModalState =
  | { type: "team"; id: string }
  | { type: "player"; id: string }
  | { type: "game"; id: string }
  | null;

/* ──────────────────── ANIMATED COUNTER ──────────────────── */

function AnimatedCounter({
  value,
  duration = 1800,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(() => 0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const prevValue = useRef(value);

  useEffect(() => {
    prevValue.current = value;
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(eased * prevValue.current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {decimals > 0 ? Number(display).toFixed(decimals) : Math.round(Number(display))}
      {suffix}
    </span>
  );
}

/* ──────────────────── DONUT CHART (SVG) ──────────────────── */

function DonutChart({
  data,
  size = 220,
  strokeWidth = 32,
  centerLabel,
  centerValue,
}: {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(id);
  }, []);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  // Pre-compute offsets purely (no mutable accumulators)
  const segments = useMemo(() => {
    const lengths = data.map((slice) => (slice.value / total) * circumference);
    return lengths.map((segLen, i) => ({
      segLen,
      offset: lengths.slice(0, i).reduce((s, l) => s + l, 0),
    }));
  }, [data, total, circumference]);

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      {data.map((slice, i) => {
        const seg = segments[i];
        if (!seg) return null;
        const { segLen, offset } = seg;
        return (
          <circle
            key={i}
            r={r}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${mounted ? segLen : 0} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: "stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)",
              filter: `drop-shadow(0 0 6px ${slice.color}50)`,
            }}
          />
        );
      })}
      {centerLabel && (
        <>
          <text
            x={size / 2}
            y={size / 2 - 8}
            textAnchor="middle"
            fill="white"
            fontSize="28"
            fontWeight="bold"
            className="select-none"
          >
            {centerValue}
          </text>
          <text
            x={size / 2}
            y={size / 2 + 16}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="11"
            className="uppercase tracking-widest select-none"
          >
            {centerLabel}
          </text>
        </>
      )}
    </svg>
  );
}

/* ────────────────────── FIRE PARTICLES ─────────────────── */

function FireParticles({ count = 18 }: { count?: number }) {
  // Use a seeded deterministic pattern instead of Math.random during render
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      // Simple hash-based pseudo-random using index
      const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      const r1 = s - Math.floor(s);
      const s2 = Math.sin(i * 269.5 + 183.3) * 43758.5453;
      const r2 = s2 - Math.floor(s2);
      const s3 = Math.sin(i * 419.2 + 571.1) * 43758.5453;
      const r3 = s3 - Math.floor(s3);
      const s4 = Math.sin(i * 631.7 + 97.3) * 43758.5453;
      const r4 = s4 - Math.floor(s4);
      const s5 = Math.sin(i * 853.1 + 427.9) * 43758.5453;
      const r5 = s5 - Math.floor(s5);
      return {
        id: i,
        left: r1 * 100,
        delay: r2 * 3,
        duration: 1.5 + r3 * 2,
        size: 3 + r4 * 6,
        hue: 20 + r5 * 30,
      };
    })
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pulse-fire-particle"
          style={{
            left: `${p.left}%`,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            background: `hsl(${p.hue}, 100%, 55%)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            boxShadow: `0 0 ${p.size * 2}px hsl(${p.hue}, 100%, 55%)`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────── SKELETON LOADER ─────────────────── */

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-slate-800/50 rounded-2xl animate-pulse ${className}`}
    >
      <div className="p-6 space-y-4">
        <div className="h-4 bg-slate-700 rounded w-1/3" />
        <div className="h-8 bg-slate-700 rounded w-2/3" />
        <div className="h-4 bg-slate-700 rounded w-1/2" />
      </div>
    </div>
  );
}

/* ─────────────────── MINI SPARKLINE ─────────────────── */

function MiniSparkline({
  data,
  color = "#f97316",
  width = 80,
  height = 28,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const divisor = data.length > 1 ? data.length - 1 : 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / divisor) * width},${height - ((v - min) / range) * height}`
    )
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block ml-2 opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD PAGE
   ═══════════════════════════════════════════════════════ */

export default function LeaguePulseDashboardPage() {
  return (
    <PulseErrorBoundary>
      <LeaguePulseDashboard />
    </PulseErrorBoundary>
  );
}

function LeaguePulseDashboard() {
  const { language } = useAdmin();
  const t = language === "fr" ? FR : EN;

  /* ── state ── */
  const [teams, setTeams] = useState<DashTeam[]>([]);
  const [games, setGames] = useState<DashGame[]>([]);
  const [allPlayers, setAllPlayers] = useState<DashPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"all" | "men" | "women">("all");
  const [now] = useState(() => new Date());
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  /* ── real-time data ── */
  useEffect(() => {
    let rosterLoaded = false;
    const unsubTeams = onSnapshot(collection(firebaseDB, "teams"), async (snap) => {
      const t: DashTeam[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? "",
          city: data.city,
          gender: data.gender,
          colors: data.colors,
          logo: data.logo,
          wins: data.wins ?? 0,
          losses: data.losses ?? 0,
          totalPoints: data.totalPoints,
        };
      });
      setTeams(t);

      // Load all rosters once
      if (!rosterLoaded) {
        rosterLoaded = true;
        try {
          const all: DashPlayer[] = [];
          await Promise.all(
            t.map(async (team) => {
              const rosterSnap = await getDocs(
                collection(firebaseDB, "teams", team.id, "roster")
              );
              rosterSnap.docs.forEach((pd) => {
                const d = pd.data();
                all.push({
                  id: pd.id,
                  teamId: team.id,
                  teamName: team.name,
                  teamLogo: team.logo,
                  teamColors: team.colors,
                  firstName: d.firstName,
                  lastName: d.lastName,
                  number: d.number,
                  position: d.position,
                  headshot: d.headshot,
                  gamesPlayed: d.gamesPlayed ?? 0,
                  stats: d.stats ?? {},
                });
              });
            })
          );
          setAllPlayers(all);
        } catch (e) {
          console.error("roster load error", e);
        }
      }
    });

    const unsubGames = onSnapshot(collection(firebaseDB, "games"), (snap) => {
      setGames(
        snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data } as DashGame;
        })
      );
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubGames();
    };
  }, []);

  /* ── filtered data ── */
  const filteredTeams = useMemo(
    () =>
      genderFilter === "all"
        ? teams
        : teams.filter((t) => t.gender === genderFilter),
    [teams, genderFilter]
  );

  const filteredGames = useMemo(
    () =>
      genderFilter === "all"
        ? games
        : games.filter((g) => g.gender === genderFilter),
    [games, genderFilter]
  );

  const filteredPlayers = useMemo(
    () =>
      genderFilter === "all"
        ? allPlayers
        : allPlayers.filter((p) => {
            const team = teams.find((t) => t.id === p.teamId);
            return team?.gender === genderFilter;
          }),
    [allPlayers, teams, genderFilter]
  );

  /* ── derived metrics ── */
  const completedGames = useMemo(
    () =>
      filteredGames
        .filter((g) => g.completed)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [filteredGames]
  );

  const upcomingGames = useMemo(
    () =>
      filteredGames
        .filter((g) => !g.completed)
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [filteredGames]
  );

  const totalPlayers = filteredPlayers.length;
  const totalTeams = filteredTeams.length;
  const totalGamesPlayed = completedGames.length;

  const avgPPG = useMemo(() => {
    if (!completedGames.length) return 0;
    const totalPts = completedGames.reduce(
      (sum, g) => sum + (g.winnerScore ?? 0) + (g.loserScore ?? 0),
      0
    );
    // Divide by (number of games * 2 for both teams)
    return totalPts / (completedGames.length * 2);
  }, [completedGames]);

  /* ── standings ── */
  const standings = useMemo(() => {
    return [...filteredTeams]
      .filter((t) => t.wins + t.losses > 0)
      .sort((a, b) => {
        const aWp = a.wins / (a.wins + a.losses);
        const bWp = b.wins / (b.wins + b.losses);
        return bWp - aWp || b.wins - a.wins;
      })
      .slice(0, 10);
  }, [filteredTeams]);


  /* ── donut chart data ── */
  const donutData: DonutSlice[] = useMemo(() => {
    const PALETTE = [
      "#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899",
      "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#06b6d4",
    ];
    return standings.slice(0, 8).map((t, i) => ({
      label: t.name,
      value: t.wins,
      color: t.colors?.[0] || PALETTE[i % PALETTE.length],
    }));
  }, [standings]);

  const totalWins = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData]
  );

  /* ── top scorers ── */
  const topScorers = useMemo(() => {
    return [...filteredPlayers]
      .filter((p) => (p.gamesPlayed ?? 0) > 0 && (p.stats?.pts ?? 0) > 0)
      .sort((a, b) => (b.stats?.pts ?? 0) - (a.stats?.pts ?? 0))
      .slice(0, 8);
  }, [filteredPlayers]);

  const maxPPGScorer = useMemo(
    () => Math.max(...topScorers.map((p) => p.stats?.pts ?? 0), 1),
    [topScorers]
  );

  /* ── who's on fire ── */
  const hotPlayers: HotPlayer[] = useMemo(() => {
    // Collect high individual game performances from recent completed games
    const recentGames = completedGames.slice(0, 15);
    const performances: HotPlayer[] = [];

    recentGames.forEach((game) => {
      (game.playerStats ?? []).forEach((ps) => {
        const pts = ps.pts ?? 0;
        const ast = ps.ast ?? 0;
        const reb = ps.reb ?? 0;
        const stl = ps.stl ?? 0;
        const blk = ps.blk ?? 0;
        const to = ps.to ?? 0;
        const heatIndex =
          pts * 1.0 + ast * 1.5 + reb * 1.2 + stl * 2.0 + blk * 2.0 - to * 1.0;

        if (pts >= 5) {
          const team = teams.find((t) => t.id === ps.teamId);
          performances.push({
            id: ps.playerId ?? `${ps.playerName}-${game.id}`,
            name:
              ps.firstName && ps.lastName
                ? `${ps.firstName} ${ps.lastName}`
                : ps.playerName ?? "Unknown",
            headshot: ps.headshot,
            teamName:
              team?.name ??
              (game.homeTeamId === ps.teamId
                ? game.homeTeamName ?? ""
                : game.awayTeamName ?? ""),
            teamLogo:
              team?.logo ??
              (game.homeTeamId === ps.teamId
                ? game.homeTeamLogo
                : game.awayTeamLogo),
            teamColors: team?.colors,
            pts,
            ast,
            reb,
            stl,
            blk,
            heatIndex,
            gameDate: game.date,
          });
        }
      });
    });

    // Dedupe by player - keep best performance
    const bestByPlayer = new Map<string, HotPlayer>();
    performances.forEach((p) => {
      const existing = bestByPlayer.get(p.id);
      if (!existing || p.heatIndex > existing.heatIndex) {
        bestByPlayer.set(p.id, p);
      }
    });

    return [...bestByPlayer.values()]
      .sort((a, b) => b.heatIndex - a.heatIndex)
      .slice(0, 5);
  }, [completedGames, teams]);

  /* ── recent win sparklines per team ── */
  const teamSparklines = useMemo(() => {
    const raw: Record<string, number[]> = {};
    completedGames.slice(0, 30).forEach((g) => {
      if (g.winnerTeamId) {
        [g.homeTeamId, g.awayTeamId].forEach((tid) => {
          if (tid) {
            if (!raw[tid]) raw[tid] = [];
            raw[tid].push(tid === g.winnerTeamId ? 1 : 0);
          }
        });
      }
    });
    // Make cumulative wins (immutable scan)
    const result: Record<string, number[]> = {};
    Object.keys(raw).forEach((tid) => {
      const reversed = [...raw[tid]].reverse();
      const cumulative: number[] = [];
      reversed.forEach((v, idx) => {
        cumulative.push((idx > 0 ? cumulative[idx - 1] : 0) + v);
      });
      result[tid] = cumulative;
    });
    return result;
  }, [completedGames]);

  /* ── league health metrics ── */
  const leagueHealth = useMemo(() => {
    if (!completedGames.length)
      return {
        avgMargin: 0,
        highestScore: 0,
        total3PM: 0,
        competitiveIndex: 0,
        closeGames: 0,
      };

    // Use reduce to avoid mutable let accumulators
    const acc = completedGames.reduce(
      (a, g) => {
        const margin = Math.abs((g.winnerScore ?? 0) - (g.loserScore ?? 0));
        const three = (g.playerStats ?? []).reduce((s, ps) => s + (ps.three_pm ?? 0), 0);
        return {
          totalMargin: a.totalMargin + margin,
          closeGames: a.closeGames + (margin <= 5 ? 1 : 0),
          highestScore: Math.max(a.highestScore, g.winnerScore ?? 0),
          total3PM: a.total3PM + three,
        };
      },
      { totalMargin: 0, closeGames: 0, highestScore: 0, total3PM: 0 }
    );

    const avgMargin = acc.totalMargin / completedGames.length;
    const competitiveIndex = Math.min(
      100,
      Math.round(
        ((acc.closeGames / completedGames.length) * 50 +
          (1 / (avgMargin / 10 + 1)) * 50) *
          1
      )
    );

    return { avgMargin, highestScore: acc.highestScore, total3PM: acc.total3PM, competitiveIndex, closeGames: acc.closeGames };
  }, [completedGames]);

  /* ── countdown to next game ── */
  const nextGameCountdown = useMemo(() => {
    if (!upcomingGames.length) return null;
    const next = upcomingGames[0];
    if (!next.date) return null;
    const gameDate = parseCongoDateTime(next.date, next.time || "00:00") || new Date(`${next.date}T${next.time || "00:00"}`);
    const diff = gameDate.getTime() - now.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    return { days, hours, mins, game: next };
  }, [upcomingGames, now]);

  /* ── crm insights ── */
  const crmInsights = useMemo(() => {
    let missingHeadshots = 0;
    filteredPlayers.forEach((p) => {
      if (!p.headshot || p.headshot.includes("default")) missingHeadshots++;
    });

    const shortRosters = filteredTeams.filter((t) => {
      const rosterCount = filteredPlayers.filter((p) => p.teamId === t.id).length;
      return rosterCount > 0 && rosterCount < 5; // Has some players but less than 5
    }).length;

    const inactiveTeams = filteredTeams.filter((t) => {
      const hasGames = filteredGames.some((g) => g.homeTeamId === t.id || g.awayTeamId === t.id);
      return !hasGames;
    }).length;

    const noStatsGames = completedGames.filter((g) => !g.playerStats || g.playerStats.length === 0).length;

    return { missingHeadshots, shortRosters, inactiveTeams, noStatsGames };
  }, [filteredPlayers, filteredTeams, filteredGames, completedGames]);

  /* ── helpers ── */
  const teamLogo = useCallback(
    (logo?: string) => {
      if (!logo) return "/logos/default.png";
      if (logo.startsWith("http") || logo.startsWith("/")) return logo;
      return `/${logo}`;
    },
    []
  );

  /* ═══════════════════════ RENDER ═══════════════════════ */

  if (loading) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="h-12 bg-slate-800 rounded-xl animate-pulse w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="h-36" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-80" />
        </div>
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ═══════ HEADER ═══════ */}
        <div
          className="card-entrance flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ animationDelay: "0ms" }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-4xl">⚡</span>
              <span
                className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full live-pulse-dot"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                <span className="shimmer-text">{t.title}</span>
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Gender filter pills */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 border border-white/5">
            {(["all", "men", "women"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-all duration-300 ${
                  genderFilter === g
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {g === "all" ? t.all : g === "men" ? t.men : t.women}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ KEY METRICS ROW ═══════ */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              icon: "🏀",
              label: t.totalTeams,
              value: totalTeams,
              accent: "from-orange-500 to-amber-500",
              glow: "rgba(249,115,22,0.15)",
            },
            {
              icon: "👤",
              label: t.totalPlayers,
              value: totalPlayers,
              accent: "from-blue-500 to-cyan-400",
              glow: "rgba(59,130,246,0.15)",
            },
            {
              icon: "🏟️",
              label: t.gamesPlayed,
              value: totalGamesPlayed,
              accent: "from-emerald-500 to-teal-400",
              glow: "rgba(16,185,129,0.15)",
            },
            {
              icon: "📊",
              label: t.avgPPG,
              value: avgPPG,
              decimals: 1,
              accent: "from-purple-500 to-pink-500",
              glow: "rgba(168,85,247,0.15)",
            },
          ].map((m, i) => (
            <div
              key={i}
              className="card-entrance relative group"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              {/* Gradient border wrapper */}
              <div className="gradient-border rounded-2xl p-[1px]">
                <div
                  className="bg-slate-900 rounded-2xl p-5 relative overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{
                    boxShadow: `0 0 30px ${m.glow}`,
                  }}
                >
                  {/* Background gradient orb */}
                  <div
                    className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${m.accent} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                        {t.live}
                      </span>
                    </div>
                    <div className="text-3xl font-black text-white">
                      <AnimatedCounter
                        value={m.value}
                        decimals={m.decimals ?? 0}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      {m.label}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════ MAIN GRID: STANDINGS + DONUT ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Conference Standings ── */}
          <div
            className="card-entrance lg:col-span-3 bg-slate-900/80 border border-white/5 rounded-2xl p-6 glow-card"
            style={{ animationDelay: "400ms" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="text-orange-400">🏆</span> {t.standings}
              </h2>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                {t.topTeams}
              </span>
            </div>

            {standings.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                {t.noData}
              </p>
            ) : (
              <div className="space-y-3">
                {standings.map((team, i) => {
                  const wp =
                    team.wins + team.losses > 0
                      ? (team.wins / (team.wins + team.losses)) * 100
                      : 0;
                  const barColor = team.colors?.[0] || "#f97316";
                  return (
                    <div
                      key={team.id}
                      onClick={() => setActiveModal({ type: "team", id: team.id })}
                      className="card-entrance group flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      style={{ animationDelay: `${500 + i * 60}ms` }}
                    >
                      {/* Rank */}
                      <span className="text-xs font-bold text-slate-500 w-5 text-right">
                        {i + 1}
                      </span>

                      {/* Logo */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
                        {team.logo ? (
                          <Image
                            src={teamLogo(team.logo)}
                            alt={team.name}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-xs">
                            🏀
                          </span>
                        )}
                      </div>

                      {/* Name & record */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold truncate group-hover:text-orange-400 transition-colors">
                            {team.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {team.wins}W - {team.losses}L
                            </span>
                            <MiniSparkline
                              data={teamSparklines[team.id] ?? []}
                              color={barColor}
                            />
                          </div>
                        </div>

                        {/* Win % bar */}
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: `${wp}%`,
                              background: `linear-gradient(90deg, ${barColor}, ${team.colors?.[1] || barColor}99)`,
                              boxShadow: `0 0 8px ${barColor}40`,
                              animation: "heat-bar 1.2s ease-out",
                              animationDelay: `${600 + i * 60}ms`,
                              animationFillMode: "both",
                            }}
                          />
                        </div>
                      </div>

                      {/* Win % */}
                      <span className="text-xs font-bold text-slate-300 w-12 text-right">
                        {Number(wp).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Win Distribution Donut ── */}
          <div
            className="card-entrance lg:col-span-2 bg-slate-900/80 border border-white/5 rounded-2xl p-6 flex flex-col items-center glow-card"
            style={{ animationDelay: "450ms" }}
          >
            <h2 className="text-lg font-bold mb-4 self-start flex items-center gap-2">
              <span className="text-orange-400">📊</span> {t.winDistribution}
            </h2>

            <DonutChart
              data={donutData}
              centerLabel={t.totalWins}
              centerValue={String(totalWins)}
              size={200}
              strokeWidth={28}
            />

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: d.color }}
                  />
                  <span className="text-slate-400 truncate">{d.label}</span>
                  <span className="text-white font-bold ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════ 🔥 WHO'S ON FIRE ═══════ */}
        {hotPlayers.length > 0 && (
          <div
            className="card-entrance relative overflow-hidden rounded-2xl border border-orange-500/20"
            style={{ animationDelay: "600ms" }}
          >
            {/* Fire background */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(249,115,22,0.12) 50%, rgba(234,179,8,0.06) 100%)",
              }}
            />
            <FireParticles count={24} />

            <div className="relative z-10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl float-gentle">
                  🔥
                </span>
                <div>
                  <h2 className="text-xl font-extrabold">
                    <span className="shimmer-text">{t.onFire}</span>
                  </h2>
                  <p className="text-xs text-slate-400">{t.onFireSub}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {hotPlayers.map((player, i) => {
                  const isTop = i === 0;
                  const accentColor = player.teamColors?.[0] || "#f97316";
                  return (
                    <div
                      key={player.id}
                      onClick={() => setActiveModal({ type: "player", id: player.id })}
                      className={`card-entrance relative group rounded-xl border overflow-hidden transition-all duration-300 hover:scale-[1.03] cursor-pointer ${
                        isTop
                          ? "border-orange-500/40 bg-gradient-to-b from-orange-500/10 to-slate-900/90"
                          : "border-white/5 bg-slate-900/80"
                      }`}
                      style={{
                        animationDelay: `${700 + i * 100}ms`,
                        boxShadow: isTop
                          ? "0 0 40px rgba(249,115,22,0.2)"
                          : undefined,
                      }}
                    >
                      {/* Rank badge */}
                      <div
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black z-10 ${
                          isTop
                            ? "bg-orange-500 text-white"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {i + 1}
                      </div>

                      {/* Top accent bar */}
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                        }}
                      />

                      <div className="p-4 pt-3">
                        {/* Player header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0"
                            style={{ borderColor: accentColor }}
                          >
                            {typeof player.headshot === "string" && player.headshot ? (
                              <Image
                                src={
                                  player.headshot.startsWith("http") ||
                                  player.headshot.startsWith("/")
                                    ? player.headshot
                                    : `/${player.headshot}`
                                }
                                alt={player.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-700 flex items-center justify-center text-lg">
                                👤
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate leading-tight">
                              {player.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {player.teamName}
                            </p>
                          </div>
                        </div>

                        {/* Heat Index */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                              {t.heatIndex}
                            </span>
                            <span className="text-sm font-black text-orange-400">
                              {Number(player.heatIndex).toFixed(1)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (player.heatIndex / (hotPlayers[0]?.heatIndex || 1)) * 100)}%`,
                                background:
                                  "linear-gradient(90deg, #f97316, #ef4444, #eab308)",
                                animation: "heat-bar 1s ease-out",
                                animationDelay: `${800 + i * 100}ms`,
                                animationFillMode: "both",
                              }}
                            />
                          </div>
                        </div>

                        {/* Stat pills */}
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { label: "PTS", val: player.pts },
                            { label: "AST", val: player.ast },
                            { label: "REB", val: player.reb },
                          ].map((s) => (
                            <div
                              key={s.label}
                              className="text-center bg-slate-800/60 rounded-lg py-1"
                            >
                              <div className="text-xs font-bold text-white">
                                {s.val}
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {s.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ BOTTOM GRID: SCORERS + RESULTS + UPCOMING ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Top Scorers Bar Chart ── */}
          <div
            className="card-entrance bg-slate-900/80 border border-white/5 rounded-2xl p-6 glow-card"
            style={{ animationDelay: "800ms" }}
          >
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <span className="text-orange-400">⭐</span> {t.topScorers}
            </h2>

            {topScorers.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                {t.noData}
              </p>
            ) : (
              <div className="space-y-3">
                {topScorers.map((p, i) => {
                  const barColor = p.teamColors?.[0] || "#f97316";
                  const ptsVal = p.stats?.pts ?? 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActiveModal({ type: "player", id: p.id })}
                      className="card-entrance group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      style={{ animationDelay: `${900 + i * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
                            {typeof p.headshot === "string" && p.headshot ? (
                              <Image
                                src={
                                  p.headshot.startsWith("http") ||
                                  p.headshot.startsWith("/")
                                    ? p.headshot
                                    : `/${p.headshot}`
                                }
                                alt=""
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-[10px]">
                                👤
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold truncate group-hover:text-orange-400 transition-colors">
                            {p.firstName} {p.lastName}
                          </span>
                        </div>
                        <span className="text-xs font-black text-white ml-2">
                          {Number(ptsVal).toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(ptsVal / maxPPGScorer) * 100}%`,
                            background: `linear-gradient(90deg, ${barColor}, ${barColor}66)`,
                            boxShadow: `0 0 6px ${barColor}30`,
                            animation: "heat-bar 1s ease-out",
                            animationDelay: `${1000 + i * 50}ms`,
                            animationFillMode: "both",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Recent Results ── */}
          <div
            className="card-entrance bg-slate-900/80 border border-white/5 rounded-2xl p-6 glow-card"
            style={{ animationDelay: "850ms" }}
          >
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <span className="text-orange-400">📋</span> {t.recentResults}
            </h2>

            {completedGames.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                {t.noData}
              </p>
            ) : (
              <div className="space-y-2.5">
                {completedGames.slice(0, 6).map((g, i) => {
                  const isHomeWinner = g.homeTeamId === g.winnerTeamId;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setActiveModal({ type: "game", id: g.id })}
                      className="card-entrance bg-slate-800/40 rounded-xl p-3 border border-white/5 hover:border-orange-500/20 transition-all group cursor-pointer"
                      style={{ animationDelay: `${950 + i * 60}ms` }}
                    >
                      {/* Date */}
                      <div className="text-[10px] text-slate-500 mb-1.5">
                        {g.date}
                        {g.venue && ` · ${g.venue}`}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {/* Home team */}
                        <div
                          className={`flex items-center gap-2 flex-1 min-w-0 ${
                            isHomeWinner ? "opacity-100" : "opacity-50"
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                            {g.homeTeamLogo ? (
                              <Image
                                src={teamLogo(g.homeTeamLogo)}
                                alt=""
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-[10px]">
                                🏀
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold truncate">
                            {g.homeTeamName}
                          </span>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 rounded-lg flex-shrink-0">
                          <span
                            className={`text-sm font-black ${
                              isHomeWinner
                                ? "text-orange-400"
                                : "text-slate-500"
                            }`}
                          >
                            {isHomeWinner ? g.winnerScore : g.loserScore}
                          </span>
                          <span className="text-slate-600 text-xs">-</span>
                          <span
                            className={`text-sm font-black ${
                              !isHomeWinner
                                ? "text-orange-400"
                                : "text-slate-500"
                            }`}
                          >
                            {!isHomeWinner ? g.winnerScore : g.loserScore}
                          </span>
                        </div>

                        {/* Away team */}
                        <div
                          className={`flex items-center gap-2 flex-1 min-w-0 justify-end ${
                            !isHomeWinner ? "opacity-100" : "opacity-50"
                          }`}
                        >
                          <span className="text-xs font-semibold truncate">
                            {g.awayTeamName}
                          </span>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                            {g.awayTeamLogo ? (
                              <Image
                                src={teamLogo(g.awayTeamLogo)}
                                alt=""
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-[10px]">
                                🏀
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Upcoming Games + Countdown ── */}
          <div
            className="card-entrance bg-slate-900/80 border border-white/5 rounded-2xl p-6 glow-card space-y-5"
            style={{ animationDelay: "900ms" }}
          >
            {/* Countdown to next game */}
            {nextGameCountdown && (
              <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-xl p-4 border border-orange-500/20">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-medium">
                  {t.nextTipoff}
                </p>
                <div className="flex items-center gap-3 mb-2">
                  <CountdownBlock
                    value={nextGameCountdown.days}
                    label={t.days}
                  />
                  <span className="text-orange-400 font-bold">:</span>
                  <CountdownBlock
                    value={nextGameCountdown.hours}
                    label={t.hours}
                  />
                  <span className="text-orange-400 font-bold">:</span>
                  <CountdownBlock
                    value={nextGameCountdown.mins}
                    label={t.mins}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {nextGameCountdown.game.homeTeamName}{" "}
                  <span className="text-orange-400 font-bold">vs</span>{" "}
                  {nextGameCountdown.game.awayTeamName}
                </p>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-orange-400">📅</span> {t.upcoming}
              </h2>

              {upcomingGames.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  {t.noUpcoming}
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingGames.slice(0, 5).map((g, i) => (
                    <div
                      key={g.id}
                      onClick={() => setActiveModal({ type: "game", id: g.id })}
                      className="card-entrance flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2.5 border border-white/5 hover:border-orange-500/20 transition-all cursor-pointer"
                      style={{ animationDelay: `${1000 + i * 50}ms` }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                          {g.homeTeamLogo ? (
                            <Image
                              src={teamLogo(g.homeTeamLogo)}
                              alt=""
                              width={20}
                              height={20}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-[8px]">
                              🏀
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold truncate">
                          {g.homeTeamName}
                        </span>
                        <span className="text-[10px] text-orange-400 font-bold flex-shrink-0">
                          vs
                        </span>
                        <span className="text-[11px] font-semibold truncate">
                          {g.awayTeamName}
                        </span>
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                          {g.awayTeamLogo ? (
                            <Image
                              src={teamLogo(g.awayTeamLogo)}
                              alt=""
                              width={20}
                              height={20}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-[8px]">
                              🏀
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-[10px] text-slate-400 font-medium">
                          {(() => { const d = parseCongoDateTime(g.date, g.time); return d ? d.toLocaleDateString() : g.date; })()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {(() => { const d = parseCongoDateTime(g.date, g.time); return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : g.time; })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ LEAGUE HEALTH INDICATORS ═══════ */}
        <div
          className="card-entrance grid grid-cols-2 md:grid-cols-5 gap-4"
          style={{ animationDelay: "1000ms" }}
        >
          {[
            {
              icon: "🎯",
              label: t.competitiveIndex,
              value: leagueHealth.competitiveIndex,
              suffix: "/100",
              color: "#22c55e",
              description: t.competitiveIndexDesc,
            },
            {
              icon: "📏",
              label: t.avgMargin,
              value: leagueHealth.avgMargin,
              decimals: 1,
              suffix: " pts",
              color: "#3b82f6",
              description: t.avgMarginDesc,
            },
            {
              icon: "🏀",
              label: t.closeGames,
              value: leagueHealth.closeGames,
              color: "#a855f7",
              description: t.closeGamesDesc,
            },
            {
              icon: "🎯",
              label: t.total3PM,
              value: leagueHealth.total3PM,
              color: "#ec4899",
              description: t.total3PMDesc,
            },
            {
              icon: "🔥",
              label: t.highestScore,
              value: leagueHealth.highestScore,
              suffix: " pts",
              color: "#f97316",
              description: t.highestScoreDesc,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-white/5 rounded-xl p-4 hover:border-orange-500/20 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  {stat.label}
                </span>
              </div>
              <div className="text-xl font-black" style={{ color: stat.color }}>
                <AnimatedCounter
                  value={stat.value}
                  decimals={stat.decimals ?? 0}
                  suffix={stat.suffix ?? ""}
                  duration={2000}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* ═══════ CRM DATA ═══════ */}
        <div
          className="card-entrance bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-6 glow-card"
          style={{ animationDelay: "1100ms" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-indigo-400">🛡️</span> {t.crmInsights}
            </h2>
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold bg-indigo-500/10 px-2 py-1 rounded">
              Admin Only
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: "📸",
                label: t.missingHeadshots,
                value: crmInsights.missingHeadshots,
                color: crmInsights.missingHeadshots > 0 ? "text-amber-400" : "text-emerald-400",
                desc: t.missingHeadshotsDesc,
              },
              {
                icon: "⚠️",
                label: t.shortRosters,
                value: crmInsights.shortRosters,
                color: crmInsights.shortRosters > 0 ? "text-red-400" : "text-emerald-400",
                desc: t.shortRostersDesc,
              },
              {
                icon: "💤",
                label: t.inactiveTeams,
                value: crmInsights.inactiveTeams,
                color: crmInsights.inactiveTeams > 0 ? "text-amber-400" : "text-emerald-400",
                desc: t.inactiveTeamsDesc,
              },
              {
                icon: "📉",
                label: t.noStatsGames,
                value: crmInsights.noStatsGames,
                color: crmInsights.noStatsGames > 0 ? "text-red-400" : "text-emerald-400",
                desc: t.noStatsGamesDesc,
              },
            ].map((crm, idx) => (
              <div key={idx} className="bg-slate-800/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg">{crm.icon}</span>
                  <span className={`text-xl font-black ${crm.color}`}>
                    <AnimatedCounter value={crm.value} duration={1200} />
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300 mb-0.5">{crm.label}</h3>
                  <p className="text-[10px] text-slate-500 leading-tight">{crm.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <div className="text-center text-[10px] text-slate-600 py-4">
          {t.footer} · {t.lastRefresh} {now.toLocaleTimeString()}
        </div>
      </div>

      {/* ═══════ DETAIL MODAL ═══════ */}
      {activeModal && (
        <DetailModal
          state={activeModal}
          onClose={() => setActiveModal(null)}
          teams={teams}
          players={allPlayers}
          games={games}
          t={t}
        />
      )}
    </div>
  );
}

/* ──────────────────── MODAL COMPONENT ──────────────────── */

function DetailModal({
  state,
  onClose,
  teams,
  players,
  games,
  t,
}: {
  state: ModalState;
  onClose: () => void;
  teams: DashTeam[];
  players: DashPlayer[];
  games: DashGame[];
  t: typeof EN;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // trigger animation
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!state) return null;

  let content: ReactNode = null;

  if (state.type === "team") {
    const team = teams.find((t) => t.id === state.id);
    if (team) {
      const roster = players.filter((p) => p.teamId === team.id);
      const teamGames = games.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
      const winPct = team.wins + team.losses > 0 ? (team.wins / (team.wins + team.losses) * 100).toFixed(1) : "0.0";
      
      const missingHeadshots = roster.filter(p => !p.headshot || p.headshot.includes("default")).length;

      content = (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-indigo-500/20 pb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 border-2" style={{ borderColor: team.colors?.[0] || "#f97316" }}>
              {team.logo ? (
                <Image src={team.logo.startsWith("http") || team.logo.startsWith("/") ? team.logo : `/${team.logo}`} alt={team.name} width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">🏀</span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black">{team.name}</h2>
              <p className="text-sm text-slate-400">{team.city || "Unknown City"} · {team.gender === "women" ? t.women : t.men}</p>
            </div>
          </div>

          {/* CRM Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{t.record || "Record"}</p>
              <p className="text-xl font-bold">{team.wins} - {team.losses}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{t.winPct || "Win %"}</p>
              <p className="text-xl font-bold">{winPct}%</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{t.totalPoints || "Total Pts"}</p>
              <p className="text-xl font-bold">{team.totalPoints || 0}</p>
            </div>
          </div>

          {/* CRM specific insights */}
          <div>
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>🛡️</span> CRM Intelligence
            </h3>
            <div className="bg-slate-900/50 border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Registered Roster Size</span>
                <span className="text-sm font-bold">{roster.length} Players</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Missing Headshots</span>
                <span className={`text-sm font-bold ${missingHeadshots > 0 ? "text-amber-400" : "text-emerald-400"}`}>{missingHeadshots}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Total Games Scheduled</span>
                <span className="text-sm font-bold">{teamGames.length}</span>
              </div>
            </div>
          </div>

          {/* Roster preview */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t.roster || "Roster Preview"}</h3>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {roster.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-slate-800/30 p-2 rounded-lg border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                    {p.headshot ? <Image src={p.headshot.startsWith("http") || p.headshot.startsWith("/") ? p.headshot : `/${p.headshot}`} alt="" width={32} height={32} className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center text-xs">👤</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-[10px] text-slate-400">#{p.number || "--"} · {p.position || "Unknown"}</p>
                  </div>
                </div>
              ))}
              {roster.length === 0 && <p className="text-xs text-slate-500 italic">No players registered.</p>}
            </div>
          </div>
        </div>
      );
    }
  } else if (state.type === "player") {
    // Some players exist as strings in hotPlayers without real DashPlayer records if they weren't in `allPlayers`.
    // Let's try finding them.
    const player = players.find((p) => p.id === state.id || `${p.firstName} ${p.lastName}` === state.id);
    
    if (player) {
      const stats = player.stats || {};
      const gamesPlayed = player.gamesPlayed || 1;
      
      content = (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-indigo-500/20 pb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 border-2" style={{ borderColor: player.teamColors?.[0] || "#f97316" }}>
              {player.headshot ? (
                <Image src={player.headshot.startsWith("http") || player.headshot.startsWith("/") ? player.headshot : `/${player.headshot}`} alt="" width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">👤</span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black">{player.firstName} {player.lastName}</h2>
              <p className="text-sm text-slate-400">{player.teamName} · #{player.number || "--"} · {player.position || "POS"}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { l: "PTS", v: stats.pts },
              { l: "REB", v: stats.reb },
              { l: "AST", v: stats.ast },
              { l: "STL", v: stats.stl },
              { l: "BLK", v: stats.blk },
              { l: "TO", v: stats.to },
            ].map(s => (
              <div key={s.l} className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/5">
                <div className="text-[10px] text-slate-500">{s.l}</div>
                <div className="text-lg font-bold text-white">{s.v || 0}</div>
                <div className="text-[8px] text-slate-600">Total</div>
              </div>
            ))}
          </div>

          <div>
             <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>🛡️</span> Player CRM Data
            </h3>
            <div className="bg-slate-900/50 border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Games Played</span>
                <span className="text-sm font-bold">{gamesPlayed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Headshot Status</span>
                <span className={`text-sm font-bold ${!player.headshot || player.headshot.includes("default") ? "text-amber-400" : "text-emerald-400"}`}>
                  {!player.headshot || player.headshot.includes("default") ? "Missing" : "Uploaded"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Avg PPG</span>
                <span className="text-sm font-bold text-orange-400">{((stats.pts || 0) / gamesPlayed).toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      content = <div className="p-8 text-center text-slate-500">Player record not fully indexed yet. Data streamed from match stats.</div>
    }
  } else if (state.type === "game") {
    const game = games.find(g => g.id === state.id);
    if (game) {
      content = (
        <div className="space-y-6 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{(() => { const d = parseCongoDateTime(game.date, game.time); return d ? d.toLocaleDateString() : game.date; })()} · {game.venue || "TBD"} · {game.gender === "women" ? t.women : t.men}</p>
          
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0">
                {game.homeTeamLogo ? <Image src={game.homeTeamLogo.startsWith("http") || game.homeTeamLogo.startsWith("/") ? game.homeTeamLogo : `/${game.homeTeamLogo}`} alt="" width={64} height={64} className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center">🏀</span>}
              </div>
              <span className="text-xs font-bold w-24 truncate">{game.homeTeamName}</span>
            </div>

            <div className="text-3xl font-black px-4 py-2 bg-slate-900 rounded-xl border border-white/5">
              {game.completed ? (
                <>
                  <span className={game.homeTeamId === game.winnerTeamId ? "text-orange-400" : "text-slate-500"}>{game.homeTeamId === game.winnerTeamId ? game.winnerScore : game.loserScore}</span>
                  <span className="text-slate-700 mx-2">-</span>
                  <span className={game.awayTeamId === game.winnerTeamId ? "text-orange-400" : "text-slate-500"}>{game.awayTeamId === game.winnerTeamId ? game.winnerScore : game.loserScore}</span>
                </>
              ) : (
                <span className="text-slate-500 text-lg">{(() => { const d = parseCongoDateTime(game.date, game.time); return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : (game.time || "TBD"); })()}</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0">
                {game.awayTeamLogo ? <Image src={game.awayTeamLogo.startsWith("http") || game.awayTeamLogo.startsWith("/") ? game.awayTeamLogo : `/${game.awayTeamLogo}`} alt="" width={64} height={64} className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center">🏀</span>}
              </div>
              <span className="text-xs font-bold w-24 truncate">{game.awayTeamName}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2 justify-center">
              <span>🛡️</span> Game CRM Audit
            </h3>
            <div className="bg-slate-900/50 border border-indigo-500/20 rounded-xl p-4 space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Status</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${game.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>
                  {game.completed ? "Completed & Locked" : "Scheduled"}
                </span>
              </div>
              {game.completed && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Stats Logged</span>
                  <span className={`text-sm font-bold ${game.playerStats && game.playerStats.length > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {game.playerStats && game.playerStats.length > 0 ? "Yes" : "Missing Data"}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">System ID</span>
                <span className="text-[10px] font-mono text-slate-500">{game.id}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`} 
        onClick={close}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className={`bg-slate-950 border border-white/10 shadow-2xl shadow-indigo-500/10 rounded-2xl w-full max-w-md pointer-events-auto overflow-hidden transition-all duration-300 transform ${isVisible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-8 opacity-0"}`}
        >
          <div className="relative p-6">
            <button 
              onClick={close}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            {content || <div className="text-center py-8 text-slate-500">Record missing or deleted.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ──────────────────── COUNTDOWN BLOCK ──────────────────── */

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="bg-slate-800 rounded-lg px-3 py-2 min-w-[48px] border border-white/5">
        <span className="text-xl font-black text-orange-400">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-1 block">
        {label}
      </span>
    </div>
  );
}

/* ──────────────── TRANSLATIONS ──────────────── */

const EN = {
  title: "LEAGUE PULSE",
  subtitle: "Real-time league intelligence dashboard",
  all: "All",
  men: "Men",
  women: "Women",
  live: "Live",
  totalTeams: "Total Teams",
  totalPlayers: "Registered Players",
  gamesPlayed: "Games Played",
  avgPPG: "Avg Points / Game",
  standings: "Conference Standings",
  topTeams: "Top 10",
  winDistribution: "Win Distribution",
  totalWins: "Total Wins",
  onFire: "WHO'S ON FIRE",
  onFireSub: "Top performers from recent games – based on Heat Index",
  heatIndex: "Heat Index",
  topScorers: "Scoring Leaders",
  recentResults: "Recent Results",
  upcoming: "Upcoming Games",
  noUpcoming: "No upcoming games scheduled",
  noData: "No data available yet",
  nextTipoff: "Next Tip-off",
  days: "Days",
  hours: "Hours",
  mins: "Mins",
  competitiveIndex: "Competitive Index",
  competitiveIndexDesc: "League parity score based on close games & margins",
  avgMargin: "Avg Margin",
  avgMarginDesc: "Average point margin in completed games",
  closeGames: "Close Games",
  closeGamesDesc: "Games decided by 5 points or less",
  total3PM: "Total 3PM",
  total3PMDesc: "Three-pointers made across all games",
  highestScore: "Top Score",
  highestScoreDesc: "Highest individual game score this season",
  crmInsights: "League Operations CRM",
  missingHeadshots: "Missing Headshots",
  missingHeadshotsDesc: "Players lacking profile photos",
  shortRosters: "Short Rosters",
  shortRostersDesc: "Teams with less than 5 players",
  inactiveTeams: "Inactive Teams",
  inactiveTeamsDesc: "Teams with 0 games scheduled",
  noStatsGames: "Missing Match Stats",
  noStatsGamesDesc: "Completed games with no stats attached",
  record: "Record",
  winPct: "Win %",
  totalPoints: "Total Pts",
  roster: "Roster Preview",
  footer: "League Pulse Dashboard — FEBACO Admin CRM",
  lastRefresh: "Last refresh:",
};

const FR: typeof EN = {
  title: "POULS DE LA LIGUE",
  subtitle: "Tableau de bord en temps réel de la ligue",
  all: "Tous",
  men: "Hommes",
  women: "Dames",
  live: "En direct",
  totalTeams: "Équipes Totales",
  totalPlayers: "Joueurs Inscrits",
  gamesPlayed: "Matchs Joués",
  avgPPG: "Moy. Points / Match",
  standings: "Classement Conférence",
  topTeams: "Top 10",
  winDistribution: "Répartition des Victoires",
  totalWins: "Total Victoires",
  onFire: "QUI EST EN FEU",
  onFireSub: "Meilleures performances récentes – basé sur l'Indice de Chaleur",
  heatIndex: "Indice Chaleur",
  topScorers: "Meilleurs Marqueurs",
  recentResults: "Résultats Récents",
  upcoming: "Prochains Matchs",
  noUpcoming: "Aucun match à venir",
  noData: "Pas encore de données",
  nextTipoff: "Prochain Coup d'envoi",
  days: "Jours",
  hours: "Heures",
  mins: "Min",
  competitiveIndex: "Indice Compétitif",
  competitiveIndexDesc: "Score de parité basé sur les matchs serrés",
  avgMargin: "Écart Moyen",
  avgMarginDesc: "Écart de points moyen dans les matchs joués",
  closeGames: "Matchs Serrés",
  closeGamesDesc: "Matchs décidés par 5 points ou moins",
  total3PM: "Total 3PM",
  total3PMDesc: "Trois-points marqués dans tous les matchs",
  highestScore: "Meilleur Score",
  highestScoreDesc: "Plus haut score individuel de la saison",
  crmInsights: "Opérations Ligue CRM",
  missingHeadshots: "Photos Manquantes",
  missingHeadshotsDesc: "Joueurs sans photo de profil",
  shortRosters: "Effectifs Réduits",
  shortRostersDesc: "Équipes avec moins de 5 joueurs",
  inactiveTeams: "Équipes Inactives",
  inactiveTeamsDesc: "Équipes sans match programmé",
  noStatsGames: "Stats Manquantes",
  noStatsGamesDesc: "Matchs terminés sans statistiques",
  record: "Bilan",
  winPct: "% Vict.",
  totalPoints: "Pts Totaux",
  roster: "Aperçu de l'Effectif",
  footer: "Tableau de Bord Pouls de la Ligue — FEBACO Admin CRM",
  lastRefresh: "Dernière mise à jour :",
};
