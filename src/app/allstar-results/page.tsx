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
  votes: number;
};

type Results = Record<Category, Entry[]>;

const CATEGORY_LABELS: Record<Category, { en: string; fr: string }> = {
  menPlayers:   { en: "Men",  fr: "Hommes" },
  womenPlayers: { en: "Women", fr: "Femmes" },
};

const CATEGORIES: Category[] = ["menPlayers", "womenPlayers"];

export default function AllStarResultsPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Results>({
    menPlayers: [], womenPlayers: [],
  });
  const [tab, setTab] = useState<Category>("menPlayers");
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

  useEffect(() => {
    const load = async () => {
      // 1. Read aggregated vote results (publicly readable collection)
      const [menDoc, womenDoc] = await Promise.all([
        getDoc(doc(firebaseDB, "allStarVoteResults", "menPlayers")),
        getDoc(doc(firebaseDB, "allStarVoteResults", "womenPlayers")),
      ]);

      const counts: Record<Category, Record<string, number>> = {
        menPlayers:   menDoc.exists()   ? (menDoc.data()   as Record<string, number>) : {},
        womenPlayers: womenDoc.exists() ? (womenDoc.data() as Record<string, number>) : {},
      };

      // 2. Build id → { name, teamName } lookup from all team rosters (publicly readable)
      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
      const playerMap: Record<string, { name: string; teamName: string; gender: string }> = {};

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
            };
          }
        })
      );

      // 3. Resolve and sort
      const resolve = (
        countMap: Record<string, number>,
        lookup: Record<string, { name: string; teamName: string }>,
      ): Entry[] =>
        Object.entries(countMap)
          .map(([id, votes]) => ({
            id,
            name: lookup[id]?.name ?? id,
            teamName: lookup[id]?.teamName ?? "—",
            votes,
          }))
          .sort((a, b) => b.votes - a.votes);

      setResults({
        menPlayers:   resolve(counts.menPlayers,   playerMap),
        womenPlayers: resolve(counts.womenPlayers,  playerMap),
      });
      setLoading(false);
    };

    load();
  }, []);

  const rows = results[tab];

  // Show loading while checking settings
  if (checkingSettings) {
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
                {language === "fr" ? "Résultats du Vote All-Star" : "All-Star Vote Results"}
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
            {language === "fr" ? "Résultats All-Star non disponibles" : "All-Star Results Unavailable"}
          </h2>
          <p className="text-slate-400 mb-8">
            {language === "fr" 
              ? "Les résultats du vote All-Star ne sont pas actuellement disponibles." 
              : "All-Star voting results are not currently available."}
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
    <div className="min-h-screen bg-slate-950 text-white pb-16">
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
              {language === "fr" ? "Résultats du Vote All-Star" : "All-Star Vote Results"}
            </h1>
          </div>

          <div className="w-8" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Voter count */}
      <div className="max-w-5xl mx-auto px-4 pt-5">
        {/* Category tabs */}
        <div className="flex gap-2 justify-center mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setTab(cat)}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                tab === cat
                  ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {CATEGORY_LABELS[cat][language]}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {language === "fr" ? "Chargement…" : "Loading…"}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">
              {language === "fr" ? "Aucun vote pour cette catégorie." : "No votes in this category yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500 border-b border-white/5 bg-slate-800/50">
                    <th className="text-left py-3 px-4 w-12">#</th>
                    <th className="text-left py-3 px-4">{language === "fr" ? "Nom" : "Name"}</th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell">{language === "fr" ? "Équipe" : "Team"}</th>
                    <th className="text-right py-3 px-4">{language === "fr" ? "Votes" : "Votes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, i) => {
                    const rankColors = [
                      "text-yellow-400", // 1st - Gold
                      "text-slate-300",  // 2nd - Silver
                      "text-orange-500", // 3rd - Bronze
                    ];
                    const rankColor = i < 3 ? rankColors[i] : "text-slate-500";
                    
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className={`py-3 px-4 font-mono text-sm font-bold ${rankColor}`}>{i + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{entry.name}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs hidden sm:table-cell">{entry.teamName}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-black text-orange-400 text-base">{entry.votes}</span>
                            {i === 0 && <span className="text-xl">🏆</span>}
                          </span>
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
    </div>
  );
}
