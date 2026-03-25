import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";

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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toText = (value) => (typeof value === "string" ? value : "");

const [teamsSnap, gamesSnap] = await Promise.all([
  getDocs(collection(db, "teams")),
  getDocs(collection(db, "games")),
]);

const teamRecords = new Map();
teamsSnap.docs.forEach((teamDoc) => {
  teamRecords.set(teamDoc.id, { wins: 0, losses: 0, totalPoints: 0 });
});

for (const gameDoc of gamesSnap.docs) {
  const data = gameDoc.data();
  const status = toText(data.status).toLowerCase();
  const completed = data.completed === true || data.archived === true || status === "completed" || status === "final" || status === "finished" || Boolean(data.winnerTeamId || data.winnerId);
  if (!completed) continue;

  const homeTeamId = toText(data.homeTeamId);
  const awayTeamId = toText(data.awayTeamId);
  const winnerTeamId = toText(data.winnerTeamId || data.winnerId);
  const homeScore = toNumber(data.homeScore);
  const awayScore = toNumber(data.awayScore);

  if (homeTeamId && teamRecords.has(homeTeamId)) {
    const record = teamRecords.get(homeTeamId);
    record.totalPoints += homeScore;
    if (winnerTeamId === homeTeamId) {
      record.wins += 1;
    } else if (awayTeamId && winnerTeamId === awayTeamId) {
      record.losses += 1;
    }
  }

  if (awayTeamId && teamRecords.has(awayTeamId)) {
    const record = teamRecords.get(awayTeamId);
    record.totalPoints += awayScore;
    if (winnerTeamId === awayTeamId) {
      record.wins += 1;
    } else if (homeTeamId && winnerTeamId === homeTeamId) {
      record.losses += 1;
    }
  }
}

let batch = writeBatch(db);
let opCount = 0;

for (const [teamId, record] of teamRecords.entries()) {
  batch.update(doc(db, "teams", teamId), {
    wins: record.wins,
    losses: record.losses,
    totalPoints: record.totalPoints,
    updatedAt: serverTimestamp(),
  });
  opCount += 1;

  if (opCount >= 400) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }
}

if (opCount > 0) {
  await batch.commit();
}

console.log(`Updated ${teamRecords.size} team records.`);