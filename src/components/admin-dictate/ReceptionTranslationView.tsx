import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Mic,
  Loader2,
  MicOff, 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff,
  Volume2,
  Trash2,
  FileText,
  Maximize2,
  Printer,
  Mail,
  Smartphone,
  Pause,
  Play,
  Send,
  XCircle,
  AlertTriangle,
  ShieldX,
  Monitor,
  MonitorOff,
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AssemblyRealtimeClient } from '@/lib/assembly-realtime';
import { useReceptionTranslation, TranslationMessage, ContentWarning } from '@/hooks/useReceptionTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { generateTranslationReportDocx } from '@/utils/generateTranslationReportDocx';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { SpeakerModeSelector } from './SpeakerModeSelector';
import { PatientSpeakingPrompt } from './PatientSpeakingPrompt';
import { getWebSpeechLanguageCode, isWebSpeechSupported } from '@/utils/webSpeechLanguages';
import { TranslationSettingsModal } from './TranslationSettingsModal';
import { TranslationHistoryInline } from './TranslationHistoryInline';

// Localised "GP Practice said" for translated messages
const GP_PRACTICE_SAID: Record<string, string> = {
  en: "GP Practice said:",
  ar: "قالت العيادة:",
  zh: "诊所说：",
  'zh-TW': "診所說：",
  fr: "Le cabinet médical a dit :",
  de: "Die Praxis sagte:",
  hi: "जीपी प्रैक्टिस ने कहा:",
  it: "Lo studio medico ha detto:",
  es: "La consulta médica dijo:",
  bg: "Практиката каза:",
  hr: "Ordinacija je rekla:",
  cs: "Ordinace řekla:",
  da: "Lægepraksis sagde:",
  nl: "De huisartsenpraktijk zei:",
  el: "Το ιατρείο είπε:",
  hu: "A rendelő mondta:",
  pl: "Gabinet lekarski powiedział:",
  pt: "A clínica disse:",
  ro: "Cabinetul medical a spus:",
  ru: "Клиника сказала:",
  tr: "Sağlık merkezi dedi:",
  fa: "مطب گفت:",
  ku: "Klînik got:",
  ps: "کلینیک وویل:",
  ti: "ክሊኒክ በለ:",
  bn: "জিপি প্র্যাকটিস বলেছে:",
  ur: "جی پی پریکٹس نے کہا:",
  pa: "ਜੀਪੀ ਪ੍ਰੈਕਟਿਸ ਨੇ ਕਿਹਾ:",
  gu: "જીપી પ્રેક્ટિસે કહ્યું:",
  ta: "ஜிபி பிராக்டிஸ் கூறியது:",
  te: "జిపి ప్రాక్టీస్ చెప్పింది:",
  kn: "ಜಿಪಿ ಪ್ರಾಕ್ಟೀಸ್ ಹೇಳಿದ್ದು:",
  ml: "ജിപി പ്രാക്ടീസ് പറഞ്ഞു:",
  mr: "जीपी प्रॅक्टिस म्हणाले:",
  ne: "जीपी प्र्याक्टिसले भन्यो:",
  uk: "Клініка сказала:",
  vi: "Phòng khám nói:",
  th: "คลินิกพูดว่า:",
  id: "Praktik dokter berkata:",
  ms: "Klinik berkata:",
  tl: "Sinabi ng klinika:",
  sw: "Kliniki ilisema:",
  am: "ክሊኒኩ እንዲህ አለ:",
  yo: "Ilé-ìwòsàn sọ pé:",
  ig: "Ụlọ ọgwụ kwuru:",
  ha: "Asibitin ya ce:",
  so: "Xarunta caafimaadka waxay tiri:",
  om: "Kilinikiin jedhe:",
  ja: "クリニックからのメッセージ：",
  ko: "진료소에서 말했습니다:",
  fi: "Vastaanotto sanoi:",
  sv: "Vårdcentralen sa:",
  no: "Legekontoret sa:",
  he: "המרפאה אמרה:",
  sk: "Ambulancia povedala:",
};

// Localised "Patient said:" labels for patient messages
const PATIENT_SAID: Record<string, string> = {
  en: "Patient said:",
  ar: "قال المريض:",
  zh: "患者说：",
  'zh-TW': "患者說：",
  fr: "Le patient a dit :",
  de: "Der Patient sagte:",
  hi: "मरीज ने कहा:",
  it: "Il paziente ha detto:",
  es: "El paciente dijo:",
  bg: "Пациентът каза:",
  hr: "Pacijent je rekao:",
  cs: "Pacient řekl:",
  da: "Patienten sagde:",
  nl: "De patiënt zei:",
  el: "Ο ασθενής είπε:",
  hu: "A páciens mondta:",
  pl: "Pacjent powiedział:",
  pt: "O paciente disse:",
  ro: "Pacientul a spus:",
  ru: "Пациент сказал:",
  tr: "Hasta dedi:",
  fa: "بیمار گفت:",
  ku: "Nexweş got:",
  ps: "ناروغ وویل:",
  ti: "ሕሙም በለ:",
  bn: "রোগী বলেছে:",
  ur: "مریض نے کہا:",
  pa: "ਮਰੀਜ਼ ਨੇ ਕਿਹਾ:",
  gu: "દર્દીએ કહ્યું:",
  ta: "நோயாளி கூறினார்:",
  te: "రోగి చెప్పారు:",
  kn: "ರೋಗಿ ಹೇಳಿದರು:",
  ml: "രോഗി പറഞ്ഞു:",
  mr: "रुग्ण म्हणाले:",
  ne: "बिरामीले भन्नुभयो:",
  uk: "Пацієнт сказав:",
  vi: "Bệnh nhân nói:",
  th: "ผู้ป่วยพูดว่า:",
  id: "Pasien berkata:",
  ms: "Pesakit berkata:",
  tl: "Sinabi ng pasyente:",
  sw: "Mgonjwa alisema:",
  am: "ታካሚው አለ:",
  yo: "Aláìsàn sọ pé:",
  ig: "Onye ọrịa kwuru:",
  ha: "Majinyaci ya ce:",
  so: "Bukaanku wuxuu yiri:",
  om: "Dhukkubsataan jedhe:",
  ja: "患者さんが言いました：",
  ko: "환자가 말했습니다:",
  fi: "Potilas sanoi:",
  sv: "Patienten sa:",
  no: "Pasienten sa:",
  he: "המטופל אמר:",
  sk: "Pacient povedal:",
};

// Localised "Play Audio" button labels
const PLAY_AUDIO: Record<string, string> = {
  en: "Play Audio",
  ar: "تشغيل الصوت",
  zh: "播放音频",
  'zh-TW': "播放音頻",
  fr: "Lire l'audio",
  de: "Audio abspielen",
  hi: "ऑडियो चलाएं",
  it: "Riproduci audio",
  es: "Reproducir audio",
  bg: "Пусни аудио",
  hr: "Reproduciraj audio",
  cs: "Přehrát zvuk",
  da: "Afspil lyd",
  nl: "Audio afspelen",
  el: "Αναπαραγωγή ήχου",
  hu: "Hang lejátszása",
  pl: "Odtwórz dźwięk",
  pt: "Reproduzir áudio",
  ro: "Redare audio",
  ru: "Воспроизвести",
  tr: "Sesi çal",
  fa: "پخش صدا",
  ku: "Dengê lêxin",
  ps: "غږ غږول",
  ti: "ድምጺ ኣጻውት",
  bn: "অডিও চালান",
  ur: "آڈیو چلائیں",
  pa: "ਆਡੀਓ ਚਲਾਓ",
  gu: "ઓડિયો ચલાવો",
  ta: "ஆடியோ இயக்கு",
  te: "ఆడియో ప్లే చేయండి",
  kn: "ಆಡಿಯೋ ಪ್ಲೇ ಮಾಡಿ",
  ml: "ഓഡിയോ പ്ലേ ചെയ്യുക",
  mr: "ऑडिओ प्ले करा",
  ne: "अडियो बजाउनुहोस्",
  uk: "Відтворити аудіо",
  vi: "Phát âm thanh",
  th: "เล่นเสียง",
  id: "Putar audio",
  ms: "Main audio",
  tl: "I-play ang audio",
  sw: "Cheza sauti",
  am: "ድምፅ አጫውት",
  yo: "Ṣí ohùn",
  ig: "Kpọọ ọdịyo",
  ha: "Kunna sauti",
  so: "Dhagayso codka",
  om: "Sagalee taphachiisi",
  ja: "音声を再生",
  ko: "오디오 재생",
  fi: "Toista ääni",
  sv: "Spela ljud",
  no: "Spill av lyd",
  he: "נגן שמע",
  sk: "Prehrať zvuk",
};

// Localised "Loading audio..." labels
const LOADING_AUDIO: Record<string, string> = {
  en: "Loading audio...",
  ar: "جاري تحميل الصوت...",
  zh: "加载音频中...",
  'zh-TW': "載入音頻中...",
  fr: "Chargement audio...",
  de: "Audio wird geladen...",
  hi: "ऑडियो लोड हो रहा है...",
  it: "Caricamento audio...",
  es: "Cargando audio...",
  bg: "Зареждане на аудио...",
  hr: "Učitavanje zvuka...",
  cs: "Načítání zvuku...",
  da: "Indlæser lyd...",
  nl: "Audio laden...",
  el: "Φόρτωση ήχου...",
  hu: "Hang betöltése...",
  pl: "Ładowanie dźwięku...",
  pt: "Carregando áudio...",
  ro: "Se încarcă audio...",
  ru: "Загрузка аудио...",
  tr: "Ses yükleniyor...",
  fa: "در حال بارگذاری صدا...",
  ku: "Deng tê barkirin...",
  ps: "غږ لوډ کیږي...",
  ti: "ድምጺ ይጽዕን ኣሎ...",
  bn: "অডিও লোড হচ্ছে...",
  ur: "آڈیو لوڈ ہو رہا ہے...",
  pa: "ਆਡੀਓ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...",
  gu: "ઓડિયો લોડ થઈ રહ્યો છે...",
  ta: "ஆடியோ ஏற்றப்படுகிறது...",
  te: "ఆడియో లోడ్ అవుతోంది...",
  kn: "ಆಡಿಯೋ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
  ml: "ഓഡിയോ ലോഡുചെയ്യുന്നു...",
  mr: "ऑडिओ लोड होत आहे...",
  ne: "अडियो लोड हुँदैछ...",
  uk: "Завантаження аудіо...",
  vi: "Đang tải âm thanh...",
  th: "กำลังโหลดเสียง...",
  id: "Memuat audio...",
  ms: "Memuatkan audio...",
  tl: "Naglo-load ng audio...",
  sw: "Inapakia sauti...",
  am: "ድምፅ በመጫን ላይ...",
  yo: "Ń gbé ohùn...",
  ig: "Na-ebugo ọdịyo...",
  ha: "Ana loda sauti...",
  so: "Codka ayaa la soo dejinayaa...",
  om: "Sagaleen fe'amaa jira...",
  ja: "音声を読み込み中...",
  ko: "오디오 로드 중...",
  fi: "Ladataan ääntä...",
  sv: "Laddar ljud...",
  no: "Laster lyd...",
  he: "טוען שמע...",
  sk: "Načítavam zvuk...",
};

// Localised "Stop" button labels
const STOP_AUDIO: Record<string, string> = {
  en: "Stop",
  ar: "إيقاف",
  zh: "停止",
  'zh-TW': "停止",
  fr: "Arrêter",
  de: "Stopp",
  hi: "रोकें",
  it: "Ferma",
  es: "Parar",
  bg: "Стоп",
  hr: "Zaustavi",
  cs: "Stop",
  da: "Stop",
  nl: "Stop",
  el: "Διακοπή",
  hu: "Leállítás",
  pl: "Stop",
  pt: "Parar",
  ro: "Stop",
  ru: "Стоп",
  tr: "Durdur",
  fa: "توقف",
  ku: "Rawestîne",
  ps: "ودرول",
  ti: "ኣቋርጽ",
  bn: "থামান",
  ur: "روکیں",
  pa: "ਰੋਕੋ",
  gu: "બંધ કરો",
  ta: "நிறுத்து",
  te: "ఆపు",
  kn: "ನಿಲ್ಲಿಸಿ",
  ml: "നിർത്തുക",
  mr: "थांबा",
  ne: "रोक्नुहोस्",
  uk: "Стоп",
  vi: "Dừng",
  th: "หยุด",
  id: "Berhenti",
  ms: "Berhenti",
  tl: "Ihinto",
  sw: "Simama",
  am: "አቁም",
  yo: "Dúró",
  ig: "Kwụsị",
  ha: "Tsaya",
  so: "Joogso",
  om: "Dhaabi",
  ja: "停止",
  ko: "중지",
  fi: "Pysäytä",
  sv: "Stopp",
  no: "Stopp",
  he: "עצור",
  sk: "Stop",
};

