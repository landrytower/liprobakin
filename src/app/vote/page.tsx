"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender, type TeamGender } from "@/lib/team-gender";

const MAX_PLAYERS = 30;

const tr = {
  en: {
    title: "All-Star Vote",
    men: "Men",
    women: "Women",
    players: "Players",
    selected: "selected",
    yourTeam: "Your All-Star Team",
    voteLeaders: "Vote Leaders",
    myVote: "My Vote",
    submit: "Submit Vote",
    update: "Update Vote",
    submitting: "Submitting...",
    success: "Vote submitted!",
    loading: "Loading players...",
    instructions: "Search and select up to 30 players for your All-Star team.",
    searchPlaceholder: "Search a player…",
    remove: "Remove",
    votes: "votes",
    topPlayers: "Top 15 Players",
    rank: "Rank",
  },
  fr: {
    title: "Vote All-Star",
    men: "Hommes",
    women: "Femmes",
    players: "Joueurs",
    selected: "sélectionnés",
    yourTeam: "Votre équipe All-Star",
    voteLeaders: "Leaders des votes",
    myVote: "Mon vote",
    submit: "Soumettre le vote",
    update: "Modifier le vote",
    submitting: "Envoi en cours...",
    success: "Vote soumis!",
    loading: "Chargement des joueurs...",
    instructions: "Recherchez et sélectionnez jusqu'à 30 joueurs pour votre équipe All-Star.",
    searchPlaceholder: "Chercher un joueur…",
    remove: "Retirer",
    votes: "votes",
    topPlayers: "Top 15 joueurs",
    rank: "Rang",
  },
};

type PlayerEntry = {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  headshot?: string;
  position?: string;
};

type TeamEntry = {
  id: string;
  name: string;
  city: string;
  gender: TeamGender;
};

const PersonPlaceholder = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    fill="currentColor"
    viewBox="0 0 24 24"
    className="text-slate-600"
  >
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
);

