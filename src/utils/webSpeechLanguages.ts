// Web Speech API language code mapping
// Maps our internal language codes to proper BCP 47 locale codes for Web Speech API

const WEB_SPEECH_LANG_CODES: Record<string, string> = {
  'en': 'en-GB',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'it': 'it-IT',
  'pt': 'pt-PT',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'ro': 'ro-RO',
  'ru': 'ru-RU',
  'uk': 'uk-UA',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'bn': 'bn-BD',
  'ur': 'ur-PK',
  'pa': 'pa-IN',
  'gu': 'gu-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'mr': 'mr-IN',
  'ne': 'ne-NP',
  'zh': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'vi': 'vi-VN',
  'th': 'th-TH',
  'id': 'id-ID',
  'ms': 'ms-MY',
  'tl': 'tl-PH',
  'tr': 'tr-TR',
  'fa': 'fa-IR',
  'he': 'he-IL',
  'bg': 'bg-BG',
  'hr': 'hr-HR',
  'cs': 'cs-CZ',
  'da': 'da-DK',
  'el': 'el-GR',
  'hu': 'hu-HU',
  'fi': 'fi-FI',
  'sv': 'sv-SE',
  'no': 'nb-NO',
  'sk': 'sk-SK',
  'sl': 'sl-SI',
  'et': 'et-EE',
  'lv': 'lv-LV',
  'lt': 'lt-LT',
  'so': 'so-SO',
  'sw': 'sw-KE',
  'am': 'am-ET',
  'ti': 'ti-ER',
  'yo': 'yo-NG',
  'ig': 'ig-NG',
  'ha': 'ha-NG',
  'om': 'om-ET',
  'ku': 'ku-TR',
  'ps': 'ps-AF',
};

// Languages with good Web Speech API support (most browsers)
export const WELL_SUPPORTED_WEB_SPEECH_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 
  'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'vi', 'th', 'id',
  'da', 'fi', 'sv', 'no', 'cs', 'el', 'hu', 'ro', 'sk',
  'bg', 'hr', 'uk', 'he', 'ms', 'tl'
];

/**
 * Get the Web Speech API language code for a given internal language code
 * Falls back to a sensible default if not found
 */
export const getWebSpeechLanguageCode = (langCode: string): string => {
  // Direct lookup
  if (WEB_SPEECH_LANG_CODES[langCode]) {
    return WEB_SPEECH_LANG_CODES[langCode];
  }
  
  // Try base language code if regional variant not found
  const baseLang = langCode.split('-')[0];
  if (WEB_SPEECH_LANG_CODES[baseLang]) {
    return WEB_SPEECH_LANG_CODES[baseLang];
  }
  
  // Fallback: create a BCP 47 code from the language code
  return `${langCode}-${langCode.toUpperCase()}`;
};

/**
 * Check if a language is well-supported by Web Speech API
 */
export const isWebSpeechSupported = (langCode: string): boolean => {
  const baseLang = langCode.split('-')[0];
  return WELL_SUPPORTED_WEB_SPEECH_LANGUAGES.includes(baseLang) || 
         WELL_SUPPORTED_WEB_SPEECH_LANGUAGES.includes(langCode);
};
