import { collection, getDocs } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { normalizeTeamGender } from "@/lib/team-gender";

export type CachedTeam = {
  id: string;
  name: string;
  city: string;
  gender: string;
};

const TEAMS_CACHE_KEY = "febaco:teams:v1";
const TEAMS_CACHE_TTL_MS = 1000 * 60 * 15;

type TeamsCachePayload = {
  savedAt: number;
  teams: CachedTeam[];
};

const isValidPayload = (payload: unknown): payload is TeamsCachePayload => {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as TeamsCachePayload;
  return typeof candidate.savedAt === "number" && Array.isArray(candidate.teams);
};

export const readTeamsFromCache = (): CachedTeam[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TEAMS_CACHE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!isValidPayload(parsed)) return [];

    const isExpired = Date.now() - parsed.savedAt > TEAMS_CACHE_TTL_MS;
    if (isExpired) return [];

    return parsed.teams;
  } catch {
    return [];
  }
};

const writeTeamsToCache = (teams: CachedTeam[]) => {
  if (typeof window === "undefined") return;

  try {
    const payload: TeamsCachePayload = {
      savedAt: Date.now(),
      teams,
    };
    window.localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

export const fetchTeamsAndRefreshCache = async (): Promise<CachedTeam[]> => {
  const teamsSnapshot = await getDocs(collection(firebaseDB, "teams"));
  const teams = teamsSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name || doc.id,
    city: doc.data().city || "",
    gender: normalizeTeamGender(doc.data().gender, doc.data().logo, "men"),
  }));

  writeTeamsToCache(teams);
  return teams;
};