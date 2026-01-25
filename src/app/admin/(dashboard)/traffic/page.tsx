"use client";

import React from "react";
import { useAdmin } from "../layout";

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────

const t = {
  en: {
    title: "Traffic Analytics",
    subtitle: "Monitor website traffic and user engagement",
    overview: "Overview",
    pageViews: "Page Views",
    uniqueVisitors: "Unique Visitors",
    avgSessionDuration: "Avg. Session Duration",
    bounceRate: "Bounce Rate",
    topPages: "Top Pages",
    page: "Page",
    views: "Views",
    trafficSources: "Traffic Sources",
    source: "Source",
    visitors: "Visitors",
    geoDistribution: "Geographic Distribution",
    country: "Country",
    noData: "No analytics data available yet",
    connectAnalytics: "Connect your Google Analytics to see traffic data",
  },
  fr: {
    title: "Analyse du Trafic",
    subtitle: "Surveiller le trafic du site et l'engagement des utilisateurs",
    overview: "Aperçu",
    pageViews: "Pages Vues",
    uniqueVisitors: "Visiteurs Uniques",
    avgSessionDuration: "Durée Moyenne Session",
    bounceRate: "Taux de Rebond",
    topPages: "Pages Populaires",
    page: "Page",
    views: "Vues",
    trafficSources: "Sources de Trafic",
    source: "Source",
    visitors: "Visiteurs",
    geoDistribution: "Distribution Géographique",
    country: "Pays",
    noData: "Aucune donnée analytique disponible",
    connectAnalytics: "Connectez votre Google Analytics pour voir les données",
  },
};

// Mock data for demonstration
const mockStats = { pageViews: 12847, uniqueVisitors: 4329, avgDuration: "3:42", bounceRate: "42.5%" };
const mockTopPages = [
  { path: "/", views: 4521 },
  { path: "/teams", views: 2134 },
  { path: "/games", views: 1876 },
  { path: "/players", views: 1543 },
  { path: "/news", views: 987 },
];
const mockSources = [
  { name: "Direct", visitors: 1845, percent: 42.6 },
  { name: "Google", visitors: 1234, percent: 28.5 },
  { name: "Facebook", visitors: 654, percent: 15.1 },
  { name: "Instagram", visitors: 432, percent: 10.0 },
  { name: "Twitter/X", visitors: 164, percent: 3.8 },
];
const mockGeo = [
  { country: "Cameroon", flag: "🇨🇲", visitors: 2134 },
  { country: "France", flag: "🇫🇷", visitors: 876 },
  { country: "USA", flag: "🇺🇸", visitors: 543 },
  { country: "Canada", flag: "🇨🇦", visitors: 432 },
  { country: "Belgium", flag: "🇧🇪", visitors: 344 },
];

export default function TrafficPage() {
  const { language } = useAdmin();
  const copy = t[language];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">{copy.title}</h1><p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p></div>

      {/* Overview Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">{copy.pageViews}</p>
          <p className="text-3xl font-bold text-white mt-2">{mockStats.pageViews.toLocaleString()}</p>
          <p className="text-xs text-emerald-400 mt-1">+12.4% from last week</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-purple-600/10 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">{copy.uniqueVisitors}</p>
          <p className="text-3xl font-bold text-white mt-2">{mockStats.uniqueVisitors.toLocaleString()}</p>
          <p className="text-xs text-emerald-400 mt-1">+8.2% from last week</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600/10 to-teal-600/10 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">{copy.avgSessionDuration}</p>
          <p className="text-3xl font-bold text-white mt-2">{mockStats.avgDuration}</p>
          <p className="text-xs text-emerald-400 mt-1">+0:23 from last week</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-orange-600/10 to-amber-600/10 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">{copy.bounceRate}</p>
          <p className="text-3xl font-bold text-white mt-2">{mockStats.bounceRate}</p>
          <p className="text-xs text-red-400 mt-1">+2.1% from last week</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <h2 className="text-lg font-bold text-white mb-4">{copy.topPages}</h2>
          <div className="space-y-3">
            {mockTopPages.map((p, i) => (
              <div key={p.path} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-300">{i + 1}</span>
                  <span className="text-sm text-white">{p.path}</span>
                </div>
                <span className="text-sm font-semibold text-slate-400">{p.views.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Traffic Sources */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <h2 className="text-lg font-bold text-white mb-4">{copy.trafficSources}</h2>
          <div className="space-y-3">
            {mockSources.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">{s.name}</span>
                  <span className="text-slate-400">{s.visitors.toLocaleString()} ({s.percent}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${s.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Geographic Distribution */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h2 className="text-lg font-bold text-white mb-4">{copy.geoDistribution}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {mockGeo.map((g) => (
            <div key={g.country} className="rounded-xl border border-white/10 bg-slate-800/30 p-4 text-center">
              <span className="text-3xl">{g.flag}</span>
              <p className="text-sm font-semibold text-white mt-2">{g.country}</p>
              <p className="text-xs text-slate-400">{g.visitors.toLocaleString()} {copy.visitors.toLowerCase()}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Note */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
        <p className="text-sm text-amber-300">📊 {copy.connectAnalytics}</p>
      </div>
    </div>
  );
}
