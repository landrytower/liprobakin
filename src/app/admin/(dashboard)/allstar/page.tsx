"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import type { UploadTask } from "firebase/storage";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { firebaseDB, firebaseStorage } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { useAdmin } from "../layout";

type Category = "menPlayers" | "womenPlayers";
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

type VoterDetail = {
  voterId: string;
  voterName: string;
  voterContact: string;
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
  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [allStarTheme, setAllStarTheme] = useState(false);
  const [togglingTheme, setTogglingTheme] = useState(false);
  const [showVoterDetails, setShowVoterDetails] = useState(false);
  const [voterSearch, setVoterSearch] = useState("");
  const [voterDetails, setVoterDetails] = useState<VoterDetail[]>([]);
  const [results, setResults] = useState<Results>({
    menPlayers: [], womenPlayers: [],
  });
  const [homeBannerUrl, setHomeBannerUrl] = useState("");
  const [homeBannerUploading, setHomeBannerUploading] = useState(false);
  const [homeBannerDeleting, setHomeBannerDeleting] = useState(false);
  const [homeBannerError, setHomeBannerError] = useState("");
  const homeBannerInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const now = Date.now();
    const ONE_DAY = 86_400_000;

    // 1. Aggregate all votes
    const votesSnap = await getDocs(collection(firebaseDB, "allStarVotes"));
    const voterCount = votesSnap.size;
    setTotalVoters(voterCount);

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

    // Category totals for % of category
    const catTotals: Record<Category, number> = {
      menPlayers:   Object.values(counts.menPlayers).reduce((a, b) => a + b, 0),
      womenPlayers: Object.values(counts.womenPlayers).reduce((a, b) => a + b, 0),
    };

    // 2. Build name/team lookup from rosters
    const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
    const playerMap: Record<string, { name: string; teamName: string }> = {};

    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const td = teamDoc.data();
        const teamName = [td.city, td.name].filter(Boolean).join(" ");
        const rosterSnap = await getDocs(collection(firebaseDB, "teams", teamDoc.id, "roster"));
        for (const p of rosterSnap.docs) {
          const pd = p.data();
          playerMap[p.id] = {
            name: `${pd.firstName || ""} ${pd.lastName || ""}`.trim() || pd.name || p.id,
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

    const computedMen   = resolve(counts.menPlayers,   todayCounts.menPlayers,   playerMap, catTotals.menPlayers);
    const computedWomen = resolve(counts.womenPlayers,  todayCounts.womenPlayers, playerMap, catTotals.womenPlayers);
    setResults({ menPlayers: computedMen, womenPlayers: computedWomen });

    // Write a denormalised leaders snapshot so the vote page can display instantly
    try {
      await setDoc(doc(firebaseDB, "allStarLeaders", "snapshot"), {
        men:   computedMen.slice(0, 15).map(({ id, name, teamName, votes }) => ({ id, name, teamName, votes })),
        women: computedWomen.slice(0, 15).map(({ id, name, teamName, votes }) => ({ id, name, teamName, votes })),
        lastUpdated: new Date(),
      });
    } catch { /* non-critical */ }

    // 4. Fetch voter details with user profiles
    const voterDetailsData: VoterDetail[] = [];
    for (const voteDoc of votesSnap.docs) {
      const voteData = voteDoc.data();
      const voterId = voteDoc.id;
      
      // Fetch user profile
      try {
        const userDoc = await getDoc(doc(firebaseDB, "users", voterId));
        const userData = userDoc.exists() ? userDoc.data() : null;
        
        const menPlayerIds = (voteData.menPlayers || []) as string[];
        const womenPlayerIds = (voteData.womenPlayers || []) as string[];
        
        voterDetailsData.push({
          voterId,
          voterName: userData 
            ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Unknown"
            : "Unknown",
          voterContact: userData?.phoneNumber || userData?.email || "—",
          menPlayers: menPlayerIds.map(id => ({ id, name: playerMap[id]?.name || id })),
          womenPlayers: womenPlayerIds.map(id => ({ id, name: playerMap[id]?.name || id })),
          votedAt: (voteData.lastModified as Timestamp | undefined)?.toDate?.() || null,
        });
      } catch (error) {
        console.error(`Failed to fetch user profile for ${voterId}:`, error);
      }
    }
    setVoterDetails(voterDetailsData.sort((a, b) => 
      (b.votedAt?.getTime() || 0) - (a.votedAt?.getTime() || 0)
    ));

    setLastRefreshed(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getDoc(doc(firebaseDB, "settings", "allStarBanner"))
      .then((snap) => { if (snap.exists() && snap.data().url) setHomeBannerUrl(snap.data().url as string); })
      .catch(() => {});
  }, []);

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

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const blob = await compressBannerImage(file).catch(() => file);

      const sRef = storageRef(firebaseStorage, "allstar-banners/home-banner");
      const task = uploadBytesResumable(sRef, blob, { contentType: "image/jpeg" });
      uploadTaskRef.current = task;

      await new Promise<void>((resolve, reject) => {
        timeoutId = setTimeout(() => {
          task.cancel();
          reject(new Error("timeout"));
        }, 60_000);
        task.on("state_changed", null, reject, resolve);
      });

      uploadTaskRef.current = null;
      const url = await getDownloadURL(sRef);
      await setDoc(doc(firebaseDB, "settings", "allStarBanner"), { url });
      setHomeBannerUrl(url);
    } catch (err: unknown) {
      uploadTaskRef.current = null;
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "storage/cancelled") return;
      const isTimeout = err instanceof Error && err.message === "timeout";
      console.error("Banner upload failed:", err);
      setHomeBannerError(
        isTimeout
          ? (language === "fr" ? "Délai dépassé — veuillez réessayer." : "Upload timed out — please try again.")
          : (language === "fr" ? "Échec de l'import — veuillez réessayer." : "Upload failed — please try again.")
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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
                    onClick={() => { uploadTaskRef.current?.cancel(); uploadTaskRef.current = null; }}
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
          <div className="px-4 py-3 bg-slate-800/80 border-b border-white/5 flex items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              👥 {t.voterDetails}
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-semibold">
                {voterDetails.length}
              </span>
            </h3>
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
            // Filter voters based on search query
            const searchLower = voterSearch.toLowerCase().trim();
            const filteredVoters = searchLower
              ? voterDetails.filter((voter) => {
                  const nameMatch = voter.voterName.toLowerCase().includes(searchLower);
                  const contactMatch = voter.voterContact.toLowerCase().includes(searchLower);
                  const menPlayersMatch = voter.menPlayers.some(p => p.name.toLowerCase().includes(searchLower));
                  const womenPlayersMatch = voter.womenPlayers.some(p => p.name.toLowerCase().includes(searchLower));
                  return nameMatch || contactMatch || menPlayersMatch || womenPlayersMatch;
                })
              : voterDetails;

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
                        <td className="px-4 py-3 text-white font-medium">{voter.voterName}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{voter.voterContact}</td>
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
