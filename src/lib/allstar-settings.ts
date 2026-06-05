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

// Module-level promise cache — one Firestore read shared across all components per page load
let _eligibilityPromise: Promise<Set<string>> | null = null;

/**
 * Returns the set of player IDs eligible for All-Star voting, flattened across
 * all teams from settings/allStarEligibility { teams: { [teamId]: string[] } }.
 * Fails closed: on error or missing doc, returns an empty set (nobody eligible).
 */
export function getAllStarEligibility(): Promise<Set<string>> {
  if (!_eligibilityPromise) {
    _eligibilityPromise = getDoc(doc(firebaseDB, "settings", "allStarEligibility"))
      .then((snap) => {
        const teams = (snap.exists() ? snap.data().teams : undefined) as
          | Record<string, string[]>
          | undefined;
        const set = new Set<string>();
        if (teams) {
          for (const ids of Object.values(teams)) {
            for (const id of ids || []) set.add(id);
          }
        }
        return set;
      })
      .catch(() => new Set<string>());
  }
  return _eligibilityPromise;
}
