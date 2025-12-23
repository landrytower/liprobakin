const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const https = require('https');

// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDmjfEtVyEiINQfwPZS-r8dxbUBv0HEz3o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "febakin.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "febakin",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "febakin.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "360509730690",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:360509730690:web:f092be07f0b52d52ac5aa9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to translate text using Google Translate API (free tier with limitations)
async function translateToFrench(text) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(text)}`;
    
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

async function addFrenchTranslations() {
  try {
    console.log('Fetching news articles...');
    const newsCol = collection(db, 'news');
    const newsSnapshot = await getDocs(newsCol);
    
    console.log(`Found ${newsSnapshot.size} articles`);
    
    for (const docSnap of newsSnapshot.docs) {
      const data = docSnap.data();
      
      // Skip if already has French translations
      if (data.title_fr && data.headline_fr) {
        console.log(`Skipping ${docSnap.id} - already has French translations`);
        continue;
      }
      
      console.log(`\nTranslating article: ${docSnap.id}`);
      console.log(`Title (EN): ${data.title}`);
      
      // Translate title
      const titleFr = await translateToFrench(data.title || '');
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      
      // Translate headline
      const headlineFr = await translateToFrench(data.headline || '');
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      
      // Translate summary if exists
      let summaryFr = '';
      if (data.summary) {
        summaryFr = await translateToFrench(data.summary);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
      
      console.log(`Title (FR): ${titleFr}`);
      console.log(`Headline (FR): ${headlineFr}`);
      if (summaryFr) console.log(`Summary (FR): ${summaryFr}`);
      
      // Update the document
      const docRef = doc(db, 'news', docSnap.id);
      await updateDoc(docRef, {
        title_fr: titleFr,
        headline_fr: headlineFr,
        ...(summaryFr && { summary_fr: summaryFr })
      });
      
      console.log(`✓ Updated ${docSnap.id}`);
    }
    
    console.log('\n✅ All articles translated!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addFrenchTranslations();
