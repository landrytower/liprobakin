const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ppop-35930'
  });
}

const db = admin.firestore();

async function migrateTeamIds() {
  console.log('🔄 Starting team ID migration...\n');
  
  try {
    // Step 1: Fetch all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = [];
    
    teamsSnapshot.forEach(doc => {
      teams.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 Found ${teams.length} teams\n`);
    
    // Step 2: Create mapping of old ID to new ID
    const idMapping = {};
    const nameCount = {};
    
    // First pass: count names to detect duplicates
    teams.forEach(team => {
      const baseName = team.name.replace(/[^a-zA-Z0-9]/g, '-');
      nameCount[baseName] = (nameCount[baseName] || 0) + 1;
    });
    
    // Second pass: create new IDs
    const usedIds = {};
    teams.forEach(team => {
      let baseName = team.name.replace(/[^a-zA-Z0-9]/g, '-');
      let newId;
      
      // If duplicate name exists, append gender and counter
      if (nameCount[baseName] > 1) {
        const genderSuffix = team.gender === 'women' ? '-F' : '-M';
        usedIds[baseName] = (usedIds[baseName] || 0) + 1;
        newId = `${baseName}${genderSuffix}`;
      } else {
        newId = baseName;
      }
      
      idMapping[team.id] = newId;
      console.log(`📝 ${team.name} (${team.gender}): ${team.id} → ${newId}`);
    });
    
    console.log('\n⚠️  This will:\n');
    console.log('1. Create new team documents with name-based IDs');
    console.log('2. Update all game references');
    console.log('3. Update all standing references');
    console.log('4. Delete old team documents\n');
    
    // Ask for confirmation (in real execution, you'd want user input)
    console.log('⏸️  DRY RUN - Review the mappings above before proceeding\n');
    console.log('To execute, uncomment the migration code below:\n');
    
    /*
    // Step 3: Create new team documents AND copy subcollections
    console.log('\n📦 Creating new team documents and copying subcollections...');
    
    for (const team of teams) {
      const newId = idMapping[team.id];
      const { id, ...teamData } = team;
      const oldRef = db.collection('teams').doc(team.id);
      const newRef = db.collection('teams').doc(newId);
      
      // Create new team document
      await newRef.set(teamData);
      console.log(`✅ Created team: ${newId}`);
      
      // Copy roster subcollection
      const rosterSnapshot = await oldRef.collection('roster').get();
      if (!rosterSnapshot.empty) {
        const rosterBatch = db.batch();
        rosterSnapshot.forEach(doc => {
          const newRosterRef = newRef.collection('roster').doc(doc.id);
          rosterBatch.set(newRosterRef, doc.data());
        });
        await rosterBatch.commit();
        console.log(`  📋 Copied ${rosterSnapshot.size} roster members`);
      }
      
      // Copy coachStaff subcollection
      const coachSnapshot = await oldRef.collection('coachStaff').get();
      if (!coachSnapshot.empty) {
        const coachBatch = db.batch();
        coachSnapshot.forEach(doc => {
          const newCoachRef = newRef.collection('coachStaff').doc(doc.id);
          coachBatch.set(newCoachRef, doc.data());
        });
        await coachBatch.commit();
        console.log(`  👔 Copied ${coachSnapshot.size} coaches`);
      }
    }
    
    console.log('\n✅ All teams, rosters, and coaches migrated\n');
    
    // Step 4: Update games collection
    console.log('🎮 Updating games...');
    const gamesSnapshot = await db.collection('games').get();
    const gameBatches = [];
    let currentBatch = db.batch();
    let batchCount = 0;
    
    gamesSnapshot.forEach(doc => {
      const game = doc.data();
      let updated = false;
      const updates = {};
      
      if (game.home && idMapping[game.home]) {
        updates.home = idMapping[game.home];
        updated = true;
      }
      
      if (game.away && idMapping[game.away]) {
        updates.away = idMapping[game.away];
        updated = true;
      }
      
      if (updated) {
        currentBatch.update(doc.ref, updates);
        batchCount++;
        
        if (batchCount === 500) {
          gameBatches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
    });
    
    if (batchCount > 0) {
      gameBatches.push(currentBatch);
    }
    
    for (const batch of gameBatches) {
      await batch.commit();
    }
    
    console.log(`✅ Updated ${gamesSnapshot.size} games\n`);
    
    // Step 5: Update standings collection
    console.log('📊 Updating standings...');
    const standingsSnapshot = await db.collection('standings').get();
    const standingBatches = [];
    currentBatch = db.batch();
    batchCount = 0;
    
    standingsSnapshot.forEach(doc => {
      const standing = doc.data();
      let updated = false;
      const updates = {};
      
      if (standing.team && idMapping[standing.team]) {
        updates.team = idMapping[standing.team];
        updated = true;
      }
      
      if (updated) {
        currentBatch.update(doc.ref, updates);
        batchCount++;
        
        if (batchCount === 500) {
          standingBatches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
    });
    
    if (batchCount > 0) {
      standingBatches.push(currentBatch);
    }
    
    for (const batch of standingBatches) {
      await batch.commit();
    }
    
    console.log(`✅ Updated ${standingsSnapshot.size} standings\n`);
    
    // Step 6: Delete old team documents
    console.log('🗑️  Deleting old team documents...');
    const deleteBatch = db.batch();
    
    for (const team of teams) {
      const oldRef = db.collection('teams').doc(team.id);
      deleteBatch.delete(oldRef);
    }
    
    await deleteBatch.commit();
    console.log('✅ Old team documents deleted\n');
    
    console.log('✨ Migration complete!\n');
    console.log('New team IDs:');
    Object.entries(idMapping).forEach(([oldId, newId]) => {
      console.log(`  ${oldId} → ${newId}`);
    });
    */
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateTeamIds()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
