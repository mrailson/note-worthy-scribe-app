import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Users, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';

// Localised "Patient" labels in native languages
const PATIENT_LABELS: Record<string, string> = {
  en: "Patient",
  ar: "المريض",
  zh: "患者",
  'zh-TW': "患者",
  fr: "Patient",
  de: "Patient",
  hi: "रोगी",
  it: "Paziente",
  es: "Paciente",
  bg: "Пациент",
  hr: "Pacijent",
  cs: "Pacient",
  da: "Patient",
  nl: "Patiënt",
  el: "Ασθενής",
  hu: "Beteg",
  pl: "Pacjent",
  pt: "Paciente",
  ro: "Pacient",
  ru: "Пациент",
  tr: "Hasta",
  fa: "بیمار",
  bn: "রোগী",
  ur: "مریض",
  pa: "ਮਰੀਜ਼",
  gu: "દર્દી",
  ta: "நோயாளி",
  te: "రోగి",
  kn: "ರೋಗಿ",
  ml: "രോഗി",
  mr: "रुग्ण",
  ne: "बिरामी",
  uk: "Пацієнт",
  vi: "Bệnh nhân",
  th: "ผู้ป่วย",
  id: "Pasien",
  ms: "Pesakit",
  tl: "Pasyente",
  sw: "Mgonjwa",
  am: "ታካሚ",
  yo: "Alaisan",
  ig: "Onye ọrịa",
  ha: "Mai haƙuri",
  so: "Bukaanka",
  om: "Dhukkubsataa",
  ja: "患者",
  ko: "환자",
  fi: "Potilas",
  sv: "Patient",
  no: "Pasient",
  he: "מטופל",
  sk: "Pacient",
};

// Native language names (e.g., Bengali = বাংলা)
const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  pl: "Polski",
  ro: "Română",
  ar: "العربية",
  hi: "हिन्दी",
  ur: "اردو",
  pa: "ਪੰਜਾਬੀ",
  bn: "বাংলা",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  bg: "Български",
  hr: "Hrvatski",
  cs: "Čeština",
  da: "Dansk",
  fi: "Suomi",
  el: "Ελληνικά",
  hu: "Magyar",
  no: "Norsk",
  sk: "Slovenčina",
  sv: "Svenska",
  uk: "Українська",
  ru: "Русский",
  gu: "ગુજરાતી",
  ta: "தமிழ்",
  te: "తెలుగు",
  mr: "मराठी",
  ne: "नेपाली",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  th: "ไทย",
  tr: "Türkçe",
  fa: "فارسی",
  he: "עברית",
  sw: "Kiswahili",
  so: "Soomaali",
  am: "አማርኛ",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  tl: "Tagalog",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  yo: "Yorùbá",
  ig: "Igbo",
  ha: "Hausa",
  om: "Afaan Oromoo",
};

interface SpeakerModeSelectorProps {
  mode: 'staff' | 'patient';
  onModeChange: (mode: 'staff' | 'patient') => void;
  patientLanguageName: string;
  patientLanguageCode?: string;
  patientLanguageFlag?: string;
  isListening: boolean;
  disabled?: boolean;
}

export const SpeakerModeSelector: React.FC<SpeakerModeSelectorProps> = ({
  mode,
  onModeChange,
  patientLanguageName,
  patientLanguageCode = 'en',
  patientLanguageFlag,
  isListening,
  disabled
}) => {
  // Get localised "Patient" label and native language name
  const patientLabel = PATIENT_LABELS[patientLanguageCode] || PATIENT_LABELS['en'];
  const nativeLanguageName = NATIVE_LANGUAGE_NAMES[patientLanguageCode] || patientLanguageName;
  
  return (
    <div className="flex flex-col gap-3">
      {/* Toggle buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === 'staff' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-3 flex flex-col gap-1 relative transition-all",
            mode === 'staff' && isListening && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => onModeChange('staff')}
          disabled={disabled}
        >
          {mode === 'staff' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <User className="h-5 w-5" />
          <div className="text-center">
            <div className="font-semibold text-sm">Receptionist</div>
            <div className="text-xs opacity-70">🇬🇧 English</div>
          </div>
        </Button>
        
        <Button
          variant={mode === 'patient' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-3 flex flex-col gap-1 relative transition-all",
            mode === 'patient' && "bg-emerald-600 hover:bg-emerald-700 text-white",
            mode === 'patient' && isListening && "ring-2 ring-emerald-400 ring-offset-2"
          )}
          onClick={() => onModeChange('patient')}
          disabled={disabled}
        >
          {mode === 'patient' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <Users className="h-5 w-5" />
          <div className="text-center">
            <div className="font-semibold text-sm">{patientLabel}</div>
            <div className="text-xs opacity-70">{patientLanguageFlag} {nativeLanguageName}</div>
          </div>
        </Button>
      </div>

      {/* Status indicator */}
      <div className="text-center">
        <Badge 
          variant="outline" 
          className={cn(
            "px-3 py-1.5 text-sm gap-2 transition-all",
            mode === 'staff' 
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" 
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          )}
        >
          {isListening ? (
            <>
              <VoiceWaveform isActive={true} className={mode === 'staff' ? 'text-blue-500' : 'text-emerald-500'} />
              Listening for {mode === 'staff' ? 'English' : nativeLanguageName}...
            </>
          ) : (
            <>
              {mode === 'staff' 
                ? `🇬🇧 English → ${nativeLanguageName}` 
                : `${patientLanguageFlag} ${nativeLanguageName} → English`
              }
            </>
          )}
        </Badge>
      </div>
    </div>
  );
};
