"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { firebaseDB, firebaseStorage, firebaseAuth } from "@/lib/firebase";
// firebaseStorage used by deleteHomeBanner; firebaseAuth used by uploadHomeBanner
import { normalizeTeamGender } from "@/lib/team-gender";
import { useAdmin } from "../layout";

type Category = "menPlayers" | "womenPlayers";
type SortKey = "votes" | "pctVoters" | "pctCategory" | "pctTotal" | "today";
type SortDir = "asc" | "desc";

type Entry = {
  id: string;
  name: string;
  teamName: string;
  headshot?: string;
  votes: number;
  today: number;
  pctVoters: number;
  pctCategory: number;
  pctTotal: number;
};

type VoterDetail = {
  voterId: string;
  voterName: string;
  voterContact: string;
  voterRole: string;
  voterEmail: string;
  menPlayers: Array<{ id: string; name: string }>;
  womenPlayers: Array<{ id: string; name: string }>;
  votedAt: Date | null;
};

type Results = Record<Category, Entry[]>;

const CATEGORIES: Category[] = ["menPlayers", "womenPlayers"];

const LABELS: Record<Category, { en: string; fr: string; icon: string }> = {
  menPlayers:   { en: "Men — Players",   fr: "Hommes — Joueurs",      icon: "🏀" },
  womenPlayers: { en: "Women — Players", fr: "Femmes — Joueuses",     icon: "🏀" },
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
    voterDetails: "Voter Details",
    showVoters: "Show voters",
    hideVoters: "Hide voters",
    searchVoters: "Search voters by name, contact, or players...",
    voterName: "Voter",
    contact: "Contact",
    votedFor: "Voted For",
    votedAt: "Voted At",
    noVoterData: "No voter profile data available",
    noSearchResults: "No voters match your search",
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
    eligTitle: "Eligibility",
    eligSubtitle: "Choose which players fans can vote for",
    eligPickTeam: "Pick a team above to manage its eligible players.",
    eligSelectAll: "Select all",
    eligClearAll: "Clear all",
    eligSave: "Save eligibility",
    eligSaving: "Saving…",
    eligSaved: "Saved!",
    eligUnsaved: "Unsaved changes",
    eligEligible: "eligible",
    eligNoRoster: "No players on this team.",
    eligRosterLoading: "Loading players…",
    eligError: "Could not save. Please try again.",
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
    voterDetails: "Détails des Votants",
    showVoters: "Afficher les votants",
    hideVoters: "Masquer les votants",
    searchVoters: "Rechercher par nom, contact ou joueurs...",
    voterName: "Votant",
    contact: "Contact",
    votedFor: "A voté pour",
    votedAt: "Date de vote",
    noVoterData: "Aucune donnée de profil disponible",
    noSearchResults: "Aucun votant ne correspond à votre recherche",
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
    eligTitle: "Éligibilité",
    eligSubtitle: "Choisissez les joueurs que les fans peuvent voter",
    eligPickTeam: "Choisissez une équipe ci-dessus pour gérer ses joueurs éligibles.",
    eligSelectAll: "Tout sélectionner",
    eligClearAll: "Tout effacer",
    eligSave: "Enregistrer l'éligibilité",
    eligSaving: "Enregistrement…",
    eligSaved: "Enregistré !",
    eligUnsaved: "Modifications non enregistrées",
    eligEligible: "éligibles",
    eligNoRoster: "Aucun joueur dans cette équipe.",
    eligRosterLoading: "Chargement des joueurs…",
    eligError: "Échec de l'enregistrement. Réessayez.",
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

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (target <= 0) { setValue(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
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
  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [allStarTheme, setAllStarTheme] = useState(false);
  const [togglingTheme, setTogglingTheme] = useState(false);
  const [showVoterDetails, setShowVoterDetails] = useState(false);
  const [voterSearch, setVoterSearch] = useState("");
  const [voterRoleFilter, setVoterRoleFilter] = useState<"all" | "joueur" | "staff" | "fan">("all");
  const [voterDetails, setVoterDetails] = useState<VoterDetail[]>([]);
  const [results, setResults] = useState<Results>({
    menPlayers: [], womenPlayers: [],
  });
  const [homeBannerUrl, setHomeBannerUrl] = useState("");
  const [homeBannerUploading, setHomeBannerUploading] = useState(false);
  const [homeBannerDeleting, setHomeBannerDeleting] = useState(false);
  const [homeBannerError, setHomeBannerError] = useState("");
  const homeBannerInputRef = useRef<HTMLInputElement | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Reset votes
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPwd1, setResetPwd1] = useState("");
  const [resetPwd2, setResetPwd2] = useState("");
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);
  const [resetRunning, setResetRunning] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Reset banner activity
  const [resettingBanner, setResettingBanner] = useState(false);
  const [bannerResetSuccess, setBannerResetSuccess] = useState(false);

  // Suspicious attempt alerts
  type SuspectAttempt = {
    id: string;
    ip: string;
    country: string | null;
    city: string | null;
    region: string | null;
    userAgent: string | null;
    language: string | null;
    reason: string;
    detectedAt: Date | null;
    phone?: string | null;
    menCount?: number | null;
    womenCount?: number | null;
    name?: string | null;
    ageMs?: number | null;
    menPlayers?: string[] | null;
    womenPlayers?: string[] | null;
  };
  const [suspectAttempts, setSuspectAttempts] = useState<SuspectAttempt[]>([]);
  const [showSuspects, setShowSuspects] = useState(false);
  const [expandedSuspectId, setExpandedSuspectId] = useState<string | null>(null);
  const [suspectLastSeen, setSuspectLastSeen] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date(0);
    const s = localStorage.getItem("allstar_suspects_last_seen");
    return s ? new Date(s) : new Date(0);
  });
  const [playerMapState, setPlayerMapState] = useState<Record<string, { name: string; teamName: string }>>({});

  // Cleanup fake votes + clone detection
  type FakeVoteEntry = { id: string; men: number; women: number; phone: string; name: string };
  type CloneGroup = {
    count: number;
    ids: string[];
    windowMs: number;
    sampleVotes: { id: string; name: string; phone: string }[];
    sampleMen: string[];
    sampleWomen: string[];
  };
  const [cleanupScanning, setCleanupScanning] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{
    fakeCount: number;
    dupPlayerCount: number;
    cloneCount: number;
    total: number;
    fake: FakeVoteEntry[];
    dupPlayers: Array<{ id: string; menDups: number; womenDups: number; phone: string; name: string }>;
    cloneGroups: CloneGroup[];
  } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; deletedFake: number; deletedDupPlayer: number; deletedClone: number; remaining: number } | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [showFakeList, setShowFakeList] = useState(false);
  const [showDupList, setShowDupList] = useState(false);
  const [showCloneList, setShowCloneList] = useState(false);

  // ── Player investigation ──
  type InvestigationResult = {
    players: { id: string; name: string; teamName: string }[];
    totalVotes: number;
    firstVote: string | null;
    lastVote: string | null;
    maxBurstPerMinute: number;
    maxBurstWindow: { from: string; to: string; seconds: number } | null;
    phoneSequentialPct: number;
    roles: Record<string, number>;
    cloneRatio: number;
    topCloneCount: number;
    votesByHour: Record<string, number>;
    suspectAttempts: number;
    suspectDetails: { ip: string; reason: string; name: string; phone: string; detectedAt: number }[];
    recentVotes: { phone: string; name: string; role: string; submittedAt: string | null }[];
  };
  const [investQuery, setInvestQuery] = useState("");
  const [investLoading, setInvestLoading] = useState(false);
  const [investResult, setInvestResult] = useState<InvestigationResult | null>(null);
  const [investError, setInvestError] = useState("");

  // ── Eligibility ──
  type EligTeam = { id: string; name: string; gender: "men" | "women" };
  type EligPlayer = { id: string; name: string };
  const [eligTeams, setEligTeams] = useState<EligTeam[]>([]);
  const [eligMap, setEligMap] = useState<Record<string, string[]>>({});
  const [eligSelectedTeam, setEligSelectedTeam] = useState<string | null>(null);
  const [eligRoster, setEligRoster] = useState<EligPlayer[]>([]);
  const [eligRosterLoading, setEligRosterLoading] = useState(false);
  const [eligDraft, setEligDraft] = useState<string[]>([]);
  const [eligSaving, setEligSaving] = useState(false);
  const [eligSavedFlash, setEligSavedFlash] = useState(false);
  const [eligErrorFlag, setEligErrorFlag] = useState(false);
  const eligRosterCache = useRef<Record<string, EligPlayer[]>>({});

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const now = Date.now();
    const ONE_DAY = 86_400_000;

    // 1. Fetch votes and teams in parallel
    const [votesSnap, teamsSnap] = await Promise.all([
      getDocs(collection(firebaseDB, "allStarVotes")),
      getDocs(collection(firebaseDB, "teams")),
    ]);
    const voterCount = votesSnap.size;
    setTotalVoters(voterCount);

    // 2. Build name/team/gender lookup from rosters
    const playerMap: Record<string, { name: string; teamName: string; gender: string; headshot?: string }> = {};

    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const td = teamDoc.data();
        const teamGender = normalizeTeamGender(td.gender, td.logo, "men");
        const teamName = [td.city, td.name].filter(Boolean).join(" ");
        const rosterSnap = await getDocs(collection(firebaseDB, "teams", teamDoc.id, "roster"));
        for (const p of rosterSnap.docs) {
          const pd = p.data();
          playerMap[p.id] = {
            name: `${pd.firstName || ""} ${pd.lastName || ""}`.trim() || pd.name || p.id,
            teamName,
            gender: teamGender,
            headshot: pd.headshot || undefined,
          };
        }
      })
    );

    // 3. Aggregate all votes
    const counts: Record<Category, Record<string, number>> = {
      menPlayers: {}, womenPlayers: {},
    };
    const todayCounts: Record<Category, Record<string, number>> = {
      menPlayers: {}, womenPlayers: {},
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

    // Fix gender mismatches: move votes to the correct category based on the player's team
    for (const [id, info] of Object.entries(playerMap)) {
      if (info.gender === "women" && counts.menPlayers[id] !== undefined) {
        counts.womenPlayers[id] = (counts.womenPlayers[id] || 0) + counts.menPlayers[id];
        delete counts.menPlayers[id];
        if (todayCounts.menPlayers[id] !== undefined) {
          todayCounts.womenPlayers[id] = (todayCounts.womenPlayers[id] || 0) + todayCounts.menPlayers[id];
          delete todayCounts.menPlayers[id];
        }
      } else if (info.gender === "men" && counts.womenPlayers[id] !== undefined) {
        counts.menPlayers[id] = (counts.menPlayers[id] || 0) + counts.womenPlayers[id];
        delete counts.womenPlayers[id];
        if (todayCounts.womenPlayers[id] !== undefined) {
          todayCounts.menPlayers[id] = (todayCounts.menPlayers[id] || 0) + todayCounts.womenPlayers[id];
          delete todayCounts.womenPlayers[id];
        }
      }
    }

    // Category totals for % of category (recalculated after gender correction)
    const catTotals: Record<Category, number> = {
      menPlayers:   Object.values(counts.menPlayers).reduce((a, b) => a + b, 0),
      womenPlayers: Object.values(counts.womenPlayers).reduce((a, b) => a + b, 0),
    };

    // 3. Resolve entries with all computed stats
    const resolve = (
      countMap: Record<string, number>,
      todayMap: Record<string, number>,
      lookup: Record<string, { name: string; teamName: string; gender?: string; headshot?: string }>,
      catTotal: number,
    ): Entry[] => {
      const rawEntries = Object.entries(countMap).map(([id, votes]) => ({
        id,
        name: lookup[id]?.name ?? id,
        teamName: lookup[id]?.teamName ?? "—",
        headshot: lookup[id]?.headshot,
        votes,
        today: todayMap[id] ?? 0,
      }));

      // Merge entries with the same name (player appears in multiple rosters)
      const byName = new Map<string, typeof rawEntries[0]>();
      for (const entry of rawEntries) {
        const existing = byName.get(entry.name);
        if (existing) {
          existing.votes += entry.votes;
          existing.today += entry.today;
          if (!existing.headshot && entry.headshot) existing.headshot = entry.headshot;
        } else {
          byName.set(entry.name, { ...entry });
        }
      }

      return [...byName.values()]
        .map((e) => ({
          ...e,
          pctVoters:   voterCount > 0 ? parseFloat(((e.votes / voterCount) * 100).toFixed(1)) : 0,
          pctCategory: catTotal > 0   ? parseFloat(((e.votes / catTotal)   * 100).toFixed(1)) : 0,
          pctTotal:    totalCast > 0  ? parseFloat(((e.votes / totalCast)  * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.votes - a.votes);
    };

    const computedMen   = resolve(counts.menPlayers,   todayCounts.menPlayers,   playerMap, catTotals.menPlayers);
    const computedWomen = resolve(counts.womenPlayers,  todayCounts.womenPlayers, playerMap, catTotals.womenPlayers);
    setResults({ menPlayers: computedMen, womenPlayers: computedWomen });
    setPlayerMapState(Object.fromEntries(
      Object.entries(playerMap).map(([id, v]) => [id, { name: v.name, teamName: v.teamName }])
    ));

    // Write a denormalised leaders snapshot so the vote page can display instantly
    try {
      await setDoc(doc(firebaseDB, "allStarLeaders", "snapshot"), {
        men:   computedMen.slice(0, 35).map(({ id, name, teamName, votes, headshot }) => ({ id, name, teamName, votes, headshot: headshot ?? null })),
        women: computedWomen.slice(0, 35).map(({ id, name, teamName, votes, headshot }) => ({ id, name, teamName, votes, headshot: headshot ?? null })),
        lastUpdated: new Date(),
      });
    } catch { /* non-critical */ }

    // 4. Build voter details directly from vote documents (name/phone/role stored on the vote doc itself)
    const voterDetailsData: VoterDetail[] = [];
    for (const voteDoc of votesSnap.docs) {
      const voteData = voteDoc.data();
      const voterId = voteDoc.id;
      const menPlayerIds = (voteData.menPlayers || []) as string[];
      const womenPlayerIds = (voteData.womenPlayers || []) as string[];
      const firstName = (voteData.firstName || "").trim();
      const lastName  = (voteData.lastName  || "").trim();
      voterDetailsData.push({
        voterId,
        voterName:    `${firstName} ${lastName}`.trim() || voteData.name || "Unknown",
        voterContact: voteData.phone || "—",
        voterRole:    voteData.role  || "—",
        voterEmail:   voteData.email || "",
        menPlayers:   menPlayerIds.map(id => ({ id, name: playerMap[id]?.name || id })),
        womenPlayers: womenPlayerIds.map(id => ({ id, name: playerMap[id]?.name || id })),
        votedAt: (voteData.submittedAt as Timestamp | undefined)?.toDate?.() ||
                 (voteData.lastModified as Timestamp | undefined)?.toDate?.() || null,
      });
    }
    setVoterDetails(voterDetailsData.sort((a, b) => 
      (b.votedAt?.getTime() || 0) - (a.votedAt?.getTime() || 0)
    ));

    setLastRefreshed(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time listener for suspicious vote attempts
  useEffect(() => {
    const q = query(
      collection(firebaseDB, "allStarSuspectAttempts"),
      orderBy("detectedAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSuspectAttempts(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ip:          data.ip          ?? "—",
          country:     data.country     ?? null,
          city:        data.city        ?? null,
          region:      data.region      ?? null,
          userAgent:   data.userAgent   ?? null,
          language:    data.language    ?? null,
          reason:      data.reason      ?? "UNKNOWN",
          detectedAt:  (data.detectedAt as Timestamp | undefined)?.toDate?.() ?? null,
          phone:       data.phone       ?? null,
          menCount:    data.menCount    ?? null,
          womenCount:  data.womenCount  ?? null,
          name:        data.name        ?? null,
          ageMs:       data.ageMs       ?? null,
          menPlayers:  Array.isArray(data.menPlayers)   ? data.menPlayers   : null,
          womenPlayers: Array.isArray(data.womenPlayers) ? data.womenPlayers : null,
        };
      }));
    }, () => { /* permission denied — admin not yet logged in */ });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDoc(doc(firebaseDB, "settings", "allStarBanner"))
      .then((snap) => { if (snap.exists() && snap.data().url) setHomeBannerUrl(snap.data().url as string); })
      .catch(() => {});
  }, []);

  // Load teams + current eligibility map for the Eligibility section
  useEffect(() => {
    (async () => {
      const [teamsSnap, eligSnap] = await Promise.all([
        getDocs(collection(firebaseDB, "teams")),
        getDoc(doc(firebaseDB, "settings", "allStarEligibility")),
      ]);
      const teams: EligTeam[] = teamsSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: [data.city, data.name].filter(Boolean).join(" ") || d.id,
            gender: normalizeTeamGender(data.gender, data.logo, "men") as "men" | "women",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setEligTeams(teams);
      setEligMap(eligSnap.exists() ? ((eligSnap.data().teams as Record<string, string[]>) || {}) : {});
    })().catch(() => {});
  }, []);

  const selectEligTeam = async (teamId: string) => {
    setEligSelectedTeam(teamId);
    setEligDraft(eligMap[teamId] ?? []);
    setEligErrorFlag(false);
    if (eligRosterCache.current[teamId]) {
      setEligRoster(eligRosterCache.current[teamId]);
      return;
    }
    setEligRosterLoading(true);
    try {
      const snap = await getDocs(collection(firebaseDB, "teams", teamId, "roster"));
      const roster: EligPlayer[] = snap.docs
        .map((d) => {
          const pd = d.data();
          return { id: d.id, name: `${pd.firstName || ""} ${pd.lastName || ""}`.trim() || pd.name || d.id };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      eligRosterCache.current[teamId] = roster;
      setEligRoster(roster);
    } catch {
      setEligRoster([]);
    } finally {
      setEligRosterLoading(false);
    }
  };

  const toggleEligPlayer = (id: string) =>
    setEligDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const saveEligibility = async () => {
    if (!eligSelectedTeam) return;
    setEligSaving(true);
    setEligErrorFlag(false);
    try {
      await setDoc(
        doc(firebaseDB, "settings", "allStarEligibility"),
        { teams: { [eligSelectedTeam]: eligDraft } },
        { merge: true },
      );
      setEligMap((prev) => ({ ...prev, [eligSelectedTeam]: eligDraft }));
      setEligSavedFlash(true);
      setTimeout(() => setEligSavedFlash(false), 2500);
    } catch {
      setEligErrorFlag(true);
    } finally {
      setEligSaving(false);
    }
  };

  const compressBannerImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_W = 1400;
        const scale = Math.min(1, MAX_W / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("toBlob")),
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("load")); };
      img.src = objectUrl;
    });

  const uploadHomeBanner = async (file: File) => {
    setHomeBannerUploading(true);
    setHomeBannerError("");

    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setHomeBannerError(language === "fr" ? "Non authentifié — rechargez la page." : "Not authenticated — please refresh.");
        return;
      }

      const blob = await compressBannerImage(file).catch(() => file as Blob);
      const token = await user.getIdToken(false);

      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;
      const timeoutId = setTimeout(() => ctrl.abort(), 60_000);

      let res: Response;
      try {
        res = await fetch("/api/admin/upload-banner", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "image/jpeg" },
          body: blob,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        abortCtrlRef.current = null;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${errText}`);
      }

      const { url } = await res.json() as { url: string };
      await setDoc(doc(firebaseDB, "settings", "allStarBanner"), { url });
      setHomeBannerUrl(url);
    } catch (err: unknown) {
      abortCtrlRef.current = null;
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Banner upload failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setHomeBannerError(
        language === "fr" ? `Échec de l'import: ${msg}` : `Upload failed: ${msg}`
      );
    } finally {
      setHomeBannerUploading(false);
    }
  };

  const deleteHomeBanner = async () => {
    setHomeBannerDeleting(true);
    try {
      if (homeBannerUrl) {
        await deleteObject(storageRef(firebaseStorage, "allstar-banners/home-banner")).catch(() => {});
      }
      await setDoc(doc(firebaseDB, "settings", "allStarBanner"), { url: "" });
      setHomeBannerUrl("");
    } catch (err) {
      console.error("Banner delete failed:", err);
    } finally {
      setHomeBannerDeleting(false);
    }
  };

  // Countdown: start 5-min timer when both passwords match; reset when they diverge
  const pwdMatch = resetPwd1.length >= 1 && resetPwd1 === resetPwd2;
  useEffect(() => {
    if (!pwdMatch || !showResetModal) { setResetCountdown(null); return; }
    setResetCountdown(300);
    const iv = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev === null || prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [pwdMatch, showResetModal]);

  const resetAllVotes = async () => {
    setResetRunning(true);
    setResetError("");
    try {
      const votesSnap = await getDocs(collection(firebaseDB, "allStarVotes"));
      // Batch-delete in chunks of 500
      for (let i = 0; i < votesSnap.docs.length; i += 500) {
        const batch = writeBatch(firebaseDB);
        votesSnap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await setDoc(doc(firebaseDB, "allStarVoteResults", "menPlayers"), {});
      await setDoc(doc(firebaseDB, "allStarVoteResults", "womenPlayers"), {});
      await setDoc(doc(firebaseDB, "allStarLeaders", "snapshot"), { men: [], women: [], lastUpdated: new Date() });
      setTotalVoters(0);
      setTotalVotes(0);
      setResults({ menPlayers: [], womenPlayers: [] });
      setVoterDetails([]);
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(false);
        setResetPwd1("");
        setResetPwd2("");
        setResetCountdown(null);
      }, 2000);
    } catch {
      setResetError(language === "fr" ? "Erreur lors de la réinitialisation." : "Reset failed. Please try again.");
    } finally {
      setResetRunning(false);
    }
  };

  const scanFakeVotes = async () => {
    setCleanupScanning(true);
    setCleanupError("");
    setCleanupResult(null);
    try {
      const { firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser?.getIdToken(false);
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/admin/cleanup-fake-votes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { fakeCount: number; dupPlayerCount: number; cloneCount: number; total: number; fake: FakeVoteEntry[]; dupPlayers: Array<{ id: string; menDups: number; womenDups: number; phone: string; name: string }>; cloneGroups: CloneGroup[] };
      setCleanupPreview({ ...data, dupPlayerCount: data.dupPlayerCount ?? 0, dupPlayers: data.dupPlayers ?? [] });
      setShowFakeList(false);
      setShowDupList(false);
      setShowCloneList(false);
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setCleanupScanning(false);
    }
  };

  const deleteFakeVotes = async () => {
    setCleanupRunning(true);
    setCleanupError("");
    try {
      const { firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser?.getIdToken(false);
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/admin/cleanup-fake-votes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { deleted: number; deletedFake: number; deletedDupPlayer: number; deletedClone: number; remaining: number };
      setCleanupResult({ ...data, deletedDupPlayer: data.deletedDupPlayer ?? 0 });
      setCleanupPreview(null);
      load(true); // Refresh vote counts
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleanupRunning(false);
    }
  };

  const resetBannerActivity = async () => {
    setResettingBanner(true);
    try {
      const snap = await getDoc(doc(firebaseDB, "settings", "allStarBanner"));
      const v = snap.exists() ? ((snap.data().version as number) ?? 0) : 0;
      await setDoc(doc(firebaseDB, "settings", "allStarBanner"), { url: homeBannerUrl, version: v + 1 });
      setBannerResetSuccess(true);
      setTimeout(() => setBannerResetSuccess(false), 3000);
    } catch { /* non-critical */ } finally {
      setResettingBanner(false);
    }
  };

  // Load All-Star settings (voting enabled + gold theme)
  useEffect(() => {
    const loadSetting = async () => {
      const settingsDoc = await getDoc(doc(firebaseDB, "settings", "allStar"));
      if (settingsDoc.exists()) {
        setAllStarEnabled(settingsDoc.data().enabled ?? true);
        setAllStarTheme(settingsDoc.data().allStarTheme === true);
      }
    };
    loadSetting();
  }, []);

  const toggleAllStar = async () => {
    setToggling(true);
    try {
      const newState = !allStarEnabled;
      await setDoc(doc(firebaseDB, "settings", "allStar"), {
        enabled: newState,
        lastModified: new Date(),
      }, { merge: true });
      setAllStarEnabled(newState);
    } catch (error) {
      console.error("Failed to toggle All-Star:", error);
    }
    setToggling(false);
  };

  const toggleTheme = async () => {
    setTogglingTheme(true);
    try {
      const newState = !allStarTheme;
      await setDoc(doc(firebaseDB, "settings", "allStar"), {
        allStarTheme: newState,
        lastModified: new Date(),
      }, { merge: true });
      setAllStarTheme(newState);
    } catch (error) {
      console.error("Failed to toggle All-Star theme:", error);
    }
    setTogglingTheme(false);
  };

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

  const eligSavedForTeam = eligSelectedTeam ? eligMap[eligSelectedTeam] ?? [] : [];
  const eligDirty =
    eligSelectedTeam !== null &&
    (eligDraft.length !== eligSavedForTeam.length ||
      eligDraft.some((id) => !eligSavedForTeam.includes(id)));
  const eligGroups: { key: "men" | "women"; label: string }[] = [
    { key: "men", label: language === "fr" ? "Hommes" : "Men" },
    { key: "women", label: language === "fr" ? "Femmes" : "Women" },
  ];

  const SUSPECT_LABELS: Record<string, { fr: string; en: string; color: string }> = {
    TOKEN_MISSING:      { fr: "Token manquant — bot direct",             en: "No token — direct bot",              color: "text-red-400" },
    TOKEN_INVALID:      { fr: "Signature falsifiée — tentative hack",    en: "Forged token — signature mismatch",  color: "text-red-400" },
    TOKEN_TOO_YOUNG:    { fr: "Soumis trop vite — automation",           en: "Submitted too fast — automation",    color: "text-orange-400" },
    DUPLICATE_PLAYERS:  { fr: "Joueur dupliqué ×15 — exploit bot",       en: "Same player ×15 — bot exploit",      color: "text-red-500" },
    TOKEN_REPLAY:    { fr: "Token rejoué — attaque replay",       en: "Token replayed — replay attack",    color: "text-red-400" },
    PLAYER_COUNT:    { fr: "Nombre de joueurs modifié",           en: "Player count tampered",             color: "text-orange-400" },
    RATE_LIMITED:    { fr: "Soumissions répétées — IP flooding",  en: "Repeated submissions — IP flooding", color: "text-yellow-400" },
  };

  const newSuspectCount = suspectAttempts.filter(
    (a) => a.detectedAt && a.detectedAt > suspectLastSeen
  ).length;

  const runInvestigation = async () => {
    if (!investQuery.trim()) return;
    setInvestLoading(true);
    setInvestError("");
    setInvestResult(null);
    try {
      const { firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser?.getIdToken(false);
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`/api/admin/investigate-player?name=${encodeURIComponent(investQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Investigation failed");
      setInvestResult(data as InvestigationResult);
    } catch (err) {
      setInvestError(err instanceof Error ? err.message : "Failed");
    } finally {
      setInvestLoading(false);
    }
  };

  const markSuspectsAsSeen = () => {
    const now = new Date();
    setSuspectLastSeen(now);
    localStorage.setItem("allstar_suspects_last_seen", now.toISOString());
  };

  // Count-up animations — fire once data loads, no impact on fetch timing
  const animVoters = useCountUp(loading ? 0 : totalVoters);
  const animVotes  = useCountUp(loading ? 0 : totalVotes);
  const animMen    = useCountUp(loading ? 0 : results.menPlayers.length);
  const animWomen  = useCountUp(loading ? 0 : results.womenPlayers.length);

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
        <div className="flex items-center gap-3 self-start flex-wrap">
          {/* Suspicious attempts alert bell */}
          <button
            onClick={() => {
              setShowSuspects((v) => !v);
              if (!showSuspects) markSuspectsAsSeen();
            }}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-sm transition-all ${
              newSuspectCount > 0
                ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
                : suspectAttempts.length > 0
                ? "bg-slate-800/60 border-white/10 text-slate-400 hover:border-white/20"
                : "bg-slate-800/40 border-white/5 text-slate-600"
            }`}
            title={language === "fr" ? "Tentatives suspectes" : "Suspicious attempts"}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {newSuspectCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
                {newSuspectCount > 9 ? "9+" : newSuspectCount}
              </span>
            )}
            {language === "fr" ? "Alertes" : "Alerts"}
            {suspectAttempts.length > 0 && (
              <span className="text-[10px] opacity-60">({suspectAttempts.length})</span>
            )}
          </button>

          {/* All-Star Enable/Disable Toggle */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-white/10 rounded-xl">
            <span className="text-xs font-semibold text-slate-400">
              {language === "fr" ? "Vote public" : "Public voting"}:
            </span>
            <button
              onClick={toggleAllStar}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                allStarEnabled ? "bg-emerald-600" : "bg-slate-600"
              }`}
              title={allStarEnabled ? "Click to disable" : "Click to enable"}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allStarEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-xs font-bold ${
              allStarEnabled ? "text-emerald-400" : "text-slate-500"
            }`}>
              {allStarEnabled ? (language === "fr" ? "Activé" : "ON") : (language === "fr" ? "Désactivé" : "OFF")}
            </span>
          </div>
          
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

      {/* ── Suspicious Attempts Panel ── */}
      {showSuspects && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 overflow-hidden">
          <div className="px-5 py-3.5 bg-red-950/40 border-b border-red-500/20 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg shrink-0">🚨</span>
              <div>
                <p className="text-sm font-black text-red-300 uppercase tracking-wide">
                  {language === "fr" ? "Tentatives suspectes" : "Suspicious Attempts"}
                </p>
                <p className="text-xs text-red-600/80 mt-0.5">
                  {language === "fr"
                    ? "Requêtes bloquées par les protections anti-bot — en temps réel"
                    : "Requests blocked by anti-bot protections — live"}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
              {suspectAttempts.length} {language === "fr" ? "enregistrées" : "logged"}
            </span>
          </div>

          {suspectAttempts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              {language === "fr" ? "Aucune tentative suspecte détectée." : "No suspicious attempts detected."}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-red-950/50 border-b border-red-500/15 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70 w-8" />
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">
                      {language === "fr" ? "Date / Heure" : "Date / Time"}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">IP</th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">
                      {language === "fr" ? "Lieu" : "Location"}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">
                      {language === "fr" ? "Raison" : "Reason"}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">
                      {language === "fr" ? "Identité soumise" : "Submitted Identity"}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-red-400/70">
                      {language === "fr" ? "Appareil" : "Device"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suspectAttempts.map((a) => {
                    const label = SUSPECT_LABELS[a.reason] ?? { fr: a.reason, en: a.reason, color: "text-slate-400" };
                    const isNew = a.detectedAt && a.detectedAt > suspectLastSeen;
                    const isExpanded = expandedSuspectId === a.id;
                    const hasPlayers = (a.menPlayers && a.menPlayers.length > 0) || (a.womenPlayers && a.womenPlayers.length > 0);
                    return (
                      <>
                        <tr
                          key={a.id}
                          onClick={() => setExpandedSuspectId(isExpanded ? null : a.id)}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${isNew ? "bg-red-500/5" : ""} ${isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                        >
                          {/* Expand chevron */}
                          <td className="px-3 py-2.5 text-slate-600">
                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          {/* Time */}
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                            {isNew && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 mb-0.5 align-middle" />}
                            {a.detectedAt
                              ? a.detectedAt.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
                                  month: "short", day: "numeric",
                                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                                })
                              : "—"}
                          </td>
                          {/* IP + lookup */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-red-300 font-bold select-all">{a.ip}</span>
                              <a
                                href={`https://ipinfo.io/${a.ip}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-600 hover:text-blue-400 transition-colors"
                                title="Look up IP details (ISP, carrier, VPN)"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </td>
                          {/* Location */}
                          <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                            {[a.city, a.country].filter(Boolean).join(", ") || "—"}
                          </td>
                          {/* Reason */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`font-bold ${label.color}`}>
                              {language === "fr" ? label.fr : label.en}
                            </span>
                          </td>
                          {/* Identity */}
                          <td className="px-3 py-2.5 text-slate-400">
                            {a.name && <span className="text-slate-200 font-medium mr-2">{a.name}</span>}
                            {a.phone && <span className="font-mono text-slate-500">{a.phone}</span>}
                            {a.ageMs !== null && a.ageMs !== undefined && (
                              <span className="text-orange-400 ml-2">{(a.ageMs / 1000).toFixed(1)}s</span>
                            )}
                          </td>
                          {/* Device */}
                          <td className="px-3 py-2.5 max-w-[200px]">
                            <span className="text-slate-500 truncate block" title={a.userAgent ?? ""}>
                              {a.userAgent ? (a.userAgent.length > 45 ? a.userAgent.slice(0, 45) + "…" : a.userAgent) : "—"}
                            </span>
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExpanded && (
                          <tr key={`${a.id}-detail`} className="bg-slate-900/80 border-b border-red-500/10">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                {/* Left: identity + device */}
                                <div className="space-y-3">
                                  <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                                    {language === "fr" ? "Empreinte appareil" : "Device fingerprint"}
                                  </p>
                                  <div className="space-y-1.5 text-xs">
                                    <div><span className="text-slate-500 w-24 inline-block">IP</span><span className="font-mono text-red-300">{a.ip}</span></div>
                                    <div><span className="text-slate-500 w-24 inline-block">{language === "fr" ? "Lieu" : "Location"}</span><span className="text-slate-300">{[a.city, a.region, a.country].filter(Boolean).join(", ") || "—"}</span></div>
                                    <div><span className="text-slate-500 w-24 inline-block">{language === "fr" ? "Langue" : "Language"}</span><span className="text-slate-300">{a.language ?? "—"}</span></div>
                                    <div className="flex gap-2">
                                      <span className="text-slate-500 w-24 inline-block shrink-0">User-Agent</span>
                                      <span className="text-slate-400 break-all leading-relaxed">{a.userAgent ?? "—"}</span>
                                    </div>
                                  </div>
                                  <a
                                    href={`https://ipinfo.io/${a.ip}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-xs font-semibold rounded-lg transition-all"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    {language === "fr" ? "Voir FAI / opérateur sur ipinfo.io" : "View ISP / carrier on ipinfo.io"}
                                  </a>
                                </div>

                                {/* Right: players voted for */}
                                {hasPlayers && (
                                  <div className="space-y-3">
                                    <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                                      {language === "fr" ? "Joueurs pour lesquels ils ont voté" : "Players they tried to vote for"}
                                    </p>
                                    {a.menPlayers && a.menPlayers.length > 0 && (
                                      <div>
                                        <p className="text-[10px] text-blue-400 font-semibold mb-1">♂ {language === "fr" ? "Hommes" : "Men"} ({a.menPlayers.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                          {a.menPlayers.map((pid) => (
                                            <span key={pid} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300">
                                              {playerMapState[pid]?.name ?? pid}
                                              {playerMapState[pid]?.teamName && (
                                                <span className="text-slate-500 ml-1">· {playerMapState[pid].teamName}</span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {a.womenPlayers && a.womenPlayers.length > 0 && (
                                      <div>
                                        <p className="text-[10px] text-purple-400 font-semibold mb-1">♀ {language === "fr" ? "Femmes" : "Women"} ({a.womenPlayers.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                          {a.womenPlayers.map((pid) => (
                                            <span key={pid} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-300">
                                              {playerMapState[pid]?.name ?? pid}
                                              {playerMapState[pid]?.teamName && (
                                                <span className="text-slate-500 ml-1">· {playerMapState[pid].teamName}</span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!hasPlayers && (
                                  <div className="flex items-center text-xs text-slate-600">
                                    {language === "fr" ? "Aucune sélection de joueurs soumise." : "No player selection submitted."}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── All-Star Gold Theme Toggle ── */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-950/60 via-amber-950/40 to-yellow-950/60 p-5">
        {/* Shimmer strip */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -left-24 top-0 h-full w-32 rotate-12 bg-gradient-to-r from-transparent via-yellow-400/6 to-transparent animate-shimmer" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
              allStarTheme
                ? "bg-gradient-to-br from-yellow-500 to-amber-400 shadow-lg shadow-yellow-500/30"
                : "bg-slate-800/80 border border-white/10"
            }`}>
              ⭐
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-300 tracking-wide uppercase">
                {language === "fr" ? "Thème All-Star" : "All-Star Theme"}
              </p>
              <p className="text-xs text-yellow-600/80 mt-0.5 max-w-xs">
                {language === "fr"
                  ? "Applique le thème doré All-Star sur tout le site"
                  : "Activates the gold All-Star theme across the entire site"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide ${
              allStarTheme
                ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"
                : "bg-slate-700/60 text-slate-500 border border-white/5"
            }`}>
              {allStarTheme
                ? (language === "fr" ? "● ACTIF" : "● ACTIVE")
                : (language === "fr" ? "○ INACTIF" : "○ INACTIVE")}
            </span>
            <button
              onClick={toggleTheme}
              disabled={togglingTheme}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 disabled:opacity-50 ${
                allStarTheme
                  ? "bg-gradient-to-r from-yellow-600 to-amber-500 shadow-md shadow-yellow-600/40"
                  : "bg-slate-700"
              }`}
              title={allStarTheme ? "Disable gold theme" : "Enable gold theme"}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full transition-transform duration-300 shadow-sm ${
                  allStarTheme
                    ? "translate-x-8 bg-yellow-100"
                    : "translate-x-1 bg-slate-300"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Eligibility ── */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl shrink-0">✅</div>
          <div>
            <p className="text-sm font-bold text-emerald-300 tracking-wide uppercase">{t.eligTitle}</p>
            <p className="text-xs text-emerald-600/80 mt-0.5">{t.eligSubtitle}</p>
          </div>
        </div>

        {/* Team picker grouped by gender */}
        <div className="space-y-3">
          {eligGroups.map((group) => {
            const groupTeams = eligTeams.filter((tm) => tm.gender === group.key);
            if (groupTeams.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {groupTeams.map((tm) => {
                    const count = (eligMap[tm.id] ?? []).length;
                    const active = eligSelectedTeam === tm.id;
                    return (
                      <button
                        key={tm.id}
                        onClick={() => selectEligTeam(tm.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/5"}`}
                      >
                        {tm.name}
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20" : "bg-emerald-500/15 text-emerald-400"}`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Roster checkbox list */}
        {eligSelectedTeam === null ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t.eligPickTeam}</div>
        ) : eligRosterLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t.eligRosterLoading}
          </div>
        ) : eligRoster.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t.eligNoRoster}</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                {eligDraft.length} / {eligRoster.length} {t.eligEligible}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setEligDraft(eligRoster.map((p) => p.id))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 transition-all">{t.eligSelectAll}</button>
                <button onClick={() => setEligDraft([])} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 border border-white/5 text-slate-300 transition-all">{t.eligClearAll}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {eligRoster.map((p) => {
                const checked = eligDraft.includes(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/50 border-white/5 hover:bg-slate-800"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEligPlayer(p.id)}
                      className="w-4 h-4 shrink-0 rounded accent-emerald-500"
                    />
                    <span className={`text-sm truncate ${checked ? "text-white font-medium" : "text-slate-300"}`}>{p.name}</span>
                  </label>
                );
              })}
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-3 pt-1 flex-wrap">
              {eligErrorFlag && <span className="text-xs text-red-400 mr-auto">{t.eligError}</span>}
              {eligDirty && !eligSaving && <span className="text-xs text-amber-400 mr-auto">{t.eligUnsaved}</span>}
              <button
                onClick={saveEligibility}
                disabled={!eligDirty || eligSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-600/30"
              >
                {eligSaving ? (
                  <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>{t.eligSaving}</span>
                ) : eligSavedFlash ? (
                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{t.eligSaved}</span>
                ) : t.eligSave}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Home Page Vote Banner ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-base shrink-0">🖼️</div>
          <div>
            <p className="text-sm font-bold text-white">
              {language === "fr" ? "Bannière d'accueil — Vote All-Star" : "Home Page Vote Banner"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === "fr"
                ? "Affichée dans le pop-up de vote sur la page d'accueil"
                : "Shown inside the vote promotion pop-up on the home page"}
            </p>
          </div>
        </div>

        {/* Dimension guide */}
        <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">📐</span>
          <div>
            <p className="text-xs font-bold text-amber-300">
              {language === "fr" ? "Dimensions recommandées pour le graphiste" : "Recommended dimensions for the graphic designer"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              <span className="font-mono font-bold text-white">1200 × 480 px</span>
              {" "}({language === "fr" ? "ratio 2.5:1, paysage large" : "2.5:1 ratio, wide landscape"})
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === "fr"
                ? "Format PNG ou JPG · Arrière-plan foncé recommandé pour s'intégrer au thème"
                : "PNG or JPG format · Dark background recommended to match the site theme"}
            </p>
          </div>
        </div>

        {/* Single banner card */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl overflow-hidden max-w-sm">
          {/* Preview at 2.5:1 */}
          <div className="relative bg-slate-900 flex items-center justify-center" style={{ aspectRatio: "2.5/1" }}>
            {homeBannerUrl ? (
              <Image src={homeBannerUrl} alt="Home banner" fill className="object-cover" sizes="384px" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600 select-none py-6">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5-5 4 4 3-3 6 6M14.5 8.5a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                <span className="text-xs font-medium">{language === "fr" ? "Aucune image" : "No image"}</span>
              </div>
            )}
            {(homeBannerUploading || homeBannerDeleting) && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <svg className="w-7 h-7 animate-spin text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs text-slate-300">
                  {homeBannerUploading
                    ? (language === "fr" ? "Import en cours…" : "Uploading…")
                    : (language === "fr" ? "Suppression…" : "Deleting…")}
                </span>
                {homeBannerUploading && (
                  <button
                    onClick={() => { abortCtrlRef.current?.abort(); abortCtrlRef.current = null; }}
                    className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs rounded-lg transition-colors"
                  >
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-3 flex gap-2">
            <button
              onClick={() => homeBannerInputRef.current?.click()}
              disabled={homeBannerUploading || homeBannerDeleting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 font-semibold text-xs rounded-xl transition-all disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {homeBannerUrl
                ? (language === "fr" ? "Remplacer" : "Replace")
                : (language === "fr" ? "Importer" : "Upload")}
            </button>
            {homeBannerUrl && (
              <button
                onClick={deleteHomeBanner}
                disabled={homeBannerUploading || homeBannerDeleting}
                title={language === "fr" ? "Supprimer l'image" : "Delete image"}
                className="px-2.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl transition-all disabled:opacity-40"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={homeBannerInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadHomeBanner(file);
                e.target.value = "";
              }}
            />
          </div>
          
          {/* Error message */}
          {homeBannerError && (
            <div className="px-3 pb-3">
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs text-red-300">{homeBannerError}</p>
                  <button
                    onClick={() => setHomeBannerError("")}
                    className="text-xs text-red-400 hover:text-red-300 underline mt-1"
                  >
                    {language === "fr" ? "Fermer" : "Dismiss"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.totalVoters}</p>
          <p className="text-3xl font-black text-orange-400 mt-1">{loading ? "—" : animVoters.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.totalVotes}</p>
          <p className="text-3xl font-black text-blue-400 mt-1">{loading ? "—" : animVotes.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.menNominees}</p>
          <p className="text-3xl font-black text-emerald-400 mt-1">{loading ? "—" : animMen}</p>
          <p className="text-xs text-slate-500 mt-0.5">{language === "fr" ? "candidats" : "nominees"}</p>
        </div>
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">{t.womenNominees}</p>
          <p className="text-3xl font-black text-purple-400 mt-1">{loading ? "—" : animWomen}</p>
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
        <button
          onClick={() => setShowVoterDetails(!showVoterDetails)}
          className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1 text-xs text-blue-400 font-semibold transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={showVoterDetails ? "M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 4v16m8-8H4"} />
          </svg>
          {showVoterDetails ? t.hideVoters : t.showVoters}
        </button>
        <span className="ml-auto text-xs text-slate-600 hidden sm:block">→ {language === "fr" ? "Analytique de profil" : "Profile analytics"}</span>
      </div>

      {/* ── Voter Details Table ── */}
      {showVoterDetails && (
        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/80 border-b border-white/5 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
              👥 {t.voterDetails}
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-semibold">
                {voterRoleFilter === "all" ? voterDetails.length : voterDetails.filter(v => v.voterRole === voterRoleFilter).length}
              </span>
            </h3>
            {/* Role filter pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(["all", "joueur", "staff", "fan"] as const).map((role) => {
                const label = role === "all" ? (language === "fr" ? "Tous" : "All") : role === "joueur" ? (language === "fr" ? "Joueur" : "Player") : role === "staff" ? "Staff" : "Fan";
                const active = voterRoleFilter === role;
                return (
                  <button
                    key={role}
                    onClick={() => setVoterRoleFilter(role)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                      active
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-slate-700/60 border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={voterSearch}
                onChange={(e) => setVoterSearch(e.target.value)}
                placeholder={t.searchVoters}
                className="w-full px-4 py-2 pl-10 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {voterSearch && (
                <button
                  onClick={() => setVoterSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  title={language === "fr" ? "Effacer la recherche" : "Clear search"}
                  aria-label={language === "fr" ? "Effacer la recherche" : "Clear search"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {(() => {
            // Filter voters by role then search query
            const searchLower = voterSearch.toLowerCase().trim();
            const roleFiltered = voterRoleFilter === "all"
              ? voterDetails
              : voterDetails.filter(v => v.voterRole === voterRoleFilter);
            const filteredVoters = searchLower
              ? roleFiltered.filter((voter) => {
                  const nameMatch    = voter.voterName.toLowerCase().includes(searchLower);
                  const contactMatch = voter.voterContact.toLowerCase().includes(searchLower);
                  const roleMatch    = voter.voterRole.toLowerCase().includes(searchLower);
                  const emailMatch   = voter.voterEmail.toLowerCase().includes(searchLower);
                  const menPlayersMatch   = voter.menPlayers.some(p => p.name.toLowerCase().includes(searchLower));
                  const womenPlayersMatch = voter.womenPlayers.some(p => p.name.toLowerCase().includes(searchLower));
                  return nameMatch || contactMatch || roleMatch || emailMatch || menPlayersMatch || womenPlayersMatch;
                })
              : roleFiltered;

            if (voterDetails.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                  <span className="text-3xl">👤</span>
                  <p className="text-sm">{t.noVoterData}</p>
                </div>
              );
            }

            if (filteredVoters.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm">{t.noSearchResults}</p>
                  <button
                    onClick={() => setVoterSearch("")}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    {language === "fr" ? "Effacer la recherche" : "Clear search"}
                  </button>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/60 border-b border-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400">#</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400">{t.voterName}</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400">{t.contact}</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400">{t.votedFor}</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400">{t.votedAt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVoters.map((voter, idx) => (
                      <tr key={voter.voterId} className="border-b border-white/5 hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{voter.voterName}</div>
                          {voter.voterRole && voter.voterRole !== "—" && (
                            <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 text-amber-400">{voter.voterRole}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          <div>{voter.voterContact}</div>
                          {voter.voterEmail && <div className="text-slate-500 text-[10px] mt-0.5">{voter.voterEmail}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {voter.menPlayers.length > 0 && (
                              <div className="text-xs">
                                <span className="text-blue-400 font-semibold">🏀 Hommes: </span>
                                <span className="text-slate-300">{voter.menPlayers.map(p => p.name).join(", ")}</span>
                              </div>
                            )}
                            {voter.womenPlayers.length > 0 && (
                              <div className="text-xs">
                                <span className="text-purple-400 font-semibold">🏀 Femmes: </span>
                                <span className="text-slate-300">{voter.womenPlayers.map(p => p.name).join(", ")}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {voter.votedAt ? voter.votedAt.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

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
                      {/* Name + headshot */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {entry.headshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.headshot}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full object-cover object-top shrink-0 bg-slate-700"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center text-xs font-black text-slate-400 shrink-0 select-none">
                              {entry.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className={`font-semibold ${isTop3 ? "text-white" : "text-slate-300"}`}>
                            {entry.name}
                          </span>
                        </div>
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

      {/* ── Player Investigation ── */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-xl shrink-0">🔍</div>
          <div>
            <p className="text-sm font-bold text-indigo-300 uppercase tracking-wide">
              {language === "fr" ? "Enquête sur un joueur" : "Player Investigation"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === "fr"
                ? "Détecte les votes suspects pour un joueur spécifique"
                : "Detect suspicious vote patterns for any player"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={investQuery}
            onChange={(e) => setInvestQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runInvestigation()}
            placeholder={language === "fr" ? "Nom du joueur (ex: David Mubenga)" : "Player name (e.g. David Mubenga)"}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          <button
            onClick={runInvestigation}
            disabled={investLoading || !investQuery.trim()}
            className="px-5 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 font-bold text-sm rounded-xl transition-all disabled:opacity-40"
          >
            {investLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : (language === "fr" ? "Analyser" : "Analyze")}
          </button>
        </div>

        {investError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{investError}</p>
        )}

        {investResult && (
          <div className="space-y-4">
            {/* Player match */}
            <div className="flex flex-wrap gap-2">
              {investResult.players.map((p) => (
                <span key={p.id} className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/25 rounded-full text-xs text-indigo-300 font-semibold">
                  {p.name} · {p.teamName}
                </span>
              ))}
            </div>

            {/* Verdict banner */}
            {(() => {
              const score =
                (investResult.maxBurstPerMinute >= 10 ? 3 : investResult.maxBurstPerMinute >= 5 ? 2 : investResult.maxBurstPerMinute >= 3 ? 1 : 0) +
                (investResult.phoneSequentialPct >= 60 ? 3 : investResult.phoneSequentialPct >= 30 ? 2 : investResult.phoneSequentialPct >= 15 ? 1 : 0) +
                (investResult.cloneRatio >= 60 ? 3 : investResult.cloneRatio >= 30 ? 2 : investResult.cloneRatio >= 15 ? 1 : 0) +
                (investResult.suspectAttempts >= 10 ? 2 : investResult.suspectAttempts >= 3 ? 1 : 0) +
                ((investResult.roles["fan"] ?? 0) / Math.max(investResult.totalVotes, 1) >= 0.95 ? 1 : 0);
              const verdict =
                score >= 7 ? { label: language === "fr" ? "TRICHE CONFIRMÉE" : "CONFIRMED CHEATING",   color: "bg-red-500/20 border-red-500/40 text-red-300",    icon: "🚨" } :
                score >= 4 ? { label: language === "fr" ? "TRÈS SUSPECT"     : "HIGHLY SUSPICIOUS",    color: "bg-orange-500/20 border-orange-500/40 text-orange-300", icon: "⚠️" } :
                score >= 2 ? { label: language === "fr" ? "SUSPECT"          : "SUSPICIOUS",           color: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300", icon: "🔶" } :
                             { label: language === "fr" ? "SEMBLE LÉGITIME"  : "APPEARS LEGITIMATE",   color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300", icon: "✅" };
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${verdict.color}`}>
                  <span className="text-2xl shrink-0">{verdict.icon}</span>
                  <div>
                    <p className="text-sm font-black tracking-wider">{verdict.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {language === "fr" ? `Score de suspicion : ${score}/12` : `Suspicion score: ${score}/12`}
                    </p>
                  </div>
                  <span className="ml-auto text-2xl font-black opacity-60">{investResult.totalVotes}</span>
                  <span className="text-xs opacity-60">{language === "fr" ? "votes" : "votes"}</span>
                </div>
              );
            })()}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  label: language === "fr" ? "Rafale max / min" : "Max burst / min",
                  value: String(investResult.maxBurstPerMinute),
                  sub: investResult.maxBurstWindow
                    ? `${investResult.maxBurstWindow.seconds}s window`
                    : "—",
                  bad: investResult.maxBurstPerMinute >= 5,
                },
                {
                  label: language === "fr" ? "N° séquentiels" : "Sequential phones",
                  value: `${investResult.phoneSequentialPct}%`,
                  sub: language === "fr" ? "de votes consécutifs" : "of votes in a row",
                  bad: investResult.phoneSequentialPct >= 30,
                },
                {
                  label: language === "fr" ? "Votes clonés" : "Clone votes",
                  value: `${investResult.cloneRatio}%`,
                  sub: `${investResult.topCloneCount} ${language === "fr" ? "identiques" : "identical"}`,
                  bad: investResult.cloneRatio >= 30,
                },
                {
                  label: language === "fr" ? "Tentatives bloquées" : "Blocked attempts",
                  value: String(investResult.suspectAttempts),
                  sub: language === "fr" ? "dans le journal" : "in suspect log",
                  bad: investResult.suspectAttempts >= 5,
                },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl border p-3 ${stat.bad ? "bg-red-500/10 border-red-500/25" : "bg-slate-800/50 border-white/5"}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className={`text-xl font-black mt-0.5 ${stat.bad ? "text-red-400" : "text-white"}`}>{stat.value}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Votes by hour */}
            {Object.keys(investResult.votesByHour).length > 0 && (
              <div className="rounded-xl border border-white/5 bg-slate-800/30 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                  {language === "fr" ? "Votes par heure" : "Votes by hour"}
                </p>
                <div className="space-y-1">
                  {Object.entries(investResult.votesByHour).sort(([a], [b]) => a.localeCompare(b)).map(([hour, count]) => {
                    const maxHour = Math.max(...Object.values(investResult.votesByHour));
                    const pct = Math.round((count / maxHour) * 100);
                    return (
                      <div key={hour} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-14 shrink-0">{hour.slice(5, 16)}</span>
                        <div className="flex-1 h-3 bg-slate-700/50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${count >= 20 ? "bg-red-500" : count >= 10 ? "bg-orange-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-black w-8 text-right tabular-nums ${count >= 20 ? "text-red-400" : count >= 10 ? "text-orange-400" : "text-slate-400"}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent votes sample */}
            <div className="rounded-xl border border-white/5 overflow-hidden">
              <div className="px-3 py-2 bg-slate-800/60 border-b border-white/5">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                  {language === "fr" ? "30 derniers votes pour ce joueur" : "Last 30 votes for this player"}
                </p>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {investResult.recentVotes.slice().reverse().map((v, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-white/[0.02]">
                    <span className="font-mono text-slate-400 shrink-0">{v.phone}</span>
                    <span className="text-slate-300 truncate flex-1">{v.name}</span>
                    <span className="text-slate-600 shrink-0">{v.role}</span>
                    <span className="text-slate-600 shrink-0 whitespace-nowrap">
                      {v.submittedAt ? new Date(v.submittedAt).toLocaleString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suspect log entries */}
            {investResult.suspectDetails.length > 0 && (
              <div className="rounded-xl border border-red-500/20 overflow-hidden">
                <div className="px-3 py-2 bg-red-950/40 border-b border-red-500/15">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-red-400">
                    {language === "fr" ? "Tentatives bloquées liées" : "Related blocked attempts"}
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-white/5">
                  {investResult.suspectDetails.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <span className="font-mono text-red-300 shrink-0">{s.ip}</span>
                      <span className="text-orange-400 font-bold shrink-0">{s.reason}</span>
                      <span className="text-slate-400 truncate flex-1">{s.name} {s.phone}</span>
                      <span className="text-slate-600 shrink-0 whitespace-nowrap">
                        {s.detectedAt ? new Date(s.detectedAt).toLocaleString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Danger Zone ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-base shrink-0">⚠️</div>
          <div>
            <p className="text-sm font-bold text-red-400">{language === "fr" ? "Zone dangereuse" : "Danger Zone"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{language === "fr" ? "Actions irréversibles — procéder avec précaution" : "Irreversible actions — proceed with caution"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Reset all votes */}
          <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🗑️</span>
              <div>
                <p className="text-sm font-bold text-red-300">{language === "fr" ? "Réinitialiser tous les votes" : "Reset All Votes"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === "fr"
                    ? "Supprime tous les bulletins, remet les compteurs à 0 et efface le classement. Action irréversible."
                    : "Deletes every ballot, resets all vote counts to 0, and clears the leaderboard. Cannot be undone."}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowResetModal(true); setResetPwd1(""); setResetPwd2(""); setResetCountdown(null); setResetError(""); setResetSuccess(false); }}
              className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold text-sm rounded-xl transition-all"
            >
              {language === "fr" ? "Commencer la procédure" : "Start Reset Procedure"}
            </button>
          </div>

          {/* Reset banner activity */}
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🔔</span>
              <div>
                <p className="text-sm font-bold text-amber-300">{language === "fr" ? "Réinitialiser l'activité bannière" : "Reset Banner Activity"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === "fr"
                    ? "La bannière sera à nouveau affichée 3 fois pour tous les visiteurs qui ne l'ont pas encore vue."
                    : "The banner will be shown 3 more times to all visitors, as if they had never seen it."}
                </p>
              </div>
            </div>
            <button
              onClick={resetBannerActivity}
              disabled={resettingBanner}
              className="w-full py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 font-bold text-sm rounded-xl transition-all disabled:opacity-40"
            >
              {resettingBanner ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {language === "fr" ? "Réinitialisation…" : "Resetting…"}
                </span>
              ) : bannerResetSuccess ? (
                <span className="flex items-center justify-center gap-2 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {language === "fr" ? "Réinitialisé !" : "Reset!"}
                </span>
              ) : (language === "fr" ? "Réinitialiser la bannière" : "Reset Banner")}
            </button>
          </div>
        </div>

        {/* ── Clean up fake votes ── */}
        <div className="bg-orange-950/30 border border-orange-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🤖</span>
            <div>
              <p className="text-sm font-bold text-orange-300">
                {language === "fr" ? "Supprimer les faux votes (bots)" : "Remove Fake Votes (Bots)"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {language === "fr"
                  ? "Détecte les votes incomplets (< 15 joueurs) ET les votes clonés identiques soumis en rafale. Les vrais votes sont conservés."
                  : "Detects incomplete ballots (< 15 players) AND clone votes with identical selections submitted in bursts. Real votes are kept."}
              </p>
            </div>
          </div>

          {cleanupError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{cleanupError}</p>
          )}

          {cleanupResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <p className="text-xs text-emerald-300 font-semibold">
                  {language === "fr"
                    ? `${cleanupResult.deleted} votes supprimés (${cleanupResult.deletedFake} incomplets + ${cleanupResult.deletedDupPlayer} joueur×15 + ${cleanupResult.deletedClone} clonés) — ${cleanupResult.remaining} votes valides conservés.`
                    : `${cleanupResult.deleted} votes deleted (${cleanupResult.deletedFake} incomplete + ${cleanupResult.deletedDupPlayer} player×15 + ${cleanupResult.deletedClone} clones) — ${cleanupResult.remaining} real votes kept.`}
                </p>
              </div>
            </div>
          )}

          {cleanupPreview && !cleanupResult && (
            <div className="space-y-3">

              {/* ── Fake votes (incomplete) row ── */}
              <div className="rounded-xl border border-orange-500/20 overflow-hidden">
                <div className="flex items-center gap-2 bg-orange-950/40 border-b border-orange-500/15 px-3 py-2">
                  <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <p className="text-xs text-orange-300 font-semibold flex-1">
                    {language === "fr"
                      ? `${cleanupPreview.fakeCount} votes incomplets (< 15 joueurs)`
                      : `${cleanupPreview.fakeCount} incomplete ballots (< 15 players)`}
                  </p>
                  {cleanupPreview.fake.length > 0 && (
                    <button
                      onClick={() => setShowFakeList((v) => !v)}
                      className="shrink-0 text-xs text-orange-400 underline hover:text-orange-200 transition-colors"
                    >
                      {showFakeList
                        ? (language === "fr" ? "Masquer" : "Hide")
                        : (language === "fr" ? "Voir" : "View")}
                    </button>
                  )}
                </div>
                {showFakeList && cleanupPreview.fake.length > 0 && (
                  <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                    {cleanupPreview.fake.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-white/[0.03]">
                        <span className="text-slate-300 font-medium truncate flex-1">{v.name || "—"}</span>
                        <span className="text-slate-500 font-mono shrink-0">{v.phone}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold tabular-nums ${v.men < 15 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          ♂ {v.men}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold tabular-nums ${v.women < 15 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          ♀ {v.women}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {cleanupPreview.fakeCount === 0 && (
                  <p className="text-xs text-slate-500 px-3 py-2">{language === "fr" ? "Aucun vote incomplet." : "None found."}</p>
                )}
              </div>

              {/* ── Duplicate-player votes (same player ×15) row ── */}
              <div className="rounded-xl border border-red-500/35 overflow-hidden">
                <div className="flex items-center gap-2 bg-red-950/50 border-b border-red-500/20 px-3 py-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <p className="text-xs text-red-400 font-semibold flex-1">
                    {language === "fr"
                      ? `${cleanupPreview.dupPlayerCount} votes avec joueur dupliqué ×15 (exploit bot)`
                      : `${cleanupPreview.dupPlayerCount} ballots with player ×15 (bot exploit)`}
                  </p>
                  {cleanupPreview.dupPlayers.length > 0 && (
                    <button
                      onClick={() => setShowDupList((v) => !v)}
                      className="shrink-0 text-xs text-red-400 underline hover:text-red-200 transition-colors"
                    >
                      {showDupList
                        ? (language === "fr" ? "Masquer" : "Hide")
                        : (language === "fr" ? "Voir" : "View")}
                    </button>
                  )}
                </div>
                {showDupList && cleanupPreview.dupPlayers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                    {cleanupPreview.dupPlayers.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="flex-1 text-slate-300 truncate">{v.name}</span>
                        <span className="text-slate-500 shrink-0">{v.phone}</span>
                        {v.menDups > 0 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded font-bold tabular-nums bg-red-500/15 text-red-400">
                            ♂ {v.menDups} dup
                          </span>
                        )}
                        {v.womenDups > 0 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded font-bold tabular-nums bg-red-500/15 text-red-400">
                            ♀ {v.womenDups} dup
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {cleanupPreview.dupPlayerCount === 0 && (
                  <p className="text-xs text-slate-500 px-3 py-2">{language === "fr" ? "Aucun exploit joueur×15 détecté." : "No player×15 exploit found."}</p>
                )}
              </div>

              {/* ── Clone votes (identical burst) row ── */}
              <div className="rounded-xl border border-red-500/25 overflow-hidden">
                <div className="flex items-center gap-2 bg-red-950/40 border-b border-red-500/15 px-3 py-2">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  <p className="text-xs text-red-300 font-semibold flex-1">
                    {language === "fr"
                      ? `${cleanupPreview.cloneCount} votes clonés en ${cleanupPreview.cloneGroups.length} groupe${cleanupPreview.cloneGroups.length !== 1 ? "s" : ""}`
                      : `${cleanupPreview.cloneCount} clone votes in ${cleanupPreview.cloneGroups.length} group${cleanupPreview.cloneGroups.length !== 1 ? "s" : ""}`}
                  </p>
                  {cleanupPreview.cloneGroups.length > 0 && (
                    <button
                      onClick={() => setShowCloneList((v) => !v)}
                      className="shrink-0 text-xs text-red-400 underline hover:text-red-200 transition-colors"
                    >
                      {showCloneList
                        ? (language === "fr" ? "Masquer" : "Hide")
                        : (language === "fr" ? "Voir" : "View")}
                    </button>
                  )}
                </div>

                {showCloneList && cleanupPreview.cloneGroups.length > 0 && (
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                    {cleanupPreview.cloneGroups.map((g, gi) => (
                      <div key={gi} className="px-3 py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-red-400">
                            {language === "fr" ? `Groupe ${gi + 1}` : `Group ${gi + 1}`}
                          </span>
                          <span className="text-xs bg-red-500/15 border border-red-500/25 text-red-300 font-bold px-2 py-0.5 rounded-full">
                            {g.count} {language === "fr" ? "votes identiques" : "identical votes"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {language === "fr" ? "en" : "in"} {Math.round(g.windowMs / 1000)}s
                          </span>
                        </div>
                        {/* Sample phones */}
                        <div className="flex flex-wrap gap-1">
                          {g.sampleVotes.map((sv) => (
                            <span key={sv.id} className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-white/5">
                              {sv.phone}
                            </span>
                          ))}
                          {g.count > g.sampleVotes.length && (
                            <span className="text-[10px] text-slate-600 px-1.5 py-0.5">+{g.count - g.sampleVotes.length} {language === "fr" ? "autres" : "more"}</span>
                          )}
                        </div>
                        {/* Sample players they all voted for */}
                        {g.sampleMen.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-blue-400 font-semibold shrink-0">♂</span>
                            {g.sampleMen.map((pid) => (
                              <span key={pid} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/15">
                                {playerMapState[pid]?.name ?? pid}
                              </span>
                            ))}
                            {g.sampleMen.length < 15 && <span className="text-[10px] text-slate-600">…</span>}
                          </div>
                        )}
                        {g.sampleWomen.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-purple-400 font-semibold shrink-0">♀</span>
                            {g.sampleWomen.map((pid) => (
                              <span key={pid} className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/15">
                                {playerMapState[pid]?.name ?? pid}
                              </span>
                            ))}
                            {g.sampleWomen.length < 15 && <span className="text-[10px] text-slate-600">…</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {cleanupPreview.cloneCount === 0 && (
                  <p className="text-xs text-slate-500 px-3 py-2">{language === "fr" ? "Aucun vote cloné détecté." : "No clone votes detected."}</p>
                )}
              </div>

              {/* ── Summary + action buttons ── */}
              {(cleanupPreview.fakeCount + cleanupPreview.dupPlayerCount + cleanupPreview.cloneCount === 0) ? (
                <p className="text-center text-xs text-emerald-400 py-2">
                  {language === "fr" ? "Aucun vote suspect détecté. La base est propre." : "No suspicious votes found. Database is clean."}
                </p>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCleanupPreview(null); setShowFakeList(false); setShowCloneList(false); }}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    {language === "fr" ? "Annuler" : "Cancel"}
                  </button>
                  <button
                    onClick={deleteFakeVotes}
                    disabled={cleanupRunning}
                    className="flex-1 py-2 bg-red-700/30 hover:bg-red-700/50 border border-red-500/40 text-red-300 font-bold text-xs rounded-xl transition-all disabled:opacity-40"
                  >
                    {cleanupRunning ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {language === "fr" ? "Suppression…" : "Deleting…"}
                      </span>
                    ) : (
                      language === "fr"
                        ? `Supprimer ${cleanupPreview.fakeCount + cleanupPreview.dupPlayerCount + cleanupPreview.cloneCount} votes`
                        : `Delete ${cleanupPreview.fakeCount + cleanupPreview.dupPlayerCount + cleanupPreview.cloneCount} votes`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {!cleanupPreview && !cleanupResult && (
            <button
              onClick={scanFakeVotes}
              disabled={cleanupScanning}
              className="w-full py-2.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-400 font-bold text-sm rounded-xl transition-all disabled:opacity-40"
            >
              {cleanupScanning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {language === "fr" ? "Analyse en cours…" : "Scanning…"}
                </span>
              ) : (language === "fr" ? "Analyser et supprimer les faux votes" : "Scan & Remove Fake Votes")}
            </button>
          )}
        </div>
      </div>

      {/* ── Reset Votes Modal ── */}
      {showResetModal && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={() => !resetRunning && setShowResetModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto z-50">
            <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-white/5 bg-red-950/30">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <h3 className="text-lg font-black text-red-300">
                    {language === "fr" ? "Réinitialisation des votes" : "Reset All Votes"}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {language === "fr"
                    ? "Cette action supprimera DÉFINITIVEMENT tous les bulletins et remettra les compteurs à zéro. Elle ne peut pas être annulée."
                    : "This will PERMANENTLY delete every ballot and reset all vote counts to zero. This cannot be undone."}
                </p>
              </div>

              <div className="p-6 space-y-5">
                {resetSuccess ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-emerald-400 font-bold">{language === "fr" ? "Votes réinitialisés avec succès." : "Votes reset successfully."}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {language === "fr" ? "Étape 1 — Entrez votre mot de passe deux fois" : "Step 1 — Enter your password twice"}
                      </p>
                      <input
                        type="password"
                        value={resetPwd1}
                        onChange={(e) => setResetPwd1(e.target.value)}
                        placeholder={language === "fr" ? "Mot de passe" : "Password"}
                        disabled={resetRunning}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      />
                      <input
                        type="password"
                        value={resetPwd2}
                        onChange={(e) => setResetPwd2(e.target.value)}
                        placeholder={language === "fr" ? "Répétez le mot de passe" : "Repeat password"}
                        disabled={resetRunning}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      />
                      {resetPwd1.length > 0 && resetPwd2.length > 0 && (
                        <p className={`text-xs font-semibold flex items-center gap-1.5 ${pwdMatch ? "text-emerald-400" : "text-red-400"}`}>
                          <span>{pwdMatch ? "✓" : "✗"}</span>
                          {pwdMatch
                            ? (language === "fr" ? "Mots de passe identiques — minuterie lancée" : "Passwords match — timer started")
                            : (language === "fr" ? "Les mots de passe ne correspondent pas" : "Passwords do not match")}
                        </p>
                      )}
                    </div>

                    {resetCountdown !== null && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {language === "fr" ? "Étape 2 — Délai de sécurité (5 min)" : "Step 2 — Security wait (5 min)"}
                        </p>
                        {resetCountdown > 0 ? (
                          <div className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                            </svg>
                            <div>
                              <p className="text-xl font-black text-amber-400 tabular-nums">
                                {String(Math.floor(resetCountdown / 60)).padStart(2, "0")}:{String(resetCountdown % 60).padStart(2, "0")}
                              </p>
                              <p className="text-xs text-slate-500">
                                {language === "fr" ? "Temps restant avant autorisation" : "Time remaining before deletion is allowed"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span>✓</span>
                            {language === "fr" ? "Délai écoulé — vous pouvez maintenant confirmer." : "Wait complete — you may now confirm."}
                          </p>
                        )}
                      </div>
                    )}

                    {resetError && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{resetError}</p>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setShowResetModal(false)}
                        disabled={resetRunning}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all disabled:opacity-40"
                      >
                        {language === "fr" ? "Annuler" : "Cancel"}
                      </button>
                      <button
                        onClick={resetAllVotes}
                        disabled={!pwdMatch || resetCountdown !== 0 || resetRunning}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-xl transition-all shadow-lg shadow-red-600/30"
                      >
                        {resetRunning ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            {language === "fr" ? "Suppression…" : "Deleting…"}
                          </span>
                        ) : (language === "fr" ? "Supprimer définitivement" : "Delete Permanently")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
