// Auto-translation utility for news articles
// This will automatically translate French content to English on the fly

export async function translateText(text: string, fromLang = 'fr', toLang = 'en'): Promise<string> {
  if (!text) return text;
  
  // If already translated or is English
  if (text.match(/\b(the|and|with|after|their|have|been|was|were|championship|basketball|team|player)\b/i)) {
    return text;
  }
  
  try {
    // Using free Google Translate API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data[0]) {
      const translated = data[0].map((item: any[]) => item[0]).join('');
      return translated;
    }
    
    return text;
  } catch (error) {
    console.warn('Translation failed:', error);
    return text;
  }
}

export async function translateNewsArticle(article: any) {
  if (article.title_en) {
    return article; // Already has English translation
  }
  
  try {
    const [titleEn, headlineEn, summaryEn] = await Promise.all([
      translateText(article.title),
      translateText(article.headline),
      translateText(article.summary)
    ]);
    
    return {
      ...article,
      title_en: titleEn,
      headline_en: headlineEn,
      summary_en: summaryEn
    };
  } catch (error) {
    console.error('Error translating article:', error);
    return article;
  }
}
