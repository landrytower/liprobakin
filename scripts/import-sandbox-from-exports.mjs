import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

config({ path: ".env.local" });

const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "")
  .replace(/\\r\\n/g, "\n")
  .replace(/\\n/g, "\n")
  .trim();

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

if (projectId === "ppop-35930") {
  console.error("Refusing to import into production project ppop-35930.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const db = getFirestore();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exportsDir = path.join(__dirname, "..", "src", "data", "exports");

const collections = [
  "games",
  "news",
  "partners",
  "committee",
  "teams",
  "players",
  "referees",
  "schedule",
  "standings",
  "teamTraffic",
];

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
  for (const [k, v] of Object.entries(value)) {
    out[k] = convertTimestamps(v);
  }
  return out;
};

const importCollection = async (name) => {
  const filePath = path.join(exportsDir, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`- ${name}: file missing, skipped`);
    return 0;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data) || data.length === 0) {
    console.log(`- ${name}: empty, skipped`);
    return 0;
  }

  let imported = 0;
  let batch = db.batch();
  let ops = 0;

  for (const item of data) {
    const { id, ...docData } = item;
    const ref = id ? db.collection(name).doc(String(id)) : db.collection(name).doc();
    batch.set(ref, convertTimestamps(docData), { merge: true });
    imported += 1;
    ops += 1;

    if (ops === 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`- ${name}: imported ${imported}`);
  return imported;
};

const main = async () => {
  console.log(`Import target project: ${projectId}`);
  let total = 0;

  for (const name of collections) {
    total += await importCollection(name);
  }

  console.log(`Done. Total imported: ${total}`);
};

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
