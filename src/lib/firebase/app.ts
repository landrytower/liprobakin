import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${firebaseProjectId}.firebaseapp.com`,
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${firebaseProjectId}-default-rtdb.firebaseio.com`,
  projectId: firebaseProjectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${firebaseProjectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "478592036466",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:478592036466:web:f149e594436026717adceb",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-YJY5T6TD8E",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
