import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
