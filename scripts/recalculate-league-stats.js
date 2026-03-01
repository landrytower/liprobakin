/*
  Run with: node scripts/recalculate-league-stats.js

  What it does:
  - Rebuilds team wins/losses from completed games
  - Rebuilds roster player averages + gamesPlayed from game.playerStats
  - Falls back to playerGameStats when game.playerStats is missing
  - Does NOT delete any source game/stat documents
*/

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "febakin",
  });
}

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

function createEmptyTotals() {
  return {
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
  };
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getString(value) {
  return typeof value === "string" ? value : "";
}

function addToTotals(totals, values) {
  totals.games += values.games || 0;
  totals.pts += values.pts || 0;
  totals.two_pm += values.two_pm || 0;
  totals.two_pa += values.two_pa || 0;
  totals.three_pm += values.three_pm || 0;
  totals.three_pa += values.three_pa || 0;
  totals.ft_m += values.ft_m || 0;
  totals.ft_a += values.ft_a || 0;
  totals.ast += values.ast || 0;
  totals.oreb += values.oreb || 0;
  totals.dreb += values.dreb || 0;
  totals.reb += values.reb || 0;
  totals.stl += values.stl || 0;
  totals.blk += values.blk || 0;
  totals.min += values.min || 0;
  totals.pf += values.pf || 0;
  totals.to += values.to || 0;
}

function normalizeTotalsFromGameEntry(entry) {
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
}

function normalizeTotalsFromPlayerGameStat(entry) {
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
  const pts = toNumber(entry.pts) || twoPm * 2 + threePm * 3 + ftm;

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
}

function getAverages(totals) {
  const games = totals?.games || 0;
  const avg = (value) => (games > 0 ? (value / games).toFixed(1) : "0.0");

  return {
    stats: {
      pts: avg(totals?.pts || 0),
      two_pm: avg(totals?.two_pm || 0),
      two_pa: avg(totals?.two_pa || 0),
      three_pm: avg(totals?.three_pm || 0),
      three_pa: avg(totals?.three_pa || 0),
      ft_m: avg(totals?.ft_m || 0),
      ft_a: avg(totals?.ft_a || 0),
      ast: avg(totals?.ast || 0),
      oreb: avg(totals?.oreb || 0),
      dreb: avg(totals?.dreb || 0),
      reb: avg(totals?.reb || 0),
      stl: avg(totals?.stl || 0),
      blk: avg(totals?.blk || 0),
      min: avg(totals?.min || 0),
      pf: avg(totals?.pf || 0),
      to: avg(totals?.to || 0),
    },
    gamesPlayed: games,
    updatedAt: serverTimestamp(),
  };
}

async function commitUpdatesInChunks(updates, chunkSize = 400) {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const item of chunk) {
      batch.update(item.ref, item.data);
    }
    await batch.commit();
  }
}

async function recalculateLeagueStats() {
  console.log("📥 Loading teams, games, and playerGameStats...");
  const [teamsSnapshot, gamesSnapshot, playerGameStatsSnapshot] = await Promise.all([
    db.collection("teams").get(),
    db.collection("games").get(),
    db.collection("playerGameStats").get(),
  ]);

  const teamRecords = new Map();
  const totalsByTeamPlayer = new Map();
  const totalsByPlayer = new Map();
  const completedGameIds = new Set();
  const processedGamePlayerKeys = new Set();

  for (const teamDoc of teamsSnapshot.docs) {
    teamRecords.set(teamDoc.id, { wins: 0, losses: 0 });
    totalsByTeamPlayer.set(teamDoc.id, new Map());
  }

  for (const gameDoc of gamesSnapshot.docs) {
    const gameData = gameDoc.data() || {};
    const gameId = gameDoc.id;

    const status = getString(gameData.status);
    const winnerId = getString(gameData.winnerId) || getString(gameData.winnerTeamId);
    const homeTeamId = getString(gameData.homeTeamId);
    const awayTeamId = getString(gameData.awayTeamId);
    const completed = status === "completed" || gameData.completed === true || Boolean(winnerId);

    if (!completed) continue;
    completedGameIds.add(gameId);

    if (winnerId && teamRecords.has(winnerId)) {
      const winnerRecord = teamRecords.get(winnerId);
      winnerRecord.wins += 1;

      const loserId = winnerId === homeTeamId ? awayTeamId : homeTeamId;
      if (loserId && teamRecords.has(loserId)) {
        const loserRecord = teamRecords.get(loserId);
        loserRecord.losses += 1;
      }
    }

    if (!Array.isArray(gameData.playerStats)) continue;

    for (const item of gameData.playerStats) {
      if (!item || typeof item !== "object") continue;

      const teamId = getString(item.teamId);
      const playerId = getString(item.playerId);
      if (!playerId) continue;

      const normalized = normalizeTotalsFromGameEntry(item);

      const globalTotals = totalsByPlayer.get(playerId) || createEmptyTotals();
      addToTotals(globalTotals, normalized);
      totalsByPlayer.set(playerId, globalTotals);

      if (teamId && totalsByTeamPlayer.has(teamId)) {
        const teamMap = totalsByTeamPlayer.get(teamId);
        const teamTotals = teamMap.get(playerId) || createEmptyTotals();
        addToTotals(teamTotals, normalized);
        teamMap.set(playerId, teamTotals);
      }

      processedGamePlayerKeys.add(`${gameId}:${playerId}`);
    }
  }

  for (const statDoc of playerGameStatsSnapshot.docs) {
    const statData = statDoc.data() || {};
    const gameId = getString(statData.gameId);
    const playerId = getString(statData.playerId);
    const teamId = getString(statData.teamId);

    if (!gameId || !playerId) continue;
    if (!completedGameIds.has(gameId)) continue;
    if (processedGamePlayerKeys.has(`${gameId}:${playerId}`)) continue;

    const normalized = normalizeTotalsFromPlayerGameStat(statData);

    const globalTotals = totalsByPlayer.get(playerId) || createEmptyTotals();
    addToTotals(globalTotals, normalized);
    totalsByPlayer.set(playerId, globalTotals);

    if (teamId && totalsByTeamPlayer.has(teamId)) {
      const teamMap = totalsByTeamPlayer.get(teamId);
      const teamTotals = teamMap.get(playerId) || createEmptyTotals();
      addToTotals(teamTotals, normalized);
      teamMap.set(playerId, teamTotals);
    }
  }

  console.log("🧮 Rebuilding team records and roster stats...");
  for (const teamDoc of teamsSnapshot.docs) {
    const teamId = teamDoc.id;
    const rosterSnapshot = await db.collection(`teams/${teamId}/roster`).get();
    const rosterTotals = totalsByTeamPlayer.get(teamId) || new Map();
    const record = teamRecords.get(teamId) || { wins: 0, losses: 0 };

    const updates = [];
    updates.push({
      ref: teamDoc.ref,
      data: {
        wins: record.wins,
        losses: record.losses,
        updatedAt: serverTimestamp(),
      },
    });

    for (const playerDoc of rosterSnapshot.docs) {
      const totals = rosterTotals.get(playerDoc.id) || totalsByPlayer.get(playerDoc.id);
      updates.push({ ref: playerDoc.ref, data: getAverages(totals) });
    }

    await commitUpdatesInChunks(updates);
    console.log(`✅ Updated ${teamId}: ${rosterSnapshot.size} roster players`);
  }

  console.log("🎉 League stats recalculation complete.");
}

recalculateLeagueStats()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to recalculate league stats:", error);
    process.exit(1);
  });
