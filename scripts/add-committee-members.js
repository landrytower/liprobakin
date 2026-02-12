// Script to add committee members to Firebase
// Run with: node scripts/add-committee-members.js

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

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

const committeeMembers = [
  {
    firstName: "Arthur",
    lastName: "Lwango",
    role: "PRESIDENT",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Freddy",
    lastName: "Mali",
    role: "1ST VICE PRESIDENT",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Yannick",
    lastName: "Isasi",
    role: "2ND VICE PRESIDENT",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Medar",
    lastName: "Menga",
    role: "SECRÉTAIRE EXÉCUTIF",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Hortense",
    lastName: "Madila",
    role: "TRÉSORIÈRE",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Charles",
    lastName: "Apala",
    role: "MEMBRE",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Papi",
    lastName: "Senga",
    role: "MEMBRE",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Patrick",
    lastName: "Buzangu",
    role: "MEMBRE",
    email: "",
    phone: "",
    bio: "",
    department: "",
  },
  {
    firstName: "Ravic",
    lastName: "M",
    role: "MEMBRE",
    email: "aaa@gmail.com",
    phone: "123-123-1212",
    bio: "",
    department: "",
  },
];

async function addCommitteeMembers() {
  console.log("Adding committee members to Firebase...\n");
  
  const membersCollection = collection(db, "committeeMembers");
  
  for (const member of committeeMembers) {
    try {
      const docRef = await addDoc(membersCollection, {
        ...member,
        createdAt: serverTimestamp(),
      });
      console.log(`✅ Added: ${member.firstName} ${member.lastName} (${member.role}) - ID: ${docRef.id}`);
    } catch (error) {
      console.error(`❌ Failed to add ${member.firstName} ${member.lastName}:`, error.message);
    }
  }
  
  console.log("\n✅ Finished adding committee members!");
  process.exit(0);
}

addCommitteeMembers();
