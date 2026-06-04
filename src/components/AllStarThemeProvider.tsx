"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

const STARS = [
  { id: 1,  char: "★", left: "7%",  top: "9%",  size: 12, delay: 0,    dur: 3.2 },
  { id: 2,  char: "✦", left: "19%", top: "5%",  size: 8,  delay: 0.6,  dur: 4.0 },
  { id: 3,  char: "★", left: "34%", top: "8%",  size: 15, delay: 1.2,  dur: 3.5 },
  { id: 4,  char: "✦", left: "50%", top: "3%",  size: 9,  delay: 0.3,  dur: 4.3 },
  { id: 5,  char: "★", left: "66%", top: "7%",  size: 11, delay: 1.5,  dur: 3.8 },
  { id: 6,  char: "✦", left: "80%", top: "5%",  size: 10, delay: 0.9,  dur: 4.6 },
  { id: 7,  char: "★", left: "93%", top: "10%", size: 13, delay: 2.0,  dur: 3.3 },
  { id: 8,  char: "✦", left: "3%",  top: "38%", size: 8,  delay: 1.8,  dur: 4.1 },
  { id: 9,  char: "★", left: "96%", top: "33%", size: 10, delay: 0.4,  dur: 3.7 },
  { id: 10, char: "✦", left: "12%", top: "72%", size: 9,  delay: 2.3,  dur: 4.4 },
  { id: 11, char: "★", left: "47%", top: "82%", size: 11, delay: 0.7,  dur: 3.6 },
  { id: 12, char: "✦", left: "78%", top: "76%", size: 8,  delay: 1.4,  dur: 4.5 },
  { id: 13, char: "★", left: "88%", top: "65%", size: 12, delay: 2.8,  dur: 3.4 },
  { id: 14, char: "✦", left: "27%", top: "55%", size: 7,  delay: 0.2,  dur: 5.0 },
  { id: 15, char: "★", left: "62%", top: "48%", size: 10, delay: 3.1,  dur: 3.9 },
];

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

  return (
    <div className="allstar-stars" aria-hidden="true">
      {STARS.map((s) => (
        <span
          key={s.id}
          className="allstar-star-char"
          style={{
            left: s.left,
            top: s.top,
            fontSize: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        >
          {s.char}
        </span>
      ))}
      {/* Shooting stars */}
      <span className="allstar-shoot" />
      <span className="allstar-shoot" />
      <span className="allstar-shoot" />
    </div>
  );
}
