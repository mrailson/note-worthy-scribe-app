import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  RotateCcw, 
  FileText, 
  Settings,
  Heart,
  AlertTriangle,
  Pill
} from 'lucide-react';
import { toast } from 'sonner';

interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

interface Language {
  code: string;
  name: string;
  flag: string;
  speechLang: string;
}

const LANGUAGES: Language[] = [
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧', speechLang: 'en-GB' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', speechLang: 'pl-PL' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', speechLang: 'ur-PK' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', speechLang: 'bn-BD' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', speechLang: 'es-ES' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', speechLang: 'ar-SA' }
];

const EMERGENCY_PHRASES = [
  { en: 'Are you experiencing chest pain?', category: 'emergency' },
  { en: 'Can you breathe normally?', category: 'emergency' },
  { en: 'Are you allergic to any medicines?', category: 'allergy' },
  { en: 'Rate your pain from 1 to 10', category: 'pain' },
  { en: 'When did this start?', category: 'timing' },
  { en: 'What medications are you taking?', category: 'medication' }
];

export const NHSTranslationInterface = () => {
  const [staffLanguage, setStaffLanguage] = useState('en-GB');
  const [patientLanguage, setPatientLanguage] = useState('auto');
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'gp' | 'patient' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  
  const recognitionRef = useRef<any | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setRecognitionSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new translations are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [translations]);

  const translateText = async (text: string, fromLang: string, toLang: string): Promise<string> => {
    try {
      // Using MyMemory Translation API (free tier)
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`
      );
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        return data.responseData.translatedText;
      } else {
        throw new Error('Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original if translation fails
    }
  };

  const speakText = (text: string, language: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 0.8; // Slower for clarity
      utterance.volume = 1.0;
      speechSynthesis.speak(utterance);
    }
  };

  const startRecording = (speaker: 'gp' | 'patient') => {
    if (!recognitionSupported || !recognitionRef.current) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    setCurrentSpeaker(speaker);
    setIsRecording(true);
    
    const targetLang = speaker === 'gp' ? staffLanguage : patientLanguage === 'auto' ? 'en-GB' : patientLanguage;
    const speechLang = LANGUAGES.find(lang => lang.code === targetLang)?.speechLang || 'en-GB';
    
    recognitionRef.current.lang = speechLang;
    
    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsProcessing(true);
      
      try {
        const sourceLang = speaker === 'gp' ? staffLanguage : patientLanguage === 'auto' ? 'en-GB' : patientLanguage;
        const targetLang = speaker === 'gp' ? (patientLanguage === 'auto' ? 'en-GB' : patientLanguage) : staffLanguage;
        
        let translatedText = transcript;
        if (sourceLang !== targetLang) {
          translatedText = await translateText(transcript, sourceLang.split('-')[0], targetLang.split('-')[0]);
        }
        
        const newTranslation: TranslationEntry = {
          id: Date.now().toString(),
          speaker,
          originalText: transcript,
          translatedText,
          originalLanguage: sourceLang,
          targetLanguage: targetLang,
          timestamp: new Date()
        };
        
        setTranslations(prev => [...prev, newTranslation]);
        
        // Speak the translation
        if (sourceLang !== targetLang) {
          const targetSpeechLang = LANGUAGES.find(lang => lang.code === targetLang)?.speechLang || 'en-GB';
          setTimeout(() => speakText(translatedText, targetSpeechLang), 500);
        }
        
        toast.success('Translation completed');
      } catch (error) {
        console.error('Processing error:', error);
        toast.error('Failed to process speech');
      } finally {
        setIsProcessing(false);
      }
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      toast.error(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
      setCurrentSpeaker(null);
      setIsProcessing(false);
    };
    
    recognitionRef.current.onend = () => {
      setIsRecording(false);
      setCurrentSpeaker(null);
    };
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      toast.error('Failed to start recording');
      setIsRecording(false);
      setCurrentSpeaker(null);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const handleEmergencyPhrase = async (phrase: string) => {
    setIsProcessing(true);
    try {
      const targetLang = patientLanguage === 'auto' ? 'en-GB' : patientLanguage;
      let translatedText = phrase;
      
      if (staffLanguage !== targetLang) {
        translatedText = await translateText(phrase, staffLanguage.split('-')[0], targetLang.split('-')[0]);
      }
      
      const newTranslation: TranslationEntry = {
        id: Date.now().toString(),
        speaker: 'gp',
        originalText: phrase,
        translatedText,
        originalLanguage: staffLanguage,
        targetLanguage: targetLang,
        timestamp: new Date()
      };
      
      setTranslations(prev => [...prev, newTranslation]);
      
      // Speak the translation
      if (staffLanguage !== targetLang) {
        const targetSpeechLang = LANGUAGES.find(lang => lang.code === targetLang)?.speechLang || 'en-GB';
        setTimeout(() => speakText(translatedText, targetSpeechLang), 500);
      }
      
      toast.success('Emergency phrase translated');
    } catch (error) {
      console.error('Emergency phrase error:', error);
      toast.error('Failed to translate emergency phrase');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    setTranslations([]);
    toast.success('Conversation history cleared');
  };

  const getLanguageFlag = (langCode: string) => {
    return LANGUAGES.find(lang => lang.code === langCode)?.flag || '🌍';
  };

  const getLanguageName = (langCode: string) => {
    return LANGUAGES.find(lang => lang.code === langCode)?.name || langCode;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Heart className="w-8 h-8" />
            NHS Translation Tool - Proof of Concept
          </CardTitle>
          <p className="text-primary-foreground/80">
            Real-time translation tool for UK NHS GP practices
          </p>
        </CardHeader>
      </Card>

      {/* Language Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Staff Language</label>
              <Select value={staffLanguage} onValueChange={setStaffLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Patient Language</label>
              <Select value={patientLanguage} onValueChange={setPatientLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🔄 Auto Detect</SelectItem>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Recording Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-8 text-center">
            <Button
              size="lg"
              className="w-full h-32 text-lg font-semibold bg-primary hover:bg-primary/90"
              onMouseDown={() => startRecording('gp')}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={() => startRecording('gp')}
              onTouchEnd={stopRecording}
              disabled={isRecording && currentSpeaker !== 'gp' || isProcessing}
            >
              <div className="flex flex-col items-center gap-2">
                {isRecording && currentSpeaker === 'gp' ? (
                  <Mic className="w-8 h-8 animate-pulse" />
                ) : (
                  <MicOff className="w-8 h-8" />
                )}
                <span>🩺 GP/STAFF</span>
                <span className="text-sm opacity-90">
                  {isRecording && currentSpeaker === 'gp' ? 'Recording...' : 'Press & Hold to Speak'}
                </span>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-8 text-center">
            <Button
              size="lg"
              className="w-full h-32 text-lg font-semibold bg-secondary hover:bg-secondary/90"
              onMouseDown={() => startRecording('patient')}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={() => startRecording('patient')}
              onTouchEnd={stopRecording}
              disabled={isRecording && currentSpeaker !== 'patient' || isProcessing}
            >
              <div className="flex flex-col items-center gap-2">
                {isRecording && currentSpeaker === 'patient' ? (
                  <Mic className="w-8 h-8 animate-pulse" />
                ) : (
                  <MicOff className="w-8 h-8" />
                )}
                <span>👤 PATIENT</span>
                <span className="text-sm opacity-90">
                  {isRecording && currentSpeaker === 'patient' ? 'Recording...' : 'Press & Hold to Speak'}
                </span>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-yellow-700">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700"></div>
              <span>Processing translation...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💬 Recent Translations
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="ml-auto"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Clear History
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96" ref={scrollAreaRef}>
            {translations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No translations yet. Start speaking to begin...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {translations.map((translation) => (
                  <div key={translation.id} className="space-y-2">
                    <div className={`p-4 rounded-lg ${
                      translation.speaker === 'gp' 
                        ? 'bg-blue-50 border-l-4 border-blue-400' 
                        : 'bg-green-50 border-l-4 border-green-400'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                        </Badge>
                        <Badge variant="secondary">
                          {getLanguageFlag(translation.originalLanguage)} {getLanguageName(translation.originalLanguage)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {translation.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-medium">{translation.originalText}</p>
                      {translation.originalText !== translation.translatedText && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              🌍 {getLanguageFlag(translation.targetLanguage)} Translation
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const targetSpeechLang = LANGUAGES.find(lang => 
                                  lang.code === translation.targetLanguage
                                )?.speechLang || 'en-GB';
                                speakText(translation.translatedText, targetSpeechLang);
                              }}
                            >
                              <Volume2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-sm italic">{translation.translatedText}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Emergency Quick Phrases */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            🚨 Emergency Quick Phrases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMERGENCY_PHRASES.map((phrase, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-3 text-left justify-start border-red-200 hover:bg-red-50"
                onClick={() => handleEmergencyPhrase(phrase.en)}
                disabled={isProcessing}
              >
                <div className="flex items-center gap-2">
                  {phrase.category === 'emergency' && <Heart className="w-4 h-4 text-red-500" />}
                  {phrase.category === 'allergy' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  {phrase.category === 'medication' && <Pill className="w-4 h-4 text-blue-500" />}
                  <span className="text-sm">{phrase.en}</span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-center gap-4 pb-8">
        <Button variant="outline" onClick={clearHistory}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear History
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <FileText className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" onClick={() => toast.info('Settings panel coming soon...')}>
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Browser Compatibility Notice */}
      {!recognitionSupported && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Speech Recognition Not Supported</p>
                <p className="text-sm">
                  Please use Chrome, Edge, or Safari for full voice functionality. 
                  Text input/output is still available.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};