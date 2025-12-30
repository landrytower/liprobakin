// Script to ensure bobiyatch@gmail.com is a master admin
// This will create the user in Firebase Auth if needed and set up admin access

const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../ppop-35930-firebase-adminsdk-tbv5s-e2d4729b21.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  // Try with application default credentials
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'ppop-35930'
  });
}

const db = admin.firestore();

async function setupMasterAdmin() {
  const email = 'bobiyatch@gmail.com';
  const password = 'Admin@2025'; // Default password - CHANGE THIS AFTER FIRST LOGIN
  
  console.log('🔧 Setting up master admin for:', email);
  
  try {
    let userRecord;
    
    // Step 1: Check if user exists in Firebase Auth
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('✅ User already exists in Firebase Auth');
      console.log('   UID:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create the user
        console.log('📝 Creating user in Firebase Authentication...');
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true,
          displayName: 'Master Admin'
        });
        console.log('✅ User created in Firebase Auth');
        console.log('   UID:', userRecord.uid);
        console.log('   Default Password:', password);
        console.log('   ⚠️  PLEASE CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
      } else {
        throw error;
      }
    }
    
    // Step 2: Create/Update admin document in adminUsers collection
    console.log('\n📝 Setting up adminUsers document...');
    
    const adminData = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || 'Master Admin',
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('adminUsers').doc(userRecord.uid).set(adminData, { merge: true });
    console.log('✅ Admin document created/updated in adminUsers collection');
    
    // Step 3: Also add to admins collection (for backward compatibility)
    await db.collection('admins').doc(userRecord.uid).set({
      email: userRecord.email,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('✅ Added to admins collection');
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ SUCCESS! Master admin is ready');
    console.log('='.repeat(60));
    console.log('\nLogin details:');
    console.log('  Email:', email);
    if (!userRecord.uid.includes('existing')) {
      console.log('  Password:', password);
      console.log('\n⚠️  IMPORTANT: Change this password after first login!');
    }
    console.log('\nAdmin Portal: http://localhost:3000/admin');
    console.log('Or production: https://liprobakin.com/admin');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
  
  process.exit();
}

setupMasterAdmin();
