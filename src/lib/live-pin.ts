"use client";

export const PINNED_LIVE_GAME_ID_KEY = "liprobakin:pinnedLiveGameId";
export const LIVE_PIN_CHANGED_EVENT = "liprobakin:live-pin-changed";

export function readPinnedLiveGameId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PINNED_LIVE_GAME_ID_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writePinnedLiveGameId(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PINNED_LIVE_GAME_ID_KEY, String(gameId));
  } catch {
    // ignore
  }
}

export function clearPinnedLiveGameId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PINNED_LIVE_GAME_ID_KEY);
  } catch {
    // ignore
  }
}

export function emitLivePinChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LIVE_PIN_CHANGED_EVENT));
}
