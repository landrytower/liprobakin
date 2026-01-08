/**
 * Grant League Management Permissions
 * Run this script to add league_manager role to your admin account
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function grantLeaguePermissions() {
  console.log('🔍 Finding your admin account...\n');
  
  // Get all admin users
  const snapshot = await db.collection('adminUsers').get();
  
  if (snapshot.empty) {
    console.log('❌ No admin users found!');
    return;
  }

  console.log('📋 Current admin users:\n');
  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ${data.email} - Roles: ${data.roles?.join(', ') || 'none'}`);
  });

  console.log('\n🎯 Adding league_manager role to ALL admins...\n');

  // Update all admin users
  const batch = db.batch();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const currentRoles = data.roles || [];
    
    // Add league_manager if not already present
    if (!currentRoles.includes('league_manager')) {
      const newRoles = [...currentRoles, 'league_manager'];
      
      batch.update(doc.ref, {
        roles: newRoles,
        permissions: {
          canManageNews: true,
          canManageGames: true,
          canManageTeams: true,
          canManagePlayers: true,
          canManageReferees: true,
          canManageVenues: true,
          canManagePartners: true,
          canManageCommittee: true,
          canManageAdmins: data.roles?.includes('master') || false,
        }
      });
      
      console.log(`✅ Updated: ${data.email}`);
    } else {
      console.log(`⏭️  Skipped (already has league_manager): ${data.email}`);
    }
  });

  await batch.commit();
  
  console.log('\n✨ Done! Refresh your admin page to see the LEAGUE tab.\n');
  process.exit(0);
}

grantLeaguePermissions().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
