export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  voice?: string;
  hasElevenLabsVoice?: boolean;
  hasGoogleTTSVoice?: boolean;
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
  
  // ElevenLabs supported languages (natural, realistic voices)
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', voice: 'bg-BG-Standard-A', hasElevenLabsVoice: true },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', voice: 'hr-HR-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', voice: 'cs-CZ-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'da', name: 'Danish', flag: '🇩🇰', voice: 'da-DK-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', voice: 'nl-NL-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'el', name: 'Greek', flag: '🇬🇷', voice: 'el-GR-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', voice: 'hu-HU-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', voice: 'pl-PL-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', voice: 'pt-PT-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', voice: 'ro-RO-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', voice: 'ru-RU-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', voice: 'tr-TR-Wavenet-A', hasElevenLabsVoice: true },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷', voice: 'fa-IR-Standard-A', hasElevenLabsVoice: true },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', hasElevenLabsVoice: true },
  { code: 'ms', name: 'Malay', flag: '🇲🇾', hasElevenLabsVoice: true },
  { code: 'th', name: 'Thai', flag: '🇹🇭', hasElevenLabsVoice: true },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', hasElevenLabsVoice: true },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', hasElevenLabsVoice: true },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭', hasElevenLabsVoice: true },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰', hasElevenLabsVoice: true },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', hasElevenLabsVoice: true },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴', hasElevenLabsVoice: true },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮', hasElevenLabsVoice: true },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱', hasElevenLabsVoice: true },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', hasElevenLabsVoice: true },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', hasElevenLabsVoice: true },
  
  // Google Cloud TTS supported (standard quality fallback)
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', voice: 'bn-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', voice: 'pa-IN-Wavenet-A', hasGoogleTTSVoice: true },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', voice: 'gu-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', voice: 'ta-IN-Wavenet-A', hasGoogleTTSVoice: true },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', voice: 'te-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', voice: 'kn-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', voice: 'ml-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', voice: 'mr-IN-Standard-A', hasGoogleTTSVoice: true },
  { code: 'sw', name: 'Swahili', flag: '🇰🇪', voice: 'sw-KE-Standard-A', hasGoogleTTSVoice: true },
  { code: 'ku', name: 'Kurdish', flag: '🏴', voice: 'ku-TR-Standard-A', hasGoogleTTSVoice: true },
  { code: 'ps', name: 'Pashto', flag: '🇦🇫', voice: 'ps-AF-Standard-A', hasGoogleTTSVoice: true },
  { code: 'ti', name: 'Tigrinya', flag: '🇪🇷', voice: 'ti-ER-Standard-A', hasGoogleTTSVoice: true },
  
  // Text translation only (no voice support)
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', manualTranslationOnly: true },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵', manualTranslationOnly: true },
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

export const getGoogleTTSLanguages = () => 
  HEALTHCARE_LANGUAGES.filter(lang => lang.hasGoogleTTSVoice && lang.code !== 'none');

export const getManualTranslationLanguages = () => 
  HEALTHCARE_LANGUAGES.filter(lang => lang.manualTranslationOnly && lang.code !== 'none');
