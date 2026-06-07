"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender, type TeamGender } from "@/lib/team-gender";
import { getAllStarEligibility } from "@/lib/allstar-settings";

const MAX_PLAYERS = 15;
const SESSION_KEY = "allstar_voter_phone";

const tr = {
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
    submitting: "Envoi en cours...",
    success: "Vote soumis! 🎉",
    switchToWomen: "15 hommes sélectionnés! Choisissez maintenant vos 15 femmes ⭐",
    loading: "Chargement des joueurs...",
    instructions: "Sélectionnez 15 hommes et 15 femmes pour votre équipe All-Star.",
    searchPlaceholder: "Chercher un joueur…",
    remove: "Retirer",
    votes: "votes",
    topPlayers: "Top 15 joueurs",
    rank: "Rang",
    voteLocked: "Votre vote est enregistré ✓",
    alreadyVoted: "Vous avez déjà voté",
    alreadyVotedSub: "Ce numéro a déjà soumis un vote.",
    nonEligible: "Non éligible",
    emailLabel: "Email",
    emailOptional: "(optionnel)",
    roleLabel: "Rôle",
    roleJoueur: "Joueur",
    roleStaff: "Staff",
    roleFan: "Fan",
    roleRequired: "Veuillez sélectionner votre rôle.",
  },
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
    submitting: "Submitting...",
    success: "Vote submitted! 🎉",
    switchToWomen: "15 men picked! Now choose your 15 women ⭐",
    loading: "Loading players...",
    instructions: "Select 15 men and 15 women for your All-Star team.",
    searchPlaceholder: "Search a player…",
    remove: "Remove",
    votes: "votes",
    topPlayers: "Top 15 Players",
    rank: "Rank",
    voteLocked: "Your vote is locked in ✓",
    alreadyVoted: "Already voted",
    alreadyVotedSub: "This phone number has already submitted a vote.",
    nonEligible: "Non-eligible",
    emailLabel: "Email",
    emailOptional: "(optional)",
    roleLabel: "Role",
    roleJoueur: "Player",
    roleStaff: "Staff",
    roleFan: "Fan",
    roleRequired: "Please select your role.",
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
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className="text-slate-600">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
);

async function loadRostersForGender(teams: TeamEntry[], g: TeamGender): Promise<PlayerEntry[]> {
  const genderTeams = teams.filter((tm) => tm.gender === g);
  const results = await Promise.all(
    genderTeams.map(async (team) => {
      const displayName = [team.city, team.name].filter(Boolean).join(" ");
      const snap = await getDocs(collection(firebaseDB, "teams", team.id, "roster"));
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, teamId: team.id, teamName: displayName,
          name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.name || "Unknown",
          headshot: data.headshot, position: data.position,
        };
      });
    })
  );
  return results.flat().sort((a, b) => a.name.localeCompare(b.name));
}

function toDocId(countryCode: string, localNumber: string): string {
  const cc = countryCode.replace(/\D/g, "") || "243";
  const local = localNumber.replace(/\D/g, "");
  if (cc === "243" && local.startsWith("0")) return cc + local.slice(1);
  return cc + local;
}

