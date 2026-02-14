import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Native language names
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
  children?: React.ReactNode;
}

export const SpeakerModeSelector: React.FC<SpeakerModeSelectorProps> = ({
  mode,
  onModeChange,
  patientLanguageName,
  patientLanguageCode = 'en',
  patientLanguageFlag,
  isListening,
  disabled,
  children
}) => {
  const patientLabel = PATIENT_LABELS[patientLanguageCode] || PATIENT_LABELS['en'];
  const nativeLanguageName = NATIVE_LANGUAGE_NAMES[patientLanguageCode] || patientLanguageName;
  
  const isStaff = mode === 'staff';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pill-style segmented toggle */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-stretch rounded-full border-2 border-muted overflow-hidden bg-muted/50">
          {/* Staff / Receptionist side */}
          <button
            onClick={() => onModeChange('staff')}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none",
              isStaff
                ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <User className="h-4 w-4" />
            <span>Receptionist</span>
            <span className="text-xs opacity-80">🇬🇧</span>
          </button>

          {/* Patient side */}
          <button
            onClick={() => onModeChange('patient')}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none",
              !isStaff
                ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Users className="h-4 w-4" />
            <span>{patientLabel}</span>
            <span className="text-xs opacity-80">{patientLanguageFlag}</span>
          </button>
        </div>

        {/* Mic controls (passed as children) */}
        {children}
      </div>

      {/* Translation direction indicator */}
      <div className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
        isStaff
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
      )}>
        {isStaff ? (
          <>🇬🇧 English <ArrowRight className="h-3.5 w-3.5" /> {patientLanguageFlag} {nativeLanguageName}</>
        ) : (
          <>{patientLanguageFlag} {nativeLanguageName} <ArrowRight className="h-3.5 w-3.5" /> 🇬🇧 English</>
        )}
      </div>

      {/* Status text */}
      <p className="text-center text-xs text-muted-foreground">
        {isListening 
          ? `Listening for ${isStaff ? 'English' : nativeLanguageName}...` 
          : 'Press Tab or select above to switch between speakers · Click the Mic in the grey circle above to start'
        }
      </p>
    </div>
  );
};
