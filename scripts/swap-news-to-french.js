const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const https = require('https');

const firebaseConfig = {
  apiKey: "AIzaSyApCmWDWPfmBwVAOvNAu3_CSVCqGycN5OE",
  authDomain: "ppop-35930.firebaseapp.com",
  projectId: "ppop-35930",
  storageBucket: "ppop-35930.firebasestorage.app",
  messagingSenderId: "478592036466",
  appId: "1:478592036466:web:f149e594436026717adceb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to translate text from English to French
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
          resolve(text);
        }
      });
    }).on('error', (error) => {
      console.error('Request error:', error);
      resolve(text);
    });
  });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function swapAndTranslate() {
  try {
    console.log('Fetching news articles...\n');
    const newsCol = collection(db, 'news');
    const newsSnapshot = await getDocs(newsCol);
    
    for (const docSnapshot of newsSnapshot.docs) {
      const data = docSnapshot.data();
      const newsId = docSnapshot.id;
      
      console.log(`Processing: ${newsId}`);
      console.log(`Current title: ${data.title?.substring(0, 60)}...`);
      
      // Store the English content
      const englishTitle = data.title;
      const englishHeadline = data.headline;
      const englishSummary = data.summary;
      
      console.log('Translating to French...');
      
      // Translate to French
      const frenchTitle = await translateToFrench(englishTitle);
      await delay(500);
      
      const frenchHeadline = await translateToFrench(englishHeadline);
      await delay(500);
      
      // Translate summary in chunks
      let frenchSummary;
      if (englishSummary && englishSummary.length > 1000) {
        const paragraphs = englishSummary.split('\n\n');
        const translatedParagraphs = [];
        
        for (const paragraph of paragraphs) {
          if (paragraph.trim()) {
            const translated = await translateToFrench(paragraph);
            translatedParagraphs.push(translated);
            await delay(500);
          }
        }
        frenchSummary = translatedParagraphs.join('\n\n');
      } else {
        frenchSummary = await translateToFrench(englishSummary);
        await delay(500);
      }
      
      // Update document: French as base, English as _en
      const updates = {
        title: frenchTitle,
        headline: frenchHeadline,
        summary: frenchSummary,
        title_en: englishTitle,
        headline_en: englishHeadline,
        summary_en: englishSummary
      };
      
      const docRef = doc(db, 'news', newsId);
      await updateDoc(docRef, updates);
      
      console.log(`✅ Updated ${newsId}`);
      console.log(`FR Title: ${frenchTitle.substring(0, 60)}...`);
      console.log(`EN Title: ${englishTitle.substring(0, 60)}...\n`);
      
      await delay(1000);
    }
    
    console.log('\n✅ All articles updated!');
    console.log('French is now the base language, English is in _en fields');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

swapAndTranslate();
