"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAllStarSettings } from "@/lib/allstar-settings";

export default function AllStarFloatingButton() {
  const pathname = usePathname();
  const [allStarEnabled, setAllStarEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getAllStarSettings().then((s) => setAllStarEnabled(s.enabled));
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/vote") || allStarEnabled !== true) return null;

  return (
    <Link
      href="/vote"
      className="fixed top-20 right-4 z-40 flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs px-3 py-2 rounded-full shadow-lg shadow-orange-500/40 transition-all hover:scale-105 active:scale-95 animate-pulse-slow"
      aria-label="All-Star Vote"
    >
      <span className="text-base leading-none">⭐</span>
      <span className="hidden sm:inline uppercase tracking-wide">All-Star Vote</span>
    </Link>
  );
}