// Localised modal titles for "Patient's Language"
const MODAL_TITLES: Record<string, string> = {
  en: "Patient's Language",
  ar: "لغة المريض",
  zh: "患者语言",
  fr: "Langue du patient",
  de: "Sprache des Patienten",
  hi: "रोगी की भाषा",
  it: "Lingua del paziente",
  es: "Idioma del paciente",
  bg: "Език на пациента",
  hr: "Jezik pacijenta",
  cs: "Jazyk pacienta",
  da: "Patientens sprog",
  nl: "Taal van de patiënt",
  el: "Γλώσσα ασθενούς",
  hu: "Beteg nyelve",
  pl: "Język pacjenta",
  pt: "Língua do paciente",
  ro: "Limba pacientului",
  ru: "Язык пациента",
  tr: "Hasta dili",
  fa: "زبان بیمار",
  ku: "Zimanê nexweş",
  ps: "د ناروغ ژبه",
  ti: "ቋንቋ ሕሙም",
  bn: "রোগীর ভাষা",
  ur: "مریض کی زبان",
  pa: "ਮਰੀਜ਼ ਦੀ ਭਾਸ਼ਾ",
  gu: "દર્દીની ભાષા",
  ta: "நோயாளியின் மொழி",
  te: "రోగి భాష",
  kn: "ರೋಗಿಯ ಭಾಷೆ",
  ml: "രോഗിയുടെ ഭാഷ",
  mr: "रुग्णाची भाषा",
  ne: "बिरामीको भाषा",
  uk: "Мова пацієнта",
  vi: "Ngôn ngữ bệnh nhân",
  th: "ภาษาของผู้ป่วย",
  id: "Bahasa pasien",
  ms: "Bahasa pesakit",
  tl: "Wika ng pasyente",
  sw: "Lugha ya mgonjwa",
  am: "የታካሚ ቋንቋ",
  yo: "Èdè aláìsàn",
  ig: "Asụsụ onye ọrịa",
  ha: "Harshen majinyaci",
  so: "Luqadda bukaanka",
  om: "Afaan dhukkubsataa"
};

// Translated instructions for patients
const QR_INSTRUCTIONS: Record<string, {
  scanInstruction: string;
  welcomeMessage: string;
}> = {
  en: {
    scanInstruction: 'Please scan this QR code with your phone camera',
    welcomeMessage: 'Welcome to {practice}. This service will help us communicate with you in your language.'
  },
  fr: {
    scanInstruction: 'Veuillez scanner ce code QR avec la caméra de votre téléphone',
    welcomeMessage: 'Bienvenue à {practice}. Ce service nous aidera à communiquer avec vous dans votre langue.'
  },
  es: {
    scanInstruction: 'Por favor escanee este código QR con la cámara de su teléfono',
    welcomeMessage: 'Bienvenido a {practice}. Este servicio nos ayudará a comunicarnos con usted en su idioma.'
  },
  pl: {
    scanInstruction: 'Proszę zeskanować ten kod QR aparatem telefonu',
    welcomeMessage: 'Witamy w {practice}. Ta usługa pomoże nam komunikować się z Państwem w Państwa języku.'
  },
  ro: {
    scanInstruction: 'Vă rugăm să scanați acest cod QR cu camera telefonului',
    welcomeMessage: 'Bine ați venit la {practice}. Acest serviciu ne va ajuta să comunicăm cu dumneavoastră în limba dumneavoastră.'
  },
  pt: {
    scanInstruction: 'Por favor, digitalize este código QR com a câmara do seu telemóvel',
    welcomeMessage: 'Bem-vindo a {practice}. Este serviço irá ajudar-nos a comunicar consigo na sua língua.'
  },
  ar: {
    scanInstruction: 'يرجى مسح رمز QR هذا بكاميرا هاتفك',
    welcomeMessage: 'مرحبًا بكم في {practice}. ستساعدنا هذه الخدمة على التواصل معكم بلغتكم.'
  },
  bn: {
    scanInstruction: 'অনুগ্রহ করে আপনার ফোনের ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করুন',
    welcomeMessage: '{practice}-এ স্বাগতম। এই পরিষেবাটি আমাদের আপনার ভাষায় আপনার সাথে যোগাযোগ করতে সাহায্য করবে।'
  },
  gu: {
    scanInstruction: 'કૃપા કરીને તમારા ફોનના કેમેરાથી આ QR કોડ સ્કેન કરો',
    welcomeMessage: '{practice}માં સ્વાગત છે. આ સેવા અમને તમારી ભાષામાં તમારી સાથે વાતચીત કરવામાં મદદ કરશે.'
  },
  hi: {
    scanInstruction: 'कृपया अपने फोन के कैमरे से इस QR कोड को स्कैन करें',
    welcomeMessage: '{practice} में आपका स्वागत है। यह सेवा हमें आपकी भाषा में आपसे संवाद करने में मदद करेगी।'
  },
  pa: {
    scanInstruction: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਫ਼ੋਨ ਦੇ ਕੈਮਰੇ ਨਾਲ ਇਸ QR ਕੋਡ ਨੂੰ ਸਕੈਨ ਕਰੋ',
    welcomeMessage: '{practice} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਇਹ ਸੇਵਾ ਸਾਨੂੰ ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰੇਗੀ।'
  },
  ur: {
    scanInstruction: 'براہ کرم اپنے فون کے کیمرے سے اس QR کوڈ کو اسکین کریں',
    welcomeMessage: '{practice} میں خوش آمدید۔ یہ سروس ہمیں آپ کی زبان میں آپ سے بات چیت کرنے میں مدد کرے گی۔'
  },
  zh: {
    scanInstruction: '请用手机摄像头扫描此二维码',
    welcomeMessage: '欢迎来到{practice}。这项服务将帮助我们用您的语言与您交流。'
  },
  'zh-TW': {
    scanInstruction: '請用手機相機掃描此二維碼',
    welcomeMessage: '歡迎來到{practice}。這項服務將幫助我們用您的語言與您交流。'
  },
  so: {
    scanInstruction: 'Fadlan sawir koodhkan QR-ga kamaradda telefoonkaaga',
    welcomeMessage: 'Ku soo dhawoow {practice}. Adeeggan wuxuu naga caawin doonaa inaan kugula xiriirno luqaddaada.'
  },
  ti: {
    scanInstruction: 'በጃኻ ብካመራ ተሌፎንካ እዚ QR ኮድ ስካን ግበር',
    welcomeMessage: 'ናብ {practice} እንቋዕ ብደሓን መጻእካ። እዚ ኣገልግሎት ብቋንቋኻ ምሳኻ ንምርኻብ ክሕግዘና እዩ።'
  },
  tr: {
    scanInstruction: 'Lütfen bu QR kodunu telefonunuzun kamerasıyla tarayın',
    welcomeMessage: '{practice}\'a hoş geldiniz. Bu hizmet sizinle kendi dilinizde iletişim kurmamıza yardımcı olacaktır.'
  },
  it: {
    scanInstruction: 'Si prega di scansionare questo codice QR con la fotocamera del telefono',
    welcomeMessage: 'Benvenuto a {practice}. Questo servizio ci aiuterà a comunicare con Lei nella Sua lingua.'
  },
  de: {
    scanInstruction: 'Bitte scannen Sie diesen QR-Code mit Ihrer Handykamera',
    welcomeMessage: 'Willkommen bei {practice}. Dieser Service wird uns helfen, in Ihrer Sprache mit Ihnen zu kommunizieren.'
  },
  ru: {
    scanInstruction: 'Пожалуйста, отсканируйте этот QR-код камерой телефона',
    welcomeMessage: 'Добро пожаловать в {practice}. Этот сервис поможет нам общаться с вами на вашем языке.'
  },
  fa: {
    scanInstruction: 'لطفاً این کد QR را با دوربین گوشی خود اسکن کنید',
    welcomeMessage: 'به {practice} خوش آمدید. این سرویس به ما کمک می‌کند تا به زبان شما با شما ارتباط برقرار کنیم.'
  },
  ku: {
    scanInstruction: 'Ji kerema xwe vê koda QR-ê bi kameraya têlefona xwe bişopîne',
    welcomeMessage: 'Tu bi xêr hatî {practice}. Ev xizmet dê ji me re bibe alîkar ku em bi zimanê te bi te re têkiliyê daynin.'
  },
  vi: {
    scanInstruction: 'Vui lòng quét mã QR này bằng camera điện thoại của bạn',
    welcomeMessage: 'Chào mừng bạn đến {practice}. Dịch vụ này sẽ giúp chúng tôi giao tiếp với bạn bằng ngôn ngữ của bạn.'
  },
  th: {
    scanInstruction: 'กรุณาสแกน QR code นี้ด้วยกล้องโทรศัพท์ของคุณ',
    welcomeMessage: 'ยินดีต้อนรับสู่ {practice} บริการนี้จะช่วยให้เราสื่อสารกับคุณในภาษาของคุณ'
  },
  tl: {
    scanInstruction: 'Pakiscan ang QR code na ito gamit ang camera ng iyong telepono',
    welcomeMessage: 'Maligayang pagdating sa {practice}. Ang serbisyong ito ay makakatulong sa amin na makipag-usap sa iyo sa iyong wika.'
  },
  ne: {
    scanInstruction: 'कृपया तपाईंको फोनको क्यामेराले यो QR कोड स्क्यान गर्नुहोस्',
    welcomeMessage: '{practice}मा स्वागत छ। यो सेवाले हामीलाई तपाईंको भाषामा तपाईंसँग कुराकानी गर्न मद्दत गर्नेछ।'
  },
  sw: {
    scanInstruction: 'Tafadhali scan msimbo huu wa QR kwa kamera ya simu yako',
    welcomeMessage: 'Karibu {practice}. Huduma hii itatusaidia kuwasiliana nawe kwa lugha yako.'
  },
  am: {
    scanInstruction: 'እባክዎ ይህንን QR ኮድ በስልክዎ ካሜራ ይቃኙ',
    welcomeMessage: 'ወደ {practice} እንኳን በደህና መጡ። ይህ አገልግሎት በእርስዎ ቋንቋ ከእርስዎ ጋር ለመገናኘት ይረዳናል።'
  },
  // New languages added
  bg: {
    scanInstruction: 'Моля, сканирайте този QR код с камерата на телефона си',
    welcomeMessage: 'Добре дошли в {practice}. Тази услуга ще ни помогне да общуваме с вас на вашия език.'
  },
  hr: {
    scanInstruction: 'Molimo skenirajte ovaj QR kod kamerom svog telefona',
    welcomeMessage: 'Dobrodošli u {practice}. Ova usluga pomoći će nam da komuniciramo s vama na vašem jeziku.'
  },
  cs: {
    scanInstruction: 'Naskenujte prosím tento QR kód fotoaparátem telefonu',
    welcomeMessage: 'Vítejte v {practice}. Tato služba nám pomůže komunikovat s vámi ve vašem jazyce.'
  },
  da: {
    scanInstruction: 'Scan venligst denne QR-kode med din telefons kamera',
    welcomeMessage: 'Velkommen til {practice}. Denne tjeneste vil hjælpe os med at kommunikere med dig på dit sprog.'
  },
  nl: {
    scanInstruction: 'Scan deze QR-code met de camera van uw telefoon',
    welcomeMessage: 'Welkom bij {practice}. Deze dienst helpt ons om met u te communiceren in uw taal.'
  },
  el: {
    scanInstruction: 'Παρακαλώ σαρώστε αυτόν τον κωδικό QR με την κάμερα του τηλεφώνου σας',
    welcomeMessage: 'Καλώς ήρθατε στο {practice}. Αυτή η υπηρεσία θα μας βοηθήσει να επικοινωνήσουμε μαζί σας στη γλώσσα σας.'
  },
  hu: {
    scanInstruction: 'Kérjük, szkennelje be ezt a QR-kódot telefonja kamerájával',
    welcomeMessage: 'Üdvözöljük a {practice}-ben. Ez a szolgáltatás segít nekünk az Ön nyelvén kommunikálni Önnel.'
  },
  ps: {
    scanInstruction: 'مهرباني وکړئ دا QR کوډ د خپل تلیفون کیمرې سره سکین کړئ',
    welcomeMessage: 'د {practice} ته ښه راغلاست. دا خدمت به موږ سره ستاسو په ژبه کې ستاسو سره اړیکه ونیسي.'
  },
  ta: {
    scanInstruction: 'உங்கள் தொலைபேசி கேமராவால் இந்த QR குறியீட்டை ஸ்கேன் செய்யவும்',
    welcomeMessage: '{practice}க்கு வரவேற்கிறோம். இந்த சேவை உங்கள் மொழியில் உங்களுடன் தொடர்பு கொள்ள எங்களுக்கு உதவும்.'
  },
  te: {
    scanInstruction: 'దయచేసి మీ ఫోన్ కెమెరాతో ఈ QR కోడ్‌ను స్కాన్ చేయండి',
    welcomeMessage: '{practice}కు స్వాగతం. ఈ సేవ మీ భాషలో మీతో కమ్యూనికేట్ చేయడంలో మాకు సహాయపడుతుంది.'
  },
  kn: {
    scanInstruction: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾದಿಂದ ಈ QR ಕೋಡ್ ಅನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    welcomeMessage: '{practice}ಗೆ ಸುಸ್ವಾಗತ. ಈ ಸೇವೆಯು ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ನಿಮ್ಮೊಂದಿಗೆ ಸಂವಹನ ನಡೆಸಲು ನಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.'
  },
  ml: {
    scanInstruction: 'നിങ്ങളുടെ ഫോൺ ക്യാമറ ഉപയോഗിച്ച് ഈ QR കോഡ് സ്കാൻ ചെയ്യുക',
    welcomeMessage: '{practice}ലേക്ക് സ്വാഗതം. നിങ്ങളുടെ ഭാഷയിൽ നിങ്ങളുമായി ആശയവിനിമയം നടത്താൻ ഈ സേവനം ഞങ്ങളെ സഹായിക്കും.'
  },
  mr: {
    scanInstruction: 'कृपया तुमच्या फोनच्या कॅमेऱ्याने हा QR कोड स्कॅन करा',
    welcomeMessage: '{practice}मध्ये आपले स्वागत आहे. ही सेवा आम्हाला तुमच्या भाषेत तुमच्याशी संवाद साधण्यात मदत करेल.'
  },
  uk: {
    scanInstruction: 'Будь ласка, відскануйте цей QR-код камерою телефону',
    welcomeMessage: 'Ласкаво просимо до {practice}. Цей сервіс допоможе нам спілкуватися з вами вашою мовою.'
  },
  id: {
    scanInstruction: 'Silakan pindai kode QR ini dengan kamera ponsel Anda',
    welcomeMessage: 'Selamat datang di {practice}. Layanan ini akan membantu kami berkomunikasi dengan Anda dalam bahasa Anda.'
  },
  ms: {
    scanInstruction: 'Sila imbas kod QR ini dengan kamera telefon anda',
    welcomeMessage: 'Selamat datang ke {practice}. Perkhidmatan ini akan membantu kami berkomunikasi dengan anda dalam bahasa anda.'
  },
  yo: {
    scanInstruction: 'Jọwọ ṣe ayẹwo koodu QR yii pẹlu kamẹra foonu rẹ',
    welcomeMessage: 'Kaabo si {practice}. Iṣẹ yii yoo ṣe iranlọwọ fun wa lati ba ọ sọrọ ni ede rẹ.'
  },
  ig: {
    scanInstruction: 'Biko nyochaa koodu QR a site na igwefoto ekwentị gị',
    welcomeMessage: 'Nnọọ na {practice}. Ọrụ a ga-enyere anyị aka ịkparịta ụka na asụsụ gị.'
  },
  ha: {
    scanInstruction: 'Da fatan za a duba wannan lambar QR tare da kyamarar wayar ku',
    welcomeMessage: 'Barka da zuwa {practice}. Wannan sabis zai taimaka mana mu yi magana da ku cikin yarenku.'
  },
  om: {
    scanInstruction: 'Maaloo koodii QR kana kaameraa bilbila keessaniin iskeen godhaa',
    welcomeMessage: 'Baga gara {practice} nagaan dhuftan. Tajaajilli kun afaan keessaniin isin waliin haasawuuf nu gargaara.'
  }
};

