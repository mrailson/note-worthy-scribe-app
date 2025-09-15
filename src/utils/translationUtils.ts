// Helper function to extract language and clean text from language tags
export const extractLanguageAndCleanText = (text: string) => {
  const languageMatch = text.match(/<(\w+)>(.*?)<\/\1>/);
  if (languageMatch) {
    return {
      language: languageMatch[1],
      cleanText: languageMatch[2]
    };
  }
  return {
    language: 'Unknown',
    cleanText: text
  };
};

// Helper function to get full language name
export const getLanguageName = (code: string, healthcareLanguages: any[]) => {
  const language = healthcareLanguages.find(l => l.code === code);
  return language?.name || code.charAt(0).toUpperCase() + code.slice(1);
};