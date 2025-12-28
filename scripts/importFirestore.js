/*
 * Import data from JSON files back into Firestore
 *
 * Usage:
 *   1. Ensure your Firebase credentials are set up
 *   2. From the project root run:
 *        node scripts/importFirestore.js
 *
 * This will import all data from src/data/exports back into Firestore
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// Initialize Firebase Admin with your project credentials
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "ppop-35930",
  databaseURL: "https://ppop-35930-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

const COLLECTIONS_TO_IMPORT = [
  "games",
  "news",
  "partners",
  "committee",
  "teams",
  "players",
  "referees",
  "schedule",
  "standings",
  "teamTraffic"
];

async function importCollection(collectionName) {
  const filePath = path.join(__dirname, "..", "src", "data", "exports", `${collectionName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${collectionName}.json - skipping`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`⚠️  No data in ${collectionName}.json - skipping`);
    return;
  }

  console.log(`\n📥 Importing ${data.length} documents into "${collectionName}"...`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of data) {
    const { id, ...docData } = doc;
    
    // Convert timestamp objects back to Firestore Timestamps
    const processedData = JSON.parse(JSON.stringify(docData), (key, value) => {
      if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
        return admin.firestore.Timestamp.fromMillis(value._seconds * 1000 + Math.floor(value._nanoseconds / 1000000));
      }
      return value;
    });
    
    if (id) {
      const docRef = db.collection(collectionName).doc(id);
      batch.set(docRef, processedData, { merge: true });
    } else {
      const docRef = db.collection(collectionName).doc();
      batch.set(docRef, processedData);
    }
    
    count++;
    
    // Commit batch every 500 documents (Firestore limit is 500)
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  ✓ Imported ${count} documents...`);
    }
  }
  
  // Commit remaining documents
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`  ✅ Successfully imported ${count} documents into "${collectionName}"`);
}

async function main() {
  console.log("🚀 Starting Firestore import...\n");
  
  for (const collection of COLLECTIONS_TO_IMPORT) {
    try {
      await importCollection(collection);
    } catch (error) {
      console.error(`❌ Error importing ${collection}:`, error.message);
    }
  }
  
  console.log("\n✅ Import completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
