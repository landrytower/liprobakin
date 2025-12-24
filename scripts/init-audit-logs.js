/**
 * Initialize Audit Logs Collection in Firebase
 * 
 * This script ensures the auditLogs collection exists in Firebase
 * and creates an initial log entry if the collection is empty.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin (you may need to set up your service account key)
// For now, we'll use the default credentials
initializeApp({
  projectId: 'ppop-35930',
});

const db = getFirestore();

async function initializeAuditLogs() {
  console.log('🔍 Checking auditLogs collection...');

  try {
    // Check if collection exists and has documents
    const auditLogsRef = db.collection('auditLogs');
    const snapshot = await auditLogsRef.limit(1).get();

    if (snapshot.empty) {
      console.log('⚠️  auditLogs collection is empty. Creating initial log entry...');

      // Create an initial system log entry
      await auditLogsRef.add({
        action: 'system_initialized',
        userId: 'system',
        userEmail: 'system@febakin.com',
        targetType: 'admin',
        targetId: null,
        targetName: 'Audit Log System',
        details: {
          message: 'Audit log system initialized',
          deviceInfo: {
            userAgent: 'System',
            platform: 'Server',
            browser: 'Node.js',
            isMobile: false,
            screenResolution: 'N/A',
            language: 'en-US',
            timezone: 'UTC',
          },
        },
        sessionId: `system_${Date.now()}`,
        timestamp: Timestamp.now(),
      });

      console.log('✅ Initial audit log entry created successfully!');
      console.log('📝 The audit log system is now active and ready to record all admin actions.');
    } else {
      console.log(`✅ auditLogs collection exists with ${snapshot.size} document(s).`);
      
      // Display the most recent log
      const recentLog = snapshot.docs[0];
      console.log('\n📊 Most recent log:');
      console.log(JSON.stringify(recentLog.data(), null, 2));
    }

    // Get total count
    const allLogs = await auditLogsRef.count().get();
    console.log(`\n📈 Total audit logs in database: ${allLogs.data().count}`);

    // Check Firestore rules
    console.log('\n⚙️  Ensure your firestore.rules allows admins to read/write auditLogs:');
    console.log(`
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
    }
    `);

  } catch (error) {
    console.error('❌ Error initializing audit logs:', error);
    throw error;
  }
}

// Run the initialization
initializeAuditLogs()
  .then(() => {
    console.log('\n✨ Audit log initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Initialization failed:', error);
    process.exit(1);
  });
