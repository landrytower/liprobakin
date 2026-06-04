import { doc, getDoc } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

export interface AllStarSettings {
  enabled: boolean;
  allStarTheme: boolean;
}

// Module-level promise cache — one Firestore read shared across all components per page load
let _promise: Promise<AllStarSettings> | null = null;

export function getAllStarSettings(): Promise<AllStarSettings> {
  if (!_promise) {
    _promise = getDoc(doc(firebaseDB, "settings", "allStar"))
      .then((snap) => {
        const data = snap.exists() ? snap.data() : {};
        return {
          enabled: data.enabled !== false,
          allStarTheme: data.allStarTheme === true,
        };
      })
      .catch(() => ({ enabled: true, allStarTheme: false }));
  }
  return _promise;
}
