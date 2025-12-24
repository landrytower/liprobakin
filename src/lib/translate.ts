// Auto-translation utility for news articles
// This will automatically translate between French and English

export async function translateText(text: string, fromLang = 'fr', toLang = 'en'): Promise<string> {
  if (!text) return text;
  
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

/**
 * Detect if text is primarily in English or French
 */
export function detectLanguage(text: string): 'fr' | 'en' {
  const frenchIndicators = [
    ' le ', ' la ', ' les ', ' un ', ' une ', ' des ', ' du ',
    ' à ', ' au ', ' aux ', ' de ', ' dans ', ' pour ', ' avec ',
    ' est ', ' sont ', ' être ', ' avoir ', ' été ',
    ' que ', ' qui ', ' quoi ', ' où ', ' quand ',
  ];
  
  const lowerText = ' ' + text.toLowerCase() + ' ';
  let frenchMatches = 0;
  
  frenchIndicators.forEach(indicator => {
    if (lowerText.includes(indicator)) {
      frenchMatches++;
    }
  });
  
  // If we find more than 3 French indicators, assume it's French
  return frenchMatches >= 3 ? 'fr' : 'en';
}

/**
 * Auto-translate news article based on detected language
 * Always ensures French is base and English is in _en fields
 */
export async function autoTranslateNewsArticle(article: {
  title: string;
  headline: string;
  summary: string;
}): Promise<{
  title: string;
  headline: string;
  summary: string;
  title_en: string;
  headline_en: string;
  summary_en: string;
}> {
  const detectedLang = detectLanguage(article.title + ' ' + article.headline);
  
  console.log('🌍 Auto-translating article...');
  console.log('Detected language:', detectedLang);
  console.log('Original title:', article.title);
  
  if (detectedLang === 'en') {
    // Content is in English, translate to French for base fields
    console.log('📝 Content is in English, translating to French...');
    
    try {
      const [titleFr, headlineFr, summaryFr] = await Promise.all([
        translateText(article.title, 'en', 'fr'),
        translateText(article.headline, 'en', 'fr'),
        translateSummary(article.summary, 'en', 'fr'),
      ]);
      
      console.log('✅ Translation complete!');
      console.log('French title:', titleFr);
      
      return {
        title: titleFr,
        headline: headlineFr,
        summary: summaryFr,
        title_en: article.title,
        headline_en: article.headline,
        summary_en: article.summary,
      };
    } catch (error) {
      console.error('❌ Translation failed, using original content:', error);
      // Fallback: keep English as both
      return {
        title: article.title,
        headline: article.headline,
        summary: article.summary,
        title_en: article.title,
        headline_en: article.headline,
        summary_en: article.summary,
      };
    }
  } else {
    // Content is in French, translate to English for _en fields
    console.log('📝 Content is in French, translating to English...');
    
    try {
      const [titleEn, headlineEn, summaryEn] = await Promise.all([
        translateText(article.title, 'fr', 'en'),
        translateText(article.headline, 'fr', 'en'),
        translateSummary(article.summary, 'fr', 'en'),
      ]);
      
      console.log('✅ Translation complete!');
      console.log('English title:', titleEn);
      
      return {
        title: article.title,
        headline: article.headline,
        summary: article.summary,
        title_en: titleEn,
        headline_en: headlineEn,
        summary_en: summaryEn,
      };
    } catch (error) {
      console.error('❌ Translation failed, using original content:', error);
      // Fallback: use French as base, create basic English
      return {
        title: article.title,
        headline: article.headline,
        summary: article.summary,
        title_en: article.title,
        headline_en: article.headline,
        summary_en: article.summary,
      };
    }
  }
}

/**
 * Translate summary text in chunks for better quality
 */
async function translateSummary(summary: string, fromLang: 'fr' | 'en', toLang: 'fr' | 'en'): Promise<string> {
  if (!summary) return summary;
  
  // Split long summaries into paragraphs
  if (summary.length > 1000) {
    const paragraphs = summary.split('\n\n');
    const translatedParagraphs: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        const translated = await translateText(paragraph, fromLang, toLang);
        translatedParagraphs.push(translated);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        translatedParagraphs.push('');
      }
    }
    
    return translatedParagraphs.join('\n\n');
  } else {
    return translateText(summary, fromLang, toLang);
  }
}

export async function translateNewsArticle(article: any) {
  if (article.title_en && article.headline_en && article.summary_en) {
    return article; // Already has complete English translation
  }
  
  try {
    return await autoTranslateNewsArticle({
      title: article.title,
      headline: article.headline,
      summary: article.summary
    });
  } catch (error) {
    console.error('Error translating article:', error);
    return article;
  }
}
