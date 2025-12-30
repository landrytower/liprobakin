// Web-based script to set up admin in Firestore
// Open this file in your browser at http://localhost:3000/setup-admin-now.html

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: "ppop-35930.firebaseapp.com",
  projectId: "ppop-35930",
  storageBucket: "ppop-35930.firebasestorage.app",
  messagingSenderId: "478592036466",
  appId: "1:478592036466:web:f149e594436026717adceb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupAdmin() {
  // You need to get the UID from Firebase Console
  // Go to: https://console.firebase.google.com/project/ppop-35930/authentication/users
  // Find bobiyatch@gmail.com and copy the UID
  
  const uid = 'YOUR_UID_HERE'; // REPLACE THIS with the actual UID
  const email = 'bobiyatch@gmail.com';
  
  console.log('Setting up admin for UID:', uid);
  
  try {
    await setDoc(doc(db, 'adminUsers', uid), {
      uid: uid,
      email: email,
      displayName: 'Master Admin',
      roles: ['master'],
      permissions: {
        canManageNews: true,
        canManageGames: true,
        canManageTeams: true,
        canManagePlayers: true,
        canManageAdmins: true,
        canViewAuditLogs: true,
        canManageSettings: true
      },
      isActive: true,
      status: 'active',
      isFirstLogin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    await setDoc(doc(db, 'admins', uid), {
      email: email,
      active: true,
      createdAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Success! Admin setup complete');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupAdmin();
