// Run this script with: node reset-team-records.js
// This will reset all team wins and losses to 0

const admin = require('firebase-admin');

// Initialize with application default credentials
// This uses your local Firebase credentials
admin.initializeApp({
  projectId: "febakin"
});

const db = admin.firestore();

async function resetTeamRecords() {
  try {
    console.log('Fetching all teams...');
    const teamsSnapshot = await db.collection('teams').get();
    
    console.log(`Found ${teamsSnapshot.size} teams`);
    
    const updates = [];
    
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.name || teamDoc.id;
      
      console.log(`Resetting ${teamName}...`);
      
      updates.push(
        db.collection('teams').doc(teamDoc.id).update({
          wins: 0,
          losses: 0
        })
      );
    }
    
    await Promise.all(updates);
    
    console.log('✅ Successfully reset all team records to 0-0');
    console.log('All teams now have wins: 0, losses: 0');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting team records:', error);
    process.exit(1);
  }
}

resetTeamRecords();
