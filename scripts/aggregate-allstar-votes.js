// Aggregate All-Star Votes
// Run this script periodically to update vote counts in Firestore

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function aggregateVotes() {
  console.log("Starting vote aggregation...");

  try {
    // Initialize vote counters
    const voteCounts = {
      menPlayers: {},
      womenPlayers: {},
    };

    // Fetch all votes
    const votesSnapshot = await db.collection("allStarVotes").get();

    console.log(`Processing ${votesSnapshot.size} total votes...`);

    // Count votes
    votesSnapshot.docs.forEach((doc) => {
      const vote = doc.data();

      // Count men's player votes
      (vote.menPlayers || []).forEach((playerId) => {
        voteCounts.menPlayers[playerId] = (voteCounts.menPlayers[playerId] || 0) + 1;
      });

      // Count women's player votes
      (vote.womenPlayers || []).forEach((playerId) => {
        voteCounts.womenPlayers[playerId] = (voteCounts.womenPlayers[playerId] || 0) + 1;
      });
    });

    // Write aggregated results to Firestore
    const batch = db.batch();

    batch.set(db.collection("allStarVoteResults").doc("menPlayers"), voteCounts.menPlayers);
    batch.set(db.collection("allStarVoteResults").doc("womenPlayers"), voteCounts.womenPlayers);

    await batch.commit();

    console.log("\n✅ Vote aggregation complete!");
    console.log(`Men's Players: ${Object.keys(voteCounts.menPlayers).length} candidates received votes`);
    console.log(`Women's Players: ${Object.keys(voteCounts.womenPlayers).length} candidates received votes`);

    // Show top 5 vote-getters in each category
    const sortedMenPlayers = Object.entries(voteCounts.menPlayers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    console.log("\n🏀 Top 5 Men's Players:");
    sortedMenPlayers.forEach(([id, count]) => {
      console.log(`  ${id}: ${count} votes`);
    });

    const sortedWomenPlayers = Object.entries(voteCounts.womenPlayers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    console.log("\n🏀 Top 5 Women's Players:");
    sortedWomenPlayers.forEach(([id, count]) => {
      console.log(`  ${id}: ${count} votes`);
    });

  } catch (error) {
    console.error("❌ Error aggregating votes:", error);
    process.exit(1);
  }

  process.exit(0);
}

aggregateVotes();
