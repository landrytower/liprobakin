import { collection, collectionGroup, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

import { firebaseDB } from "@/lib/firebase/firestore";
import { normalizeTeamGender } from "@/lib/team-gender";

export const HOME_PROJECTOR_COLLECTION = "publicCache";
export const HOME_PROJECTOR_DOC = "homeProjector";

export type HomeProjectorPlayer = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  number: string;
  teamName: string;
  teamGender: string;
  teamLogo: string;
  headshot: string | null;
  isImport: boolean;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    blk: number;
    stl: number;
    evl: number;
  };
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().replace(/,/g, ".").replace(/[^0-9.+\-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const resolveEvaluation = (statsSource: Record<string, unknown>) => {
  const evStored = toNumber(statsSource.evl ?? statsSource.ev ?? statsSource.eff);
  if (evStored !== 0) {
    return evStored;
  }

  const pts = toNumber(statsSource.pts ?? statsSource.points);
  const rebDirect = toNumber(statsSource.reb ?? statsSource.rebounds);
  const oreb = toNumber(statsSource.oreb ?? statsSource.offensiveRebounds);
  const dreb = toNumber(statsSource.dreb ?? statsSource.defensiveRebounds);
  const reb = rebDirect > 0 ? rebDirect : oreb + dreb;
  const ast = toNumber(statsSource.ast ?? statsSource.assists);
  const stl = toNumber(statsSource.stl ?? statsSource.steals);
  const blk = toNumber(statsSource.blk ?? statsSource.blocks);
  const turnovers = toNumber(statsSource.to ?? statsSource.turnovers);
  const twoPa = toNumber(statsSource.two_pa ?? statsSource.twoPointsAttempted);
  const threePa = toNumber(statsSource.three_pa ?? statsSource.threePointsAttempted);
  const twoPm = toNumber(statsSource.two_pm ?? statsSource.twoPointsMade);
  const threePm = toNumber(statsSource.three_pm ?? statsSource.threePointsMade);
  const fga = toNumber(statsSource.fga ?? statsSource.fieldGoalsAttempted) || (twoPa + threePa);
  const fgm = toNumber(statsSource.fgm ?? statsSource.fieldGoalsMade) || (twoPm + threePm);
  const fta = toNumber(statsSource.ft_a ?? statsSource.freeThrowsAttempted);
  const ftm = toNumber(statsSource.ft_m ?? statsSource.freeThrowsMade);

  return pts + reb + ast + stl + blk - turnovers - (fga - fgm) - (fta - ftm);
};

export async function recomputeHomeProjectorCache(): Promise<void> {
  try {
    const players = await fetchHomeProjectorPlayers();

    await setDoc(
      doc(firebaseDB, HOME_PROJECTOR_COLLECTION, HOME_PROJECTOR_DOC),
      {
        players,
        updatedAt: serverTimestamp(),
        source: "recomputeHomeProjectorCache",
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Failed to recompute home projector cache:", error);
  }
}

export async function fetchHomeProjectorPlayers(): Promise<HomeProjectorPlayer[]> {
  const [teamsSnapshot, rosterSnapshot] = await Promise.all([
    getDocs(collection(firebaseDB, "teams")),
    getDocs(collectionGroup(firebaseDB, "roster")),
  ]);

  const teamsMap = new Map<string, { teamName: string; teamGender: string; teamLogo: string }>();
  teamsSnapshot.docs.forEach((teamDoc) => {
    const teamData = teamDoc.data();
    const rawTeamName = [teamData.city, teamData.name].filter(Boolean).join(" ").trim() || "Unknown";
    teamsMap.set(teamDoc.id, {
      teamName: rawTeamName.replace(/^espoir\s+espoir\s+/i, "Espoir "),
      teamGender: normalizeTeamGender(teamData.gender, teamData.logo, "men"),
      teamLogo: teamData.logo || "/logos/liprobakin.png",
    });
  });

  return rosterSnapshot.docs
    .map((playerDoc) => {
      const playerData = playerDoc.data();
      if (playerData.isTestPlayer === true || playerData.isMockPlayer === true) {
        return null;
      }

      const teamId = String(playerData.teamId || playerDoc.ref.parent.parent?.id || "");
      const teamMeta = teamsMap.get(teamId);
      if (!teamMeta) {
        return null;
      }

      const firstName = playerData.firstName || "";
      const lastName = playerData.lastName || "";
      const playerName = (playerData.name || `${firstName} ${lastName}`).trim();
      const statsSource = (playerData.stats ?? playerData.leaderboard ?? playerData.statsTotals ?? {}) as Record<string, unknown>;
      const hasAnyRealStat = ["pts", "reb", "ast", "blk", "stl", "points", "rebounds", "assists", "blocks", "steals"]
        .some((key) => toNumber(statsSource[key]) > 0);

      if (!playerName || !hasAnyRealStat) {
        return null;
      }

      return {
        id: `${teamId}:${playerDoc.id}`,
        name: playerName,
        firstName,
        lastName,
        number: String(playerData.jerseyNumber ?? playerData.number ?? ""),
        teamName: teamMeta.teamName,
        teamGender: teamMeta.teamGender,
        teamLogo: teamMeta.teamLogo,
        headshot: playerData.headshot || null,
        isImport: playerData.isImport || false,
        stats: {
          pts: toNumber(statsSource.pts ?? statsSource.points),
          reb: toNumber(statsSource.reb ?? statsSource.rebounds),
          ast: toNumber(statsSource.ast ?? statsSource.assists),
          blk: toNumber(statsSource.blk ?? statsSource.blocks),
          stl: toNumber(statsSource.stl ?? statsSource.steals),
          evl: resolveEvaluation(statsSource),
        },
      };
    })
    .filter((player): player is HomeProjectorPlayer => Boolean(player))
    .sort((a, b) => b.stats.pts - a.stats.pts)
    .slice(0, 40);
}