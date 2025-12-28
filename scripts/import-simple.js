// Simple script to import data from JSON to Firestore using the web SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: "ppop-35930.firebaseapp.com",
  databaseURL: "https://ppop-35930-default-rtdb.firebaseio.com",
  projectId: "ppop-35930",
  storageBucket: "ppop-35930.firebasestorage.app",
  messagingSenderId: "478592036466",
  appId: "1:478592036466:web:f149e594436026717adceb",
  measurementId: "G-YJY5T6TD8E",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return Timestamp.fromMillis(obj._seconds * 1000 + Math.floor(obj._nanoseconds / 1000000));
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestamps(item));
  }
  
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    converted[key] = convertTimestamps(value);
  }
  return converted;
}

async function importCollection(collectionName) {
  const filePath = path.join(__dirname, '..', 'src', 'data', 'exports', `${collectionName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${collectionName}.json - skipping`);
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`⚠️  No data in ${collectionName}.json - skipping`);
    return 0;
  }

  console.log(`📥 Importing ${data.length} documents into "${collectionName}"...`);
  let count = 0;

  for (const item of data) {
    try {
      const { id, ...docData } = item;
      const converted = convertTimestamps(docData);
      
      if (id) {
        await setDoc(doc(db, collectionName, id), converted, { merge: true });
      } else {
        const newDocRef = doc(collection(db, collectionName));
        await setDoc(newDocRef, converted);
      }
      count++;
      
      if (count % 10 === 0) {
        console.log(`  ✓ Imported ${count}/${data.length} documents...`);
      }
    } catch (error) {
      console.error(`  ❌ Error importing document:`, error.message);
    }
  }

  console.log(`✅ Successfully imported ${count} documents into "${collectionName}"`);
  return count;
}

async function main() {
  console.log('🚀 Starting Firestore import...\n');
  
  const collections = [
    'games',
    'news',
    'partners',
    'committee',
    'teams',
    'players',
    'referees',
    'schedule',
    'standings',
    'teamTraffic'
  ];

  let totalImported = 0;

  for (const collectionName of collections) {
    try {
      const count = await importCollection(collectionName);
      totalImported += count;
    } catch (error) {
      console.error(`❌ Error importing ${collectionName}:`, error.message);
    }
  }

  console.log(`\n✅ Import completed! Total documents imported: ${totalImported}`);
  console.log('🔄 Refresh your app at http://localhost:3000 to see the data!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
