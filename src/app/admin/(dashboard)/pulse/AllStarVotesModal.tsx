"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";

type Category = "menPlayers" | "womenPlayers" | "menCoaches" | "womenCoaches";

type Entry = {
  id: string;
  name: string;
  teamName: string;
  votes: number;
};

type Results = Record<Category, Entry[]>;

const CATEGORY_LABELS: Record<Category, { en: string; fr: string }> = {
  menPlayers:   { en: "Men – Players",  fr: "Hommes – Joueurs" },
  womenPlayers: { en: "Women – Players", fr: "Femmes – Joueuses" },
  menCoaches:   { en: "Men – Coaches",  fr: "Hommes – Entraîneurs" },
  womenCoaches: { en: "Women – Coaches", fr: "Femmes – Entraîneures" },
};

const CATEGORIES: Category[] = ["menPlayers", "womenPlayers", "menCoaches", "womenCoaches"];

export default function AllStarVotesModal({
  onClose,
  language = "en",
}: {
  onClose: () => void;
  language?: "en" | "fr";
}) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Results>({
    menPlayers: [], womenPlayers: [], menCoaches: [], womenCoaches: [],
  });
  const [tab, setTab] = useState<Category>("menPlayers");
  const [totalVoters, setTotalVoters] = useState(0);

  useEffect(() => {
    const load = async () => {
      // 1. Aggregate raw votes
      const votesSnap = await getDocs(collection(firebaseDB, "allStarVotes"));
      setTotalVoters(votesSnap.size);

      const counts: Record<Category, Record<string, number>> = {
        menPlayers: {}, womenPlayers: {}, menCoaches: {}, womenCoaches: {},
      };

      for (const d of votesSnap.docs) {
        const data = d.data();
        for (const cat of CATEGORIES) {
          const ids: string[] = data[cat] || [];
          for (const id of ids) counts[cat][id] = (counts[cat][id] || 0) + 1;
        }
      }

      // 2. Build id → { name, teamName } lookup from all team rosters
      const teamsSnap = await getDocs(collection(firebaseDB, "teams"));
      const playerMap: Record<string, { name: string; teamName: string; gender: string }> = {};
      const coachMap: Record<string, { name: string; teamName: string; gender: string }> = {};

      await Promise.all(
        teamsSnap.docs.map(async (teamDoc) => {
          const td = teamDoc.data();
          const teamGender = normalizeTeamGender(td.gender, td.logo, "men");
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
              gender: teamGender,
            };
          }
          for (const c of coachSnap.docs) {
            const cd = c.data();
            coachMap[c.id] = {
              name: `${cd.firstName || ""} ${cd.lastName || ""}`.trim() || c.id,
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
        menCoaches:   resolve(counts.menCoaches,    coachMap),
        womenCoaches: resolve(counts.womenCoaches,  coachMap),
      });
      setLoading(false);
    };

    load();
  }, []);

  const rows = results[tab];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white">
              {language === "fr" ? "Résultats du Vote All-Star" : "All-Star Vote Results"}
            </h2>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">
                {totalVoters} {language === "fr" ? "votant(s)" : "voter(s)"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 p-3 border-b border-white/10 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setTab(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === cat
                  ? "bg-orange-500 text-white"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {CATEGORY_LABELS[cat][language]}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              {language === "fr" ? "Chargement…" : "Loading…"}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">
              {language === "fr" ? "Aucun vote pour cette catégorie." : "No votes in this category yet."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-white/5">
                  <th className="text-left pb-2 w-8">#</th>
                  <th className="text-left pb-2">{language === "fr" ? "Nom" : "Name"}</th>
                  <th className="text-left pb-2 hidden sm:table-cell">{language === "fr" ? "Équipe" : "Team"}</th>
                  <th className="text-right pb-2">{language === "fr" ? "Votes" : "Votes"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-2.5 font-semibold text-white">{entry.name}</td>
                    <td className="py-2.5 text-slate-400 text-xs hidden sm:table-cell">{entry.teamName}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-black text-orange-400">{entry.votes}</span>
                        {i === 0 && <span className="text-base">🏆</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
