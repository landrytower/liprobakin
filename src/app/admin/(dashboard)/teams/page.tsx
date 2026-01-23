"use client";

import { useAdmin } from "../layout";

export default function TeamsPage() {
  const { language } = useAdmin();

  const t = {
    en: {
      title: "Teams Management",
      description: "Manage teams, rosters, and player information",
      comingSoon: "This module is being migrated. Please use the main admin page for now.",
    },
    fr: {
      title: "Gestion des Équipes",
      description: "Gérer les équipes, les effectifs et les informations des joueurs",
      comingSoon: "Ce module est en cours de migration. Veuillez utiliser la page d'administration principale pour l'instant.",
    },
  };

  const copy = t[language];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{copy.title}</h1>
        <p className="text-slate-400 mt-1">{copy.description}</p>
      </div>

      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-8 text-center">
        <p className="text-blue-300">{copy.comingSoon}</p>
        <a
          href="/admin"
          className="inline-block mt-4 px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
        >
          {language === "fr" ? "Aller à l'admin principal" : "Go to main admin"}
        </a>
      </div>
    </div>
  );
}
