// Script to create bobiyatch@gmail.com as master admin with password 123456
const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../ppop-35930-firebase-adminsdk-tbv5s-e2d4729b21.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('Error loading service account key. Make sure ppop-35930-firebase-adminsdk-tbv5s-e2d4729b21.json exists');
  process.exit(1);
}

const db = admin.firestore();

async function setupAdmin() {
  const email = 'bobiyatch@gmail.com';
  const password = '123456';
  
  console.log('Setting up master admin:', email);
  
  try {
    let userRecord;
    
    // Try to get existing user
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('✅ Found existing user, UID:', userRecord.uid);
      
      // Update password to 123456
      await admin.auth().updateUser(userRecord.uid, {
        password: password
      });
      console.log('✅ Password updated to: 123456');
      
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('Creating new user...');
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true,
          displayName: 'Master Admin'
        });
        console.log('✅ User created, UID:', userRecord.uid);
      } else {
        throw error;
      }
    }
    
    // Create/update adminUsers document with ALL master permissions
    await db.collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: 'Master Admin',
      roles: ['master'],
      permissions: {
        canManageNews: true,
        canManageGames: true,
        canManageMatches: true,
        canManageStatistics: true,
        canManageTeams: true,
        canManageUsers: true,
        canManageAccounts: true,
        canManageVerifications: true,
        canManageLeague: true,
        canManagePlayers: true,
        canManageReferees: true,
        canManageVenues: true,
        canManagePartners: true,
        canManageCommittee: true,
        canManageCommission: true,
        canManageSales: true,
        canManageAdmins: true,
        canViewTraffic: true,
        canViewAuditLogs: true,
        canManageSettings: true
      },
      status: 'active',
      isActive: true,
      isFirstLogin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Admin document created/updated');
    console.log('\n✨ SUCCESS!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nYou can now login at: http://localhost:3000/admin');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  process.exit();
}

setupAdmin();
