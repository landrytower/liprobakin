"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

export default function AllStarFloatingButton() {
  const pathname = usePathname();
  const [allStarEnabled, setAllStarEnabled] = useState(true);

  // Check if All-Star is enabled in Firebase
  useEffect(() => {
    const checkSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(firebaseDB, "settings", "allStar"));
        const enabled = settingsDoc.exists() ? settingsDoc.data().enabled : true;
        setAllStarEnabled(enabled);
      } catch (error) {
        console.error("Error checking All-Star settings:", error);
        setAllStarEnabled(true);
      }
    };
    checkSettings();
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/vote") || !allStarEnabled) return null;

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
