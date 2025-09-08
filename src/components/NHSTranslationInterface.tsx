import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  RotateCcw, 
  FileText, 
  Settings,
  Heart,
  AlertTriangle,
  Pill,
  History,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import TranslationHistory from './TranslationHistory';
import { scoreTranslation, TranslationScore } from '@/utils/translationScoring';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';

interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  accuracy?: number; // 0-100
  confidence?: number; // 0-100  
  safetyFlag?: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected?: string[];
  translationLatency?: number; // milliseconds
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
  { code: 'fr', name: 'French', flag: '🇫🇷', speechLang: 'fr-FR' },
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
  const [translationScores, setTranslationScores] = useState<TranslationScore[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'gp' | 'patient' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date>(new Date());
  
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
      console.log(`🔄 Translating: "${text}" from ${fromLang} to ${toLang}`);
      
      // Use Supabase edge function for translation
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: { text, fromLang, toLang }
      });
      
      console.log('Translation API response:', data, error);
      
      if (error) {
        console.error('Translation API error:', error);
        throw new Error('Translation failed');
      }

      if (data?.translatedText) {
        console.log(`✅ Translation successful: "${data.translatedText}"`);
        return data.translatedText;
      } else {
        console.error('No translation returned:', data);
        throw new Error('No translation returned');
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

    // Prevent starting if already recording
    if (isRecording || currentSpeaker) {
      console.log('Already recording, ignoring start request');
      return;
    }

    setCurrentSpeaker(speaker);
    setIsRecording(true);
    
    // Set recognition language based on who is speaking
    const recognitionLang = speaker === 'gp' ? 'en-GB' : (patientLanguage === 'auto' ? 'en-GB' : patientLanguage);
    const speechLang = LANGUAGES.find(lang => lang.code === recognitionLang)?.speechLang || 'en-GB';
    
    recognitionRef.current.lang = speechLang;
    
    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      console.log(`🎤 Received transcript from ${speaker}: "${transcript}"`);
      setIsProcessing(true);
      
      const translationStartTime = Date.now();
      
      try {
        // Automatic translation logic:
        // GP always speaks English, translates to patient language  
        // Patient always speaks their language, translates to English
        const sourceLang = speaker === 'gp' ? 'en-GB' : (patientLanguage === 'auto' ? 'en-GB' : patientLanguage);
        const targetLang = speaker === 'gp' ? (patientLanguage === 'auto' ? 'en-GB' : patientLanguage) : 'en-GB';
        
        console.log(`🔄 Translation setup: ${sourceLang} → ${targetLang}, Patient language: ${patientLanguage}`);
        
        let translatedText = transcript;
        // Only translate if languages are different and not auto-detect
        if (sourceLang !== targetLang && patientLanguage !== 'auto') {
          // Convert language codes for API (remove country codes)
          const apiSourceLang = sourceLang.split('-')[0]; // en-GB → en
          const apiTargetLang = targetLang.split('-')[0]; // fr → fr
          
          console.log(`🌐 API call: ${apiSourceLang} → ${apiTargetLang}`);
          translatedText = await translateText(transcript, apiSourceLang, apiTargetLang);
        } else {
          console.log('📝 No translation needed - same language or auto-detect');
        }
        
        const translationLatency = Date.now() - translationStartTime;
        
        // Score the translation
        const translationScore = scoreTranslation(
          transcript,
          translatedText,
          sourceLang,
          targetLang,
          translationLatency
        );
        
        const newTranslation: TranslationEntry = {
          id: Date.now().toString(),
          speaker,
          originalText: transcript,
          translatedText,
          originalLanguage: sourceLang,
          targetLanguage: targetLang,
          timestamp: new Date(),
          accuracy: translationScore.accuracy,
          confidence: translationScore.confidence,
          safetyFlag: translationScore.safetyFlag,
          medicalTermsDetected: translationScore.medicalTermsDetected,
          translationLatency
        };
        
        setTranslations(prev => [...prev, newTranslation]);
        setTranslationScores(prev => [...prev, translationScore]);
        
        // Automatically speak the translation (not the original)
        if (sourceLang !== targetLang && patientLanguage !== 'auto') {
          const targetSpeechLang = LANGUAGES.find(lang => lang.code === targetLang)?.speechLang || 'en-GB';
          console.log(`🔊 Speaking translation in: ${targetSpeechLang}`);
          setTimeout(() => speakText(translatedText, targetSpeechLang), 500);
        }
        
        // Show safety warning if needed
        if (translationScore.safetyFlag === 'unsafe') {
          toast.error('Translation safety warning - please verify with qualified interpreter', {
            duration: 6000
          });
        } else if (translationScore.safetyFlag === 'warning') {
          toast.warning('Translation needs verification - medical terms detected', {
            duration: 4000
          });
        } else {
          toast.success(`${speaker === 'gp' ? 'GP' : 'Patient'} speech translated`);
        }
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
    const translationStartTime = Date.now();
    
    try {
      // Emergency phrases are always from GP (English) to patient language
      const sourceLang = 'en-GB';
      const targetLang = patientLanguage === 'auto' ? 'en-GB' : patientLanguage;
      let translatedText = phrase;
      
      if (sourceLang !== targetLang && patientLanguage !== 'auto') {
        translatedText = await translateText(phrase, sourceLang.split('-')[0], targetLang.split('-')[0]);
      }
      
      const translationLatency = Date.now() - translationStartTime;
      
      // Score the emergency phrase translation
      const translationScore = scoreTranslation(
        phrase,
        translatedText,
        sourceLang,
        targetLang,
        translationLatency
      );
      
      const newTranslation: TranslationEntry = {
        id: Date.now().toString(),
        speaker: 'gp',
        originalText: phrase,
        translatedText,
        originalLanguage: sourceLang,
        targetLanguage: targetLang,
        timestamp: new Date(),
        accuracy: translationScore.accuracy,
        confidence: translationScore.confidence,
        safetyFlag: translationScore.safetyFlag,
        medicalTermsDetected: translationScore.medicalTermsDetected,
        translationLatency
      };
      
      setTranslations(prev => [...prev, newTranslation]);
      setTranslationScores(prev => [...prev, translationScore]);
      
      // Speak the translation automatically
      if (sourceLang !== targetLang && patientLanguage !== 'auto') {
        const targetSpeechLang = LANGUAGES.find(lang => lang.code === targetLang)?.speechLang || 'en-GB';
        setTimeout(() => speakText(translatedText, targetSpeechLang), 500);
      }
      
      if (translationScore.safetyFlag === 'unsafe') {
        toast.error('Emergency phrase safety warning - verify immediately');
      } else {
        toast.success('Emergency phrase translated to patient language');
      }
    } catch (error) {
      console.error('Emergency phrase error:', error);
      toast.error('Failed to translate emergency phrase');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    setTranslations([]);
    setTranslationScores([]);
    setSessionStart(new Date());
    toast.success('Conversation history cleared');
  };

  const handleExportDOCX = async () => {
    try {
      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      
      const averageAccuracy = translationScores.length > 0 
        ? Math.round(translationScores.reduce((sum, s) => sum + s.accuracy, 0) / translationScores.length)
        : 0;
      
      const averageConfidence = translationScores.length > 0
        ? Math.round(translationScores.reduce((sum, s) => sum + s.confidence, 0) / translationScores.length)
        : 0;

      const safeCount = translationScores.filter(s => s.safetyFlag === 'safe').length;
      const warningCount = translationScores.filter(s => s.safetyFlag === 'warning').length;
      const unsafeCount = translationScores.filter(s => s.safetyFlag === 'unsafe').length;
      
      let overallSafetyRating: 'safe' | 'warning' | 'unsafe' = 'safe';
      if (unsafeCount > 0) {
        overallSafetyRating = 'unsafe';
      } else if (warningCount > translationScores.length * 0.3) {
        overallSafetyRating = 'warning';
      }

      const metadata: SessionMetadata = {
        sessionDate: sessionStart,
        sessionStart,
        sessionEnd,
        patientLanguage: getLanguageName(patientLanguage),
        totalTranslations: translations.length,
        sessionDuration,
        overallSafetyRating,
        averageAccuracy,
        averageConfidence
      };

      await downloadDOCX(translations, metadata, translationScores);
      toast.success('Translation history exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export translation history');
    }
  };

  const getLanguageFlag = (langCode: string) => {
    return LANGUAGES.find(lang => lang.code === langCode)?.flag || '🌍';
  };

  const getLanguageName = (langCode: string) => {
    return LANGUAGES.find(lang => lang.code === langCode)?.name || langCode;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Heart className="w-8 h-8" />
            NHS Translation Tool - Enhanced with AI Safety Assessment
          </CardTitle>
          <p className="text-primary-foreground/80">
            Real-time translation tool with accuracy tracking and safety assessment for UK NHS GP practices
          </p>
        </CardHeader>
      </Card>

      {/* Main Interface Tabs */}
      <Tabs defaultValue="translate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="translate" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Live Translation
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Translation History
            {translations.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {translations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="translate" className="space-y-6 mt-6">
          {/* Language Selection */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">GP/Staff Language (Fixed)</label>
                  <div className="flex items-center p-3 border rounded-md bg-muted">
                    <span className="text-lg">🇬🇧 English (UK)</span>
                    <Badge variant="secondary" className="ml-2">GP Default</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    GP always speaks English - automatically translates to patient language
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Patient Language</label>
                  <Select value={patientLanguage} onValueChange={setPatientLanguage}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔄 Auto Detect</SelectItem>
                      {LANGUAGES.filter(lang => lang.code !== 'en-GB').map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Patient speech automatically translates to English
                  </p>
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
                      {isRecording && currentSpeaker === 'gp' 
                        ? 'Recording English...' 
                        : 'English → Patient Language'
                      }
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
                      {isRecording && currentSpeaker === 'patient' 
                        ? `Recording ${getLanguageName(patientLanguage)}...` 
                        : 'Patient Language → English'
                      }
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
                  <span>Processing translation with AI safety assessment...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Quick View */}
          {translations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💬 Recent Translations
                  <Badge variant="secondary">{translations.length}</Badge>
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
                <ScrollArea className="h-64" ref={scrollAreaRef}>
                  <div className="space-y-3">
                    {translations.slice(-3).map((translation, index) => (
                      <div key={translation.id} className={`p-3 rounded-lg border ${
                        translation.speaker === 'gp' 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {translation.timestamp.toLocaleTimeString()}
                          </span>
                          {translation.accuracy && (
                            <Badge className={`text-xs ${
                              translation.accuracy >= 90 ? 'bg-green-100 text-green-700' :
                              translation.accuracy >= 75 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {translation.accuracy}%
                            </Badge>
                          )}
                          {translation.safetyFlag && (
                            <Badge className={`text-xs ${
                              translation.safetyFlag === 'safe' ? 'bg-green-100 text-green-700' :
                              translation.safetyFlag === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {translation.safetyFlag}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm"><strong>Original:</strong> {translation.originalText}</p>
                          <p className="text-sm"><strong>Translation:</strong> {translation.translatedText}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {translations.length > 3 && (
                    <div className="text-center mt-3">
                      <p className="text-xs text-muted-foreground">
                        Showing last 3 translations. View all in History tab.
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Emergency Quick Phrases */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🚨 Emergency Quick Phrases
                <Badge variant="destructive" className="ml-2">GP → Patient Language</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {EMERGENCY_PHRASES.map((phrase, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`p-3 h-auto text-left justify-start text-wrap ${
                      phrase.category === 'emergency' ? 'border-red-200 hover:bg-red-50' :
                      phrase.category === 'allergy' ? 'border-orange-200 hover:bg-orange-50' :
                      phrase.category === 'pain' ? 'border-yellow-200 hover:bg-yellow-50' :
                      phrase.category === 'timing' ? 'border-blue-200 hover:bg-blue-50' :
                      'border-purple-200 hover:bg-purple-50'
                    }`}
                    onClick={() => handleEmergencyPhrase(phrase.en)}
                    disabled={isProcessing}
                  >
                    <div className="flex items-center gap-2">
                      {phrase.category === 'emergency' && <Heart className="w-4 h-4 text-red-500" />}
                      {phrase.category === 'allergy' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      {phrase.category === 'pain' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      {phrase.category === 'timing' && <Pill className="w-4 h-4 text-blue-500" />}
                      {phrase.category === 'medication' && <Pill className="w-4 h-4 text-purple-500" />}
                      <span className="text-sm">{phrase.en}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-center text-yellow-800">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-medium">⚠️ ENHANCED AI SAFETY DISCLAIMER</p>
                <p className="text-xs mt-1">
                  This tool now includes AI-powered accuracy scoring and safety assessment. However, it remains a 
                  proof-of-concept for demonstration only. Critical medical information should always be verified 
                  through qualified medical interpreters, especially for translations flagged as "warning" or "unsafe".
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <TranslationHistory
            translations={translations}
            sessionStart={sessionStart}
            patientLanguage={getLanguageName(patientLanguage)}
            onExportDOCX={handleExportDOCX}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};