export default function VotePage() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const t = tr[language];

  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);

  // Check if All-Star voting is enabled
  useEffect(() => {
    const checkSetting = async () => {
      const settingsDoc = await getDoc(doc(firebaseDB, "settings", "allStar"));
      if (settingsDoc.exists()) {
        setAllStarEnabled(settingsDoc.data().enabled ?? true);
      }
      setCheckingSettings(false);
    };
    checkSetting();
  }, []);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/vote/auth");
    }
  }, [user, authLoading, router]);

  const getVoterId = () => {
    if (user?.uid) return user.uid;
    return "";
  };

  const [gender, setGender] = useState<TeamGender>("men");
  const [viewMode, setViewMode] = useState<"vote" | "leaders">("vote");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<string, number>>>({});

  const [selectedPlayers, setSelectedPlayers] = useState<Record<TeamGender, string[]>>({
    men: [],
    women: [],
  });

  const [barsVisible, setBarsVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch all teams once
  useEffect(() => {
    getDocs(collection(firebaseDB, "teams")).then((snap) => {
      const list: TeamEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          city: data.city || "",
          gender: normalizeTeamGender(data.gender, data.logo, "men"),
        };
      });
      setTeams(list);
    });
  }, []);

  // Fetch rosters when gender or teams change
  useEffect(() => {
    if (!teams.length) return;
    const genderTeams = teams.filter((tm) => tm.gender === gender);
    setLoading(true);
    setPlayers([]);

    Promise.all(
      genderTeams.map(async (team) => {
        const displayName = [team.city, team.name].filter(Boolean).join(" ");
        const rosterSnap = await getDocs(collection(firebaseDB, "teams", team.id, "roster"));
        const teamPlayers: PlayerEntry[] = rosterSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            teamId: team.id,
            teamName: displayName,
            name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.name || "Unknown",
            headshot: data.headshot,
            position: data.position,
          };
        });
        return teamPlayers;
      })
    ).then((results) => {
      const allPlayers = results.flat().sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(allPlayers);
      setLoading(false);
    });
  }, [teams, gender]);

  // Fetch aggregated vote counts
  useEffect(() => {
    Promise.all(
      ["menPlayers", "womenPlayers"].map(async (cat) => {
        const d = await getDoc(doc(firebaseDB, "allStarVoteResults", cat));
        return [cat, d.exists() ? (d.data() as Record<string, number>) : {}] as const;
      })
    ).then((entries) => setVoteCounts(Object.fromEntries(entries)));
  }, []);

  // Load existing votes (works for both authed and anon users)
  useEffect(() => {
    const voterId = getVoterId();
    getDoc(doc(firebaseDB, "allStarVotes", voterId)).then((d) => {
      if (d.exists()) {
        const data = d.data();
        setHasVoted(true);
        setSelectedPlayers({ men: data.menPlayers || [], women: data.womenPlayers || [] });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Trigger bar animations when leaders view becomes active
  useEffect(() => {
    if (viewMode === "leaders") {
      const t = setTimeout(() => setBarsVisible(true), 150);
      return () => clearTimeout(t);
    } else {
      setBarsVisible(false);
    }
  }, [viewMode, gender]);

  // Pre-population removed - users start with empty team

  const triggerShake = (id: string) => {
    setShakeId(id);
    setTimeout(() => setShakeId(null), 500);
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      const cur = prev[gender];
      if (cur.includes(id)) return { ...prev, [gender]: cur.filter((x) => x !== id) };
      if (cur.length >= MAX_PLAYERS) { triggerShake(id); return prev; }
      return { ...prev, [gender]: [...cur, id] };
    });
  };

  const removePlayer = (id: string) => {
    setSelectedPlayers((prev) => ({
      ...prev,
      [gender]: prev[gender].filter((x) => x !== id),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const voterId = getVoterId();
      await setDoc(doc(firebaseDB, "allStarVotes", voterId), {
        menPlayers: selectedPlayers.men,
        womenPlayers: selectedPlayers.women,
        lastModified: serverTimestamp(),
        ...(hasVoted ? {} : { submittedAt: serverTimestamp() }),
      });
      setHasVoted(true);
      setSuccessMsg(t.success);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const curPlayers = selectedPlayers[gender];
  const playerVotes = voteCounts[gender === "men" ? "menPlayers" : "womenPlayers"] || {};

  // Leaders view — podium data
  const rankedLeaders = players
    .map((p) => ({ ...p, voteCount: playerVotes[p.id] || 0 }))
    .filter((p) => p.voteCount > 0)
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 10);
  const leaderTopVotes = rankedLeaders[0]?.voteCount ?? 1;
  // Podium order: #2 left, #1 centre, #3 right
  const podiumOrder = [rankedLeaders[1], rankedLeaders[0], rankedLeaders[2]].filter(
    (p): p is (typeof rankedLeaders)[0] => Boolean(p),
  );
  const restLeaders = rankedLeaders.slice(3);

  const q = search.toLowerCase().trim();
  // Search results: only show when query is non-empty
  const searchResults = q
    ? players
        .filter((p) => !curPlayers.includes(p.id))
        .filter((p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q))
        .slice(0, 12)
    : [];

  // Show nothing while auth resolves (redirect effect fires if not logged in)
  if (authLoading || !user || checkingSettings) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    );
  }

  // Show "not available" message if All-Star voting is disabled
  if (!allStarEnabled) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                {t.title}
              </h1>
            </div>
            <div className="w-8" />
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {language === "fr" ? "Vote All-Star non disponible" : "All-Star Voting Unavailable"}
          </h2>
          <p className="text-slate-400 mb-8">
            {language === "fr" 
              ? "Le vote All-Star n'est pas actuellement disponible. Veuillez revenir plus tard." 
              : "All-Star voting is not currently available. Please check back later."}
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {language === "fr" ? "Retour à l'accueil" : "Back to Home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      {/* ── Navbar ── */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex items-center gap-2">
            <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              {t.title}
            </h1>
          </div>

          {/* Gender tabs */}
          <div className="flex gap-1.5">
            {(["men", "women"] as TeamGender[]).map((g) => (
              <button
                key={g}
                onClick={() => { setGender(g); setSearch(""); }}
                className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all ${
                  gender === g ? "bg-emerald-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                {g === "men" ? t.men : t.women}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── View Mode Tabs ── */}
      <div className="sticky top-[61px] z-10 bg-slate-950/95 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-2 py-3">
            <button
              onClick={() => setViewMode("vote")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === "vote"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {t.myVote}
            </button>
            <button
              onClick={() => setViewMode("leaders")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === "leaders"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              🏆 {t.voteLeaders}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 pb-6 space-y-5">

        {viewMode === "vote" ? (
          <>
        {/* ── Player search ── */}
        <section ref={searchRef} className="relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg text-emerald-400">{t.yourTeam}</h2>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 transition-all duration-300 hover:scale-105">
              {curPlayers.length}/{MAX_PLAYERS} {t.selected}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">{t.instructions}</p>

          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-9 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" title="Clear search">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {searchFocused && q && searchResults.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-96 overflow-y-auto animate-scale-in">
              <div className="px-3 py-1.5 text-[10px] uppercase text-slate-500 tracking-widest border-b border-white/5 sticky top-0 bg-slate-800 backdrop-blur">
                {t.players}
              </div>
              {searchResults.map((player) => {
                const voteCount = playerVotes[player.id] || 0;
                const isSelected = curPlayers.includes(player.id);
                return (
                  <button
                    key={player.id}
                    onMouseDown={() => { togglePlayer(player.id); setSearch(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 hover:scale-[1.02] transition-all text-left ${isSelected ? "opacity-50" : ""} ${shakeId === player.id ? "animate-shake" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden relative shrink-0 flex items-center justify-center ring-2 ring-transparent group-hover:ring-emerald-500/50 transition-all">
                      {player.headshot
                        ? <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="36px" />
                        : <PersonPlaceholder size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                      <p className="text-xs text-slate-400 truncate">{player.teamName}</p>
                    </div>
                    {voteCount > 0 && (
                      <span className="text-xs text-orange-400 font-bold shrink-0 px-2 py-0.5 rounded-full bg-orange-400/10">{voteCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {/* Selected players list */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t.loading}
            </div>
          ) : curPlayers.length > 0 ? (
            <div className="space-y-2 mt-4">
              {curPlayers.map((playerId, idx) => {
                const player = players.find((p) => p.id === playerId);
                if (!player) return null;
                const voteCount = playerVotes[player.id] || 0;
                return (
                  <div
                    key={playerId}
                    className="flex items-center gap-3 bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-white/10 rounded-xl p-3 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 animate-slide-in hover:scale-[1.02]"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600/20 to-blue-600/20 overflow-hidden relative shrink-0 flex items-center justify-center ring-2 ring-emerald-500/20 group-hover:ring-emerald-500/50 transition-all">
                      {player.headshot
                        ? <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="40px" />
                        : <PersonPlaceholder size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        <span className="inline-block w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 text-xs leading-6 text-center mr-2 font-bold">{idx + 1}</span>
                        {player.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate ml-8">{player.teamName}</p>
                    </div>
                    {voteCount > 0 && (
                      <span className="text-xs text-orange-400 font-bold shrink-0 px-2 py-1 rounded-full bg-orange-400/10 border border-orange-400/20">{voteCount}</span>
                    )}
                    <button
                      onClick={() => removePlayer(playerId)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg p-1.5 transition-all hover:scale-110 active:scale-95 shrink-0"
                      title={t.remove}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              {language === "fr" ? "Aucun joueur sélectionné" : "No players selected"}
            </div>
          )}        </section>
        </>
        ) : (
          // ── Vote Leaders View — Podium B ──
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-xl shrink-0">
                🏆
              </div>
              <h2 className="font-bold text-xl text-blue-400">{t.topPlayers}</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.loading}
              </div>
            ) : rankedLeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                {language === "fr" ? "Aucun vote pour le moment" : "No votes yet"}
              </div>
            ) : (
              <>
                {/* ── Top 3 Podium ── */}
                <div className="flex items-end justify-center gap-3 mb-6">
                  {podiumOrder.map((player, podiumIdx) => {
                    // podiumIdx 0 = #2 (left), 1 = #1 (centre), 2 = #3 (right)
                    const voteRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                    const isFirst = voteRank === 1;
                    const animDelays = [120, 0, 200];

                    const cardStyle = {
                      1: {
                        border: "border-yellow-400/40",
                        bg: "bg-gradient-to-b from-yellow-500/10 to-yellow-600/5",
                        avatarBg: "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black",
                        votesColor: "text-yellow-400",
                        votesSize: "text-3xl",
                        avatarSize: "w-14 h-14 text-2xl",
                        scale: "scale-[1.08]",
                      },
                      2: {
                        border: "border-slate-400/20",
                        bg: "bg-gradient-to-b from-slate-400/8 to-slate-500/3",
                        avatarBg: "bg-gradient-to-br from-slate-300 to-slate-400 text-black",
                        votesColor: "text-slate-300",
                        votesSize: "text-2xl",
                        avatarSize: "w-12 h-12 text-xl",
                        scale: "",
                      },
                      3: {
                        border: "border-orange-800/25",
                        bg: "bg-gradient-to-b from-orange-900/8 to-orange-950/3",
                        avatarBg: "bg-gradient-to-br from-orange-600 to-orange-800 text-white",
                        votesColor: "text-orange-500",
                        votesSize: "text-xl",
                        avatarSize: "w-12 h-12 text-xl",
                        scale: "",
                      },
                    }[voteRank]!;

                    return (
                      <div
                        key={player.id}
                        className={`flex-1 flex flex-col items-center ${cardStyle.bg} border ${cardStyle.border} rounded-2xl p-4 animate-podium-in ${cardStyle.scale} relative`}
                        style={{ animationDelay: `${animDelays[podiumIdx]}ms` }}
                      >
                        {isFirst && (
                          <span className="text-xl leading-none mb-1 animate-bounce" style={{ animationDuration: "2s" }}>👑</span>
                        )}
                        <div className={`${cardStyle.avatarSize} rounded-full overflow-hidden relative shrink-0 flex items-center justify-center font-black ${cardStyle.avatarBg} mb-2 shadow-lg`}>
                          {player.headshot ? (
                            <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="56px" />
                          ) : (
                            player.name.charAt(0)
                          )}
                        </div>
                        <p className={`font-bold text-center text-white leading-tight ${isFirst ? "text-sm" : "text-xs"} w-full truncate`}>
                          {player.name}
                        </p>
                        <p className="text-xs text-slate-500 text-center truncate w-full mt-0.5">{player.teamName}</p>
                        <p className={`font-black mt-2 leading-none ${cardStyle.votesColor} ${cardStyle.votesSize}`}>
                          {player.voteCount}
                        </p>
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">{t.votes}</p>
                      </div>
                    );
                  })}
                </div>

                {/* ── Ranks 4–10 mini list ── */}
                {restLeaders.length > 0 && (
                  <div className="space-y-2">
                    {restLeaders.map((player, idx) => {
                      const pct = leaderTopVotes > 0 ? Math.round((player.voteCount / leaderTopVotes) * 100) : 0;
                      const rowOpacity = Math.max(0.35, 0.82 - idx * 0.08);
                      return (
                        <div
                          key={player.id}
                          className="flex items-center gap-3 bg-slate-800/40 border border-white/5 rounded-xl px-4 py-2.5 animate-mini-row-in"
                          style={{
                            animationDelay: `${320 + idx * 45}ms`,
                            opacity: rowOpacity,
                          }}
                        >
                          <span className="text-slate-500 font-mono text-xs w-5 text-center shrink-0">
                            {idx + 4}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{player.name}</p>
                            <p className="text-xs text-slate-500 truncate">{player.teamName}</p>
                          </div>
                          <div className="w-20 h-1.5 bg-slate-700/60 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                              style={{ width: barsVisible ? `${pct}%` : "0%" }}
                            />
                          </div>
                          <span className="text-sm font-black text-slate-300 w-7 text-right shrink-0">
                            {player.voteCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}

      </div>

      {/* ── Sticky submit ── */}
      {viewMode === "vote" && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-slate-950/95 backdrop-blur border-t border-white/10 z-20">
          {successMsg && (
            <p className="text-center text-emerald-400 text-sm mb-2 font-semibold">{successMsg}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || curPlayers.length === 0}
            className="w-full max-w-md mx-auto block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
          >
            {submitting ? t.submitting : hasVoted ? t.update : t.submit}
          </button>
        </div>
      )}
    </div>
  );
}
