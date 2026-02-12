// Script to clean up duplicate committee members
// Run with: node scripts/cleanup-committee.js

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

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

async function cleanupDuplicates() {
  console.log("Cleaning up duplicate committee members...\n");
  
  const membersSnap = await getDocs(collection(db, "committeeMembers"));
  const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`Found ${members.length} total members\n`);
  
  // Group by name
  const seen = new Map();
  const toDelete = [];
  
  for (const member of members) {
    const key = `${member.firstName}-${member.lastName}`.toLowerCase();
    if (seen.has(key)) {
      toDelete.push(member);
      console.log(`Duplicate: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
    } else {
      seen.set(key, member);
      console.log(`Keeping: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
    }
  }
  
  console.log(`\nDeleting ${toDelete.length} duplicates...`);
  
  for (const member of toDelete) {
    await deleteDoc(doc(db, "committeeMembers", member.id));
    console.log(`✅ Deleted: ${member.firstName} ${member.lastName}`);
  }
  
  console.log("\n✅ Cleanup complete!");
  process.exit(0);
}

cleanupDuplicates();
