"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllStarSettings } from "@/lib/allstar-settings";

const translations = {
  en: {
    title: "All-Star Voting is Open!",
    subtitle: "Vote for your favorite players and coaches for the 2026 All-Star Game",
    voteNow: "Vote Now",
    dismiss: "Maybe Later",
  },
  fr: {
    title: "Le Vote All-Star est Ouvert!",
    subtitle: "Votez pour vos joueurs et entraîneurs préférés pour le Match All-Star 2026",
    voteNow: "Voter Maintenant",
    dismiss: "Plus Tard",
  },
};

export default function AllStarVoteBanner() {
  const { language } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const t = translations[language];

  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [allStarEnabled, setAllStarEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    getAllStarSettings().then((s) => {
      setAllStarEnabled(s.enabled);
      setCheckingSettings(false);
    });
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/vote")) return;
    if (!allStarEnabled || checkingSettings) return;
    const BANNER_KEY = "allstar_banner_views";
    const views = parseInt(localStorage.getItem(BANNER_KEY) ?? "0", 10);
    if (views >= 2) return; // already shown twice
    const timer = setTimeout(() => {
      localStorage.setItem(BANNER_KEY, String(views + 1));
      setIsOpen(true);
      setTimeout(() => setIsAnimating(true), 50);
    }, 2000);
    return () => clearTimeout(timer);
  }, [allStarEnabled, checkingSettings, pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/vote")) {
      setIsAnimating(false);
      setIsOpen(false);
    }
  }, [pathname]);

  const handleVoteNow = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsOpen(false);
      router.push("/vote");
    }, 300);
  };

  const handleDismiss = () => {
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 300);
  };

  if (!isOpen || !allStarEnabled) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className={`fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 transition-all duration-300 ${
          isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {/* Basketball Icon Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 opacity-20">
              <svg
                className="w-full h-full text-orange-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.9" />
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-1.46 0-2.82-.4-4-1.08V17.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5v1.42c-1.18.68-2.54 1.08-4 1.08zm6-3.25c0-1.38-1.12-2.5-2.5-2.5h-5c-1.38 0-2.5 1.12-2.5 2.5V17c-1.82-1.47-3-3.72-3-6.25 0-4.41 3.59-8 8-8s8 3.59 8 8c0 2.53-1.18 4.78-3 6.25v-.5z"
                  fill="white"
                  opacity="0.3"
                />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="relative p-8 md:p-12">
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-center mb-4">
              {t.title}
            </h2>

            {/* Subtitle */}
            <p className="text-slate-300 text-center text-lg mb-8 max-w-md mx-auto">
              {t.subtitle}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleVoteNow}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg shadow-emerald-600/50 transition-all transform hover:scale-105 active:scale-95"
              >
                {t.voteNow}
              </button>
              <button
                onClick={handleDismiss}
                className="bg-slate-700/50 hover:bg-slate-700 text-white font-semibold px-8 py-4 rounded-xl transition-all"
              >
                {t.dismiss}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