// Localised sharing text for Print, Email, SMS
const SHARING_TRANSLATIONS: Record<string, {
  emailSubject: string;
  emailBody: string;
  smsText: string;
  printTitle: string;
  copySuccess: string;
  sendSuccess: string;
  accurxInstruction: string;
}> = {
  en: { emailSubject: 'Join Translation Session', emailBody: 'Please click the link below to join the translation session:', smsText: 'Join the translation, click the link:', printTitle: 'Translation Session', copySuccess: 'Copied to clipboard', sendSuccess: 'Email sent successfully', accurxInstruction: 'Copy and paste this into Accurx to send to the patient' },
  ar: { emailSubject: 'انضم إلى جلسة الترجمة', emailBody: 'يرجى النقر على الرابط أدناه للانضمام إلى جلسة الترجمة:', smsText: 'انضم إلى الترجمة، انقر على الرابط:', printTitle: 'جلسة الترجمة', copySuccess: 'تم النسخ', sendSuccess: 'تم إرسال البريد الإلكتروني', accurxInstruction: 'انسخ والصق هذا في Accurx للإرسال إلى المريض' },
  zh: { emailSubject: '加入翻译会话', emailBody: '请点击以下链接加入翻译会话：', smsText: '加入翻译，点击链接：', printTitle: '翻译会话', copySuccess: '已复制到剪贴板', sendSuccess: '邮件发送成功', accurxInstruction: '复制并粘贴到Accurx发送给患者' },
  fr: { emailSubject: 'Rejoindre la session de traduction', emailBody: 'Veuillez cliquer sur le lien ci-dessous pour rejoindre la session de traduction :', smsText: 'Rejoignez la traduction, cliquez sur le lien :', printTitle: 'Session de traduction', copySuccess: 'Copié dans le presse-papiers', sendSuccess: 'Email envoyé avec succès', accurxInstruction: 'Copiez et collez ceci dans Accurx pour envoyer au patient' },
  de: { emailSubject: 'An der Übersetzungssitzung teilnehmen', emailBody: 'Bitte klicken Sie auf den untenstehenden Link, um an der Übersetzungssitzung teilzunehmen:', smsText: 'Zur Übersetzung beitreten, Link klicken:', printTitle: 'Übersetzungssitzung', copySuccess: 'In die Zwischenablage kopiert', sendSuccess: 'E-Mail erfolgreich gesendet', accurxInstruction: 'Kopieren und in Accurx einfügen, um an den Patienten zu senden' },
  hi: { emailSubject: 'अनुवाद सत्र में शामिल हों', emailBody: 'कृपया अनुवाद सत्र में शामिल होने के लिए नीचे दिए गए लिंक पर क्लिक करें:', smsText: 'अनुवाद में शामिल हों, लिंक पर क्लिक करें:', printTitle: 'अनुवाद सत्र', copySuccess: 'क्लिपबोर्ड पर कॉपी किया गया', sendSuccess: 'ईमेल सफलतापूर्वक भेजा गया', accurxInstruction: 'इसे Accurx में कॉपी और पेस्ट करें और मरीज को भेजें' },
  it: { emailSubject: 'Unisciti alla sessione di traduzione', emailBody: 'Clicca sul link qui sotto per unirti alla sessione di traduzione:', smsText: 'Unisciti alla traduzione, clicca sul link:', printTitle: 'Sessione di traduzione', copySuccess: 'Copiato negli appunti', sendSuccess: 'Email inviata con successo', accurxInstruction: 'Copia e incolla in Accurx per inviare al paziente' },
  es: { emailSubject: 'Únase a la sesión de traducción', emailBody: 'Haga clic en el enlace a continuación para unirse a la sesión de traducción:', smsText: 'Únase a la traducción, haga clic en el enlace:', printTitle: 'Sesión de traducción', copySuccess: 'Copiado al portapapeles', sendSuccess: 'Correo enviado con éxito', accurxInstruction: 'Copie y pegue esto en Accurx para enviar al paciente' },
  bg: { emailSubject: 'Присъединете се към сесията за превод', emailBody: 'Моля, кликнете върху връзката по-долу, за да се присъедините към сесията за превод:', smsText: 'Присъединете се към превода, кликнете върху връзката:', printTitle: 'Сесия за превод', copySuccess: 'Копирано в клипборда', sendSuccess: 'Имейлът е изпратен успешно', accurxInstruction: 'Копирайте и поставете това в Accurx, за да изпратите на пациента' },
  hr: { emailSubject: 'Pridružite se sesiji prevođenja', emailBody: 'Kliknite na poveznicu u nastavku da biste se pridružili sesiji prevođenja:', smsText: 'Pridružite se prijevodu, kliknite na poveznicu:', printTitle: 'Sesija prevođenja', copySuccess: 'Kopirano u međuspremnik', sendSuccess: 'E-pošta uspješno poslana', accurxInstruction: 'Kopirajte i zalijepite ovo u Accurx za slanje pacijentu' },
  cs: { emailSubject: 'Připojte se k překladatelské relaci', emailBody: 'Kliknutím na odkaz níže se připojíte k překladatelské relaci:', smsText: 'Připojte se k překladu, klikněte na odkaz:', printTitle: 'Překladatelská relace', copySuccess: 'Zkopírováno do schránky', sendSuccess: 'E-mail úspěšně odeslán', accurxInstruction: 'Zkopírujte a vložte do Accurx k odeslání pacientovi' },
  da: { emailSubject: 'Deltag i oversættelsessessionen', emailBody: 'Klik på linket nedenfor for at deltage i oversættelsessessionen:', smsText: 'Deltag i oversættelsen, klik på linket:', printTitle: 'Oversættelsessession', copySuccess: 'Kopieret til udklipsholder', sendSuccess: 'E-mail sendt', accurxInstruction: 'Kopier og indsæt dette i Accurx for at sende til patienten' },
  nl: { emailSubject: 'Neem deel aan de vertaalsessie', emailBody: 'Klik op de onderstaande link om deel te nemen aan de vertaalsessie:', smsText: 'Neem deel aan de vertaling, klik op de link:', printTitle: 'Vertaalsessie', copySuccess: 'Gekopieerd naar klembord', sendSuccess: 'E-mail succesvol verzonden', accurxInstruction: 'Kopieer en plak dit in Accurx om naar de patiënt te sturen' },
  el: { emailSubject: 'Συμμετοχή στη συνεδρία μετάφρασης', emailBody: 'Κάντε κλικ στον παρακάτω σύνδεσμο για να συμμετάσχετε στη συνεδρία μετάφρασης:', smsText: 'Συμμετοχή στη μετάφραση, κάντε κλικ στον σύνδεσμο:', printTitle: 'Συνεδρία μετάφρασης', copySuccess: 'Αντιγράφηκε στο πρόχειρο', sendSuccess: 'Το email στάλθηκε επιτυχώς', accurxInstruction: 'Αντιγράψτε και επικολλήστε αυτό στο Accurx για αποστολή στον ασθενή' },
  hu: { emailSubject: 'Csatlakozzon a fordítási munkamenethez', emailBody: 'Kattintson az alábbi linkre a fordítási munkamenethez való csatlakozáshoz:', smsText: 'Csatlakozzon a fordításhoz, kattintson a linkre:', printTitle: 'Fordítási munkamenet', copySuccess: 'Vágólapra másolva', sendSuccess: 'E-mail sikeresen elküldve', accurxInstruction: 'Másolja és illessze be az Accurx-be a betegnek való küldéshez' },
  pl: { emailSubject: 'Dołącz do sesji tłumaczeniowej', emailBody: 'Kliknij poniższy link, aby dołączyć do sesji tłumaczeniowej:', smsText: 'Dołącz do tłumaczenia, kliknij link:', printTitle: 'Sesja tłumaczeniowa', copySuccess: 'Skopiowano do schowka', sendSuccess: 'E-mail wysłany pomyślnie', accurxInstruction: 'Skopiuj i wklej to do Accurx, aby wysłać do pacjenta' },
  pt: { emailSubject: 'Junte-se à sessão de tradução', emailBody: 'Clique no link abaixo para se juntar à sessão de tradução:', smsText: 'Junte-se à tradução, clique no link:', printTitle: 'Sessão de tradução', copySuccess: 'Copiado para a área de transferência', sendSuccess: 'Email enviado com sucesso', accurxInstruction: 'Copie e cole isto no Accurx para enviar ao paciente' },
  ro: { emailSubject: 'Alăturați-vă sesiunii de traducere', emailBody: 'Faceți clic pe linkul de mai jos pentru a vă alătura sesiunii de traducere:', smsText: 'Alăturați-vă traducerii, faceți clic pe link:', printTitle: 'Sesiune de traducere', copySuccess: 'Copiat în clipboard', sendSuccess: 'Email trimis cu succes', accurxInstruction: 'Copiați și lipiți acest lucru în Accurx pentru a trimite pacientului' },
  ru: { emailSubject: 'Присоединяйтесь к сеансу перевода', emailBody: 'Нажмите на ссылку ниже, чтобы присоединиться к сеансу перевода:', smsText: 'Присоединяйтесь к переводу, нажмите на ссылку:', printTitle: 'Сеанс перевода', copySuccess: 'Скопировано в буфер обмена', sendSuccess: 'Письмо успешно отправлено', accurxInstruction: 'Скопируйте и вставьте это в Accurx для отправки пациенту' },
  tr: { emailSubject: 'Çeviri oturumuna katılın', emailBody: 'Çeviri oturumuna katılmak için aşağıdaki bağlantıya tıklayın:', smsText: 'Çeviriye katılın, bağlantıya tıklayın:', printTitle: 'Çeviri oturumu', copySuccess: 'Panoya kopyalandı', sendSuccess: 'E-posta başarıyla gönderildi', accurxInstruction: 'Bunu Accurx\'e kopyalayıp yapıştırarak hastaya gönderin' },
  fa: { emailSubject: 'به جلسه ترجمه بپیوندید', emailBody: 'لطفاً برای پیوستن به جلسه ترجمه روی لینک زیر کلیک کنید:', smsText: 'به ترجمه بپیوندید، روی لینک کلیک کنید:', printTitle: 'جلسه ترجمه', copySuccess: 'در کلیپ‌بورد کپی شد', sendSuccess: 'ایمیل با موفقیت ارسال شد', accurxInstruction: 'این را در Accurx کپی و پیست کنید تا به بیمار ارسال شود' },
  ku: { emailSubject: 'Beşdarî danişîna wergerê bibe', emailBody: 'Ji kerema xwe li ser lînka jêrîn bikirtînin da ku beşdarî danişîna wergerê bibin:', smsText: 'Beşdarî wergerê bibe, li lînkê bikirtîne:', printTitle: 'Danişîna wergerê', copySuccess: 'Li clipboardê hat kopîkirin', sendSuccess: 'E-name bi serkeftî hat şandin', accurxInstruction: 'Vê kopî bike û di Accurx de bicîh bîne da ku ji nexweş re bişînî' },
  ps: { emailSubject: 'د ژباړې ناستې سره یوځای شئ', emailBody: 'مهرباني وکړئ د ژباړې ناستې سره د یوځای کیدو لپاره لاندې لینک کلیک کړئ:', smsText: 'ژباړې سره یوځای شئ، لینک کلیک کړئ:', printTitle: 'د ژباړې ناسته', copySuccess: 'کلیپبورډ ته کاپي شو', sendSuccess: 'بریښنالیک په بریالیتوب سره لیږل شو', accurxInstruction: 'دا په Accurx کې کاپي او پیسټ کړئ ترڅو ناروغ ته یې ولیږئ' },
  ti: { emailSubject: 'ናብ ጉባኤ ትርጉም ተጸምበሩ', emailBody: 'ናብ ጉባኤ ትርጉም ንምጽምባር ኣብ ታሕቲ ዘሎ ሊንክ ጠውቁ:', smsText: 'ናብ ትርጉም ተጸምበሩ፣ ሊንክ ጠውቁ:', printTitle: 'ጉባኤ ትርጉም', copySuccess: 'ናብ ክሊፕቦርድ ተቐዲሑ', sendSuccess: 'ኢመይል ብዓወት ተላኢኹ', accurxInstruction: 'ነዚ ኣብ Accurx ቅዳሕን ለጥፍን ናብ ሕሙም ክትልእኮ' },
  bn: { emailSubject: 'অনুবাদ সেশনে যোগ দিন', emailBody: 'অনুবাদ সেশনে যোগ দিতে নীচের লিঙ্কে ক্লিক করুন:', smsText: 'অনুবাদে যোগ দিন, লিঙ্কে ক্লিক করুন:', printTitle: 'অনুবাদ সেশন', copySuccess: 'ক্লিপবোর্ডে কপি করা হয়েছে', sendSuccess: 'ইমেইল সফলভাবে পাঠানো হয়েছে', accurxInstruction: 'রোগীকে পাঠাতে Accurx-এ এটি কপি এবং পেস্ট করুন' },
  ur: { emailSubject: 'ترجمے کے سیشن میں شامل ہوں', emailBody: 'ترجمے کے سیشن میں شامل ہونے کے لیے نیچے دیے گئے لنک پر کلک کریں:', smsText: 'ترجمے میں شامل ہوں، لنک پر کلک کریں:', printTitle: 'ترجمے کا سیشن', copySuccess: 'کلپ بورڈ پر کاپی ہو گیا', sendSuccess: 'ای میل کامیابی سے بھیجی گئی', accurxInstruction: 'مریض کو بھیجنے کے لیے اسے Accurx میں کاپی اور پیسٹ کریں' },
  pa: { emailSubject: 'ਅਨੁਵਾਦ ਸੈਸ਼ਨ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ', emailBody: 'ਅਨੁਵਾਦ ਸੈਸ਼ਨ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਲਿੰਕ \'ਤੇ ਕਲਿੱਕ ਕਰੋ:', smsText: 'ਅਨੁਵਾਦ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ, ਲਿੰਕ \'ਤੇ ਕਲਿੱਕ ਕਰੋ:', printTitle: 'ਅਨੁਵਾਦ ਸੈਸ਼ਨ', copySuccess: 'ਕਲਿੱਪਬੋਰਡ \'ਤੇ ਕਾਪੀ ਕੀਤਾ ਗਿਆ', sendSuccess: 'ਈਮੇਲ ਸਫਲਤਾਪੂਰਵਕ ਭੇਜੀ ਗਈ', accurxInstruction: 'ਮਰੀਜ਼ ਨੂੰ ਭੇਜਣ ਲਈ ਇਸਨੂੰ Accurx ਵਿੱਚ ਕਾਪੀ ਅਤੇ ਪੇਸਟ ਕਰੋ' },
  gu: { emailSubject: 'અનુવાદ સત્રમાં જોડાઓ', emailBody: 'અનુવાદ સત્રમાં જોડાવા માટે નીચેની લિંક પર ક્લિક કરો:', smsText: 'અનુવાદમાં જોડાઓ, લિંક પર ક્લિક કરો:', printTitle: 'અનુવાદ સત્ર', copySuccess: 'ક્લિપબોર્ડ પર કૉપિ થયું', sendSuccess: 'ઈમેલ સફળતાપૂર્વક મોકલાયો', accurxInstruction: 'દર્દીને મોકલવા માટે આને Accurx માં કૉપિ અને પેસ્ટ કરો' },
  ta: { emailSubject: 'மொழிபெயர்ப்பு அமர்வில் சேரவும்', emailBody: 'மொழிபெயர்ப்பு அமர்வில் சேர கீழே உள்ள இணைப்பைக் கிளிக் செய்யவும்:', smsText: 'மொழிபெயர்ப்பில் சேரவும், இணைப்பைக் கிளிக் செய்யவும்:', printTitle: 'மொழிபெயர்ப்பு அமர்வு', copySuccess: 'கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது', sendSuccess: 'மின்னஞ்சல் வெற்றிகரமாக அனுப்பப்பட்டது', accurxInstruction: 'நோயாளிக்கு அனுப்ப இதை Accurx இல் நகலெடுத்து ஒட்டவும்' },
  te: { emailSubject: 'అనువాద సెషన్‌లో చేరండి', emailBody: 'అనువాద సెషన్‌లో చేరడానికి క్రింది లింక్‌పై క్లిక్ చేయండి:', smsText: 'అనువాదంలో చేరండి, లింక్‌పై క్లిక్ చేయండి:', printTitle: 'అనువాద సెషన్', copySuccess: 'క్లిప్‌బోర్డ్‌కు కాపీ చేయబడింది', sendSuccess: 'ఇమెయిల్ విజయవంతంగా పంపబడింది', accurxInstruction: 'రోగికి పంపడానికి దీన్ని Accurxలో కాపీ చేసి పేస్ట్ చేయండి' },
  kn: { emailSubject: 'ಅನುವಾದ ಅಧಿವೇಶನಕ್ಕೆ ಸೇರಿ', emailBody: 'ಅನುವಾದ ಅಧಿವೇಶನಕ್ಕೆ ಸೇರಲು ಕೆಳಗಿನ ಲಿಂಕ್ ಅನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ:', smsText: 'ಅನುವಾದಕ್ಕೆ ಸೇರಿ, ಲಿಂಕ್ ಕ್ಲಿಕ್ ಮಾಡಿ:', printTitle: 'ಅನುವಾದ ಅಧಿವೇಶನ', copySuccess: 'ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ', sendSuccess: 'ಇಮೇಲ್ ಯಶಸ್ವಿಯಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ', accurxInstruction: 'ರೋಗಿಗೆ ಕಳುಹಿಸಲು Accurx ನಲ್ಲಿ ಇದನ್ನು ನಕಲಿಸಿ ಮತ್ತು ಅಂಟಿಸಿ' },
  ml: { emailSubject: 'വിവർത്തന സെഷനിൽ ചേരുക', emailBody: 'വിവർത്തന സെഷനിൽ ചേരാൻ താഴെയുള്ള ലിങ്കിൽ ക്ലിക്ക് ചെയ്യുക:', smsText: 'വിവർത്തനത്തിൽ ചേരുക, ലിങ്കിൽ ക്ലിക്ക് ചെയ്യുക:', printTitle: 'വിവർത്തന സെഷൻ', copySuccess: 'ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി', sendSuccess: 'ഇമെയിൽ വിജയകരമായി അയച്ചു', accurxInstruction: 'രോഗിക്ക് അയയ്ക്കാൻ ഇത് Accurx-ൽ കോപ്പി ചെയ്ത് പേസ്റ്റ് ചെയ്യുക' },
  mr: { emailSubject: 'भाषांतर सत्रात सामील व्हा', emailBody: 'भाषांतर सत्रात सामील होण्यासाठी खालील लिंकवर क्लिक करा:', smsText: 'भाषांतरात सामील व्हा, लिंकवर क्लिक करा:', printTitle: 'भाषांतर सत्र', copySuccess: 'क्लिपबोर्डवर कॉपी केले', sendSuccess: 'ईमेल यशस्वीरित्या पाठवला', accurxInstruction: 'रुग्णाला पाठवण्यासाठी हे Accurx मध्ये कॉपी आणि पेस्ट करा' },
  ne: { emailSubject: 'अनुवाद सत्रमा सामेल हुनुहोस्', emailBody: 'अनुवाद सत्रमा सामेल हुन तलको लिङ्कमा क्लिक गर्नुहोस्:', smsText: 'अनुवादमा सामेल हुनुहोस्, लिङ्कमा क्लिक गर्नुहोस्:', printTitle: 'अनुवाद सत्र', copySuccess: 'क्लिपबोर्डमा प्रतिलिपि गरियो', sendSuccess: 'इमेल सफलतापूर्वक पठाइयो', accurxInstruction: 'बिरामीलाई पठाउन यसलाई Accurx मा प्रतिलिपि र टाँस्नुहोस्' },
  uk: { emailSubject: 'Приєднайтесь до сеансу перекладу', emailBody: 'Натисніть на посилання нижче, щоб приєднатися до сеансу перекладу:', smsText: 'Приєднайтесь до перекладу, натисніть на посилання:', printTitle: 'Сеанс перекладу', copySuccess: 'Скопійовано в буфер обміну', sendSuccess: 'Електронний лист успішно надіслано', accurxInstruction: 'Скопіюйте та вставте це в Accurx для надсилання пацієнту' },
  vi: { emailSubject: 'Tham gia phiên dịch', emailBody: 'Vui lòng nhấp vào liên kết bên dưới để tham gia phiên dịch:', smsText: 'Tham gia dịch thuật, nhấp vào liên kết:', printTitle: 'Phiên dịch thuật', copySuccess: 'Đã sao chép vào clipboard', sendSuccess: 'Email đã gửi thành công', accurxInstruction: 'Sao chép và dán vào Accurx để gửi cho bệnh nhân' },
  th: { emailSubject: 'เข้าร่วมเซสชันการแปล', emailBody: 'กรุณาคลิกลิงก์ด้านล่างเพื่อเข้าร่วมเซสชันการแปล:', smsText: 'เข้าร่วมการแปล คลิกลิงก์:', printTitle: 'เซสชันการแปล', copySuccess: 'คัดลอกไปยังคลิปบอร์ดแล้ว', sendSuccess: 'ส่งอีเมลสำเร็จ', accurxInstruction: 'คัดลอกและวางสิ่งนี้ใน Accurx เพื่อส่งให้ผู้ป่วย' },
  id: { emailSubject: 'Bergabung dengan sesi penerjemahan', emailBody: 'Silakan klik tautan di bawah untuk bergabung dengan sesi penerjemahan:', smsText: 'Bergabung dengan terjemahan, klik tautan:', printTitle: 'Sesi penerjemahan', copySuccess: 'Disalin ke clipboard', sendSuccess: 'Email berhasil dikirim', accurxInstruction: 'Salin dan tempel ini di Accurx untuk dikirim ke pasien' },
  ms: { emailSubject: 'Sertai sesi terjemahan', emailBody: 'Sila klik pautan di bawah untuk menyertai sesi terjemahan:', smsText: 'Sertai terjemahan, klik pautan:', printTitle: 'Sesi terjemahan', copySuccess: 'Disalin ke papan keratan', sendSuccess: 'E-mel berjaya dihantar', accurxInstruction: 'Salin dan tampal ini dalam Accurx untuk menghantar kepada pesakit' },
  tl: { emailSubject: 'Sumali sa session ng pagsasalin', emailBody: 'Mangyaring i-click ang link sa ibaba upang sumali sa session ng pagsasalin:', smsText: 'Sumali sa pagsasalin, i-click ang link:', printTitle: 'Session ng pagsasalin', copySuccess: 'Nakopya sa clipboard', sendSuccess: 'Matagumpay na naipadala ang email', accurxInstruction: 'Kopyahin at i-paste ito sa Accurx upang ipadala sa pasyente' },
  sw: { emailSubject: 'Jiunge na kikao cha kutafsiri', emailBody: 'Tafadhali bofya kiungo hapa chini ili kujiunga na kikao cha kutafsiri:', smsText: 'Jiunge na tafsiri, bofya kiungo:', printTitle: 'Kikao cha kutafsiri', copySuccess: 'Imenakiliwa kwenye ubao wa kunakili', sendSuccess: 'Barua pepe imetumwa kwa mafanikio', accurxInstruction: 'Nakili na ubandike hii katika Accurx ili kutuma kwa mgonjwa' },
  am: { emailSubject: 'የትርጉም ክፍለ ጊዜ ይቀላቀሉ', emailBody: 'እባክዎ ከታች ያለውን አገናኝ ጠቅ ያድርጉ የትርጉም ክፍለ ጊዜ ለመቀላቀል:', smsText: 'ትርጉም ይቀላቀሉ፣ አገናኝ ላይ ጠቅ ያድርጉ:', printTitle: 'የትርጉም ክፍለ ጊዜ', copySuccess: 'ወደ ክሊፕቦርድ ተቀድቷል', sendSuccess: 'ኢሜይል በተሳካ ሁኔታ ተልኳል', accurxInstruction: 'ይህንን በ Accurx ውስጥ ቅዳ እና ለበሽተኛው ለመላክ ለጥፍ' },
  yo: { emailSubject: 'Darapọ mọ igba itumọ', emailBody: 'Jọwọ tẹ ọna asopọ ni isalẹ lati darapọ mọ igba itumọ:', smsText: 'Darapọ mọ itumọ, tẹ ọna asopọ:', printTitle: 'Igba itumọ', copySuccess: 'Ti da si clipboard', sendSuccess: 'Imeeli ti ranṣẹ ni aṣeyọri', accurxInstruction: 'Daakọ ati lẹ eyi sinu Accurx lati fi ranṣẹ si alaisan' },
  ig: { emailSubject: 'Sonye na nnọkọ nsụgharị', emailBody: 'Biko pịa njikọ dị n\'okpuru iji sonyere nnọkọ nsụgharị:', smsText: 'Sonye na nsụgharị, pịa njikọ:', printTitle: 'Nnọkọ nsụgharị', copySuccess: 'Edepụtara na clipboard', sendSuccess: 'E zigara email nke ọma', accurxInstruction: 'Depụta ma kpọnye nke a na Accurx iziga onye ọrịa' },
  ha: { emailSubject: 'Shiga zaman fassara', emailBody: 'Da fatan za a danna hanyar haɗi da ke ƙasa don shiga zaman fassara:', smsText: 'Shiga fassara, danna hanyar haɗi:', printTitle: 'Zaman fassara', copySuccess: 'An kwafa zuwa clipboard', sendSuccess: 'An aika email cikin nasara', accurxInstruction: 'Kwafa kuma manna wannan a cikin Accurx don aika wa majinyaci' },
  so: { emailSubject: 'Ku biir kulan turjumaadda', emailBody: 'Fadlan guji linkiga hoose si aad ugu biirto kulan turjumaadda:', smsText: 'Ku biir turjumaadda, guji linkiga:', printTitle: 'Kulan turjumaadda', copySuccess: 'Lagu koobiyeeyey clipboard', sendSuccess: 'Emailka waa la diray si guul leh', accurxInstruction: 'Koobiyee oo ku dhejiso tan Accurx si aad ugu dirto bukaanka' },
  om: { emailSubject: 'Walgahii hiikkaa irratti makamaa', emailBody: 'Walgahii hiikkaa irratti makamuu link armaan gadii tuqi:', smsText: 'Hiikkaa irratti makamaa, link tuqi:', printTitle: 'Walgahii hiikkaa', copySuccess: 'Gara clipboarditti waraabame', sendSuccess: 'Imeeliin milkaa\'inaan ergame', accurxInstruction: 'Kana Accurx keessatti waraabii fi maxxansii dhukkubsataaf erguuf' }
};

