import { config } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

config({ path: ".env.local" });

const SOURCE_PROJECT_ID = (process.env.MAIN_FIREBASE_PROJECT_ID || "").trim();
const SOURCE_CLIENT_EMAIL = (process.env.MAIN_FIREBASE_CLIENT_EMAIL || "").trim();
const SOURCE_PRIVATE_KEY = (process.env.MAIN_FIREBASE_PRIVATE_KEY || "")
  .replace(/\\r\\n/g, "\n")
  .replace(/\\n/g, "\n")
  .trim();

const TARGET_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || "").trim();
const TARGET_CLIENT_EMAIL = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
const TARGET_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || "")
  .replace(/\\r\\n/g, "\n")
  .replace(/\\n/g, "\n")
  .trim();

if (!SOURCE_PROJECT_ID || !SOURCE_CLIENT_EMAIL || !SOURCE_PRIVATE_KEY) {
  console.error("Missing MAIN_FIREBASE_PROJECT_ID / MAIN_FIREBASE_CLIENT_EMAIL / MAIN_FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

if (!TARGET_PROJECT_ID || !TARGET_CLIENT_EMAIL || !TARGET_PRIVATE_KEY) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

if (SOURCE_PROJECT_ID !== "ppop-35930") {
  console.error(`Refusing to read from unexpected source project: ${SOURCE_PROJECT_ID}`);
  process.exit(1);
}

if (TARGET_PROJECT_ID === "ppop-35930") {
  console.error("Refusing to write into production project ppop-35930.");
  process.exit(1);
}

if (SOURCE_PROJECT_ID === TARGET_PROJECT_ID) {
  console.error("Source and target projects are the same. Aborting.");
  process.exit(1);
}

const COLLECTIONS = [
  "games",
  "news",
  "partners",
  "committee",
  "teams",
  "players",
  "referees",
  "venues",
  "schedule",
  "standings",
  "teamTraffic",
];

const TEAM_SUBCOLLECTIONS = ["roster", "coachStaff"];

const convertTimestamps = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(convertTimestamps);

  if (
    Object.prototype.hasOwnProperty.call(value, "_seconds") &&
    Object.prototype.hasOwnProperty.call(value, "_nanoseconds")
  ) {
    return new Timestamp(value._seconds, value._nanoseconds);
  }

  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = convertTimestamps(nested);
  }
  return out;
};

const writeCollection = async (sourceDb, targetDb, collectionName) => {
  const snapshot = await sourceDb.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`- ${collectionName}: source empty, skipped`);
    return 0;
  }

  let count = 0;
  let batch = targetDb.batch();
  let ops = 0;

  for (const doc of snapshot.docs) {
    const targetRef = targetDb.collection(collectionName).doc(doc.id);
    batch.set(targetRef, convertTimestamps(doc.data()), { merge: true });
    count += 1;
    ops += 1;

    if (ops === 450) {
      await batch.commit();
      batch = targetDb.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`- ${collectionName}: synced ${count}`);
  return count;
};

const writeTeamSubcollections = async (sourceDb, targetDb) => {
  const teamsSnapshot = await sourceDb.collection("teams").get();
  if (teamsSnapshot.empty) {
    console.log("- teams subcollections: no teams found, skipped");
    return 0;
  }

  let synced = 0;

  for (const teamDoc of teamsSnapshot.docs) {
    for (const subcollection of TEAM_SUBCOLLECTIONS) {
      const subSnapshot = await sourceDb
        .collection("teams")
        .doc(teamDoc.id)
        .collection(subcollection)
        .get();

      if (subSnapshot.empty) {
        continue;
      }

      let batch = targetDb.batch();
      let ops = 0;

      for (const subDoc of subSnapshot.docs) {
        const targetRef = targetDb
          .collection("teams")
          .doc(teamDoc.id)
          .collection(subcollection)
          .doc(subDoc.id);

        batch.set(targetRef, convertTimestamps(subDoc.data()), { merge: true });
        synced += 1;
        ops += 1;

        if (ops === 450) {
          await batch.commit();
          batch = targetDb.batch();
          ops = 0;
        }
      }

      if (ops > 0) {
        await batch.commit();
      }
    }
  }

  console.log(`- teams/*/{roster,coachStaff}: synced ${synced}`);
  return synced;
};

const main = async () => {
  const sourceAppName = "source-main";
  const targetAppName = "target-sandbox";

  const existingSource = getApps().find((app) => app.name === sourceAppName);
  const existingTarget = getApps().find((app) => app.name === targetAppName);

  if (existingSource || existingTarget) {
    console.error("Unexpected existing admin app instances detected. Restart script and retry.");
    process.exit(1);
  }

  const sourceApp = initializeApp(
    {
      credential: cert({
        projectId: SOURCE_PROJECT_ID,
        clientEmail: SOURCE_CLIENT_EMAIL,
        privateKey: SOURCE_PRIVATE_KEY,
      }),
      projectId: SOURCE_PROJECT_ID,
    },
    sourceAppName
  );

  const targetApp = initializeApp(
    {
      credential: cert({
        projectId: TARGET_PROJECT_ID,
        clientEmail: TARGET_CLIENT_EMAIL,
        privateKey: TARGET_PRIVATE_KEY,
      }),
      projectId: TARGET_PROJECT_ID,
    },
    targetAppName
  );

  const sourceDb = getFirestore(sourceApp);
  const targetDb = getFirestore(targetApp);

  console.log(`Source project: ${SOURCE_PROJECT_ID}`);
  console.log(`Target project: ${TARGET_PROJECT_ID}`);

  let total = 0;
  for (const collectionName of COLLECTIONS) {
    total += await writeCollection(sourceDb, targetDb, collectionName);
  }

  total += await writeTeamSubcollections(sourceDb, targetDb);

  await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
  console.log(`Done. Total synced: ${total}`);
};

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
