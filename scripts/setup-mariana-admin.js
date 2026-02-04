// Script to create admin user: Mariana Feza
// Run with: node scripts/setup-mariana-admin.js

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createAdmin() {
  const email = 'marianafeza@gmail.com';
  const displayName = 'Mariana Feza';
  const password = 'TempPassword123!'; // They can change this after first login
  const roles = ['league_manager']; // Change to ['master'] for full access

  console.log('🔄 Creating admin user:', email);

  try {
    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('⚠️  User already exists in Firebase Auth:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        userRecord = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: false,
        });
        console.log('✅ Created Firebase Auth user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Define permissions based on role
    const permissions = roles.includes('master') 
      ? {
          canManageAdmins: true,
          canManageTeams: true,
          canManagePlayers: true,
          canManageGames: true,
          canManageNews: true,
          canViewAnalytics: true,
          canManageSettings: true,
          canManageVerifications: true,
        }
      : {
          canManageAdmins: false,
          canManageTeams: true,
          canManagePlayers: true,
          canManageGames: true,
          canManageNews: true,
          canViewAnalytics: true,
          canManageSettings: false,
          canManageVerifications: true,
        };

    // Create/Update Firestore document
    await db.collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      displayName: displayName,
      roles: roles,
      permissions: permissions,
      isFirstLogin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'script',
      lastLogin: null,
      isActive: true,
    }, { merge: true });

    console.log('✅ Created Firestore admin document');
    console.log('');
    console.log('========================================');
    console.log('🎉 Admin user created successfully!');
    console.log('========================================');
    console.log('Email:', email);
    console.log('Display Name:', displayName);
    console.log('Roles:', roles.join(', '));
    console.log('Temporary Password:', password);
    console.log('');
    console.log('⚠️  The user should change their password after first login!');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

createAdmin();
