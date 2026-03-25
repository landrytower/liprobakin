import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { firebaseDB } from "@/lib/firebase/firestore";

export const HOME_STATS_SETTINGS_DOC = "global";
export const HOME_STATS_VERSION_FIELD = "homeStatsVersion";

export async function bumpHomeStatsVersion(updatedBy?: string) {
  await setDoc(
    doc(firebaseDB, "siteSettings", HOME_STATS_SETTINGS_DOC),
    {
      [HOME_STATS_VERSION_FIELD]: Date.now(),
      homeStatsUpdatedAt: serverTimestamp(),
      homeStatsUpdatedBy: updatedBy || "unknown",
    },
    { merge: true }
  );
}