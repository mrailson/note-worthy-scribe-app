export interface ElevenLabsLanguage {
  code: string;
  name: string;
  flag: string;
  voiceId: string;
  voiceName: string;
  priority: number; // Lower = higher priority
  nativeName?: string;
}

// ElevenLabs multilingual voices - all support 29+ languages via eleven_multilingual_v2
// These are the recommended voices with best multilingual support
export const ELEVENLABS_VOICES = {
  sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm, professional female' },
  laura: { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Clear, friendly female' },
  charlie: { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Conversational male' },
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Professional male' },
  callum: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Young male' },
  river: { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', description: 'Non-binary' },
  liam: { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Friendly male' },
  alice: { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British female' },
  matilda: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Expressive female' },
  will: { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', description: 'Articulate male' },
  jessica: { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'American female' },
  eric: { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', description: 'Clear male' },
  brian: { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Authoritative male' },
  daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British male' },
  lily: { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'British female' },
  bill: { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Narration male' },
} as const;

// Language configuration with priority ordering for UK GP practices
// Priority 1-3: Most common in UK healthcare settings
export const ELEVENLABS_LANGUAGES: ElevenLabsLanguage[] = [
  // Priority 1: English (default GP language)
  { code: 'en', name: 'English', flag: '🇬🇧', voiceId: ELEVENLABS_VOICES.daniel.id, voiceName: 'Daniel', priority: 1 },
  
  // Priority 2: Most common in UK GP practices (Eastern European)
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 2, nativeName: 'Polski' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voiceId: ELEVENLABS_VOICES.laura.id, voiceName: 'Laura', priority: 2, nativeName: 'Română' },
  
  // Priority 3: Arabic and South Asian languages (very common in UK)
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 3, nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 3, nativeName: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 3, nativeName: 'اردو' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 3, nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 3, nativeName: 'বাংলা' },
  
  // Priority 4: Western European languages
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voiceId: ELEVENLABS_VOICES.laura.id, voiceName: 'Laura', priority: 4, nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voiceId: ELEVENLABS_VOICES.alice.id, voiceName: 'Alice', priority: 4, nativeName: 'Português' },
  { code: 'fr', name: 'French', flag: '🇫🇷', voiceId: ELEVENLABS_VOICES.charlie.id, voiceName: 'Charlie', priority: 4, nativeName: 'Français' },
  { code: 'de', name: 'German', flag: '🇩🇪', voiceId: ELEVENLABS_VOICES.george.id, voiceName: 'George', priority: 5, nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voiceId: ELEVENLABS_VOICES.laura.id, voiceName: 'Laura', priority: 5, nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voiceId: ELEVENLABS_VOICES.george.id, voiceName: 'George', priority: 6, nativeName: 'Nederlands' },
  
  // Priority 5: Other European languages
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 5, nativeName: 'Български' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', voiceId: ELEVENLABS_VOICES.laura.id, voiceName: 'Laura', priority: 6, nativeName: 'Hrvatski' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', flag: '🇩🇰', voiceId: ELEVENLABS_VOICES.lily.id, voiceName: 'Lily', priority: 7, nativeName: 'Dansk' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮', voiceId: ELEVENLABS_VOICES.lily.id, voiceName: 'Lily', priority: 7, nativeName: 'Suomi' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'Ελληνικά' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'Magyar' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴', voiceId: ELEVENLABS_VOICES.lily.id, voiceName: 'Lily', priority: 7, nativeName: 'Norsk' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'Slovenčina' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', voiceId: ELEVENLABS_VOICES.lily.id, voiceName: 'Lily', priority: 7, nativeName: 'Svenska' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 5, nativeName: 'Українська' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 5, nativeName: 'Русский' },
  
  // Priority 6: Other South Asian languages
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 5, nativeName: 'ગુજરાતી' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'मराठी' },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵', voiceId: ELEVENLABS_VOICES.matilda.id, voiceName: 'Matilda', priority: 6, nativeName: 'नेपाली' },
  
  // Priority 7: East Asian languages
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 5, nativeName: '中文' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 7, nativeName: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 7, nativeName: '한국어' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 6, nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', flag: '🇹🇭', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 7, nativeName: 'ไทย' },
  
  // Priority 8: Middle Eastern & African languages
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 5, nativeName: 'Türkçe' },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 5, nativeName: 'فارسی' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 7, nativeName: 'עברית' },
  { code: 'sw', name: 'Swahili', flag: '🇰🇪', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 7, nativeName: 'Kiswahili' },
  { code: 'so', name: 'Somali', flag: '🇸🇴', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 5, nativeName: 'Soomaali' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹', voiceId: ELEVENLABS_VOICES.brian.id, voiceName: 'Brian', priority: 6, nativeName: 'አማርኛ' },
  
  // Priority 9: Southeast Asian
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 7, nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 7, nativeName: 'Bahasa Melayu' },
  { code: 'tl', name: 'Tagalog/Filipino', flag: '🇵🇭', voiceId: ELEVENLABS_VOICES.jessica.id, voiceName: 'Jessica', priority: 6, nativeName: 'Tagalog' },
];

// Get languages sorted by priority (for dropdown)
export const getSortedLanguages = () => 
  [...ELEVENLABS_LANGUAGES].sort((a, b) => a.priority - b.priority);

// Get language by code
export const getLanguageByCode = (code: string) => 
  ELEVENLABS_LANGUAGES.find(l => l.code === code);

// Get voice for language
export const getVoiceForLanguage = (code: string) => {
  const lang = getLanguageByCode(code);
  return lang ? { voiceId: lang.voiceId, voiceName: lang.voiceName } : null;
};
