require('dotenv').config({ path: '.env.local' });

const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, where } = require("firebase/firestore");

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('Firebase Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// Initial venues data
const initialVenues = [
  {
    name: "Martyrs",
    address: "Boulevard Triomphal, near Avenue des Huiteries",
    city: "Kinshasa",
    capacity: 10000,
  },
  {
    name: "Police",
    address: "121 bandal av masano",
    city: "Bandal",
    capacity: 2100,
  },
];

async function addInitialVenues() {
  try {
    console.log("Checking for existing venues...");
    
    for (const venueData of initialVenues) {
      // Check if venue already exists
      const existingQuery = query(
        collection(db, "venues"),
        where("name", "==", venueData.name)
      );
      const existingDocs = await getDocs(existingQuery);
      
      if (existingDocs.empty) {
        console.log(`Adding venue: ${venueData.name}`);
        await addDoc(collection(db, "venues"), {
          ...venueData,
          createdAt: serverTimestamp(),
        });
        console.log(`✓ Added ${venueData.name}`);
      } else {
        console.log(`✓ ${venueData.name} already exists, skipping`);
      }
    }
    
    console.log("Initial venues setup completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error adding initial venues:", error);
    process.exit(1);
  }
}

addInitialVenues();