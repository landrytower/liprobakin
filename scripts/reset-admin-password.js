// Script to send password reset email to admin
// Run with: node scripts/reset-admin-password.js

const admin = require('firebase-admin');

// Initialize with application default credentials or service account
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} catch (error) {
  console.log('Already initialized or using default credentials');
}

async function sendPasswordReset() {
  const email = 'bobiyatch@gmail.com';
  
  try {
    // Check if user exists
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.email} (UID: ${userRecord.uid})`);
    
    // Generate password reset link
    const link = await admin.auth().generatePasswordResetLink(email);
    console.log('\n📧 Password Reset Link:');
    console.log(link);
    console.log('\nCopy this link and paste it in your browser to reset your password.');
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error('\n❌ User NOT FOUND in Firebase Authentication!');
      console.log('\nThe adminUsers document may exist in Firestore, but the actual');
      console.log('Firebase Authentication user does not exist.');
      console.log('\nTo fix this, create the user in Firebase Console:');
      console.log('1. Go to: https://console.firebase.google.com/project/ppop-35930/authentication/users');
      console.log('2. Click "Add user"');
      console.log('3. Email:', email);
      console.log('4. Set a strong password');
      console.log('5. Then try logging in again');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
  
  process.exit();
}

sendPasswordReset();
