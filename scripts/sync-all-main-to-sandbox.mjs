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

const syncCollection = async (sourceCollectionRef, targetCollectionRef, stats) => {
  const snapshot = await sourceCollectionRef.get();
  if (snapshot.empty) return;

  let batch = targetCollectionRef.firestore.batch();
  let ops = 0;

  for (const sourceDoc of snapshot.docs) {
    const targetDocRef = targetCollectionRef.doc(sourceDoc.id);
    batch.set(targetDocRef, convertTimestamps(sourceDoc.data()), { merge: true });
    stats.documents += 1;
    ops += 1;

    if (ops === 400) {
      await batch.commit();
      batch = targetCollectionRef.firestore.batch();
      ops = 0;
    }

    const sourceSubcollections = await sourceDoc.ref.listCollections();
    for (const sourceSubcollection of sourceSubcollections) {
      stats.subcollections += 1;
      const targetSubcollectionRef = targetDocRef.collection(sourceSubcollection.id);
      await syncCollection(sourceSubcollection, targetSubcollectionRef, stats);
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
};

const main = async () => {
  const sourceAppName = "source-main-all";
  const targetAppName = "target-sandbox-all";

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

  const rootCollections = await sourceDb.listCollections();
  console.log(`Root collections discovered: ${rootCollections.length}`);

  const stats = { documents: 0, subcollections: 0 };

  for (const rootCollection of rootCollections) {
    const targetRootCollection = targetDb.collection(rootCollection.id);
    await syncCollection(rootCollection, targetRootCollection, stats);
    console.log(`- synced root collection: ${rootCollection.id}`);
  }

  await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
  console.log(`Done. Total documents synced: ${stats.documents}`);
  console.log(`Done. Total subcollections traversed: ${stats.subcollections}`);
};

main().catch((error) => {
  console.error("Full sync failed:", error);
  process.exit(1);
});
