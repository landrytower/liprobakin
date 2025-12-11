// Script to create a master admin user in Firestore
// Run with: node scripts/create-master-admin.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createMasterAdmin() {
  const email = 'bobiyatch@gmail.com';
  
  try {
    // Get the user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.email} (UID: ${userRecord.uid})`);
    
    // Create admin document in Firestore
    await db.collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || email.split('@')[0],
      roles: ['master'],
      isActive: true,
      isFirstLogin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Master admin created successfully!');
    console.log('You can now log in at http://localhost:3000/admin');
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error('❌ User not found. Please create a Firebase user first with email:', email);
      console.log('\nYou can create the user in Firebase Console:');
      console.log('1. Go to Firebase Console > Authentication > Users');
      console.log('2. Click "Add user"');
      console.log('3. Enter email:', email);
      console.log('4. Set a password');
      console.log('5. Run this script again');
    } else {
      console.error('Error:', error.message);
    }
  }
  
  process.exit();
}

createMasterAdmin();
