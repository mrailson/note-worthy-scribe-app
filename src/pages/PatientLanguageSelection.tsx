import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';

// Native language names and phrases mapping
const LANGUAGE_DETAILS: Record<string, { nativeName: string; phrase: string }> = {
  'en': { nativeName: 'English', phrase: 'I speak English' },
  'ar': { nativeName: 'العربية', phrase: 'أتكلم العربية' },
  'zh': { nativeName: '中文', phrase: '我说中文' },
  'fr': { nativeName: 'Français', phrase: 'Je parle français' },
  'de': { nativeName: 'Deutsch', phrase: 'Ich spreche Deutsch' },
  'hi': { nativeName: 'हिन्दी', phrase: 'मैं हिन्दी बोलता हूँ' },
  'it': { nativeName: 'Italiano', phrase: 'Parlo italiano' },
  'es': { nativeName: 'Español', phrase: 'Hablo español' },
  'pt': { nativeName: 'Português', phrase: 'Eu falo português' },
  'ru': { nativeName: 'Русский', phrase: 'Я говорю по-русски' },
  'pl': { nativeName: 'Polski', phrase: 'Mówię po polsku' },
  'tr': { nativeName: 'Türkçe', phrase: 'Türkçe konuşuyorum' },
  'nl': { nativeName: 'Nederlands', phrase: 'Ik spreek Nederlands' },
  'bn': { nativeName: 'বাংলা', phrase: 'আমি বাংলা বলি' },
  'ur': { nativeName: 'اردو', phrase: 'میں اردو بولتا ہوں' },
  'pa': { nativeName: 'ਪੰਜਾਬੀ', phrase: 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹਾਂ' },
  'gu': { nativeName: 'ગુજરાતી', phrase: 'હું ગુજરાતી બોલું છું' },
  'ta': { nativeName: 'தமிழ்', phrase: 'நான் தமிழ் பேசுகிறேன்' },
  'te': { nativeName: 'తెలుగు', phrase: 'నేను తెలుగు మాట్లాడతాను' },
  'kn': { nativeName: 'ಕನ್ನಡ', phrase: 'ನಾನು ಕನ್ನಡ ಮಾತನಾಡುತ್ತೇನೆ' },
  'ml': { nativeName: 'മലയാളം', phrase: 'ഞാൻ മലയാളം സംസാരിക്കുന്നു' },
  'mr': { nativeName: 'मराठी', phrase: 'मी मराठी बोलतो' },
  'fa': { nativeName: 'فارسی', phrase: 'من فارسی صحبت می‌کنم' },
  'so': { nativeName: 'Soomaali', phrase: 'Waxaan ku hadlaa Soomaaliga' },
  'sw': { nativeName: 'Kiswahili', phrase: 'Ninazungumza Kiswahili' },
  'am': { nativeName: 'አማርኛ', phrase: 'አማርኛ እናገራለሁ' },
  'ti': { nativeName: 'ትግርኛ', phrase: 'ትግርኛ እናገር' },
  'om': { nativeName: 'Afaan Oromoo', phrase: 'Afaan Oromoo nan dubadha' },
  'yo': { nativeName: 'Yorùbá', phrase: 'Mo n sọ Yorùbá' },
  'ig': { nativeName: 'Igbo', phrase: 'Ana m asụ Igbo' },
  'ha': { nativeName: 'Hausa', phrase: 'Ina jin Hausa' },
  'bg': { nativeName: 'Български', phrase: 'Говоря български' },
  'hr': { nativeName: 'Hrvatski', phrase: 'Govorim hrvatski' },
  'cs': { nativeName: 'Čeština', phrase: 'Mluvím česky' },
  'da': { nativeName: 'Dansk', phrase: 'Jeg taler dansk' },
  'el': { nativeName: 'Ελληνικά', phrase: 'Μιλάω ελληνικά' },
  'hu': { nativeName: 'Magyar', phrase: 'Magyarul beszélek' },
  'ro': { nativeName: 'Română', phrase: 'Vorbesc română' },
  'ku': { nativeName: 'کوردی', phrase: 'من کوردی قسه می کنم' },
  'ps': { nativeName: 'پښتو', phrase: 'زه پښتو وایم' },
  'ne': { nativeName: 'नेपाली', phrase: 'म नेपाली बोल्छु' },
  'uk': { nativeName: 'Українська', phrase: 'Я розмовляю українською' },
  'vi': { nativeName: 'Tiếng Việt', phrase: 'Tôi nói tiếng Việt' },
  'th': { nativeName: 'ไทย', phrase: 'ฉันพูดภาษาไทย' },
  'id': { nativeName: 'Bahasa Indonesia', phrase: 'Saya berbicara bahasa Indonesia' },
  'ms': { nativeName: 'Bahasa Melayu', phrase: 'Saya bertutur dalam bahasa Melayu' },
  'tl': { nativeName: 'Tagalog', phrase: 'Nagsasalita ako ng Tagalog' }
};

// Create patient languages from healthcare languages with native details
const PATIENT_LANGUAGES = HEALTHCARE_LANGUAGES
  .filter(lang => lang.code !== 'none') // Exclude the 'No Translation' option
  .map(lang => ({
    code: lang.code,
    name: lang.name,
    flag: lang.flag,
    nativeName: LANGUAGE_DETAILS[lang.code]?.nativeName || lang.name,
    phrase: LANGUAGE_DETAILS[lang.code]?.phrase || `I speak ${lang.name}`
  }))
  .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by English name

const PatientLanguageSelection = () => {
  const navigate = useNavigate();

  const handleLanguageSelect = (language: any) => {
    // Store selected language and navigate to translation tool or show confirmation
    localStorage.setItem('selectedPatientLanguage', JSON.stringify(language));
    // You could navigate to translation tool or show a confirmation
    navigate('/mobile-translate', { state: { selectedLanguage: language.code } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Helmet>
        <title>Select Your Language - Patient Language Selection</title>
        <meta name="description" content="Point to your language to help us communicate better" />
      </Helmet>

      {/* Header */}
      <div className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Select Your Language</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="text-center mb-8">
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Point to Your Language
            </h2>
            <p className="text-muted-foreground text-lg">
              Please point to the language you speak so we can help you better
            </p>
            <div className="mt-4 flex justify-center">
              <div className="w-16 h-1 bg-primary rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PATIENT_LANGUAGES.map((language) => (
            <Button
              key={language.code}
              onClick={() => handleLanguageSelect(language)}
              variant="outline"
              className="h-auto p-6 bg-card/50 hover:bg-card hover:scale-105 transition-all duration-200 border-2 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                {/* Flag */}
                <span className="text-4xl">{language.flag}</span>
                
                {/* Native Name (Large) */}
                <div className="text-xl font-bold text-foreground">
                  {language.nativeName}
                </div>
                
                {/* English Name */}
                <div className="text-sm text-muted-foreground font-medium">
                  {language.name}
                </div>
                
                {/* Phrase in native language */}
                <div className="text-sm text-primary/80 font-medium border-t pt-2 w-full">
                  {language.phrase}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {/* Footer Help */}
        <div className="mt-12 text-center">
          <div className="bg-card/30 backdrop-blur-sm rounded-xl p-4 border">
            <p className="text-sm text-muted-foreground">
              If you don't see your language, please ask a staff member for help
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientLanguageSelection;