import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

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

const teamsSnap = await getDocs(collection(db, "teams"));
const gamesSnap = await getDocs(collection(db, "games"));

const teams = teamsSnap.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((team) => String(team.name || "").toLowerCase().includes("bosco"));

console.log("TEAMS");
for (const team of teams) {
  console.log(JSON.stringify({
    id: team.id,
    city: team.city || "",
    name: team.name || "",
    gender: team.gender || "",
    wins: team.wins ?? null,
    losses: team.losses ?? null,
    totalPoints: team.totalPoints ?? null,
  }, null, 2));
}

const teamIds = new Set(teams.map((team) => team.id));

const games = gamesSnap.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((game) =>
    teamIds.has(String(game.homeTeamId || "")) ||
    teamIds.has(String(game.awayTeamId || "")) ||
    String(game.homeTeamName || "").toLowerCase().includes("bosco") ||
    String(game.awayTeamName || "").toLowerCase().includes("bosco")
  );

console.log("GAMES");
for (const game of games) {
  console.log(JSON.stringify({
    id: game.id,
    gender: game.gender || "",
    completed: game.completed ?? null,
    archived: game.archived ?? null,
    status: game.status || "",
    homeTeamId: game.homeTeamId || "",
    awayTeamId: game.awayTeamId || "",
    homeTeamName: game.homeTeamName || "",
    awayTeamName: game.awayTeamName || "",
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null,
    winnerTeamId: game.winnerTeamId || game.winnerId || "",
    winnerScore: game.winnerScore ?? null,
    loserTeamId: game.loserTeamId || "",
    loserScore: game.loserScore ?? null,
  }, null, 2));
}