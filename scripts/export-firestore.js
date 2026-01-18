const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ppop-35930'
  });
}

const db = admin.firestore();

async function exportCollection(collectionName) {
  console.log(`📦 Exporting ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const data = {};
  
  for (const doc of snapshot.docs) {
    const docData = doc.data();
    
    // Get subcollections
    const subcollections = await doc.ref.listCollections();
    const subcollectionData = {};
    
    for (const subcollection of subcollections) {
      const subSnapshot = await subcollection.get();
      subcollectionData[subcollection.id] = {};
      
      subSnapshot.forEach(subDoc => {
        subcollectionData[subcollection.id][subDoc.id] = subDoc.data();
      });
    }
    
    data[doc.id] = {
      ...docData,
      _subcollections: subcollectionData
    };
  }
  
  console.log(`✅ Exported ${snapshot.size} documents from ${collectionName}`);
  return data;
}

async function exportFirestore() {
  console.log('🚀 Starting Firestore export...\n');
  
  const collections = [
    'teams',
    'games',
    'standings',
    'players',
    'news',
    'partners',
    'referees',
    'users',
    'venues'
  ];
  
  const backup = {
    exportDate: new Date().toISOString(),
    collections: {}
  };
  
  for (const collection of collections) {
    try {
      backup.collections[collection] = await exportCollection(collection);
    } catch (error) {
      console.error(`❌ Error exporting ${collection}:`, error.message);
    }
  }
  
  // Save to file
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `firestore-backup-${timestamp}.json`;
  const filepath = path.join(__dirname, '..', 'backups', filename);
  
  // Create backups directory if it doesn't exist
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  
  console.log(`\n✅ Backup saved to: ${filepath}`);
  console.log(`📊 File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
}

exportFirestore()
  .then(() => {
    console.log('\n✨ Export complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  });
