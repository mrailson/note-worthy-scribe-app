import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Enhanced language data with native names and "I speak" phrases
const PATIENT_LANGUAGES = [
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English',
    flag: '🇬🇧', 
    phrase: 'I speak English'
  },
  { 
    code: 'ar', 
    name: 'Arabic', 
    nativeName: 'العربية',
    flag: '🇸🇦', 
    phrase: 'أتكلم العربية'
  },
  { 
    code: 'zh', 
    name: 'Chinese', 
    nativeName: '中文',
    flag: '🇨🇳', 
    phrase: '我说中文'
  },
  { 
    code: 'fr', 
    name: 'French', 
    nativeName: 'Français',
    flag: '🇫🇷', 
    phrase: 'Je parle français'
  },
  { 
    code: 'de', 
    name: 'German', 
    nativeName: 'Deutsch',
    flag: '🇩🇪', 
    phrase: 'Ich spreche Deutsch'
  },
  { 
    code: 'hi', 
    name: 'Hindi', 
    nativeName: 'हिन्दी',
    flag: '🇮🇳', 
    phrase: 'मैं हिन्दी बोलता हूँ'
  },
  { 
    code: 'it', 
    name: 'Italian', 
    nativeName: 'Italiano',
    flag: '🇮🇹', 
    phrase: 'Parlo italiano'
  },
  { 
    code: 'es', 
    name: 'Spanish', 
    nativeName: 'Español',
    flag: '🇪🇸', 
    phrase: 'Hablo español'
  },
  { 
    code: 'pt', 
    name: 'Portuguese', 
    nativeName: 'Português',
    flag: '🇵🇹', 
    phrase: 'Eu falo português'
  },
  { 
    code: 'ru', 
    name: 'Russian', 
    nativeName: 'Русский',
    flag: '🇷🇺', 
    phrase: 'Я говорю по-русски'
  },
  { 
    code: 'pl', 
    name: 'Polish', 
    nativeName: 'Polski',
    flag: '🇵🇱', 
    phrase: 'Mówię po polsku'
  },
  { 
    code: 'tr', 
    name: 'Turkish', 
    nativeName: 'Türkçe',
    flag: '🇹🇷', 
    phrase: 'Türkçe konuşuyorum'
  },
  { 
    code: 'nl', 
    name: 'Dutch', 
    nativeName: 'Nederlands',
    flag: '🇳🇱', 
    phrase: 'Ik spreek Nederlands'
  },
  { 
    code: 'bn', 
    name: 'Bengali', 
    nativeName: 'বাংলা',
    flag: '🇧🇩', 
    phrase: 'আমি বাংলা বলি'
  },
  { 
    code: 'ur', 
    name: 'Urdu', 
    nativeName: 'اردو',
    flag: '🇵🇰', 
    phrase: 'میں اردو بولتا ہوں'
  },
  { 
    code: 'pa', 
    name: 'Punjabi', 
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳', 
    phrase: 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹਾਂ'
  },
  { 
    code: 'gu', 
    name: 'Gujarati', 
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳', 
    phrase: 'હું ગુજરાતી બોલું છું'
  },
  { 
    code: 'ta', 
    name: 'Tamil', 
    nativeName: 'தமிழ்',
    flag: '🇮🇳', 
    phrase: 'நான் தமிழ் பேசுகிறேன்'
  },
  { 
    code: 'fa', 
    name: 'Persian', 
    nativeName: 'فارسی',
    flag: '🇮🇷', 
    phrase: 'من فارسی صحبت می‌کنم'
  },
  { 
    code: 'so', 
    name: 'Somali', 
    nativeName: 'Soomaali',
    flag: '🇸🇴', 
    phrase: 'Waxaan ku hadlaa Soomaaliga'
  }
];

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