"use client";

import React from "react";
import { useAdmin } from "../layout";

const translations = {
  en: {
    title: "Error Monitoring & Observability",
    subtitle: "Access Grafana for full error monitoring, logs, and metrics",
    openGrafana: "Open Grafana Dashboard",
    grafanaDesc: "Grafana provides comprehensive error monitoring, log analysis, and metrics visualization.",
    setupTitle: "Observability Stack",
    setupDesc: "Your project includes a full observability stack with Docker:",
    services: [
      { name: "Grafana", port: "3001", desc: "Visualization & Dashboards", icon: "📊" },
      { name: "Prometheus", port: "9090", desc: "Metrics Collection", icon: "📈" },
      { name: "Loki", port: "3100", desc: "Log Aggregation", icon: "📝" },
      { name: "Tempo", port: "3200", desc: "Distributed Tracing", icon: "🔍" },
      { name: "Promtail", port: "-", desc: "Log Shipper", icon: "📤" },
    ],
    howToStart: "How to Start",
    startCommand: "docker-compose up -d",
    credentials: "Default Credentials",
    username: "Username",
    password: "Password",
    features: "Features",
    featureList: [
      "Real-time error tracking and alerting",
      "Log aggregation and search with Loki",
      "Application metrics with Prometheus",
      "Distributed tracing with Tempo",
      "Custom dashboards and visualizations",
      "Alerting rules and notifications",
    ],
  },
  fr: {
    title: "Surveillance des Erreurs",
    subtitle: "Accédez à Grafana pour une surveillance complète des erreurs, journaux et métriques",
    openGrafana: "Ouvrir Grafana",
    grafanaDesc: "Grafana fournit une surveillance complète des erreurs, une analyse des journaux et une visualisation des métriques.",
    setupTitle: "Stack d'Observabilité",
    setupDesc: "Votre projet inclut un stack d'observabilité complet avec Docker:",
    services: [
      { name: "Grafana", port: "3001", desc: "Visualisation & Tableaux de bord", icon: "📊" },
      { name: "Prometheus", port: "9090", desc: "Collection de Métriques", icon: "📈" },
      { name: "Loki", port: "3100", desc: "Agrégation de Logs", icon: "📝" },
      { name: "Tempo", port: "3200", desc: "Traçage Distribué", icon: "🔍" },
      { name: "Promtail", port: "-", desc: "Expéditeur de Logs", icon: "📤" },
    ],
    howToStart: "Comment Démarrer",
    startCommand: "docker-compose up -d",
    credentials: "Identifiants par Défaut",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    features: "Fonctionnalités",
    featureList: [
      "Suivi des erreurs en temps réel et alertes",
      "Agrégation et recherche de logs avec Loki",
      "Métriques d'application avec Prometheus",
      "Traçage distribué avec Tempo",
      "Tableaux de bord personnalisés",
      "Règles d'alerte et notifications",
    ],
  },
};

export default function ErrorsPage() {
  const { language } = useAdmin();
  const t = translations[language];

  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3001";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Open Grafana CTA */}
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-600/20 to-amber-600/20 p-4 sm:p-8">
        <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center text-4xl sm:text-5xl">
            📊
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Grafana Dashboard</h2>
            <p className="text-slate-300 text-sm sm:text-base">{t.grafanaDesc}</p>
          </div>
          <a
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto text-center px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all text-base sm:text-lg"
          >
            {t.openGrafana} →
          </a>
        </div>
      </div>

      {/* Stack Overview */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white mb-2">{t.setupTitle}</h2>
        <p className="text-slate-400 text-sm mb-6">{t.setupDesc}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {t.services.map((service) => (
            <div
              key={service.name}
              className="rounded-xl border border-white/10 bg-slate-800/50 p-3 sm:p-4 text-center"
            >
              <span className="text-2xl sm:text-3xl">{service.icon}</span>
              <h3 className="font-semibold text-white mt-2">{service.name}</h3>
              <p className="text-xs text-slate-400">{service.desc}</p>
              <p className="text-xs text-orange-400 mt-1 font-mono">:{service.port}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* How to Start */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t.howToStart}</h2>
          <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm">
            <p className="text-slate-500 mb-2"># Start all services</p>
            <p className="text-green-400">{t.startCommand}</p>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-white/10">
            <h3 className="font-semibold text-white mb-2">{t.credentials}</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-400">{t.username}:</span> <span className="text-white font-mono">admin</span></p>
              <p><span className="text-slate-400">{t.password}:</span> <span className="text-white font-mono">admin</span></p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t.features}</h2>
          <ul className="space-y-3">
            {t.featureList.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-slate-300 text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-slate-800/50 p-4 hover:border-orange-500/50 transition-all group"
        >
          <span className="text-2xl">📊</span>
          <h3 className="font-semibold text-white mt-2 group-hover:text-orange-400">Grafana</h3>
          <p className="text-xs text-slate-400">localhost:3001</p>
        </a>
        <a
          href="http://localhost:9090"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-slate-800/50 p-4 hover:border-blue-500/50 transition-all group"
        >
          <span className="text-2xl">📈</span>
          <h3 className="font-semibold text-white mt-2 group-hover:text-blue-400">Prometheus</h3>
          <p className="text-xs text-slate-400">localhost:9090</p>
        </a>
        <a
          href="http://localhost:3100"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-slate-800/50 p-4 hover:border-purple-500/50 transition-all group"
        >
          <span className="text-2xl">📝</span>
          <h3 className="font-semibold text-white mt-2 group-hover:text-purple-400">Loki</h3>
          <p className="text-xs text-slate-400">localhost:3100</p>
        </a>
        <a
          href="http://localhost:3200"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-slate-800/50 p-4 hover:border-cyan-500/50 transition-all group"
        >
          <span className="text-2xl">🔍</span>
          <h3 className="font-semibold text-white mt-2 group-hover:text-cyan-400">Tempo</h3>
          <p className="text-xs text-slate-400">localhost:3200</p>
        </a>
      </div>
    </div>
  );
}
