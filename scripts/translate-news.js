/**
 * Automatically translate news articles from French to English
 * This script fetches news from Firestore and adds English translations
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Simple translation dictionary for common basketball terms
const translations = {
  // Basketball terms
  "champions": "champions",
  "finale": "final",
  "coach": "coach",
  "équipe": "team",
  "joueurs": "players",
  "basket-ball": "basketball",
  "titre": "title",
  "victoire": "victory",
  "défaite": "defeat",
  "saison": "season",
  "match": "game",
  "compétition": "competition",
  
  // Common phrases
  "ont été sacrés": "were crowned",
  "après": "after",
  "chez les messieurs": "in men's",
  "chez les dames": "in women's",
  "de retour": "back",
  "ans après": "years after",
  "remporté": "won",
  "battu": "beat",
  "terminé": "finished",
  "troisième position": "third place",
};

async function translateText(text, fromLang = 'fr', toLang = 'en') {
  if (!text) return text;
  
  // If text is already in English (contains common English words), return as is
  if (text.match(/\b(the|and|with|after|their|have|been|was|were|championship)\b/i)) {
    return text;
  }
  
  try {
    // Using free translation API - you can replace with Google Translate API if you have credentials
    const https = require('https');
    const querystring = require('querystring');
    
    const params = querystring.stringify({
      client: 'gtx',
      sl: fromLang,
      tl: toLang,
      dt: 't',
      q: text
    });
    
    return new Promise((resolve, reject) => {
      https.get(`https://translate.googleapis.com/translate_a/single?${params}`, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const translated = parsed[0].map(item => item[0]).join('');
            console.log(`      Translated: "${text.substring(0, 50)}..." → "${translated.substring(0, 50)}..."`);
            resolve(translated);
          } catch (err) {
            console.warn(`      ⚠️  Translation failed, using placeholder`);
            resolve(`[EN] ${text}`);
          }
        });
      }).on('error', (err) => {
        console.warn(`      ⚠️  Translation API error: ${err.message}`);
        resolve(`[EN] ${text}`);
      });
    });
  } catch (error) {
    console.warn(`   ⚠️  Translation error: ${error.message}`);
    return `[EN] ${text}`;
  }
}

async function translateNewsArticles() {
  try {
    console.log('📰 Fetching news articles from Firestore...');
    const newsSnapshot = await db.collection('news').get();
    
    if (newsSnapshot.empty) {
      console.log('No news articles found.');
      return;
    }
    
    console.log(`Found ${newsSnapshot.size} news articles.`);
    
    const batch = db.batch();
    let updatedCount = 0;
    
    for (const doc of newsSnapshot.docs) {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;
      
      // Check if article needs English translation
      if (data.title && !data.title_en) {
        console.log(`\n📝 Processing: ${data.title}`);
        
        // Add French versions (current content)
        if (!data.title_fr) {
          updates.title_fr = data.title;
          needsUpdate = true;
        }
        
        if (!data.headline_fr && data.headline) {
          updates.headline_fr = data.headline;
          needsUpdate = true;
        }
        
        if (!data.summary_fr && data.summary) {
          updates.summary_fr = data.summary;
          needsUpdate = true;
        }
        
        // For now, add placeholder English versions
        // TODO: Integrate with translation API
        updates.title_en = await translateText(data.title);
        updates.headline_en = await translateText(data.headline);
        updates.summary_en = await translateText(data.summary);
        
        console.log(`   ✓ French: ${data.title}`);
        console.log(`   ✓ English: ${updates.title_en}`);
        
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`\n💾 Updating ${updatedCount} articles in Firestore...`);
      await batch.commit();
      console.log('✅ Successfully updated news articles!');
      console.log('\n⚠️  Note: English translations are currently placeholders.');
      console.log('   Please manually translate the [EN] prefixed text or integrate a translation API.');
    } else {
      console.log('✅ All articles already have translations!');
    }
    
  } catch (error) {
    console.error('❌ Error translating news:', error);
    throw error;
  }
}

// Run the script
translateNewsArticles()
  .then(() => {
    console.log('\n🎉 Translation script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
