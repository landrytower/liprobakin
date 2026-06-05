"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import Image from "next/image";

type Category = "menPlayers" | "womenPlayers";

type Entry = {
  id: string;
  name: string;
  teamName: string;
  headshot?: string;
  votes: number;
};

type Results = Record<Category, Entry[]>;

const CATEGORY_LABELS: Record<Category, { en: string; fr: string }> = {
  menPlayers:   { en: "Men",   fr: "Hommes" },
  womenPlayers: { en: "Women", fr: "Femmes" },
};

const CATEGORIES: Category[] = ["menPlayers", "womenPlayers"];

export default function AllStarResultsPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Results>({ menPlayers: [], womenPlayers: [] });
  const [tab, setTab] = useState<Category>("menPlayers");
  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    getDoc(doc(firebaseDB, "settings", "allStar")).then((d) => {
      if (d.exists()) setAllStarEnabled(d.data().enabled ?? true);
      setCheckingSettings(false);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const [menDoc, womenDoc] = await Promise.all([
        getDoc(doc(firebaseDB, "allStarVoteResults", "menPlayers")),
        getDoc(doc(firebaseDB, "allStarVoteResults", "womenPlayers")),
      ]);

      const counts: Record<Category, Record<string, number>> = {
        menPlayers:   menDoc.exists()   ? (menDoc.data()   as Record<string, number>) : {},
        womenPlayers: womenDoc.exists() ? (womenDoc.data() as Record<string, number>) : {},
      };

      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
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
              headshot: pd.headshot,
            };
          }
        })
      );

      const resolve = (countMap: Record<string, number>): Entry[] =>
        Object.entries(countMap)
          .map(([id, votes]) => ({
            id,
            name: playerMap[id]?.name ?? id,
            teamName: playerMap[id]?.teamName ?? "—",
            headshot: playerMap[id]?.headshot,
            votes,
          }))
          .sort((a, b) => b.votes - a.votes);

      setResults({ menPlayers: resolve(counts.menPlayers), womenPlayers: resolve(counts.womenPlayers) });
      setLoading(false);
    };
    load();
  }, []);

  // Trigger bar animation when tab changes
  useEffect(() => {
    setBarsVisible(false);
    const t = setTimeout(() => setBarsVisible(true), 120);
    return () => clearTimeout(t);
  }, [tab, loading]);

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
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex items-center gap-2">
              <Image src="/logos/liprobakin.png" alt="Logo" width={32} height={32} className="rounded-full border border-white/20 object-cover" />
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                {language === "fr" ? "Résultats All-Star" : "All-Star Results"}
              </h1>
            </div>
            <div className="w-8" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🏀</div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {language === "fr" ? "Résultats non disponibles" : "Results Unavailable"}
          </h2>
          <p className="text-slate-400 mb-8">
            {language === "fr" ? "Les résultats ne sont pas disponibles pour le moment." : "Results are not available at this time."}
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl">
            {language === "fr" ? "Retour à l'accueil" : "Back to Home"}
          </Link>
        </div>
      </div>
    );
  }

  const rows = results[tab];
  const topVotes = rows[0]?.votes ?? 1;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter((p): p is Entry => Boolean(p));
  const podiumRanks: Record<number, number> = { 0: 2, 1: 1, 2: 3 };

  const rankBorderColor: Record<number, string> = {
    1: "border-yellow-400/50",
    2: "border-slate-400/25",
    3: "border-orange-700/30",
  };
  const rankVotesColor: Record<number, string> = {
    1: "text-yellow-300",
    2: "text-slate-300",
    3: "text-orange-400",
  };
  const rankHeight: Record<number, string> = {
    1: "h-48 sm:h-56",
    2: "h-36 sm:h-44",
    3: "h-36 sm:h-44",
  };
  const rankScale: Record<number, string> = {
    1: "scale-[1.05] sm:scale-[1.06]",
    2: "",
    3: "",
  };
  const rankBarColor: Record<number, string> = {
    1: "from-yellow-500 to-yellow-400",
    2: "from-slate-400 to-slate-300",
    3: "from-orange-600 to-orange-500",
    4: "from-blue-600 to-blue-500",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-10">
      {/* Navbar */}
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
              {language === "fr" ? "Résultats All-Star" : "All-Star Results"}
            </h1>
          </div>
          <div className="w-8" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {/* Category tabs */}
        <div className="flex gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setTab(cat)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                tab === cat
                  ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {CATEGORY_LABELS[cat][language]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {language === "fr" ? "Chargement…" : "Loading…"}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            {language === "fr" ? "Aucun vote pour cette catégorie." : "No votes in this category yet."}
          </div>
        ) : (
          <>
            {/* Podium — top 3 with full-bleed photos */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-1.5 sm:gap-2 mb-6">
                {podiumOrder.map((player, podiumIdx) => {
                  const rank = podiumRanks[podiumIdx];
                  const isFirst = rank === 1;
                  return (
                    <div key={player.id} className={`flex-1 relative overflow-hidden border ${rankBorderColor[rank]} rounded-xl sm:rounded-2xl ${rankHeight[rank]} ${rankScale[rank]} min-w-0`}>
                      {player.headshot ? (
                        <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="(max-width: 640px) 33vw, 180px" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center font-black text-3xl text-white/40 bg-slate-800">
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-transparent" />
                      {isFirst && (
                        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-lg leading-none animate-bounce z-10" style={{ animationDuration: "2s" }}>👑</span>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-center z-10">
                        <p className="font-bold text-white text-[11px] sm:text-xs leading-tight line-clamp-2 break-words">{player.name}</p>
                        <p className={`font-black mt-0.5 leading-none ${rankVotesColor[rank]} text-xl sm:text-2xl`}>{player.votes}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                          {language === "fr" ? "votes" : "votes"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rank 4+ list with progress bars */}
            {rest.length > 0 && (
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
                {rest.map((entry, i) => {
                  const rank = i + 4;
                  const pct = topVotes > 0 ? Math.round((entry.votes / topVotes) * 100) : 0;
                  const barGradient = rank <= 7 ? rankBarColor[4] : "from-slate-600 to-slate-500";
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <span className="font-mono text-sm font-bold text-slate-500 w-6 text-center shrink-0">{rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{entry.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{entry.teamName}</p>
                        <div className="mt-1.5 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-700`}
                            style={{ width: barsVisible ? `${pct}%` : "0%" }}
                          />
                        </div>
                      </div>
                      <span className="font-black text-orange-400 text-base shrink-0">{entry.votes}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
