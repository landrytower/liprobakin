const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function checkNewsLanguage() {
  try {
    console.log('Fetching news articles from Firebase...\n');
    const newsCol = collection(db, 'news');
    const newsSnapshot = await getDocs(newsCol);
    
    newsSnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      console.log('---');
      console.log(`ID: ${docSnapshot.id}`);
      console.log(`Title: ${data.title?.substring(0, 80)}`);
      console.log(`Title_EN: ${data.title_en?.substring(0, 80)}`);
      console.log(`Headline: ${data.headline?.substring(0, 80)}`);
      console.log(`Headline_EN: ${data.headline_en?.substring(0, 80)}`);
      console.log('');
    });
    
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNewsLanguage();
