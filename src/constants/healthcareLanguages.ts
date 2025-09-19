export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  voice?: string;
  hasElevenLabsVoice?: boolean;
  manualTranslationOnly?: boolean;
}

export const HEALTHCARE_LANGUAGES: LanguageOption[] = [
  { code: 'none', name: 'No Translation', flag: '🚫' },
  // ElevenLabs supported languages (with voice integration)
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', voice: 'ar-XA-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳', voice: 'cmn-CN-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'fr', name: 'French', flag: '🇫🇷', voice: 'fr-FR-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'de', name: 'German', flag: '🇩🇪', voice: 'de-DE-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', voice: 'hi-IN-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'it', name: 'Italian', flag: '🇮🇹', voice: 'it-IT-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', voice: 'es-ES-Wavenet-A', hasElevenLabsVoice: true },
  
  // Manual translation only (no ElevenLabs voice support)
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', voice: 'bg-BG-Standard-A', manualTranslationOnly: true },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', voice: 'hr-HR-Wavenet-A', manualTranslationOnly: true },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voice: 'cs-CZ-Wavenet-A', manualTranslationOnly: true },
  { code: 'da', name: 'Danish', flag: '🇩🇰', voice: 'da-DK-Wavenet-A', manualTranslationOnly: true },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voice: 'nl-NL-Wavenet-A', manualTranslationOnly: true },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A', manualTranslationOnly: true },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A', manualTranslationOnly: true },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voice: 'pl-PL-Wavenet-A', manualTranslationOnly: true },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voice: 'pt-PT-Wavenet-A', manualTranslationOnly: true },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voice: 'ro-RO-Wavenet-A', manualTranslationOnly: true },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voice: 'ru-RU-Wavenet-A', manualTranslationOnly: true },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voice: 'tr-TR-Wavenet-A', manualTranslationOnly: true },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷', voice: 'fa-IR-Standard-A', manualTranslationOnly: true },
  { code: 'ku', name: 'Kurdish', flag: '🏴', voice: 'ku-TR-Standard-A', manualTranslationOnly: true },
  { code: 'ps', name: 'Pashto', flag: '🇦🇫', voice: 'ps-AF-Standard-A', manualTranslationOnly: true },
  { code: 'ti', name: 'Tigrinya', flag: '🇪🇷', voice: 'ti-ER-Standard-A', manualTranslationOnly: true },
  // Additional languages for manual translation
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', manualTranslationOnly: true },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', manualTranslationOnly: true },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', manualTranslationOnly: true },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵', manualTranslationOnly: true },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', manualTranslationOnly: true },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', manualTranslationOnly: true },
  { code: 'th', name: 'Thai', flag: '🇹🇭', manualTranslationOnly: true },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', manualTranslationOnly: true },
  { code: 'ms', name: 'Malay', flag: '🇲🇾', manualTranslationOnly: true },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭', manualTranslationOnly: true },
  { code: 'sw', name: 'Swahili', flag: '🇰🇪', manualTranslationOnly: true },
  { code: 'am', name: 'Amharic', flag: '🇪🇹', manualTranslationOnly: true },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬', manualTranslationOnly: true },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬', manualTranslationOnly: true },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬', manualTranslationOnly: true },
  { code: 'so', name: 'Somali', flag: '🇸🇴', manualTranslationOnly: true },
  { code: 'om', name: 'Oromo', flag: '🇪🇹', manualTranslationOnly: true }
];

// Helper functions to filter languages by type
export const getElevenLabsLanguages = () => 
  HEALTHCARE_LANGUAGES.filter(lang => lang.hasElevenLabsVoice && lang.code !== 'none');

export const getManualTranslationLanguages = () => 
  HEALTHCARE_LANGUAGES.filter(lang => lang.manualTranslationOnly && lang.code !== 'none');