const getSharingText = (langCode: string) => {
  return SHARING_TRANSLATIONS[langCode] || SHARING_TRANSLATIONS['en'];
};

const getQRInstructions = (langCode: string, practiceName: string) => {
  const instructions = QR_INSTRUCTIONS[langCode] || QR_INSTRUCTIONS['en'];
  return {
    scanInstruction: instructions.scanInstruction,
    welcomeMessage: instructions.welcomeMessage.replace('{practice}', practiceName || 'our practice')
  };
};

interface ReceptionTranslationViewProps {
  sessionId: string;
  sessionToken: string;
  patientLanguage: string;
  onClose: () => void;
}

export const ReceptionTranslationView: React.FC<ReceptionTranslationViewProps> = ({
  sessionId,
  sessionToken,
  patientLanguage,
  onClose
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [largeQrCodeUrl, setLargeQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionStartTime] = useState<Date>(new Date());
  const [showExpandedQR, setShowExpandedQR] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [patientEmail, setPatientEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [smsCopied, setSmsCopied] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [loadingAudio, setLoadingAudio] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // New states for mute/pause and confirmation popup
  const [isMicPaused, setIsMicPaused] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [pendingSpeaker, setPendingSpeaker] = useState<'staff' | 'patient'>('staff'); // Track which speaker the pending message is from
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Inline editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Speaker mode toggle: 'staff' = listening for English, 'patient' = listening for patient's language
  const [speakerMode, setSpeakerMode] = useState<'staff' | 'patient'>('staff');
  
  // System audio capture state
  const [isSystemAudioMode, setIsSystemAudioMode] = useState(false);
  const [isCapturingSystemAudio, setIsCapturingSystemAudio] = useState(false);
  const [systemAudioTranscript, setSystemAudioTranscript] = useState('');
  const [systemAudioService, setSystemAudioService] = useState<'whisper' | 'assemblyai'>('whisper');
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const systemAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const systemAudioChunksRef = useRef<Blob[]>([]);
  const systemAudioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const assemblyClientRef = useRef<AssemblyRealtimeClient | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const stoppedByUserRef = useRef(false);
  const isMicPausedRef = useRef(false);
  const stoppingForModeChangeRef = useRef<'staff' | 'patient' | null>(null); // Track what mode we're stopping FROM
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakerModeRef = useRef<'staff' | 'patient'>('staff');
  const lastInterimRef = useRef<string>(''); // Track interim to preserve on restart
  const lastResultTimeRef = useRef<number>(0); // Track when last result was received
  const transcriptRef = useRef<string>(''); // Track transcript for onend handler
  
  const { practiceContext } = usePracticeContext();
  const practiceName = practiceContext?.practiceName || 'Our Practice';

  const {
    messages,
    isConnected,
    isTranslating,
    patientConnected,
    contentWarning,
    blockedContent,
    sendMessage,
    endSession,
    deleteMessage,
    updateMessage,
    clearContentWarning,
    clearBlockedContent
  } = useReceptionTranslation({
    sessionToken,
    sessionId,
    patientLanguage,
    isStaff: true
  });
  
  // State for content moderation dialogs
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingWarningTranscript, setPendingWarningTranscript] = useState<string | null>(null);
  
  // State for history panel
  const [showHistory, setShowHistory] = useState(false);

  // Track previous patient connection state for toast notification
  const prevPatientConnectedRef = useRef(false);

  useEffect(() => {
    if (patientConnected && !prevPatientConnectedRef.current) {
      showToast.success('Patient has connected');
    }
    prevPatientConnectedRef.current = patientConnected;
  }, [patientConnected]);

  // Show blocked dialog when content is blocked
  useEffect(() => {
    if (blockedContent) {
      setShowBlockedDialog(true);
    }
  }, [blockedContent]);

  const languageInfo = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);
  const patientUrl = `https://gpnotewell.co.uk/reception-translate?session=${sessionToken}`;

  // Generate QR codes (small and large versions)
  useEffect(() => {
    // Small QR for sidebar
    QRCode.toDataURL(patientUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
    
    // Large QR for expanded modal
    QRCode.toDataURL(patientUrl, {
      width: 400,
      margin: 3,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setLargeQrCodeUrl);
  }, [patientUrl]);
  
  // Get localized instructions
  const qrInstructions = getQRInstructions(patientLanguage, practiceName);

  // Auto-scroll to latest message with improved reliability
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          });
        }
      }
    };
    
    // Scroll immediately
    scrollToBottom();
    
    // Also scroll after a short delay to handle rendering delays
    const timeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeout);
  }, [messages, isTranslating, transcript]);

  // Auto-load audio for new staff messages (but don't auto-play)
  useEffect(() => {
    // Find staff messages that don't have audio loaded yet
    // Note: We no longer auto-load audio - user clicks to load and play
    // This is more reliable on iOS and saves bandwidth
  }, [messages, patientLanguage]);

  // Keep refs in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isMicPausedRef.current = isMicPaused;
  }, [isMicPaused]);

  useEffect(() => {
    speakerModeRef.current = speakerMode;
  }, [speakerMode]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Handle speaker mode change - update recognition language
  const handleSpeakerModeChange = useCallback((newMode: 'staff' | 'patient') => {
    const previousMode = speakerModeRef.current;
    
    // If switching FROM patient mode TO staff mode, finalize the patient's accumulated transcript
    if (previousMode === 'patient' && newMode === 'staff') {
      // Combine any pending transcript + current interim into final patient message
      const accumulatedText = (pendingTranscript || '').trim();
      const currentInterim = lastInterimRef.current.trim();
      const currentLiveTranscript = transcript.trim();
      
      // Combine all accumulated speech
      let finalPatientText = accumulatedText;
      if (currentInterim) {
        finalPatientText = finalPatientText ? `${finalPatientText} ${currentInterim}` : currentInterim;
      }
      if (currentLiveTranscript) {
        finalPatientText = finalPatientText ? `${finalPatientText} ${currentLiveTranscript}` : currentLiveTranscript;
      }
      
      if (finalPatientText) {
        console.log('📝 Finalizing patient speech:', finalPatientText);
        // IMPORTANT: Set pendingSpeaker BEFORE changing speakerMode so confirmation shows on patient side
        setPendingSpeaker('patient');
        setPendingTranscript(finalPatientText);
        setShowConfirmation(true);
      }
      
      // Clear interim and live transcript
      lastInterimRef.current = '';
      setTranscript('');
    }
    
    // Update recognition language if it exists
    if (recognitionRef.current) {
      // Mark that we're stopping for a mode change FROM previousMode
      stoppingForModeChangeRef.current = previousMode;
      
      const newLang = newMode === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);
      
      // Update mode BEFORE changing language so refs are correct for onend
      setSpeakerMode(newMode);
      
      recognitionRef.current.lang = newLang;
      console.log(`🌐 Speech recognition language changed to: ${newLang}`);
      
      // If currently listening, restart to apply new language
      if (isListeningRef.current && !stoppedByUserRef.current) {
        try {
          recognitionRef.current.stop();
          // Will auto-restart via onend handler
        } catch (e) {
          console.warn('Error stopping recognition for language change:', e);
        }
      }
    } else {
      // No recognition active, just update mode
      setSpeakerMode(newMode);
    }
  }, [patientLanguage, pendingTranscript, transcript]);

  // Speech recognition setup - create instance once
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    // Set initial language based on speaker mode
    recognitionRef.current.lang = speakerModeRef.current === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
      // If mic is paused, ignore all results
      if (isMicPausedRef.current) {
        return;
      }

      let finalTranscript = '';
      let interimTranscript = '';

      // Only process NEW results (starting from resultIndex) to avoid duplication
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      finalTranscript = finalTranscript.trim();

      // Track interim for potential preservation on restart
      lastInterimRef.current = interimTranscript;
      
      // Track last result time to detect gaps
      lastResultTimeRef.current = Date.now();

      if (finalTranscript) {
        // Clear interim ref since we got a final result
        lastInterimRef.current = '';
        
        // For patient mode, accumulate without showing confirmation until they toggle back
        const isPatientMode = speakerModeRef.current === 'patient';
        
        // Queue for confirmation (accumulate)
        setPendingTranscript(prev => {
          const newText = prev ? `${prev} ${finalTranscript}` : finalTranscript;
          console.log('📝 Accumulated transcript:', newText.substring(0, 50) + '...');
          return newText;
        });
        
        // Only show confirmation immediately for staff mode
        // Patient mode confirmation is shown when they toggle back to staff
        if (!isPatientMode) {
          // Set pendingSpeaker to 'staff' for staff messages
          setPendingSpeaker('staff');
          setShowConfirmation(true);
        }
        setTranscript('');
      } else if (interimTranscript) {
        setTranscript(interimTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      switch (event.error) {
        case 'no-speech':
          // Non-fatal - continue listening
          console.log('No speech detected, continuing...');
          break;
        case 'aborted':
          // Happens on restart, not a real error
          console.log('Recognition aborted (likely restart)');
          break;
        case 'not-allowed':
          showToast.error('Microphone permission denied');
          setIsListening(false);
          isListeningRef.current = false;
          break;
        case 'network':
          showToast.error('Network error during speech recognition');
          break;
        default:
          console.error('Unhandled speech error:', event.error);
      }
    };

    recognitionRef.current.onstart = () => {
      console.log('✅ Speech recognition started');
      isStartingRef.current = false;
    };

    recognitionRef.current.onend = () => {
      isStartingRef.current = false;
      
      // Only restart if still supposed to be listening and not stopped by user
      if (isListeningRef.current && !stoppedByUserRef.current) {
        // Check if we're stopping due to a mode change - if so, use the PREVIOUS mode for preservation
        const previousModeBeforeChange = stoppingForModeChangeRef.current;
        const isPatientMode = previousModeBeforeChange === 'patient' || speakerModeRef.current === 'patient';
        
        // Clear the mode change flag after reading it
        stoppingForModeChangeRef.current = null;
        
        const timeSinceLastResult = Date.now() - lastResultTimeRef.current;
        
        console.log(`Speech recognition ended (${isPatientMode ? 'patient' : 'staff'} mode, ${timeSinceLastResult}ms since last result), restarting...`);
        
        // For patient mode, ALWAYS preserve any interim OR current transcript before restart
        // This is critical - speech can be lost during the restart gap
        if (isPatientMode) {
          const currentTranscript = transcriptRef.current.trim();
          const interimText = lastInterimRef.current.trim();
          
          // Combine any interim and current transcript before restart
          if (interimText || currentTranscript) {
            const textToPreserve = [interimText, currentTranscript].filter(Boolean).join(' ').trim();
            if (textToPreserve) {
              console.log('📝 Preserving speech before restart:', textToPreserve.substring(0, 50) + (textToPreserve.length > 50 ? '...' : ''));
              lastInterimRef.current = '';
              // Queue the text as pending transcript fragment (accumulate)
              setPendingTranscript(prev => {
                const newText = prev ? `${prev} ${textToPreserve}` : textToPreserve;
                return newText;
              });
              setTranscript('');
            }
          }
        }
        
        // Use MINIMAL delay for patient mode to avoid losing speech during gaps
        // The Web Speech API often pauses between words/phrases in non-English languages
        const restartDelay = isPatientMode ? 10 : 150;
        
        setTimeout(() => {
          if (isListeningRef.current && !isStartingRef.current && recognitionRef.current) {
            try {
              isStartingRef.current = true;
              // Ensure language is still correctly set before restart
              const expectedLang = speakerModeRef.current === 'staff' ? 'en-GB' : getWebSpeechLanguageCode(patientLanguage);
              if (recognitionRef.current.lang !== expectedLang) {
                recognitionRef.current.lang = expectedLang;
                console.log(`🌐 Corrected recognition language to: ${expectedLang}`);
              }
              recognitionRef.current.start();
            } catch (e: any) {
              isStartingRef.current = false;
              if (e?.name !== 'InvalidStateError' && !`${e}`.includes('already started')) {
                console.warn('Restart failed:', e);
              }
            }
          }
        }, restartDelay);
      } else {
        console.log('Speech recognition ended');
      }
    };

    return () => {
      stoppedByUserRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop listening
      stoppedByUserRef.current = true;
      isStartingRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Prevent double-starts
    if (isStartingRef.current || isConnecting) {
      console.log('Already starting, ignoring');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Pre-flight: ensure microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone permission granted');
      } catch (permErr) {
        console.error('❌ Microphone permission error:', permErr);
        showToast.error('Microphone permission denied or unavailable');
        setIsConnecting(false);
        return;
      }

      // Check if recognition is supported
      if (!recognitionRef.current) {
        showToast.error('Speech recognition not supported in this browser');
        setIsConnecting(false);
        return;
      }

      // Start recognition
      stoppedByUserRef.current = false;
      isStartingRef.current = true;
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        isStartingRef.current = false;
        if (e?.name === 'InvalidStateError' || `${e}`.includes('already started')) {
          console.warn('Recognition already started, setting state');
          setIsListening(true);
        } else {
          throw e;
        }
      }
    } catch (error: any) {
      console.error('Failed to start speech recognition:', error);
      showToast.error('Failed to start microphone');
      setIsListening(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isListening, isConnecting]);

  // Mic pause/unpause toggle
  const toggleMicPause = useCallback(() => {
    setIsMicPaused(prev => !prev);
    if (!isMicPaused) {
      // When pausing, clear any current partial transcript
      setTranscript('');
    }
  }, [isMicPaused]);

  // System audio capture for testing with videos (supports Whisper batch and AssemblyAI real-time)
  const startSystemAudioCaptureWhisper = useCallback(async (audioStream: MediaStream) => {
    // Set up MediaRecorder for Whisper batch transcription
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    const recorder = new MediaRecorder(audioStream, { mimeType });
    systemAudioRecorderRef.current = recorder;
    systemAudioChunksRef.current = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        systemAudioChunksRef.current.push(e.data);
      }
    };
    
    recorder.start(5000); // Collect data every 5 seconds
    
    // Set up periodic transcription (every 10 seconds)
    systemAudioIntervalRef.current = setInterval(async () => {
      if (systemAudioChunksRef.current.length > 0) {
        const chunks = [...systemAudioChunksRef.current];
        systemAudioChunksRef.current = [];
        
        const audioBlob = new Blob(chunks, { type: mimeType });
        
        // Transcribe using Whisper via speech-to-text edge function
        try {
          // Convert blob to base64 (required by the edge function)
          const arrayBuffer = await audioBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binaryString = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            for (let j = 0; j < chunk.length; j++) {
              binaryString += String.fromCharCode(chunk[j]);
            }
          }
          const base64Audio = btoa(binaryString);
          
          // Determine language - use patient language for French videos etc.
          // Extract just the language code (e.g., 'fr' from 'fr-FR')
          const langCode = patientLanguage.split('-')[0] || 'en';
          console.log('🎬 System audio transcription language:', langCode, '(from:', patientLanguage, ')');
          
          const { data, error } = await supabase.functions.invoke('speech-to-text', {
            body: {
              audio: base64Audio,
              mimeType: mimeType,
              fileName: 'system-audio.webm',
              language: langCode // Use the patient language for system audio (e.g., 'fr' for French videos)
            }
          });
          
          if (error) {
            console.error('Whisper transcription error:', error);
            return;
          }
          
          const text = data?.text?.trim();
          if (text && text.length > 3) {
            console.log('🎬 Whisper system audio transcription:', text);
            setSystemAudioTranscript(prev => prev ? `${prev} ${text}` : text);
            
            // Queue for confirmation
            const isPatientMode = speakerModeRef.current === 'patient';
            setPendingSpeaker(isPatientMode ? 'patient' : 'staff');
            setPendingTranscript(prev => prev ? `${prev} ${text}` : text);
            
            if (!isPatientMode) {
              setShowConfirmation(true);
            }
          }
        } catch (err) {
          console.error('System audio transcription failed:', err);
        }
      }
    }, 10000);
  }, [patientLanguage]);

  const startSystemAudioCaptureAssemblyAI = useCallback(async (audioStream: MediaStream) => {
    console.log('🎧 Starting AssemblyAI for system audio...');
    
    const client = new AssemblyRealtimeClient({
      onOpen: () => {
        console.log('✅ AssemblyAI system audio connected');
        showToast.success('AssemblyAI connected - real-time transcription active');
      },
      onPartial: (text) => {
        console.log('📝 AssemblyAI partial:', text);
        setSystemAudioTranscript(text);
      },
      onFinal: (text) => {
        console.log('✅ AssemblyAI final:', text);
        if (text && text.trim().length > 3) {
          setSystemAudioTranscript(prev => prev ? `${prev} ${text}` : text);
          
          // Queue for confirmation
          const isPatientMode = speakerModeRef.current === 'patient';
          setPendingSpeaker(isPatientMode ? 'patient' : 'staff');
          setPendingTranscript(prev => prev ? `${prev} ${text}` : text);
          
          if (!isPatientMode) {
            setShowConfirmation(true);
          }
        }
      },
      onError: (err) => {
        console.error('❌ AssemblyAI error:', err);
        showToast.error('AssemblyAI transcription error');
      },
      onClose: (code, reason) => {
        console.log('🔌 AssemblyAI closed:', code, reason);
      },
      onReconnecting: () => {
        console.log('🔄 AssemblyAI reconnecting...');
      },
      onReconnected: () => {
        console.log('✅ AssemblyAI reconnected');
        showToast.success('AssemblyAI reconnected');
      }
    });
    
    assemblyClientRef.current = client;
    
    try {
      await client.start(audioStream);
    } catch (err) {
      console.error('Failed to start AssemblyAI:', err);
      showToast.error('Failed to start AssemblyAI transcription');
      assemblyClientRef.current = null;
    }
  }, []);

  const startSystemAudioCapture = useCallback(async () => {
    try {
      // Request display media with audio only
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for getDisplayMedia
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Check if we got audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        showToast.error('No audio track available. Make sure to share a tab with audio.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      // Stop video tracks - we only need audio
      stream.getVideoTracks().forEach(t => t.stop());
      
      // Create audio-only stream
      const audioStream = new MediaStream(audioTracks);
      systemAudioStreamRef.current = audioStream;
      
      setIsCapturingSystemAudio(true);
      showToast.success(`System audio capture started (${systemAudioService === 'assemblyai' ? 'AssemblyAI' : 'Whisper'})`);
      
      // Start the appropriate transcription service
      if (systemAudioService === 'assemblyai') {
        await startSystemAudioCaptureAssemblyAI(audioStream);
      } else {
        await startSystemAudioCaptureWhisper(audioStream);
      }
      
      // Handle track ended (user stops sharing)
      audioTracks[0].onended = () => {
        stopSystemAudioCapture();
        showToast.info('System audio capture ended');
      };
      
    } catch (err: any) {
      console.error('Failed to capture system audio:', err);
      if (err.name === 'NotAllowedError') {
        showToast.error('Screen sharing permission denied');
      } else {
        showToast.error('Failed to capture system audio');
      }
    }
  }, [patientLanguage, systemAudioService, startSystemAudioCaptureWhisper, startSystemAudioCaptureAssemblyAI]);
  
  const stopSystemAudioCapture = useCallback(() => {
    // Stop AssemblyAI client if active
    if (assemblyClientRef.current) {
      assemblyClientRef.current.stop();
      assemblyClientRef.current = null;
    }
    
    if (systemAudioIntervalRef.current) {
      clearInterval(systemAudioIntervalRef.current);
      systemAudioIntervalRef.current = null;
    }
    
    if (systemAudioRecorderRef.current && systemAudioRecorderRef.current.state !== 'inactive') {
      systemAudioRecorderRef.current.stop();
    }
    systemAudioRecorderRef.current = null;
    
    if (systemAudioStreamRef.current) {
      systemAudioStreamRef.current.getTracks().forEach(t => t.stop());
      systemAudioStreamRef.current = null;
    }
    
    systemAudioChunksRef.current = [];
    setIsCapturingSystemAudio(false);
    setSystemAudioTranscript('');
  }, []);
  
  const toggleSystemAudio = useCallback(async () => {
    if (isCapturingSystemAudio) {
      stopSystemAudioCapture();
    } else {
      await startSystemAudioCapture();
    }
  }, [isCapturingSystemAudio, startSystemAudioCapture, stopSystemAudioCapture]);
  
  // Cleanup system audio on unmount
  useEffect(() => {
    return () => {
      stopSystemAudioCapture();
    };
  }, [stopSystemAudioCapture]);

  // Confirmation handlers
  const handleConfirmSend = useCallback(async () => {
    if (pendingTranscript) {
      // Use the tracked pendingSpeaker, not the current speakerMode
      // This ensures patient messages are translated correctly even after mode toggle
      const result = await sendMessage(pendingTranscript, pendingSpeaker);
      
      // Handle blocked content
      if (result.blocked) {
        // Close confirmation dialog so blocked dialog can show
        setShowConfirmation(false);
        return;
      }
      
      // Handle warning - show warning dialog but message was sent
      if (result.warning) {
        showToast.warning('Message sent with warning - content may be inappropriate');
      }
      
      setPendingTranscript(null);
      setShowConfirmation(false);
    }
  }, [pendingTranscript, pendingSpeaker, sendMessage]);

  const handleCancelSend = useCallback(() => {
    setPendingTranscript(null);
    setShowConfirmation(false);
  }, []);

  // Add more text to pending (keep listening while confirmation is showing)
  const handleAddMore = useCallback(() => {
    // Keep the pending text but hide confirmation to continue listening
    setShowConfirmation(false);
  }, []);

  // Start editing a message
  const handleStartEdit = useCallback((messageId: string, originalText: string) => {
    setEditingMessageId(messageId);
    setEditingText(originalText);
  }, []);

  // Save the edited message
  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !editingText.trim()) {
      setEditingMessageId(null);
      setEditingText('');
      return;
    }

    setIsSavingEdit(true);
    try {
      const success = await updateMessage(editingMessageId, editingText.trim());
      if (success) {
        showToast.success('Message updated');
      } else {
        showToast.error('Failed to update message');
      }
    } catch (err) {
      console.error('Error saving edit:', err);
      showToast.error('Failed to save edit');
    } finally {
      setIsSavingEdit(false);
      setEditingMessageId(null);
      setEditingText('');
    }
  }, [editingMessageId, editingText, updateMessage]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(patientUrl);
    setCopied(true);
    showToast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEndSession = async () => {
    await endSession(sessionId);
    onClose();
  };

  // ElevenLabs supported languages (32 languages with natural voices)
  const ELEVENLABS_SUPPORTED = [
    'en', 'ar', 'zh', 'fr', 'de', 'hi', 'it', 'es', 'pl', 'pt', 'ro', 'ru', 
    'tr', 'uk', 'vi', 'ja', 'ko', 'bg', 'cs', 'da', 'nl', 'el', 'hu', 'id',
    'sv', 'no', 'fi', 'he', 'th', 'tl', 'ms', 'sk', 'hr'
  ];

  // Ref to track currently playing audio element
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const base64ToBlobUrl = useCallback((base64: string, mimeType = 'audio/mpeg') => {
    // Convert base64 -> Blob URL (more reliable than huge data: URIs on iOS/desktop)
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  }, []);

  // Unlock audio for mobile browsers (iOS Safari requirement)
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return true;
    
    try {
      // Create/resume AudioContext (required on iOS/Safari)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Unlock via Web Audio silent buffer (avoids NotSupportedError from silent MP3 data URIs)
      const ctx = audioContextRef.current;
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(ctx.currentTime + 0.01);
      
      setAudioUnlocked(true);
      console.log('🔊 Audio unlocked for reception view');
      return true;
    } catch (err) {
      console.warn('Failed to unlock audio:', err);
      return false;
    }
  }, [audioUnlocked]);

  // Stop any currently playing audio
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setPlayingAudioId(null);
    }
  }, []);

  // Load and play audio for a specific message
  const playAudioForMessage = async (messageId: string, text: string, languageCode: string) => {
    // Unlock audio on first interaction (iOS requirement)
    await unlockAudio();
    
    // Stop any currently playing audio
    stopCurrentAudio();
    
    // If already loaded, play it directly
    if (audioUrls[messageId]) {
      try {
        const audio = new Audio(audioUrls[messageId]);
        currentAudioRef.current = audio;

        // Some browsers won't fire canplaythrough for blob/data URIs reliably unless load() is called
        audio.preload = 'auto';
        audio.load();
        
        audio.onended = () => {
          setPlayingAudioId(null);
          currentAudioRef.current = null;
        };
        
        audio.onerror = () => {
          console.error('Audio playback error');
          setPlayingAudioId(null);
          currentAudioRef.current = null;
          showToast.error('Failed to play audio');
        };
        
        setPlayingAudioId(messageId);
        await audio.play();
      } catch (err) {
        console.error('Playback error:', err);
        setPlayingAudioId(null);
        showToast.error('Failed to play audio');
      }
      return;
    }
    
    // If already loading, don't start again
    if (loadingAudio[messageId]) return;
    
    setLoadingAudio(prev => ({ ...prev, [messageId]: true }));
    
    try {
      // Use ElevenLabs for supported languages (more realistic), fallback to Google TTS
      const endpoint = ELEVENLABS_SUPPORTED.includes(languageCode) 
        ? 'gp-translation-tts' 
        : 'text-to-speech';
      
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { text, languageCode }
      });
      
      if (error) throw error;
      
      if (data?.audioContent) {
        // Blob URL is more reliable than huge data: URIs across iOS + desktop
        const audioUrl = base64ToBlobUrl(data.audioContent, 'audio/mpeg');
        setAudioUrls(prev => {
          const existing = prev[messageId];
          if (existing?.startsWith('blob:')) {
            try { URL.revokeObjectURL(existing); } catch { /* ignore */ }
          }
          return { ...prev, [messageId]: audioUrl };
        });
        
        // Create audio and play it
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.preload = 'auto';
        audio.load();
        
        // Ensure AudioContext is active (helps with iOS)
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        audio.onended = () => {
          setPlayingAudioId(null);
          currentAudioRef.current = null;
        };
        
        audio.onerror = (e) => {
          console.error('Audio error event:', e);
          setPlayingAudioId(null);
          setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
          currentAudioRef.current = null;
          showToast.error('Failed to play audio');
        };
        
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
        };

        // Failsafe: avoid a permanently greyed-out button if canplay/error never fires
        const failsafe = window.setTimeout(() => {
          if (!settled) {
            console.warn('Audio load timed out');
            settle();
            setPlayingAudioId(null);
            currentAudioRef.current = null;
            showToast.error('Failed to play audio');
          }
        }, 8000);

        audio.oncanplaythrough = async () => {
          try {
            settle();
            setPlayingAudioId(messageId);
            await audio.play();
          } catch (playErr) {
            console.error('Play error:', playErr);
            setPlayingAudioId(null);
            showToast.error('Tap the screen first, then try playing audio');
          }
        };
        
        audio.onerror = (e) => {
          console.error('Audio error event:', e);
          window.clearTimeout(failsafe);
          settle();
          setPlayingAudioId(null);
          currentAudioRef.current = null;
          showToast.error('Failed to play audio');
        };

        audio.onended = () => {
          window.clearTimeout(failsafe);
          settle();
          setPlayingAudioId(null);
          currentAudioRef.current = null;
        };

        // Fallback: if canplaythrough doesn't fire quickly, try once audio has enough data
        window.setTimeout(async () => {
          if (settled) return;
          if (audio.readyState >= 2) {
            try {
              settle();
              setPlayingAudioId(messageId);
              await audio.play();
            } catch (e) {
              console.warn('Fallback play failed:', e);
            }
          }
        }, 500);
      } else {
        showToast.error('No audio content received');
        setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
      }
    } catch (err) {
      console.error('Audio loading error:', err);
      showToast.error('Failed to load audio');
      setLoadingAudio(prev => ({ ...prev, [messageId]: false }));
    }
  };


  const handleDownloadReport = async () => {
    if (messages.length === 0) {
      showToast.error('No messages to include in report');
      return;
    }

    setIsGeneratingReport(true);
    try {
      await generateTranslationReportDocx({
        messages,
        patientLanguage,
        patientLanguageName: languageInfo?.name || patientLanguage,
        sessionStart: sessionStartTime,
        sessionEnd: new Date(),
        practiceInfo: {
          name: practiceContext?.practiceName,
          address: practiceContext?.practiceAddress,
          logoUrl: practiceContext?.logoUrl,
        },
      });
      showToast.success('Translation report downloaded successfully');
    } catch (error) {
      console.error('Report generation error:', error);
      showToast.error('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Get sharing text for the current language
  const sharingText = getSharingText(patientLanguage);

  // Handle print QR code
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast.error('Unable to open print window');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${sharingText.printTitle} - ${practiceName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 40px;
              margin: 0;
            }
            .practice-name { 
              font-size: 28px; 
              font-weight: bold; 
              color: #7c3aed; 
              margin-bottom: 20px;
            }
            .qr-container {
              display: inline-block;
              padding: 20px;
              background: white;
              border-radius: 16px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              margin: 20px 0;
            }
            .qr-code { 
              width: 300px; 
              height: 300px; 
            }
            .language-badge {
              font-size: 24px;
              margin: 20px 0 10px;
            }
            .instruction { 
              font-size: 20px; 
              margin: 15px 0;
              color: #5b21b6;
              font-weight: 500;
            }
            .welcome {
              font-size: 16px;
              color: #6b7280;
              max-width: 400px;
              margin: 0 auto;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="practice-name">${practiceName}</div>
          <div class="qr-container">
            <img src="${largeQrCodeUrl}" alt="QR Code" class="qr-code" />
          </div>
          <div class="language-badge">${languageInfo?.flag} ${languageInfo?.name}</div>
          <div class="instruction">${qrInstructions.scanInstruction}</div>
          <div class="welcome">${qrInstructions.welcomeMessage}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Handle send email to patient
  const handleSendEmail = async () => {
    if (!patientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      showToast.error('Please enter a valid email address');
      return;
    }

    setIsSendingEmail(true);
    try {
      const emailContent = `${qrInstructions.welcomeMessage}\n\n${sharingText.emailBody}\n\n${patientUrl}`;
      
      const { error } = await supabase.functions.invoke('send-chat-email', {
        body: {
          recipientEmails: [patientEmail],
          subject: sharingText.emailSubject,
          chatContent: emailContent,
          senderName: practiceName,
        },
      });

      if (error) throw error;

      showToast.success(sharingText.sendSuccess);
      setShowEmailModal(false);
      setPatientEmail('');
    } catch (error) {
      console.error('Error sending email:', error);
      showToast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handle copy SMS text
  const handleCopySMS = async () => {
    const smsText = `${sharingText.smsText} ${patientUrl}`;
    try {
      await navigator.clipboard.writeText(smsText);
      setSmsCopied(true);
      showToast.success(sharingText.copySuccess);
      setTimeout(() => setSmsCopied(false), 2000);
    } catch (err) {
      showToast.error('Failed to copy');
    }
  };

  const renderMessage = (msg: TranslationMessage, index: number) => {
    const isStaffMessage = msg.speaker === 'staff';
    const messageId = msg.id || `msg-${index}`;
    // For patient language column: staff message shows translation, patient message shows original
    const patientLanguageText = isStaffMessage ? msg.translatedText : msg.originalText;
    // For English column: staff message shows original, patient message shows translation
    const englishText = isStaffMessage ? msg.originalText : msg.translatedText;
    const isLoadingAudio = loadingAudio[messageId];
    const isEditing = editingMessageId === msg.id;

    // Calculate if this is the most recent staff message for highlight
    const lastStaffIndex = messages.map((m, i) => m.speaker === 'staff' ? i : -1)
                                   .filter(i => i >= 0).pop();
    const isLatestStaffMessage = isStaffMessage && index === lastStaffIndex;

    return (
      <div
        key={msg.id || index}
        className={`flex gap-4 ${
          isLatestStaffMessage 
            ? 'ring-2 ring-blue-500 ring-offset-2 rounded-xl p-2 bg-blue-50/50 dark:bg-blue-950/20' 
            : ''
        }`}
      >
        {/* English column - ALWAYS LEFT */}
        <div className="flex-1">
          <div className={`inline-block max-w-full rounded-lg p-3 ${
            isStaffMessage 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-emerald-500 text-white dark:bg-emerald-600 border-l-4 border-emerald-700'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">
                🇬🇧 {isStaffMessage ? 'You said:' : 'Patient said:'}
              </p>
              {isStaffMessage && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => deleteMessage(msg.id)}
                  title="Delete message"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {isEditing && isSavingEdit && (
                <span className="text-xs opacity-70 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                autoFocus
                disabled={isSavingEdit}
                className="w-full text-lg bg-transparent border border-primary-foreground/30 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary-foreground/50"
                rows={Math.max(1, Math.ceil(editingText.length / 40))}
                style={{ minHeight: '2rem' }}
              />
            ) : (
              <p 
                className={`text-lg ${isStaffMessage ? 'cursor-pointer hover:underline hover:decoration-dotted' : ''}`}
                onClick={() => isStaffMessage && handleStartEdit(msg.id, msg.originalText)}
                title={isStaffMessage ? 'Click to edit' : undefined}
              >
                {englishText}
              </p>
            )}
          </div>
        </div>

        {/* Patient language column - ALWAYS RIGHT */}
        <div className="flex-1 text-right">
          <div className={`inline-block max-w-full rounded-lg p-3 text-left ${
            isStaffMessage 
              ? 'bg-secondary' 
              : 'bg-emerald-600 text-white dark:bg-emerald-700 border-l-4 border-emerald-800'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">
                {languageInfo?.flag} {isStaffMessage 
                  ? (GP_PRACTICE_SAID[patientLanguage] || GP_PRACTICE_SAID['en']) 
                  : (PATIENT_SAID[patientLanguage] || PATIENT_SAID['en'])}
              </p>
            </div>
            <p className="text-lg mb-2">
              {patientLanguageText}
            </p>
            {/* Audio player button - only show for staff messages (patient messages don't need TTS) */}
            {isStaffMessage && (
              <div className="mt-2">
                <Button
                  variant={playingAudioId === messageId ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (playingAudioId === messageId) {
                      stopCurrentAudio();
                    } else {
                      playAudioForMessage(messageId, patientLanguageText, patientLanguage);
                    }
                  }}
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {LOADING_AUDIO[patientLanguage] || LOADING_AUDIO['en']}
                    </>
                  ) : playingAudioId === messageId ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      {STOP_AUDIO[patientLanguage] || STOP_AUDIO['en']}
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 mr-2" />
                      {PLAY_AUDIO[patientLanguage] || PLAY_AUDIO['en']}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Live Translation</h1>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Connecting...</>
            )}
          </Badge>
          {/* Patient Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            patientConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            <Smartphone className="h-4 w-4" />
            {patientConnected ? (
              <>
                <span>Patient Connected</span>
                <Check className="h-4 w-4" />
              </>
            ) : (
              <span>Waiting for patient...</span>
            )}
          </div>
          {languageInfo && (
            <Badge variant="outline">
              {languageInfo.flag} {languageInfo.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* System Audio Toggle - simplified button */}
          <Button
            variant={isCapturingSystemAudio ? 'default' : 'outline'}
            size="sm"
            onClick={toggleSystemAudio}
            className={isCapturingSystemAudio ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            {isCapturingSystemAudio ? (
              <>
                <MonitorOff className="h-4 w-4 mr-2" />
                Stop System Audio
              </>
            ) : (
              <>
                <Monitor className="h-4 w-4 mr-2" />
                System Audio
              </>
            )}
          </Button>
          {/* History Button */}
          <Button
            variant={showHistory ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            variant="outline" 
            size="sm" 
            onClick={handleDownloadReport}
            disabled={isGeneratingReport || messages.length === 0}
          >
            {isGeneratingReport ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Download Report
              </>
            )}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleEndSession}>
            <X className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* History Panel - shown when history is toggled */}
        {showHistory ? (
          <div className="flex-1 p-4">
            <TranslationHistoryInline onClose={() => setShowHistory(false)} />
          </div>
        ) : (
          /* Conversation panel */
          <div className="flex-1 flex flex-col p-4">
          {/* System Audio Indicator - shown when capturing system audio */}
          {isCapturingSystemAudio && (
            <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  Capturing System Audio
                </span>
                <Badge variant="outline" className="text-xs">
                  {systemAudioService === 'assemblyai' ? 'AssemblyAI Real-time' : 'Whisper Batch'}
                </Badge>
              </div>
              {systemAudioTranscript && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400 italic">
                  Latest: {systemAudioTranscript.slice(-100)}...
                </p>
              )}
            </div>
          )}
          
          {/* Patient Speaking Prompt - shown when in patient mode and listening */}
          {speakerMode === 'patient' && isListening && !isMicPaused && (
            <div className="mb-4">
              <PatientSpeakingPrompt
                languageCode={patientLanguage}
                languageName={languageInfo?.name || patientLanguage}
                languageFlag={languageInfo?.flag}
                isListening={true}
                liveTranscript={transcript}
              />
            </div>
          )}

          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4 pb-8">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-lg">Waiting for conversation to start...</p>
                  <p className="text-sm mt-2">Click the microphone button to speak</p>
                </div>
              ) : (
                messages.map(renderMessage)
              )}

              {/* Live transcript (partial - still speaking) - only show for staff mode */}
              {transcript && !isMicPaused && (
                <div className="flex gap-4">
                  {speakerMode === 'patient' && <div className="flex-1" />}
                  <div className="flex-1">
                    <div className={`inline-block max-w-full rounded-lg p-3 animate-pulse ${
                      speakerMode === 'patient' 
                        ? 'bg-emerald-500 text-white dark:bg-emerald-600' 
                        : 'bg-primary/50 text-primary-foreground'
                    }`}>
                      <p className="text-sm font-medium mb-1">🎤 Listening...</p>
                      <p className="text-lg">{transcript}</p>
                    </div>
                  </div>
                  {speakerMode === 'staff' && <div className="flex-1" />}
                </div>
              )}

              {/* Confirmation UI when paused - use pendingSpeaker for positioning */}
              {showConfirmation && pendingTranscript && (
                <div className="flex gap-4">
                  {pendingSpeaker === 'patient' && <div className="flex-1" />}
                  <div className="flex-1">
                    <div className={`inline-block max-w-full rounded-lg p-3 border-2 ${
                      pendingSpeaker === 'patient'
                        ? 'bg-emerald-600 text-white dark:bg-emerald-700 border-emerald-700'
                        : 'bg-primary text-primary-foreground border-primary'
                    }`}>
                      <p className="text-sm font-medium mb-2">
                        📝 Confirm your message: 
                        <span className="text-xs opacity-70 ml-2">(click to edit)</span>
                      </p>
                      <textarea
                        value={pendingTranscript}
                        onChange={(e) => setPendingTranscript(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirmSend();
                          }
                        }}
                        className={`w-full text-lg mb-3 bg-transparent border-b outline-none resize-none min-h-[1.5em] cursor-text rounded px-1 -mx-1 transition-colors ${
                          pendingSpeaker === 'patient'
                            ? 'border-white/30 focus:border-white hover:bg-white/10'
                            : 'border-primary-foreground/30 focus:border-primary-foreground hover:bg-primary-foreground/10'
                        }`}
                        rows={Math.max(1, Math.ceil(pendingTranscript.length / 50))}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleCancelSend}
                          className={pendingSpeaker === 'patient' 
                            ? "text-white hover:bg-white/20 gap-1"
                            : "text-primary-foreground hover:bg-primary-foreground/20 gap-1"
                          }
                        >
                          <XCircle className="h-4 w-4" />
                          Discard
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={handleAddMore}
                          className={pendingSpeaker === 'patient' 
                            ? "text-white hover:bg-white/20 gap-1"
                            : "text-primary-foreground hover:bg-primary-foreground/20 gap-1"
                          }
                        >
                          <Mic className="h-4 w-4" />
                          Add More
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleConfirmSend}
                          className="gap-1"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                  {pendingSpeaker === 'staff' && <div className="flex-1" />}
                </div>
              )}

              {/* Show pending text even when continuing to listen (after "Add More") */}
              {pendingTranscript && !showConfirmation && (
                <div className="flex gap-4">
                  {speakerMode === 'patient' && <div className="flex-1" />}
                  <div className="flex-1">
                    <div className={`inline-block max-w-full rounded-lg p-3 border ${
                      speakerMode === 'patient'
                        ? 'bg-emerald-500/30 text-emerald-900 dark:text-emerald-100 border-emerald-500/50'
                        : 'bg-primary/30 text-primary-foreground border-primary/50'
                    }`}>
                      <p className="text-sm font-medium mb-1 opacity-70">📝 Queued (keep speaking...)</p>
                      <p className="text-lg opacity-80">{pendingTranscript}</p>
                    </div>
                  </div>
                  {speakerMode === 'staff' && <div className="flex-1" />}
                </div>
              )}

              {isTranslating && (
                <div className="text-center text-muted-foreground py-2">
                  Translating...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Speaker Mode Selector with Mic Controls */}
          <div className="pt-4">
            <SpeakerModeSelector
              mode={speakerMode}
              onModeChange={handleSpeakerModeChange}
              patientLanguageName={languageInfo?.name || patientLanguage}
              patientLanguageCode={patientLanguage}
              patientLanguageFlag={languageInfo?.flag}
              isListening={isListening && !isMicPaused}
              disabled={isConnecting}
            >
              {/* Mic controls as children */}
              <div className="flex items-center gap-3">
                {/* Pause button - only show when listening */}
                {isListening && (
                  <Button
                    size="sm"
                    variant={isMicPaused ? 'default' : 'outline'}
                    className="h-10 px-4 rounded-full gap-2"
                    onClick={toggleMicPause}
                  >
                    {isMicPaused ? (
                      <>
                        <Play className="h-4 w-4" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause
                      </>
                    )}
                  </Button>
                )}
                
                {/* Main mic button */}
                <Button
                  size="lg"
                  variant={isListening ? 'destructive' : isConnecting ? 'secondary' : 'default'}
                  className="h-16 w-16 rounded-full"
                  onClick={toggleListening}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </Button>
              </div>
            </SpeakerModeSelector>
          </div>
        </div>
        )}

        {/* QR Code panel */}
        <div className="w-72 border-l p-4 flex flex-col items-center bg-muted/30 overflow-y-auto min-h-0">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Patient QR Code
          </h2>

          {qrCodeUrl && (
            <Card
              className="mb-3 cursor-pointer transition-transform hover:scale-105 group relative overflow-hidden"
              onClick={() => setShowExpandedQR(true)}
            >
              <CardContent className="p-3">
                <img
                  src={qrCodeUrl}
                  alt="Patient QR Code"
                  className="block w-36 h-36"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions in patient's language */}
          <div className="mb-3 p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center w-full">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">
              {languageInfo?.flag} {languageInfo?.name}
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              {qrInstructions.scanInstruction}
            </p>
          </div>

          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleCopyLink}>
              {copied ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy Link</>
              )}
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowExpandedQR(true)}>
              <Maximize2 className="h-3 w-3 mr-1" />
              Expand
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-background border text-xs w-full">
            <p className="font-medium mb-1">How it works:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Patient scans QR code</li>
              <li>You speak in English</li>
              <li>Patient sees translation</li>
              <li>Patient types/speaks reply</li>
              <li>You see English translation</li>
            </ol>
          </div>

          {/* Settings button below How it works */}
          <div className="mt-3 flex justify-end w-full">
            <TranslationSettingsModal
              systemAudioService={systemAudioService}
              onServiceChange={setSystemAudioService}
              isCapturingSystemAudio={isCapturingSystemAudio}
            />
          </div>
        </div>
      </div>

      {/* Expanded QR Code Modal */}
      <Dialog open={showExpandedQR} onOpenChange={setShowExpandedQR}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <QrCode className="h-5 w-5" />
              {MODAL_TITLES[patientLanguage] || MODAL_TITLES['en']}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-6">
            {/* Practice name */}
            <p className="text-lg font-semibold text-primary mb-4">{practiceName}</p>
            
            {/* Large QR Code */}
            {largeQrCodeUrl && (
              <div className="bg-white p-4 rounded-xl shadow-lg mb-4">
                <img src={largeQrCodeUrl} alt="Patient QR Code" className="w-72 h-72" />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSMSModal(true)}>
                <Smartphone className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
            
            {/* Instructions in patient's language - prominent */}
            <div className="w-full max-w-sm p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border border-violet-200 dark:border-violet-800 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl">{languageInfo?.flag}</span>
                <span className="font-semibold text-violet-700 dark:text-violet-300">{languageInfo?.name}</span>
              </div>
              <p className="text-base text-violet-800 dark:text-violet-200 mb-3 font-medium">
                {qrInstructions.scanInstruction}
              </p>
              <p className="text-sm text-violet-600 dark:text-violet-400">
                {qrInstructions.welcomeMessage}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Link to Patient
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="patient-email-input">Patient's Email Address</Label>
              <Input
                id="patient-email-input"
                type="email"
                placeholder="patient@example.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                disabled={isSendingEmail}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted text-sm">
              <p className="font-medium mb-2">Email will include:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Welcome message in {languageInfo?.name}</li>
                <li>Clickable link to join the session</li>
                <li>Sent from: {practiceName}</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmailModal(false)} disabled={isSendingEmail}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSendingEmail || !patientEmail}>
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog open={showSMSModal} onOpenChange={setShowSMSModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              SMS Link for Accurx
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted border-2 border-dashed">
              <p className="text-sm font-medium mb-2 text-muted-foreground">Message in {languageInfo?.name}:</p>
              <p className="text-base break-all">
                {sharingText.smsText} {patientUrl}
              </p>
            </div>

            <Button 
              className="w-full" 
              onClick={handleCopySMS}
              variant={smsCopied ? 'secondary' : 'default'}
            >
              {smsCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">📱 Next step:</p>
              <p className="text-blue-600 dark:text-blue-400">
                {sharingText.accurxInstruction}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocked Content Alert Dialog */}
      <AlertDialog open={showBlockedDialog} onOpenChange={(open) => {
        setShowBlockedDialog(open);
        if (!open) clearBlockedContent();
      }}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" />
              Translation Blocked
            </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {blockedContent?.reason || 'This message contains language that cannot be translated in a healthcare setting.'}
              </p>
              <p className="text-sm text-muted-foreground">
                Please rephrase your message and try again.
              </p>
            </div>
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => {
                setShowBlockedDialog(false);
                clearBlockedContent();
              }}
            >
              Edit Message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Content Warning Alert Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent className="border-amber-500">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Content Warning
            </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This message may contain inappropriate language.
              </p>
              <p className="text-sm text-muted-foreground">
                Please review before sending to the patient.
              </p>
            </div>
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowWarningDialog(false);
              clearContentWarning();
            }}>
              Edit Message
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (pendingWarningTranscript) {
                  const speaker = speakerModeRef.current;
                  await sendMessage(pendingWarningTranscript, speaker);
                  setPendingWarningTranscript(null);
                  setPendingTranscript(null);
                  setShowConfirmation(false);
                }
                setShowWarningDialog(false);
                clearContentWarning();
              }}
            >
              Send Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
