"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAllStarSettings } from "@/lib/allstar-settings";
import { doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

const VOTE_KEY    = "allstar_voter_phone";    // set by vote page on submit
const COUNT_KEY   = "allstar_banner_count";   // number of times banner has been shown
const DAY_KEY     = "allstar_banner_last_day"; // ISO date (YYYY-MM-DD) of last show
const VERSION_KEY = "allstar_banner_version"; // tracks admin reset token

const todayStr = () => new Date().toISOString().slice(0, 10);

const translations = {
  en: {
    title: "All-Star Voting is Open!",
    subtitle: "Vote for your favorite players for the 2026 All-Star Game",
    voteNow: "Vote Now",
    dismiss: "Maybe Later",
  },
  fr: {
    title: "Le Vote All-Star est Ouvert!",
    subtitle: "Votez pour vos joueurs préférés pour le Match All-Star 2026",
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
  const [allStarEnabled, setAllStarEnabled] = useState<boolean | null>(null);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);

  useEffect(() => {
    getAllStarSettings().then((s) => {
      setAllStarEnabled(s.enabled);
      setCheckingSettings(false);
    });
    getDoc(doc(firebaseDB, "settings", "allStarBanner"))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.url) setBannerImageUrl(data.url as string);
        // If admin incremented the version, reset the local banner counter
        const serverVersion = String(data.version ?? 0);
        try {
          if (localStorage.getItem(VERSION_KEY) !== serverVersion) {
            localStorage.removeItem(COUNT_KEY);
            localStorage.removeItem(DAY_KEY);
            localStorage.setItem(VERSION_KEY, serverVersion);
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Only show on the home page
    const isHome = pathname === "/" || pathname === "/home";
    if (!isHome) return;
    if (!allStarEnabled || checkingSettings) return;

    // Never show if user already voted this session
    try {
      if (sessionStorage.getItem(VOTE_KEY)) return;
    } catch {}

    let count = 0;
    let lastDay = "";
    try {
      count   = parseInt(localStorage.getItem(COUNT_KEY) ?? "0", 10);
      lastDay = localStorage.getItem(DAY_KEY) ?? "";
    } catch {}

    const today = todayStr();
    // Show for the first 3 visits unconditionally, then once per calendar day
    if (count < 3 || lastDay !== today) {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(COUNT_KEY, String(count + 1));
          localStorage.setItem(DAY_KEY, today);
        } catch {}
        setIsOpen(true);
        setTimeout(() => setIsAnimating(true), 50);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allStarEnabled, checkingSettings, pathname]);

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

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Banner image (full-width, shown only when uploaded) */}
          {bannerImageUrl && (
            <div className="relative w-full" style={{ aspectRatio: "2.5/1" }}>
              <Image
                src={bannerImageUrl}
                alt="All-Star Vote"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
                priority
              />
            </div>
          )}

          {/* Content — no background basketball icon when we have an image */}
          <div className={`relative p-7 md:p-10 ${!bannerImageUrl ? "pt-12" : ""}`}>
            {!bannerImageUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 opacity-15">
                  <svg className="w-full h-full text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
              </div>
            )}

            <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-center mb-3">
              {t.title}
            </h2>
            <p className="text-slate-300 text-center text-base mb-7 max-w-md mx-auto">
              {t.subtitle}
            </p>

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
