/**
 * Preprocesses text for TTS to ensure natural voice output.
 * Cleans up speech recognition artefacts that cause choppy delivery.
 * Supports language-specific filler word removal.
 */

// Language-specific filler word patterns
const LANGUAGE_FILLERS: Record<string, RegExp> = {
  // English
  en: /\b(um|uh|er|erm|ah|like,?\s|you know,?\s|i mean,?\s|so,?\s(?=\w))\b/gi,
  
  // Polish - "no", "znaczy", "wiesz", "tego"
  pl: /\b(no|znaczy|wiesz|tego|jakby|ten|ta|właściwie|um|uh|er)\b/gi,
  
  // Romanian - "deci", "adică", "păi", "ăăă"
  ro: /\b(deci|adică|păi|ăăă|știi|bine|um|uh|er)\b/gi,
  
  // Arabic - "يعني", "شو", "هيك" (ya'ni, shu, heik)
  ar: /(يعني|شو|هيك|آآ|إيه|um|uh|er)/gi,
  
  // Hindi - "मतलब", "वो", "अच्छा" (matlab, wo, achha)
  hi: /(मतलब|वो|अच्छा|हाँ|बस|um|uh|er)/gi,
  
  // Urdu - "یعنی", "وہ", "اچھا"
  ur: /(یعنی|وہ|اچھا|ہاں|بس|um|uh|er)/gi,
  
  // Spanish - "pues", "o sea", "bueno", "este"
  es: /\b(pues|o sea|bueno|este|eh|mm|um|uh|er)\b/gi,
  
  // Portuguese - "tipo", "né", "então", "bem"
  pt: /\b(tipo|né|então|bem|olha|pois|um|uh|er)\b/gi,
  
  // French - "euh", "ben", "donc", "quoi"
  fr: /\b(euh|ben|donc|quoi|enfin|bref|voilà|um|uh|er)\b/gi,
  
  // German - "also", "ähm", "halt", "na ja"
  de: /\b(also|ähm|halt|na ja|sozusagen|quasi|um|uh|er)\b/gi,
  
  // Italian - "allora", "cioè", "praticamente"
  it: /\b(allora|cioè|praticamente|insomma|eh|um|uh|er)\b/gi,
  
  // Chinese - "那个", "就是", "然后" (nà ge, jiù shì, rán hòu)
  zh: /(那个|就是|然后|嗯|这个)/gi,
  
  // Russian - "ну", "вот", "как бы", "это"
  ru: /\b(ну|вот|как бы|это|значит|короче|um|uh|er)\b/gi,
  
  // Turkish - "şey", "yani", "işte", "hani"
  tr: /\b(şey|yani|işte|hani|ee|um|uh|er)\b/gi,
  
  // Bengali
  bn: /(মানে|আচ্ছা|তো|um|uh|er)/gi,
  
  // Gujarati
  gu: /(એટલે|બરાબર|તો|um|uh|er)/gi,
  
  // Punjabi
  pa: /(ਮਤਲਬ|ਠੀਕ|ਤਾਂ|um|uh|er)/gi,
  
  // Tamil
  ta: /(அதாவது|சரி|அப்போ|um|uh|er)/gi,
};

// Multiple spaces/punctuation
const MULTIPLE_SPACES = /\s{2,}/g;
const MULTIPLE_PERIODS = /\.{2,}/g;
const TRAILING_COMMA = /,\s*$/;

export function preprocessTextForTTS(text: string, languageCode?: string): string {
  if (!text?.trim()) return '';

  let processed = text.trim();

  // Apply language-specific filler removal
  const fillerPattern = languageCode 
    ? LANGUAGE_FILLERS[languageCode] || LANGUAGE_FILLERS['en']
    : LANGUAGE_FILLERS['en'];
  
  processed = processed.replace(fillerPattern, '');

  // Fix multiple periods (hesitation) to single comma for natural pause
  processed = processed.replace(MULTIPLE_PERIODS, ',');

  // Clean up multiple spaces
  processed = processed.replace(MULTIPLE_SPACES, ' ');

  // Remove trailing comma before final punctuation
  processed = processed.replace(TRAILING_COMMA, '');

  // Ensure sentence ends with proper punctuation for natural cadence
  processed = processed.trim();
  if (processed && !/[.!?]$/.test(processed)) {
    processed += '.';
  }

  // Capitalise first letter (for Latin scripts)
  if (processed.length > 0 && /[a-zA-Z]/.test(processed.charAt(0))) {
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  }

  return processed.trim();
}
