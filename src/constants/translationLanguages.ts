export interface TranslationLanguage {
  id: string;
  name: string;
  native: string;
  hello: string;
  region: string;
  rtl?: boolean;
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  // South Asia
  { id: "hi", name: "Hindi", native: "हिन्दी", hello: "नमस्ते", region: "South Asia" },
  { id: "bn", name: "Bengali", native: "বাংলা", hello: "নমস্কার", region: "South Asia" },
  { id: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", region: "South Asia" },
  { id: "gu", name: "Gujarati", native: "ગુજરાતી", hello: "નમસ્તે", region: "South Asia" },
  { id: "ta", name: "Tamil", native: "தமிழ்", hello: "வணக்கம்", region: "South Asia" },
  { id: "te", name: "Telugu", native: "తెలుగు", hello: "నమస్కారం", region: "South Asia" },
  { id: "kn", name: "Kannada", native: "ಕನ್ನಡ", hello: "ನಮಸ್ಕಾರ", region: "South Asia" },
  { id: "ml", name: "Malayalam", native: "മലയാളം", hello: "നമസ്കാരം", region: "South Asia" },
  { id: "mr", name: "Marathi", native: "मराठी", hello: "नमस्कार", region: "South Asia" },
  { id: "ur", name: "Urdu", native: "اردو", hello: "السلام علیکم", region: "South Asia", rtl: true },
  { id: "ne", name: "Nepali", native: "नेपाली", hello: "नमस्ते", region: "South Asia" },
  // Middle East & Central Asia
  { id: "ar", name: "Arabic", native: "العربية", hello: "مرحبا", region: "Middle East & Central Asia", rtl: true },
  { id: "fa", name: "Persian (Farsi)", native: "فارسی", hello: "سلام", region: "Middle East & Central Asia", rtl: true },
  { id: "tr", name: "Turkish", native: "Türkçe", hello: "Merhaba", region: "Middle East & Central Asia" },
  { id: "ku", name: "Kurdish", native: "Kurdî / کوردی", hello: "Silav", region: "Middle East & Central Asia" },
  { id: "ps", name: "Pashto", native: "پښتو", hello: "سلام", region: "Middle East & Central Asia", rtl: true },
  { id: "he", name: "Hebrew", native: "עברית", hello: "שלום", region: "Middle East & Central Asia", rtl: true },
  // East & Southeast Asia
  { id: "zh", name: "Chinese (Mandarin)", native: "中文", hello: "你好", region: "East & Southeast Asia" },
  { id: "ja", name: "Japanese", native: "日本語", hello: "こんにちは", region: "East & Southeast Asia" },
  { id: "ko", name: "Korean", native: "한국어", hello: "안녕하세요", region: "East & Southeast Asia" },
  { id: "th", name: "Thai", native: "ไทย", hello: "สวัสดี", region: "East & Southeast Asia" },
  { id: "vi", name: "Vietnamese", native: "Tiếng Việt", hello: "Xin chào", region: "East & Southeast Asia" },
  { id: "id", name: "Indonesian", native: "Bahasa Indonesia", hello: "Halo", region: "East & Southeast Asia" },
  { id: "ms", name: "Malay", native: "Bahasa Melayu", hello: "Hai", region: "East & Southeast Asia" },
  { id: "tl", name: "Tagalog", native: "Tagalog", hello: "Kumusta", region: "East & Southeast Asia" },
  // Africa
  { id: "sw", name: "Swahili", native: "Kiswahili", hello: "Habari", region: "Africa" },
  { id: "ti", name: "Tigrinya", native: "ትግርኛ", hello: "ሰላም", region: "Africa" },
  { id: "am", name: "Amharic", native: "አማርኛ", hello: "ሰላም", region: "Africa" },
  { id: "yo", name: "Yoruba", native: "Yorùbá", hello: "Pẹlẹ o", region: "Africa" },
  { id: "ig", name: "Igbo", native: "Igbo", hello: "Nnọọ", region: "Africa" },
  { id: "ha", name: "Hausa", native: "Hausa", hello: "Sannu", region: "Africa" },
  { id: "so", name: "Somali", native: "Soomaali", hello: "Salaan", region: "Africa" },
  { id: "om", name: "Oromo", native: "Afaan Oromoo", hello: "Akkam", region: "Africa" },
  // Western Europe
  { id: "fr", name: "French", native: "Français", hello: "Bonjour", region: "Western Europe" },
  { id: "de", name: "German", native: "Deutsch", hello: "Hallo", region: "Western Europe" },
  { id: "it", name: "Italian", native: "Italiano", hello: "Ciao", region: "Western Europe" },
  { id: "es", name: "Spanish", native: "Español", hello: "Hola", region: "Western Europe" },
  { id: "pt", name: "Portuguese", native: "Português", hello: "Olá", region: "Western Europe" },
  { id: "nl", name: "Dutch", native: "Nederlands", hello: "Hallo", region: "Western Europe" },
  { id: "sv", name: "Swedish", native: "Svenska", hello: "Hej", region: "Western Europe" },
  { id: "no", name: "Norwegian", native: "Norsk", hello: "Hei", region: "Western Europe" },
  { id: "da", name: "Danish", native: "Dansk", hello: "Hej", region: "Western Europe" },
  { id: "fi", name: "Finnish", native: "Suomi", hello: "Hei", region: "Western Europe" },
  // Eastern Europe
  { id: "pl", name: "Polish", native: "Polski", hello: "Cześć", region: "Eastern Europe" },
  { id: "ro", name: "Romanian", native: "Română", hello: "Bună", region: "Eastern Europe" },
  { id: "ru", name: "Russian", native: "Русский", hello: "Здравствуйте", region: "Eastern Europe" },
  { id: "uk", name: "Ukrainian", native: "Українська", hello: "Привіт", region: "Eastern Europe" },
  { id: "bg", name: "Bulgarian", native: "Български", hello: "Здравейте", region: "Eastern Europe" },
  { id: "hr", name: "Croatian", native: "Hrvatski", hello: "Bok", region: "Eastern Europe" },
  { id: "cs", name: "Czech", native: "Čeština", hello: "Ahoj", region: "Eastern Europe" },
  { id: "sk", name: "Slovak", native: "Slovenčina", hello: "Ahoj", region: "Eastern Europe" },
  { id: "hu", name: "Hungarian", native: "Magyar", hello: "Szia", region: "Eastern Europe" },
  { id: "el", name: "Greek", native: "Ελληνικά", hello: "Γεια σας", region: "Eastern Europe" },
];

export const QUICK_PICK_IDS = ["pl", "ro", "bn", "gu", "ur", "ar", "zh", "so"];

export const REGION_COLOURS: Record<string, { bg: string; accent: string; dot: string }> = {
  "South Asia": { bg: "hsl(30 100% 95%)", accent: "hsl(30 85% 40%)", dot: "hsl(38 92% 50%)" },
  "Middle East & Central Asia": { bg: "hsl(2 100% 95%)", accent: "hsl(4 58% 48%)", dot: "hsl(0 84% 60%)" },
  "East & Southeast Asia": { bg: "hsl(138 76% 97%)", accent: "hsl(148 67% 28%)", dot: "hsl(142 71% 45%)" },
  "Africa": { bg: "hsl(48 96% 89%)", accent: "hsl(33 85% 30%)", dot: "hsl(45 93% 47%)" },
  "Western Europe": { bg: "hsl(214 100% 97%)", accent: "hsl(213 72% 37%)", dot: "hsl(217 91% 60%)" },
  "Eastern Europe": { bg: "hsl(263 100% 97%)", accent: "hsl(263 69% 44%)", dot: "hsl(258 90% 66%)" },
};

export const REGION_ORDER = [
  "South Asia",
  "Middle East & Central Asia",
  "East & Southeast Asia",
  "Africa",
  "Western Europe",
  "Eastern Europe",
];
