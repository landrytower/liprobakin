"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

export default function AllStarThemeProvider() {
  useEffect(() => {
    const unsub = onSnapshot(
      doc(firebaseDB, "settings", "allStar"),
      (snap) => {
        const active = snap.exists() ? snap.data().allStarTheme === true : false;
        if (active) {
          document.documentElement.setAttribute("data-theme", "allstar");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  return null;
}
