import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { firebaseDB } from "@/lib/firebase";

type UpdateLiveGameWithAnnouncementArgs = {
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  patch: Record<string, unknown>;
};

const normalizeTeamLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const buildLiveAnnouncementPayload = (homeTeamName: string, awayTeamName: string) => {
  const home = normalizeTeamLabel(homeTeamName);
  const away = normalizeTeamLabel(awayTeamName);
  const matchup = `${away} vs ${home}`;

  return {
    title: `🔴 EN DIRECT : ${matchup}`,
    title_en: `🔴 LIVE: ${matchup}`,
    headline: matchup,
    headline_en: matchup,
    summary: "Nous sommes en direct. Suivez le score en live.",
    summary_en: "We are live now. Follow the live score.",
    category: "Live",
    author: "LIPROBAKIN",
    authorPhoto: null,
    imageUrl: null,
    additionalMedia: null,
    additionalImageUrls: null,
    videoUrl: null,
    imagePosition: 50,
    videoTrimStart: 0,
    videoTrimEnd: null,
    videoScale: 1,
    videoOffsetX: 0,
    videoOffsetY: 0,
    isPaused: false,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
};

const coerceNonEmptyString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
};

/**
 * Updates a game document (typically setting it live) and ensures a single news
 * announcement exists for that game.
 *
 * Idempotency: announcement doc id is deterministic (`live-${gameId}`) and the
 * game is stamped with `liveAnnouncementId`.
 */
export async function updateLiveGameWithAnnouncement({
  gameId,
  homeTeamName,
  awayTeamName,
  patch,
}: UpdateLiveGameWithAnnouncementArgs): Promise<{ announcementId: string }> {
  const defaultAnnouncementId = `live-${gameId}`;
  const gameRef = doc(firebaseDB, "games", gameId);

  const result = await runTransaction(firebaseDB, async (tx) => {
    const gameSnap = await tx.get(gameRef);
    const gameData = gameSnap.exists() ? (gameSnap.data() as Record<string, unknown>) : {};
    const existingAnnouncementId = coerceNonEmptyString(gameData.liveAnnouncementId);
    const announcementId = existingAnnouncementId || defaultAnnouncementId;
    const announcementRef = doc(firebaseDB, "news", announcementId);

    const announcementSnap = await tx.get(announcementRef);
    if (!announcementSnap.exists()) {
      const payload = buildLiveAnnouncementPayload(homeTeamName, awayTeamName);
      tx.set(
        announcementRef,
        {
          ...payload,
          liveGameId: gameId,
          source: "auto_live_announcement",
        },
        { merge: true }
      );
    }

    tx.update(gameRef, {
      ...patch,
      liveAnnouncementId: announcementId,
      updatedAt: serverTimestamp(),
    });

    return { announcementId };
  });

  return result;
}