export default function VotePage() {
  const { language } = useLanguage();
  const router = useRouter();
  const t = tr[language];

  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);

  // Voter identity (phone digits used as doc ID)
  const [voterPhone, setVoterPhone] = useState<string | null>(null);

  // Voter identity modal
  const [showModal, setShowModal] = useState(false);
  const [modalFirstName, setModalFirstName] = useState("");
  const [modalLastName, setModalLastName] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalCountryCode, setModalCountryCode] = useState("243");
  const [modalEmail, setModalEmail] = useState("");
  const [modalRole, setModalRole] = useState<"joueur" | "staff" | "fan" | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  const [gender, setGender] = useState<TeamGender>("men");
  const [viewMode, setViewMode] = useState<"vote" | "leaders">("vote");
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<string, number>>>({});
  const [selectedPlayers, setSelectedPlayers] = useState<Record<TeamGender, string[]>>({ men: [], women: [] });
  const [barsVisible, setBarsVisible] = useState(false);
  const [snapLoading, setSnapLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const playersCacheRef = useRef<Partial<Record<string, PlayerEntry[]>>>({});
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [switchMsg, setSwitchMsg] = useState("");
  type SnapLeader = { id: string; name: string; teamName: string; votes: number };
  const [leadersSnap, setLeadersSnap] = useState<{ men: SnapLeader[]; women: SnapLeader[] } | null>(null);
  // null = not yet loaded (suppress tag to avoid a flash of "all non-eligible")
  const [eligibleIds, setEligibleIds] = useState<Set<string> | null>(null);

  // Timing token — fetched once on mount, included in the vote submission
  const [voteToken, setVoteToken] = useState<string | null>(null);

  // Fetch timing token on mount (must be ≥45s old when submitted)
  useEffect(() => {
    fetch("/api/vote/token")
      .then((r) => r.json())
      .then((d) => { if (d.token) setVoteToken(d.token); })
      .catch(() => {});
  }, []);

  // Check if All-Star voting is enabled
  useEffect(() => {
    getDoc(doc(firebaseDB, "settings", "allStar")).then((d) => {
      if (d.exists()) setAllStarEnabled(d.data().enabled ?? true);
      setCheckingSettings(false);
    });
  }, []);

  // Restore voter phone from session + load existing vote
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return;
    setVoterPhone(stored);
    getDoc(doc(firebaseDB, "allStarVotes", stored)).then((d) => {
      if (d.exists()) {
        const data = d.data();
        setHasVoted(true);
        setSelectedPlayers({ men: data.menPlayers || [], women: data.womenPlayers || [] });
      }
    });
  }, []);

  // Fetch teams
  useEffect(() => {
    getDocs(collection(firebaseDB, "teams")).then((snap) => {
      setTeams(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, name: data.name || "", city: data.city || "", gender: normalizeTeamGender(data.gender, data.logo, "men") };
      }));
    });
  }, []);

  // Fetch rosters — cache per gender so switching never re-fetches
  useEffect(() => {
    if (!teams.length) return;

    // Cache hit: render immediately, no Firestore round-trip
    if (playersCacheRef.current[gender]) {
      setPlayers(playersCacheRef.current[gender]!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPlayers([]);
    loadRostersForGender(teams, gender).then((sorted) => {
      playersCacheRef.current[gender] = sorted;
      setPlayers(sorted);
      setLoading(false);
      // Silently preload the other gender while the user is reading/selecting
      const other: TeamGender = gender === "men" ? "women" : "men";
      if (!playersCacheRef.current[other]) {
        loadRostersForGender(teams, other)
          .then((os) => { playersCacheRef.current[other] = os; })
          .catch(() => {});
      }
    });
  }, [teams, gender]);

  // Fetch aggregated vote counts (public collection)
  useEffect(() => {
    Promise.all(["menPlayers", "womenPlayers"].map(async (cat) => {
      const d = await getDoc(doc(firebaseDB, "allStarVoteResults", cat));
      return [cat, d.exists() ? (d.data() as Record<string, number>) : {}] as const;
    })).then((entries) => setVoteCounts(Object.fromEntries(entries)));
  }, []);

  // Fetch pre-computed leaders snapshot for instant display
  useEffect(() => {
    getDoc(doc(firebaseDB, "allStarLeaders", "snapshot")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setLeadersSnap({
          men: (d.men || []) as SnapLeader[],
          women: (d.women || []) as SnapLeader[],
        });
      }
      setSnapLoading(false);
    }).catch(() => { setSnapLoading(false); });
  }, []);


  // Fetch eligibility set (cached, parallel — must not block first paint)
  useEffect(() => {
    getAllStarEligibility()
      .then(setEligibleIds)
      .catch(() => setEligibleIds(new Set()));
  }, []);

  // Bar animations on leaders tab
  useEffect(() => {
    if (viewMode === "leaders") {
      const tid = setTimeout(() => setBarsVisible(true), 150);
      return () => clearTimeout(tid);
    } else {
      setBarsVisible(false);
    }
  }, [viewMode, gender]);

  const triggerShake = (id: string) => { setShakeId(id); setTimeout(() => setShakeId(null), 500); };

  const togglePlayer = (id: string) => {
    if (eligibleIds !== null && !eligibleIds.has(id)) return; // non-eligible: inert
    setSelectedPlayers((prev) => {
      const cur = prev[gender];
      if (cur.includes(id)) return { ...prev, [gender]: cur.filter((x) => x !== id) };
      if (cur.length >= MAX_PLAYERS) { triggerShake(id); return prev; }
      const next = { ...prev, [gender]: [...cur, id] };
      // Auto-switch to women after 15th male pick
      if (gender === "men" && next.men.length === MAX_PLAYERS) {
        setTimeout(() => {
          setGender("women");
          setSwitchMsg(t.switchToWomen);
          setTimeout(() => setSwitchMsg(""), 3500);
        }, 300);
      }
      return next;
    });
  };

  const removePlayer = (id: string) => {
    setSelectedPlayers((prev) => ({ ...prev, [gender]: prev[gender].filter((x) => x !== id) }));
  };

  // Open voter modal to collect name + phone before first submit
  const handleSubmitClick = () => {
    if (hasVoted) return;
    if (selectedPlayers.men.length < MAX_PLAYERS || selectedPlayers.women.length < MAX_PLAYERS) return;
    setModalError("");
    setShowModal(true);
  };

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setModalError("");

    const firstName = modalFirstName.trim();
    const lastName = modalLastName.trim();
    if (!firstName || !lastName) {
      setModalError(language === "fr" ? "Prénom et nom requis pour voter." : "First and last name are required to vote.");
      return;
    }

    if (!modalRole) {
      setModalError(t.roleRequired);
      return;
    }

    const docId = toDocId(modalCountryCode, modalPhone);
    if (docId.length < 9) {
      setModalError(language === "fr" ? "Numéro invalide." : "Invalid phone number.");
      return;
    }

    // Filter to eligible only; if eligibility not yet loaded submit as-is
    const menIds = eligibleIds ? selectedPlayers.men.filter((id) => eligibleIds.has(id)) : selectedPlayers.men;
    const womenIds = eligibleIds ? selectedPlayers.women.filter((id) => eligibleIds.has(id)) : selectedPlayers.women;

    if (menIds.length < MAX_PLAYERS || womenIds.length < MAX_PLAYERS) {
      setModalError(
        language === "fr"
          ? `Vous devez sélectionner ${MAX_PLAYERS} hommes et ${MAX_PLAYERS} femmes.`
          : `You must select ${MAX_PLAYERS} men and ${MAX_PLAYERS} women.`
      );
      return;
    }

    setModalSubmitting(true);
    try {
      const res = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: docId,
          email: modalEmail.trim() || null,
          role: modalRole,
          menPlayers: menIds,
          womenPlayers: womenIds,
          token: voteToken,
        }),
      });

      if (res.status === 409) {
        // Phone already voted — restore their selections
        setAlreadyVoted(true);
        setShowModal(false);
        setVoterPhone(docId);
        sessionStorage.setItem(SESSION_KEY, docId);
        setHasVoted(true);
        const snap = await getDoc(doc(firebaseDB, "allStarVotes", docId));
        if (snap.exists()) {
          const data = snap.data();
          setSelectedPlayers({ men: data.menPlayers || [], women: data.womenPlayers || [] });
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // For bot-blocked errors the response carries a human-readable `message`
        // Real users on the site will only ever hit session-expiry, never the bot gates
        const friendlyErrors: Record<string, string> = {
          TOKEN_MISSING:   language === "fr" ? "Session expirée. Rechargez la page." : "Session expired. Please refresh.",
          TOKEN_INVALID:   language === "fr" ? "Session invalide. Rechargez la page." : "Invalid session. Please refresh.",
          TOKEN_TOO_YOUNG: language === "fr" ? "Soumission trop rapide. Attendez un instant." : "Submitted too fast. Wait a moment.",
          TOKEN_REPLAY:    language === "fr" ? "Cette session a déjà été utilisée. Rechargez la page." : "Session already used. Please refresh.",
          RATE_LIMITED:    language === "fr" ? "Trop de tentatives. Attendez 30 secondes." : "Too many attempts. Wait 30 seconds.",
          PLAYER_COUNT:    language === "fr" ? "Sélectionnez exactement 15H + 15F." : "Select exactly 15M + 15W players.",
        };
        setModalError(
          friendlyErrors[data.error] ||
          data.error ||
          (language === "fr" ? "Erreur, réessayez." : "Something went wrong. Please try again.")
        );
        return;
      }

      // Success
      setVoterPhone(docId);
      sessionStorage.setItem(SESSION_KEY, docId);
      setHasVoted(true);
      setShowModal(false);
      setSuccessMsg(t.success);
      setTimeout(() => router.push("/allstar-results"), 2500);

      // Send SMS confirmation (fire-and-forget)
      const cache = playersCacheRef.current;
      const resolveName = (ids: string[], g: string) =>
        ids.map((id) => (cache[g] as typeof players | undefined)?.find((p) => p.id === id)?.name ?? id);
      fetch("/api/vote/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+" + docId,
          firstName,
          lastName,
          menPlayers:   resolveName(menIds,   "men"),
          womenPlayers: resolveName(womenIds, "women"),
        }),
      }).catch(() => {});
    } catch {
      setModalError(language === "fr" ? "Erreur, réessayez." : "Something went wrong. Please try again.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const curPlayers = selectedPlayers[gender];
  const playerVotes = voteCounts[gender === "men" ? "menPlayers" : "womenPlayers"] || {};

  const snapKey = gender === "men" ? "men" : "women";
  const freshLeaders = !loading && players.length > 0
    ? players.map((p) => ({ ...p, voteCount: playerVotes[p.id] || 0 })).filter((p) => p.voteCount > 0).sort((a, b) => b.voteCount - a.voteCount).slice(0, 10)
    : null;
  const snapLeaders = (leadersSnap?.[snapKey] ?? []).map((s) => ({
    id: s.id, name: s.name, teamName: s.teamName,
    teamId: "", headshot: undefined as string | undefined, position: undefined as string | undefined,
    voteCount: s.votes,
  }));
  // Use fresh (from allStarVoteResults) only when it actually has results;
  // otherwise fall through to the admin-written snapshot.
  const rankedLeaders = (freshLeaders !== null && freshLeaders.length > 0)
    ? freshLeaders
    : snapLeaders;
  const leadersLoading = snapLoading && rankedLeaders.length === 0;
  const leaderTopVotes = rankedLeaders[0]?.voteCount ?? 1;
  const podiumOrder = [rankedLeaders[1], rankedLeaders[0], rankedLeaders[2]].filter((p): p is (typeof rankedLeaders)[0] => Boolean(p));
  const restLeaders = rankedLeaders.slice(3);

  const q = search.toLowerCase().trim();
  const searchResults = q ? players.filter((p) => !curPlayers.includes(p.id)).filter((p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q)).slice(0, 12) : [];

  if (checkingSettings) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    );
  }

  if (!allStarEnabled) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex items-center gap-2">
              <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{t.title}</h1>
            </div>
            <div className="w-8" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🏀</div>
          <h2 className="text-2xl font-bold text-white mb-3">{language === "fr" ? "Vote All-Star non disponible" : "All-Star Voting Unavailable"}</h2>
          <p className="text-slate-400 mb-8">{language === "fr" ? "Le vote n'est pas disponible pour le moment." : "Voting is not available at this time."}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            {language === "fr" ? "Retour à l'accueil" : "Back to Home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">

      {/* ── Voter identity modal ── */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
          {/* Outer: fills safe zone, flex-centers the card; card scrolls if taller than viewport */}
          <div className="fixed inset-x-4 top-4 bottom-4 max-w-sm mx-auto z-50 flex flex-col justify-center">
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
              {/* Sticky header */}
              <div className="px-5 pt-5 pb-3.5 border-b border-white/5 shrink-0 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-white">{language === "fr" ? "Qui êtes-vous ?" : "Who are you?"}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{language === "fr" ? "Requis pour valider votre vote unique." : "Required to validate your one-time vote."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Scrollable form */}
              <form onSubmit={handleModalSubmit} className="p-5 space-y-3 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {language === "fr" ? "Prénom" : "First name"} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={modalFirstName}
                      onChange={(e) => setModalFirstName(e.target.value)}
                      placeholder="Princesse"
                      required
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      {language === "fr" ? "Nom" : "Last name"} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={modalLastName}
                      onChange={(e) => setModalLastName(e.target.value)}
                      placeholder="Gafutshi"
                      required
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {language === "fr" ? "Numéro de téléphone" : "Phone number"} <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center bg-slate-800 border border-white/10 rounded-xl px-3 py-2 focus-within:border-emerald-500 transition-colors gap-1.5">
                    <span className="text-base select-none shrink-0">{modalCountryCode === "243" ? "🇨🇩" : "🌍"}</span>
                    <span className="text-slate-400 text-sm shrink-0">+</span>
                    <input
                      type="tel"
                      value={modalCountryCode}
                      onChange={(e) => setModalCountryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      aria-label="Country code"
                      className="w-10 bg-transparent text-sm text-white focus:outline-none border-r border-white/15 pr-1.5 mr-0.5 shrink-0"
                    />
                    <input
                      type="tel"
                      value={modalPhone}
                      onChange={(e) => setModalPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder={modalCountryCode === "243" ? "812 345 678" : "Phone number"}
                      required
                      inputMode="numeric"
                      className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none min-w-0"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {modalCountryCode === "243"
                      ? "Vodacom · Airtel · Africel · Orange"
                      : (language === "fr" ? "Modifiez le code pays si besoin" : "Change the country code if needed")}
                  </p>
                </div>

                {/* Role toggle */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t.roleLabel}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["joueur", "staff", "fan"] as const).map((r) => {
                      const label = r === "joueur" ? t.roleJoueur : r === "staff" ? t.roleStaff : t.roleFan;
                      const active = modalRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setModalRole(r)}
                          className={`py-2 rounded-xl text-sm font-bold transition-all border ${
                            active
                              ? "bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-600/30"
                              : "bg-slate-800 border-white/10 text-slate-300 hover:border-white/25"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Email (optional) */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t.emailLabel} <span className="normal-case font-normal text-slate-500">{t.emailOptional}</span>
                  </label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="princesse@exemple.com"
                    inputMode="email"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {modalError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{modalError}</p>
                )}

                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {modalSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {t.submitting}
                    </span>
                  ) : (language === "fr" ? "Confirmer mon vote" : "Confirm my vote")}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ── Already voted overlay ── */}
      {alreadyVoted && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={() => setAlreadyVoted(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50">
            <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl p-8 text-center">
              <div className="text-5xl mb-3">🗳️</div>
              <h3 className="text-xl font-black text-white mb-2">{t.alreadyVoted}</h3>
              <p className="text-sm text-slate-400 mb-6">{t.alreadyVotedSub}</p>
              <button
                onClick={() => setAlreadyVoted(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                {language === "fr" ? "Voir mes sélections" : "See my selections"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Navbar ── */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{t.title}</h1>
          </div>
          <div className="flex gap-1.5">
            {(["men", "women"] as TeamGender[]).map((g) => (
              <button key={g} onClick={() => { setGender(g); setSearch(""); }}
                className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all ${gender === g ? "bg-emerald-600 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}>
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
            <button onClick={() => setViewMode("vote")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === "vote" ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {t.myVote}
            </button>
            <button onClick={() => setViewMode("leaders")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === "leaders" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
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
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
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
                  onFocus={(e) => { setSearchFocused(true); setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder={t.searchPlaceholder}
                  disabled={hasVoted}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-9 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Dropdown — fixed so mobile keyboard can't push it off screen */}
              {searchFocused && q && searchResults.length > 0 && (
                <div className="fixed z-50 top-[112px] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-[50dvh] overflow-y-auto animate-scale-in">
                  <div className="px-3 py-1.5 text-[10px] uppercase text-slate-500 tracking-widest border-b border-white/5 sticky top-0 bg-slate-800 backdrop-blur">
                    {t.players}
                  </div>
                  {searchResults.map((player) => {
                    const voteCount = playerVotes[player.id] || 0;
                    const isSelected = curPlayers.includes(player.id);
                    const blocked = eligibleIds !== null && !eligibleIds.has(player.id);
                    return (
                      <button
                        key={player.id}
                        disabled={blocked}
                        onMouseDown={blocked ? undefined : () => { togglePlayer(player.id); setSearch(""); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"} ${isSelected ? "opacity-50" : ""} ${shakeId === player.id ? "animate-shake" : ""}`}>
                        <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden relative shrink-0 flex items-center justify-center">
                          {player.headshot ? <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="36px" /> : <PersonPlaceholder size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                          <p className="text-xs text-slate-400 truncate">{player.teamName}</p>
                        </div>
                        {blocked ? (
                          <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 border border-slate-500/30 uppercase tracking-wide whitespace-nowrap">
                            {t.nonEligible}
                          </span>
                        ) : (
                          voteCount > 0 && <span className="text-xs text-orange-400 font-bold shrink-0 px-2 py-0.5 rounded-full bg-orange-400/10">{voteCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected players list */}
              {loading ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {t.loading}
                </div>
              ) : curPlayers.length > 0 ? (
                <div className="space-y-2 mt-4">
                  {curPlayers.map((playerId, idx) => {
                    const player = players.find((p) => p.id === playerId);
                    if (!player) return null;
                    const voteCount = playerVotes[player.id] || 0;
                    return (
                      <div key={playerId}
                        className="flex items-center gap-3 bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-white/10 rounded-xl p-3 transition-all duration-300 animate-slide-in"
                        style={{ animationDelay: `${idx * 30}ms` }}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600/20 to-blue-600/20 overflow-hidden relative shrink-0 flex items-center justify-center ring-2 ring-emerald-500/20">
                          {player.headshot ? <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="40px" /> : <PersonPlaceholder size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            <span className="inline-block w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 text-xs leading-6 text-center mr-2 font-bold">{idx + 1}</span>
                            {player.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate ml-8">{player.teamName}</p>
                        </div>
                        {voteCount > 0 && <span className="text-xs text-orange-400 font-bold shrink-0 px-2 py-1 rounded-full bg-orange-400/10 border border-orange-400/20">{voteCount}</span>}
                        {!hasVoted && (
                          <button onClick={() => removePlayer(playerId)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg p-1.5 transition-all shrink-0" title={t.remove}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {language === "fr" ? "Aucun joueur sélectionné" : "No players selected"}
                </div>
              )}
            </section>
          </>
        ) : (
          // ── Vote Leaders — Podium B ──
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-xl shrink-0">🏆</div>
              <h2 className="font-bold text-xl text-blue-400">{t.topPlayers}</h2>
            </div>
            {leadersLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {t.loading}
              </div>
            ) : rankedLeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">{language === "fr" ? "Aucun vote pour le moment" : "No votes yet"}</div>
            ) : (
              <>
                <div className="flex items-end justify-center gap-1.5 sm:gap-2 mb-6">
                  {podiumOrder.map((player, podiumIdx) => {
                    const voteRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                    const isFirst = voteRank === 1;
                    const animDelays = [120, 0, 200];
                    const rankStyle = {
                      1: { border: "border-yellow-400/50", votesColor: "text-yellow-300", placeholderBg: "bg-gradient-to-br from-yellow-500/30 to-yellow-700/20", scale: "scale-[1.06] sm:scale-[1.08]", height: "h-44 sm:h-52" },
                      2: { border: "border-slate-400/25", votesColor: "text-slate-300", placeholderBg: "bg-gradient-to-br from-slate-500/20 to-slate-700/10", scale: "", height: "h-36 sm:h-44" },
                      3: { border: "border-orange-700/30", votesColor: "text-orange-400", placeholderBg: "bg-gradient-to-br from-orange-700/20 to-orange-900/10", scale: "", height: "h-36 sm:h-44" },
                    }[voteRank]!;
                    return (
                      <div key={player.id} className={`flex-1 relative overflow-hidden border ${rankStyle.border} rounded-xl sm:rounded-2xl animate-podium-in ${rankStyle.scale} min-w-0 ${rankStyle.height}`} style={{ animationDelay: `${animDelays[podiumIdx]}ms` }}>
                        {/* Full-bleed player photo */}
                        {player.headshot ? (
                          <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="(max-width: 640px) 33vw, 180px" />
                        ) : (
                          <div className={`absolute inset-0 flex items-center justify-center font-black text-3xl text-white/60 ${rankStyle.placeholderBg}`}>{player.name.charAt(0)}</div>
                        )}
                        {/* Dark gradient overlay at bottom */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent" />
                        {/* Crown for 1st */}
                        {/* Name + votes overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 text-center z-10">
                          <p className="font-bold text-white text-[11px] sm:text-xs leading-tight line-clamp-2 break-words">{player.name}</p>
                          <p className={`font-black mt-0.5 leading-none ${rankStyle.votesColor} text-xl sm:text-2xl`}>{player.voteCount}</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{t.votes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {restLeaders.length > 0 && (
                  <div className="space-y-2">
                    {restLeaders.map((player, idx) => {
                      const pct = leaderTopVotes > 0 ? Math.round((player.voteCount / leaderTopVotes) * 100) : 0;
                      return (
                        <div key={player.id} className="flex items-center gap-3 bg-slate-800/40 border border-white/5 rounded-xl px-4 py-2.5 animate-mini-row-in" style={{ animationDelay: `${320 + idx * 45}ms`, opacity: Math.max(0.35, 0.82 - idx * 0.08) }}>
                          <span className="text-slate-500 font-mono text-xs w-5 text-center shrink-0">{idx + 4}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{player.name}</p>
                            <p className="text-xs text-slate-500 truncate">{player.teamName}</p>
                          </div>
                          <div className="w-20 h-1.5 bg-slate-700/60 rounded-full overflow-hidden shrink-0">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: barsVisible ? `${pct}%` : "0%" }} />
                          </div>
                          <span className="text-sm font-black text-slate-300 w-7 text-right shrink-0">{player.voteCount}</span>
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

      {/* ── Sticky submit / locked bar ── */}
      {viewMode === "vote" && (
        <div className="fixed bottom-0 inset-x-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-950/95 backdrop-blur border-t border-white/10 z-20">
          {switchMsg && (
            <div className="text-center text-amber-400 text-sm mb-2 font-bold animate-scale-in flex items-center justify-center gap-2">
              <span>⭐</span>{switchMsg}<span>⭐</span>
            </div>
          )}
          {successMsg && <p className="text-center text-emerald-400 text-sm mb-2 font-semibold">{successMsg}</p>}
          {hasVoted ? (
            <div className="w-full max-w-md mx-auto flex items-center justify-center gap-2 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 font-bold py-4 rounded-xl">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              {t.voteLocked}
            </div>
          ) : (() => {
            const menDone = selectedPlayers.men.length >= MAX_PLAYERS;
            const womenDone = selectedPlayers.women.length >= MAX_PLAYERS;
            const ready = menDone && womenDone;
            const hint = !menDone && !womenDone
              ? (language === "fr" ? `Sélectionnez ${MAX_PLAYERS - selectedPlayers.men.length} hommes et ${MAX_PLAYERS - selectedPlayers.women.length} femmes` : `Select ${MAX_PLAYERS - selectedPlayers.men.length} men and ${MAX_PLAYERS - selectedPlayers.women.length} women`)
              : !menDone
              ? (language === "fr" ? `Encore ${MAX_PLAYERS - selectedPlayers.men.length} homme(s) à choisir` : `${MAX_PLAYERS - selectedPlayers.men.length} more men needed`)
              : !womenDone
              ? (language === "fr" ? `Encore ${MAX_PLAYERS - selectedPlayers.women.length} femme(s) à choisir` : `${MAX_PLAYERS - selectedPlayers.women.length} more women needed`)
              : null;
            return (
              <>
                {hint && (
                  <div className="flex items-center justify-center gap-3 mb-1.5">
                    <span className={`text-xs font-bold ${menDone ? "text-emerald-400" : "text-slate-400"}`}>♂ {selectedPlayers.men.length}/{MAX_PLAYERS}</span>
                    <span className={`text-xs font-bold ${womenDone ? "text-emerald-400" : "text-slate-400"}`}>♀ {selectedPlayers.women.length}/{MAX_PLAYERS}</span>
                  </div>
                )}
                <button
                  onClick={handleSubmitClick}
                  disabled={!ready}
                  className="w-full max-w-md mx-auto block bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {t.submit}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
