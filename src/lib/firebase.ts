import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${firebaseProjectId}.firebaseapp.com`,
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${firebaseProjectId}-default-rtdb.firebaseio.com`,
  projectId: firebaseProjectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${firebaseProjectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "478592036466",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:478592036466:web:f149e594436026717adceb",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-YJY5T6TD8E",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analyticsPromise: Promise<Analytics | undefined> | undefined;

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const firebaseDB = getFirestore(app);
export const firebaseStorage = getStorage(app);

export const getFirebaseAnalytics = () => {
  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) => {
      if (!supported || typeof window === "undefined") {
        return undefined;
      }
      return getAnalytics(app);
    });
  }
  return analyticsPromise;
};
