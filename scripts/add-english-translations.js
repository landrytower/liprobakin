const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const https = require('https');

// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ppop-35930.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ppop-35930",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ppop-35930.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "478592036466",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:478592036466:web:f149e594436026717adceb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to translate text from French to English using Google Translate
async function translateToEnglish(text) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const translated = parsed[0].map(item => item[0]).join('');
          resolve(translated);
        } catch (error) {
          console.error('Translation error:', error);
          resolve(text); // Fallback to original text
        }
      });
    }).on('error', (error) => {
      console.error('Request error:', error);
      resolve(text); // Fallback to original text
    });
  });
}

// Add delay to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function addEnglishTranslations() {
  try {
    console.log('Fetching news articles...');
    const newsCol = collection(db, 'news');
    const newsSnapshot = await getDocs(newsCol);
    
    console.log(`Found ${newsSnapshot.docs.length} news articles`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const docSnapshot of newsSnapshot.docs) {
      const newsData = docSnapshot.data();
      const newsId = docSnapshot.id;
      
      // Check if English translations already exist
      if (newsData.title_en && newsData.headline_en && newsData.summary_en) {
        console.log(`Skipping ${newsId} - English translations already exist`);
        skippedCount++;
        continue;
      }
      
      console.log(`\nProcessing: ${newsId}`);
      console.log(`Original title: ${newsData.title?.substring(0, 50)}...`);
      
      const updates = {};
      
      // Translate title if not exists
      if (!newsData.title_en && newsData.title) {
        console.log('Translating title...');
        updates.title_en = await translateToEnglish(newsData.title);
        await delay(500); // Delay to avoid rate limiting
      }
      
      // Translate headline if not exists
      if (!newsData.headline_en && newsData.headline) {
        console.log('Translating headline...');
        updates.headline_en = await translateToEnglish(newsData.headline);
        await delay(500);
      }
      
      // Translate summary if not exists
      if (!newsData.summary_en && newsData.summary) {
        console.log('Translating summary (this may take longer)...');
        // Split long summaries into chunks for better translation
        const summary = newsData.summary;
        if (summary.length > 1000) {
          const paragraphs = summary.split('\n\n');
          const translatedParagraphs = [];
          
          for (const paragraph of paragraphs) {
            if (paragraph.trim()) {
              const translated = await translateToEnglish(paragraph);
              translatedParagraphs.push(translated);
              await delay(500);
            }
          }
          updates.summary_en = translatedParagraphs.join('\n\n');
        } else {
          updates.summary_en = await translateToEnglish(summary);
          await delay(500);
        }
      }
      
      // Update the document if there are changes
      if (Object.keys(updates).length > 0) {
        const docRef = doc(db, 'news', newsId);
        await updateDoc(docRef, updates);
        console.log(`✅ Updated ${newsId} with English translations`);
        console.log(`Title (EN): ${updates.title_en?.substring(0, 50)}...`);
        updatedCount++;
      } else {
        console.log(`⏭️  No updates needed for ${newsId}`);
        skippedCount++;
      }
      
      // Add delay between documents
      await delay(1000);
    }
    
    console.log(`\n✅ Translation complete!`);
    console.log(`Updated: ${updatedCount} articles`);
    console.log(`Skipped: ${skippedCount} articles`);
    
  } catch (error) {
    console.error('Error adding English translations:', error);
  }
}

// Run the script
addEnglishTranslations()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
