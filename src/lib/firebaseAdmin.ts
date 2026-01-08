import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin only on server side
let adminApp: App | undefined;

function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Use environment variables for credentials
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (projectId && clientEmail && privateKey) {
      try {
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
        console.log("Firebase Admin initialized successfully");
      } catch (error) {
        console.error("Error initializing Firebase Admin:", error);
        throw error;
      }
    } else {
      console.error("Missing Firebase Admin credentials in environment variables");
      console.error("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
      throw new Error("Firebase Admin credentials not configured");
    }
  } else {
    adminApp = getApps()[0];
  }
  
  return adminApp;
}

export function getAdminAuth() {
  const app = initializeFirebaseAdmin();
  return getAuth(app);
}

export function getAdminFirestore() {
  const app = initializeFirebaseAdmin();
  return getFirestore(app);
}
