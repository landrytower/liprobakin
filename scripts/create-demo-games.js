const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin using environment variables
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

const db = admin.firestore();

const venues = [
  "Stade des Martyrs",
  "Palais des Sports",
  "Gymnase Tata Raphaël",
  "Salle Omnisports de Lubumbashi",
  "Complexe Sportif de Goma",
  "Arena de Bukavu"
];

const times = [
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomTeamPair(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  return { home: shuffled[0], away: shuffled[1] };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function createDemoGames() {
  console.log("🏀 Creating demo games...\n");
  
  // First, fetch actual teams from the database with their IDs and logos
  console.log("📋 Fetching teams from database...");
  const teamsSnapshot = await db.collection('teams').get();
  
  const menTeams = [];
  const womenTeams = [];
  
  teamsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const teamName = data.city ? `${data.city} ${data.name}` : data.name;
    const gender = data.gender || 'men';
    
    const teamObj = {
      id: doc.id,
      name: teamName,
      logo: data.logo || null
    };
    
    if (gender === 'women') {
      womenTeams.push(teamObj);
    } else {
      menTeams.push(teamObj);
    }
  });
  
  console.log(`   Found ${menTeams.length} men's teams: ${menTeams.map(t => t.name).join(', ')}`);
  console.log(`   Found ${womenTeams.length} women's teams: ${womenTeams.map(t => t.name).join(', ')}\n`);
  
  if (menTeams.length < 2 && womenTeams.length < 2) {
    console.error("❌ Not enough teams in database to create games!");
    process.exit(1);
  }
  
  // Delete ALL existing games (both scheduled and completed)
  console.log("🗑️  Deleting ALL existing games...");
  const existingGames = await db.collection('games').get();
  const deletePromises = existingGames.docs.map(doc => doc.ref.delete());
  await Promise.all(deletePromises);
  console.log(`   Deleted ${existingGames.size} existing games\n`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const games = [];
  
  // Determine how many games per gender based on available teams
  const canCreateMenGames = menTeams.length >= 2;
  const canCreateWomenGames = womenTeams.length >= 2;
  
  // ========== COMPLETED GAMES (11 games - earlier this week) ==========
  console.log("📅 Creating 11 COMPLETED games for earlier this week...");
  for (let i = 0; i < 11; i++) {
    // Games from Jan 20-22 (Monday to Wednesday - before today Jan 23)
    const dayOffset = -3 + Math.floor(i / 4); // -3, -2, -1 days ago
    const gameDate = addDays(today, dayOffset);
    
    // Decide gender based on what's available
    let isMen;
    if (canCreateMenGames && canCreateWomenGames) {
      isMen = i % 2 === 0; // Alternate
    } else {
      isMen = canCreateMenGames;
    }
    
    const teams = isMen ? menTeams : womenTeams;
    if (teams.length < 2) continue;
    
    const { home, away } = getRandomTeamPair(teams);
    const time = getRandomElement(times);
    
    const [hours, minutes] = time.split(':').map(Number);
    gameDate.setHours(hours, minutes, 0, 0);
    
    // Generate random scores (realistic basketball scores)
    const homeScore = Math.floor(Math.random() * 40) + 60; // 60-99
    const awayScore = Math.floor(Math.random() * 40) + 60; // 60-99
    const homeWon = homeScore > awayScore;
    
    games.push({
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homeTeamLogo: home.logo,
      awayTeamLogo: away.logo,
      homeTeam: home.name,
      awayTeam: away.name,
      date: gameDate.toISOString().split('T')[0],
      time: time,
      venue: getRandomElement(venues),
      gender: isMen ? "men" : "women",
      week: 1,
      status: "Final",
      completed: true,
      homeScore: homeScore,
      awayScore: awayScore,
      winnerTeamId: homeWon ? home.id : away.id,
      winnerTeamName: homeWon ? home.name : away.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // ========== THIS WEEK SCHEDULED (27 games - Jan 23-29) ==========
  console.log("📅 Creating 27 SCHEDULED games for THIS WEEK (Journée 1)...");
  for (let i = 0; i < 27; i++) {
    const dayOffset = Math.floor(Math.random() * 7); // 0-6 days from today
    const gameDate = addDays(today, dayOffset);
    
    let isMen;
    if (canCreateMenGames && canCreateWomenGames) {
      isMen = i % 2 === 0;
    } else {
      isMen = canCreateMenGames;
    }
    
    const teams = isMen ? menTeams : womenTeams;
    if (teams.length < 2) continue;
    
    const { home, away } = getRandomTeamPair(teams);
    const time = getRandomElement(times);
    
    const [hours, minutes] = time.split(':').map(Number);
    gameDate.setHours(hours, minutes, 0, 0);
    
    games.push({
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homeTeamLogo: home.logo,
      awayTeamLogo: away.logo,
      homeTeam: home.name,
      awayTeam: away.name,
      date: gameDate.toISOString().split('T')[0],
      time: time,
      venue: getRandomElement(venues),
      gender: isMen ? "men" : "women",
      week: 1,
      status: "Scheduled",
      completed: false,
      homeScore: 0,
      awayScore: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // ========== NEXT WEEK (20 games - Jan 30 - Feb 5) ==========
  console.log("📅 Creating 20 games for NEXT WEEK (Journée 2)...");
  for (let i = 0; i < 20; i++) {
    const dayOffset = 7 + Math.floor(Math.random() * 7); // 7-13 days from today
    const gameDate = addDays(today, dayOffset);
    
    // Decide gender based on what's available
    let isMen;
    if (canCreateMenGames && canCreateWomenGames) {
      isMen = i % 3 !== 0; // More men's games
    } else {
      isMen = canCreateMenGames;
    }
    
    const teams = isMen ? menTeams : womenTeams;
    if (teams.length < 2) continue; // Skip if not enough teams
    
    const { home, away } = getRandomTeamPair(teams);
    const time = getRandomElement(times);
    
    const [hours, minutes] = time.split(':').map(Number);
    gameDate.setHours(hours, minutes, 0, 0);
    
    games.push({
      // Team IDs (required for proper linking)
      homeTeamId: home.id,
      awayTeamId: away.id,
      // Team names
      homeTeamName: home.name,
      awayTeamName: away.name,
      // Team logos
      homeTeamLogo: home.logo,
      awayTeamLogo: away.logo,
      // Legacy fields for compatibility
      homeTeam: home.name,
      awayTeam: away.name,
      // Date and time
      date: gameDate.toISOString().split('T')[0], // Format: "2026-01-30"
      time: time,
      venue: getRandomElement(venues),
      gender: isMen ? "men" : "women",
      week: 2, // Journée 2
      // Status fields
      status: "Scheduled",
      completed: false,
      homeScore: 0,
      awayScore: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Sort games by date
  games.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Add games to Firestore (use multiple batches if needed - max 500 per batch)
  const batchSize = 500;
  const gamesRef = db.collection('games');
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = db.batch();
    const chunk = games.slice(i, i + batchSize);
    for (const game of chunk) {
      const docRef = gamesRef.doc();
      batch.set(docRef, game);
    }
    await batch.commit();
  }
  
  const totalGames = games.length;
  console.log(`\n✅ Successfully created ${totalGames} demo games!`);
  console.log("\n📊 Summary:");
  
  // Count by status
  const completedGames = games.filter(g => g.completed === true).length;
  const scheduledGames = games.filter(g => g.completed === false).length;
  console.log(`   Completed games: ${completedGames}`);
  console.log(`   Scheduled games: ${scheduledGames}`);
  
  // Count by gender
  const menGames = games.filter(g => g.gender === "men").length;
  const womenGames = games.filter(g => g.gender === "women").length;
  console.log(`   Men's games: ${menGames}`);
  console.log(`   Women's games: ${womenGames}`);
  
  // Count by week
  const week1Games = games.filter(g => g.week === 1).length;
  const week2Games = games.filter(g => g.week === 2).length;
  console.log(`   Journée 1 games: ${week1Games}`);
  console.log(`   Journée 2 games: ${week2Games}`);
  
  // Show completed games
  console.log("\n🏆 Completed games (Final Buzzer):");
  games.filter(g => g.completed).slice(0, 5).forEach((g, i) => {
    console.log(`   ${i+1}. ${g.date} - ${g.homeTeamName} ${g.homeScore} vs ${g.awayScore} ${g.awayTeamName} (${g.gender})`);
  });
  
  // Show scheduled games for this week
  console.log("\n📅 Scheduled games (This Week):");
  games.filter(g => !g.completed && g.week === 1).slice(0, 5).forEach((g, i) => {
    console.log(`   ${i+1}. ${g.date} ${g.time} - ${g.homeTeamName} vs ${g.awayTeamName} (${g.gender}) @ ${g.venue}`);
  });
  
  // Show next week games
  console.log("\n📅 Scheduled games (Next Week):");
  games.filter(g => g.week === 2).slice(0, 5).forEach((g, i) => {
    console.log(`   ${i+1}. ${g.date} ${g.time} - ${g.homeTeamName} vs ${g.awayTeamName} (${g.gender}) @ ${g.venue}`);
  });
  
  process.exit(0);
}

createDemoGames().catch((error) => {
  console.error("❌ Error creating demo games:", error);
  process.exit(1);
});
