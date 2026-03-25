import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, collectionGroup, doc, getDocs, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${firebaseProjectId}.firebaseapp.com`,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${firebaseProjectId}-default-rtdb.firebaseio.com`,
  projectId: firebaseProjectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${firebaseProjectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "478592036466",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:478592036466:web:f149e594436026717adceb",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-YJY5T6TD8E",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeGender = (gender, logo, fallback = "men") => {
  const value = String(gender || "").toLowerCase();
  const logoValue = String(logo || "").toLowerCase();

  if (
    value.includes("women") ||
    value.includes("female") ||
    value.includes("femin") ||
    logoValue.includes("women") ||
    logoValue.includes("female")
  ) {
    return "women";
  }

  if (value.includes("men") || value.includes("male") || value.includes("mascul")) {
    return "men";
  }

  return fallback;
};

const resolveEvaluation = (statsSource) => {
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

const [teamsSnapshot, rosterSnapshot] = await Promise.all([
  getDocs(collection(db, "teams")),
  getDocs(collectionGroup(db, "roster")),
]);

const teamsMap = new Map();
teamsSnapshot.docs.forEach((teamDoc) => {
  const data = teamDoc.data();
  teamsMap.set(teamDoc.id, {
    teamName: ([data.city, data.name].filter(Boolean).join(" ").trim() || "Unknown").replace(/^espoir\s+espoir\s+/i, "Espoir "),
    teamGender: normalizeGender(data.gender, data.logo, "men"),
    teamLogo: data.logo || "/logos/liprobakin.png",
  });
});

const players = rosterSnapshot.docs
  .map((playerDoc) => {
    const data = playerDoc.data();
    if (data.isTestPlayer === true || data.isMockPlayer === true) {
      return null;
    }

    const teamId = String(data.teamId || playerDoc.ref.parent.parent?.id || "");
    const teamMeta = teamsMap.get(teamId);
    if (!teamMeta) {
      return null;
    }

    const firstName = data.firstName || "";
    const lastName = data.lastName || "";
    const name = (data.name || `${firstName} ${lastName}`).trim();
    const stats = data.stats ?? data.leaderboard ?? data.statsTotals ?? {};
    const hasRealStat = ["pts", "reb", "ast", "blk", "stl", "points", "rebounds", "assists", "blocks", "steals"]
      .some((key) => toNumber(stats[key]) > 0);

    if (!name || !hasRealStat) {
      return null;
    }

    return {
      id: `${teamId}:${playerDoc.id}`,
      name,
      firstName,
      lastName,
      number: String(data.jerseyNumber ?? data.number ?? ""),
      teamName: teamMeta.teamName,
      teamGender: teamMeta.teamGender,
      teamLogo: teamMeta.teamLogo,
      headshot: data.headshot || null,
      isImport: data.isImport || false,
      stats: {
        pts: toNumber(stats.pts ?? stats.points),
        reb: toNumber(stats.reb ?? stats.rebounds),
        ast: toNumber(stats.ast ?? stats.assists),
        blk: toNumber(stats.blk ?? stats.blocks),
        stl: toNumber(stats.stl ?? stats.steals),
        evl: resolveEvaluation(stats),
      },
    };
  })
  .filter(Boolean)
  .sort((a, b) => b.stats.pts - a.stats.pts)
  .slice(0, 40);

await setDoc(
  doc(db, "publicCache", "homeProjector"),
  {
    players,
    updatedAt: serverTimestamp(),
    source: "seed-home-projector-cache",
  },
  { merge: true }
);

console.log(`Seeded ${players.length} projector players.`);