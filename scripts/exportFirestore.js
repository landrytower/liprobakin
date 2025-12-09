/*
 * Quick Firestore export helper.
 *
 * Usage:
 *   1. Create a Firebase service account with the role "Cloud Datastore Import Export Admin".
 *   2. Download the JSON key and point GOOGLE_APPLICATION_CREDENTIALS to it.
 *   3. Update the COLLECTIONS array below with the collection names you need.
 *   4. From the project root run:
 *        set GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\service-account.json
 *        node scripts/exportFirestore.js
 *
 * The script will emit one JSON file per collection inside src/data/exports.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const COLLECTIONS = [
  // Provide collection names to export specific sets.
  // Leave the array empty to export every root collection discovered.
];

(async () => {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });

    const db = admin.firestore();
    const outputDir = path.join(__dirname, "..", "src", "data", "exports");
    fs.mkdirSync(outputDir, { recursive: true });

    let collections = COLLECTIONS;

    if (collections.length === 0) {
      const discovered = await db.listCollections();
      collections = discovered.map((col) => col.id).sort();
      console.log(
        `Discovered ${collections.length} root collections: ${collections.join(", ") || "<none>"}.`
      );
    }

    if (collections.length === 0) {
      console.warn("No collections to export. Update COLLECTIONS array if this is unexpected.");
      process.exit(0);
    }

    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      const documents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filePath = path.join(outputDir, `${collection}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
      console.log(`Exported ${documents.length} docs from ${collection} -> ${filePath}`);
    }

    console.log("Firestore export complete.");
    process.exit(0);
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
})();
