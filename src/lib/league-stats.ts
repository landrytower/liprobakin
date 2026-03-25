import {
  collection,
  getDocs,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

type Totals = {
  games: number;
  pts: number;
  two_pm: number;
  two_pa: number;
  three_pm: number;
  three_pa: number;
  ft_m: number;
  ft_a: number;
  ast: number;
  oreb: number;
  dreb: number;
  reb: number;
  stl: number;
  blk: number;
  min: number;
  pf: number;
  to: number;
};

const createEmptyTotals = (): Totals => ({
  games: 0,
  pts: 0,
  two_pm: 0,
  two_pa: 0,
  three_pm: 0,
  three_pa: 0,
  ft_m: 0,
  ft_a: 0,
  ast: 0,
  oreb: 0,
  dreb: 0,
  reb: 0,
  stl: 0,
  blk: 0,
  min: 0,
  pf: 0,
  to: 0,
});

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getString = (value: unknown): string => (typeof value === "string" ? value : "");

const addToTotals = (totals: Totals, values: Partial<Totals>) => {
  totals.games += values.games ?? 0;
  totals.pts += values.pts ?? 0;
  totals.two_pm += values.two_pm ?? 0;
  totals.two_pa += values.two_pa ?? 0;
  totals.three_pm += values.three_pm ?? 0;
  totals.three_pa += values.three_pa ?? 0;
  totals.ft_m += values.ft_m ?? 0;
  totals.ft_a += values.ft_a ?? 0;
  totals.ast += values.ast ?? 0;
  totals.oreb += values.oreb ?? 0;
  totals.dreb += values.dreb ?? 0;
  totals.reb += values.reb ?? 0;
  totals.stl += values.stl ?? 0;
  totals.blk += values.blk ?? 0;
  totals.min += values.min ?? 0;
  totals.pf += values.pf ?? 0;
  totals.to += values.to ?? 0;
};

const normalizeTotalsFromGameEntry = (entry: Record<string, unknown>): Partial<Totals> => {
  return {
    games: 1,
    pts: toNumber(entry.pts),
    two_pm: toNumber(entry.two_pm),
    two_pa: toNumber(entry.two_pa),
    three_pm: toNumber(entry.three_pm),
    three_pa: toNumber(entry.three_pa),
    ft_m: toNumber(entry.ft_m),
    ft_a: toNumber(entry.ft_a),
    ast: toNumber(entry.ast),
    oreb: toNumber(entry.oreb),
    dreb: toNumber(entry.dreb),
    reb: toNumber(entry.reb),
    stl: toNumber(entry.stl),
    blk: toNumber(entry.blk),
    min: toNumber(entry.min),
    pf: toNumber(entry.pf),
    to: toNumber(entry.to),
  };
};

const normalizeTotalsFromPlayerGameStat = (entry: Record<string, unknown>): Partial<Totals> => {
  const threePm = toNumber(entry.three_pm) || toNumber(entry.threePtMade);
  const threePa = toNumber(entry.three_pa) || toNumber(entry.threePtAttempted);
  const fgm = toNumber(entry.fieldGoalsMade);
  const fga = toNumber(entry.fieldGoalsAttempted);
  const twoPm = toNumber(entry.two_pm) || Math.max(fgm - threePm, 0);
  const twoPa = toNumber(entry.two_pa) || Math.max(fga - threePa, 0);
  const ftm = toNumber(entry.ft_m) || toNumber(entry.freeThrowsMade);
  const fta = toNumber(entry.ft_a) || toNumber(entry.freeThrowsAttempted);
  const oreb = toNumber(entry.oreb) || toNumber(entry.reboundsOff);
  const dreb = toNumber(entry.dreb) || toNumber(entry.reboundsDef);
  const reb = toNumber(entry.reb) || oreb + dreb;
  const ast = toNumber(entry.ast) || toNumber(entry.assists);
  const stl = toNumber(entry.stl) || toNumber(entry.steals);
  const blk = toNumber(entry.blk) || toNumber(entry.blocks);
  const turnovers = toNumber(entry.to) || toNumber(entry.turnovers);
  const minutes = toNumber(entry.min) || toNumber(entry.minutes);
  const fouls = toNumber(entry.pf) || toNumber(entry.personalFouls);
  const pts = toNumber(entry.pts) || (twoPm * 2) + (threePm * 3) + ftm;

  return {
    games: 1,
    pts,
    two_pm: twoPm,
    two_pa: twoPa,
    three_pm: threePm,
    three_pa: threePa,
    ft_m: ftm,
    ft_a: fta,
    ast,
    oreb,
    dreb,
    reb,
    stl,
    blk,
    min: minutes,
    pf: fouls,
    to: turnovers,
  };
};

export async function recalculateLeagueStatsFromGames(): Promise<void> {
  const [teamsSnapshot, gamesSnapshot, playerGameStatsSnapshot] = await Promise.all([
    getDocs(collection(firebaseDB, "teams")),
    getDocs(collection(firebaseDB, "games")),
    getDocs(collection(firebaseDB, "playerGameStats")),
  ]);

  const teamRecords = new Map<string, { wins: number; losses: number; totalPoints: number }>();
  const totalsByTeamPlayer = new Map<string, Map<string, Totals>>();
  const totalsByPlayer = new Map<string, Totals>();
  const completedGameIds = new Set<string>();
  const processedGamePlayerKeys = new Set<string>();

  teamsSnapshot.docs.forEach((teamDoc) => {
    teamRecords.set(teamDoc.id, { wins: 0, losses: 0, totalPoints: 0 });
    totalsByTeamPlayer.set(teamDoc.id, new Map<string, Totals>());
  });

  gamesSnapshot.docs.forEach((gameDoc) => {
    const gameData = gameDoc.data() as Record<string, unknown>;
    const gameId = gameDoc.id;

    const status = getString(gameData.status);
    const winnerId = getString(gameData.winnerId) || getString(gameData.winnerTeamId);
    const homeTeamId = getString(gameData.homeTeamId);
    const awayTeamId = getString(gameData.awayTeamId);
    const homeScore = toNumber(gameData.homeScore);
    const awayScore = toNumber(gameData.awayScore);
    const completed = status === "completed" || gameData.completed === true || Boolean(winnerId);

    if (!completed) return;
    completedGameIds.add(gameId);

    if (winnerId && teamRecords.has(winnerId)) {
      const winnerRecord = teamRecords.get(winnerId);
      if (winnerRecord) {
        winnerRecord.wins += 1;
      }

      const loserId = winnerId === homeTeamId ? awayTeamId : homeTeamId;
      if (loserId && teamRecords.has(loserId)) {
        const loserRecord = teamRecords.get(loserId);
        if (loserRecord) {
          loserRecord.losses += 1;
        }
      }
    }

    if (homeTeamId && teamRecords.has(homeTeamId)) {
      const homeRecord = teamRecords.get(homeTeamId);
      if (homeRecord) {
        homeRecord.totalPoints += homeScore;
      }
    }

    if (awayTeamId && teamRecords.has(awayTeamId)) {
      const awayRecord = teamRecords.get(awayTeamId);
      if (awayRecord) {
        awayRecord.totalPoints += awayScore;
      }
    }

    const playerStatsRaw = gameData.playerStats;
    if (!Array.isArray(playerStatsRaw)) return;

    playerStatsRaw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const entry = item as Record<string, unknown>;

      const teamId = getString(entry.teamId);
      const playerId = getString(entry.playerId);
      if (!playerId) return;

      const normalized = normalizeTotalsFromGameEntry(entry);
      const globalTotals = totalsByPlayer.get(playerId) ?? createEmptyTotals();
      addToTotals(globalTotals, normalized);
      totalsByPlayer.set(playerId, globalTotals);

      if (teamId && totalsByTeamPlayer.has(teamId)) {
        const teamMap = totalsByTeamPlayer.get(teamId);
        if (teamMap) {
          const teamTotals = teamMap.get(playerId) ?? createEmptyTotals();
          addToTotals(teamTotals, normalized);
          teamMap.set(playerId, teamTotals);
        }
      }

      processedGamePlayerKeys.add(`${gameId}:${playerId}`);
    });
  });

  playerGameStatsSnapshot.docs.forEach((statDoc) => {
    const statData = statDoc.data() as Record<string, unknown>;
    const gameId = getString(statData.gameId);
    const playerId = getString(statData.playerId);
    const teamId = getString(statData.teamId);

    if (!gameId || !playerId) return;
    if (!completedGameIds.has(gameId)) return;
    if (processedGamePlayerKeys.has(`${gameId}:${playerId}`)) return;

    const normalized = normalizeTotalsFromPlayerGameStat(statData);

    const globalTotals = totalsByPlayer.get(playerId) ?? createEmptyTotals();
    addToTotals(globalTotals, normalized);
    totalsByPlayer.set(playerId, globalTotals);

    if (teamId && totalsByTeamPlayer.has(teamId)) {
      const teamMap = totalsByTeamPlayer.get(teamId);
      if (teamMap) {
        const teamTotals = teamMap.get(playerId) ?? createEmptyTotals();
        addToTotals(teamTotals, normalized);
        teamMap.set(playerId, teamTotals);
      }
    }
  });

  for (const teamDoc of teamsSnapshot.docs) {
    const teamId = teamDoc.id;
    const rosterSnapshot = await getDocs(collection(firebaseDB, `teams/${teamId}/roster`));
    const rosterTotals = totalsByTeamPlayer.get(teamId) ?? new Map<string, Totals>();
    const record = teamRecords.get(teamId) ?? { wins: 0, losses: 0, totalPoints: 0 };

    const batch = writeBatch(firebaseDB);
    batch.update(teamDoc.ref, {
      wins: record.wins,
      losses: record.losses,
      totalPoints: record.totalPoints,
      updatedAt: serverTimestamp(),
    });

    rosterSnapshot.docs.forEach((playerDoc) => {
      const totals = rosterTotals.get(playerDoc.id) ?? totalsByPlayer.get(playerDoc.id);
      const games = totals?.games ?? 0;
      const avg = (value: number) => (games > 0 ? (value / games).toFixed(1) : "0.0");

      batch.update(playerDoc.ref, {
        stats: {
          pts: avg(totals?.pts ?? 0),
          two_pm: avg(totals?.two_pm ?? 0),
          two_pa: avg(totals?.two_pa ?? 0),
          three_pm: avg(totals?.three_pm ?? 0),
          three_pa: avg(totals?.three_pa ?? 0),
          ft_m: avg(totals?.ft_m ?? 0),
          ft_a: avg(totals?.ft_a ?? 0),
          ast: avg(totals?.ast ?? 0),
          oreb: avg(totals?.oreb ?? 0),
          dreb: avg(totals?.dreb ?? 0),
          reb: avg(totals?.reb ?? 0),
          stl: avg(totals?.stl ?? 0),
          blk: avg(totals?.blk ?? 0),
          min: avg(totals?.min ?? 0),
          pf: avg(totals?.pf ?? 0),
          to: avg(totals?.to ?? 0),
        },
        gamesPlayed: games,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }
}