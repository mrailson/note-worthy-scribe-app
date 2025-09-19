import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Languages, 
  Mic, 
  MicOff, 
  Square, 
  Download, 
  X, 
  Play, 
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock,
  Volume2,
  VolumeX,
  Users,
  FileText,
  History,
  RotateCcw,
  Settings,
  Eye,
  ArrowUpDown,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { useManualTranslation } from '@/hooks/useManualTranslation';
import { ManualTranslationHistory } from './ManualTranslationHistory';
import { toast } from 'sonner';
import { downloadDOCX, SessionMetadata } from '@/utils/docxExport';
import { supabase } from '@/integrations/supabase/client';

interface ManualTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSession?: (session: any) => void;
  initialLanguageCode?: string;
  initialLanguageName?: string;
}

// Languages that require manual translation (not supported by ElevenLabs voice)
const MANUAL_TRANSLATION_LANGUAGES = HEALTHCARE_LANGUAGES.filter(lang => 
  !['none'].includes(lang.code) // All languages except 'none' can use manual translation
);

export const ManualTranslationModal: React.FC<ManualTranslationModalProps> = ({
  isOpen,
  onClose,
  onExportSession,
  initialLanguageCode,
  initialLanguageName
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguageCode || '');
  const [selectedLanguageName, setSelectedLanguageName] = useState<string>(initialLanguageName || '');
  const [showConsent, setShowConsent] = useState<boolean>(false);
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  
  // Speaker settings with persistence
  const [speakerSettings, setSpeakerSettings] = useState(() => {
    const saved = localStorage.getItem('manual-translation-speaker-settings');
    return saved ? JSON.parse(saved) : { patient: true, gp: true };
  });

  // Toggle states for individual translations
  const [translationToggles, setTranslationToggles] = useState<Record<string, {
    textSwapped: boolean;
    speakerSwapped: boolean;
  }>>({});

  // Store corrected translations locally
  const [correctedTranslations, setCorrectedTranslations] = useState<Record<string, any>>({});

  // Track which translations are being processed
  const [processingTranslations, setProcessingTranslations] = useState<Set<string>>(new Set());

  // Translation history view toggle with persistence
  const [showLastOnly, setShowLastOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('manual-translation-history-view');
    return saved ? JSON.parse(saved) : false;
  });

  // Display settings with persistence
  const [showMetrics, setShowMetrics] = useState<boolean>(() => {
    const saved = localStorage.getItem('manual-translation-show-metrics');
    return saved ? JSON.parse(saved) : true;
  });

  const [showSpeakers, setShowSpeakers] = useState<boolean>(() => {
    const saved = localStorage.getItem('manual-translation-show-speakers');
    return saved ? JSON.parse(saved) : true;
  });

  // How it works section state
  const [showInstructions, setShowInstructions] = useState<boolean>(() => {
    const saved = localStorage.getItem('manual-translation-show-instructions');
    return saved ? JSON.parse(saved) : true;
  });

  const [showInstructionsInPatientLanguage, setShowInstructionsInPatientLanguage] = useState<boolean>(false);

  // Ref for scroll area to auto-scroll to bottom
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Persist speaker settings
  useEffect(() => {
    localStorage.setItem('manual-translation-speaker-settings', JSON.stringify(speakerSettings));
  }, [speakerSettings]);

  // Persist translation history view toggle
  useEffect(() => {
    localStorage.setItem('manual-translation-history-view', JSON.stringify(showLastOnly));
  }, [showLastOnly]);

  // Persist display settings
  useEffect(() => {
    localStorage.setItem('manual-translation-show-metrics', JSON.stringify(showMetrics));
  }, [showMetrics]);

  useEffect(() => {
    localStorage.setItem('manual-translation-show-speakers', JSON.stringify(showSpeakers));
  }, [showSpeakers]);

  useEffect(() => {
    localStorage.setItem('manual-translation-show-instructions', JSON.stringify(showInstructions));
  }, [showInstructions]);

  const toggleSpeaker = (speaker: 'patient' | 'gp') => {
    setSpeakerSettings(prev => ({
      ...prev,
      [speaker]: !prev[speaker]
    }));
  };
  
  // Update selected language when initial props change
  useEffect(() => {
    if (initialLanguageCode && initialLanguageName) {
      setSelectedLanguage(initialLanguageCode);
      setSelectedLanguageName(initialLanguageName);
    }
  }, [initialLanguageCode, initialLanguageName]);
  
  const {
    isActive,
    currentSession,
    translations,
    isListening,
    isProcessing,
    error,
    startSession,
    endSession,
    clearSession,
    startListening,
    stopListening,
    sessionStats
  } = useManualTranslation();

  // Recalculate translation metrics when corrected
  const recalculateTranslationMetrics = useCallback(async (translationId: string, newToggleState: { textSwapped: boolean; speakerSwapped: boolean }) => {
    const translation = translations.find(t => t.id === translationId);
    if (!translation || !currentSession) return;

    try {
      console.log('🔄 Recalculating and retranslating for corrected translation:', translationId);
      setProcessingTranslations(prev => new Set(prev).add(translationId));
      
      if (!newToggleState.textSwapped) {
        console.log('No text swap needed, just updating display');
        setProcessingTranslations(prev => {
          const newSet = new Set(prev);
          newSet.delete(translationId);
          return newSet;
        });
        return;
      }

      // After correction: English text should be translated to patient's language
      const englishText = translation.originalText; // This was incorrectly detected as patient speech
      const targetLanguage = currentSession.targetLanguageCode; // Patient's chosen language
      
      console.log('Translating English to patient language:', { englishText, targetLanguage });

      // Call translation service to translate English to patient's language
      const { data, error } = await supabase.functions.invoke('manual-translation-service', {
        body: {
          text: englishText,
          sourceLanguage: 'English',
          targetLanguage: targetLanguage,
          isToEnglish: false
        }
      });

      if (error) throw error;

      // Update the translation entry with corrected data
      const updatedTranslation = {
        ...translation,
        speaker: newToggleState.speakerSwapped ? (translation.speaker === 'gp' ? 'patient' : 'gp') : translation.speaker,
        originalText: englishText, // GP's English text
        translatedText: data.translatedText, // Translated to patient's language
        originalLanguageDetected: 'English',
        targetLanguage: targetLanguage,
        translationAccuracy: data.accuracy,
        translationConfidence: data.confidence,
        safetyFlag: data.safetyFlag,
        medicalTermsDetected: data.medicalTermsCount > 0 ? ['medical terms detected'] : []
      };

      // Store the corrected translation locally
      setCorrectedTranslations(prev => ({
        ...prev,
        [translationId]: updatedTranslation
      }));

      console.log('✅ Translation completed successfully:', updatedTranslation);
      toast.success(`Corrected: English translated to ${currentSession.targetLanguageName}`);

    } catch (error) {
      console.error('❌ Failed to recalculate translation metrics:', error);
      toast.error('Failed to translate corrected text');
    } finally {
      setProcessingTranslations(prev => {
        const newSet = new Set(prev);
        newSet.delete(translationId);
        return newSet;
      });
    }
  }, [translations, currentSession]);

  const handleStartSession = async () => {
    console.log('🚀 Starting manual translation session:', { selectedLanguage, selectedLanguageName });
    
    if (!selectedLanguage || !selectedLanguageName) {
      toast.error('Please select a language first');
      return;
    }

    // Show consent dialog first
    setShowConsent(true);
  };

  const handleConsentGiven = async () => {
    console.log('✅ Consent given, starting session');
    setConsentGiven(true);
    setShowConsent(false);
    
    try {
      console.log('🔄 About to start session with:', { selectedLanguage, selectedLanguageName });
      await startSession(selectedLanguage, selectedLanguageName, true);
      console.log('✅ Session started successfully with auto-listening');
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      toast.error('Failed to start translation session');
    }
  };

  const handleConsentDeclined = () => {
    console.log('❌ Consent declined');
    setShowConsent(false);
    setConsentGiven(false);
    toast.error('Consent is required to use the translation service');
  };

  const handleEndSession = async () => {
    console.log('🛑 Ending manual translation session');
    try {  
      await endSession();
      console.log('✅ Session ended successfully');
    } catch (error) {
      console.error('❌ Failed to end session:', error);
    }
  };

  const handleReset = () => {
    console.log('🔄 Resetting manual translation session');
    if (isActive) {
      stopListening();
      clearSession();
    }
    
    // Reset all modal state completely
    setSelectedLanguage('');
    setSelectedLanguageName('');
    setTranslationToggles({});
    setCorrectedTranslations({});
    setProcessingTranslations(new Set());
    setShowConsent(false);
    setConsentGiven(false);
    
    console.log('✅ All manual translation state cleared');
    toast.success('Session cleared - ready for new translation');
  };

  const handleClose = () => {
    console.log('🚪 Closing modal and clearing all state');
    if (isActive) {
      stopListening();
      clearSession();
    }
    
    // Reset all modal state completely
    setSelectedLanguage('');
    setSelectedLanguageName('');
    setTranslationToggles({});
    setCorrectedTranslations({});
    setProcessingTranslations(new Set());
    setShowConsent(false);
    setConsentGiven(false);
    
    onClose();
  };

  const handleExport = async () => {
    if (translations.length === 0) {
      toast.error('No translations to export');
      return;
    }

    try {
      // Convert manual translations to the format expected by downloadDOCX
      // Use corrected translations when available
      const formattedTranslations = translations.map((translation) => {
        // Use corrected translation if it exists, otherwise use original
        const finalTranslation = correctedTranslations[translation.id] || translation;
        
        console.log(`Export: Translation ${translation.id}:`, {
          originalSpeaker: translation.speaker,
          correctedSpeaker: finalTranslation.speaker,
          hasCorrectedVersion: !!correctedTranslations[translation.id]
        });
        
        return {
          id: finalTranslation.id,
          originalText: finalTranslation.originalText,
          translatedText: finalTranslation.translatedText,
          originalLanguage: finalTranslation.originalLanguageDetected,
          targetLanguage: finalTranslation.targetLanguage,
          timestamp: finalTranslation.timestamp,
          speaker: finalTranslation.speaker, // This will now use the corrected speaker assignment
          accuracy: finalTranslation.translationAccuracy,
          confidence: finalTranslation.translationConfidence,
          safety: finalTranslation.safetyFlag,
          medicalTerms: finalTranslation.medicalTermsDetected,
          processingTime: finalTranslation.processingTimeMs,
          exchange_number: finalTranslation.exchangeNumber,
          original_text: finalTranslation.originalText,
          translated_text: finalTranslation.translatedText,
          original_language_detected: finalTranslation.originalLanguageDetected,
          target_language: finalTranslation.targetLanguage,
          detection_confidence: finalTranslation.detectionConfidence,
          translation_accuracy: finalTranslation.translationAccuracy,
          translation_confidence: finalTranslation.translationConfidence,
          safety_flag: finalTranslation.safetyFlag,
          medical_terms_detected: finalTranslation.medicalTermsDetected,
          processing_time_ms: finalTranslation.processingTimeMs,
          created_at: finalTranslation.timestamp.toISOString()
        };
      });

      console.log('📋 Exporting with corrected speaker assignments:', 
        formattedTranslations.map(t => ({ id: t.id, speaker: t.speaker }))
      );

      // Create session metadata
      const sessionStart = currentSession?.sessionStart || new Date();
      const sessionEnd = new Date();
      const safetyRating = (sessionStats?.safetyStatus === 'safe' || sessionStats?.safetyStatus === 'warning' || sessionStats?.safetyStatus === 'unsafe') 
        ? sessionStats.safetyStatus 
        : 'safe' as const;

      const metadata: SessionMetadata = {
        sessionDate: sessionStart,
        sessionStart: sessionStart,
        sessionEnd: sessionEnd,
        patientLanguage: selectedLanguageName || 'Unknown',
        totalTranslations: translations.length,
        sessionDuration: sessionStats?.duration || Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000),
        averageAccuracy: sessionStats?.averageAccuracy || Math.round(translations.reduce((sum, t) => sum + t.translationAccuracy, 0) / translations.length) || 0,
        averageConfidence: Math.round(translations.reduce((sum, t) => sum + t.translationConfidence, 0) / translations.length) || 0,
        overallSafetyRating: safetyRating
      };

      // Calculate translation scores for each entry
      const translationScores = formattedTranslations.map(translation => ({
        accuracy: translation.translation_accuracy,
        confidence: translation.translation_confidence,
        safetyFlag: translation.safety_flag,
        medicalTermsDetected: translation.medical_terms_detected,
        processingTime: translation.processing_time_ms,
        issues: [] // Manual translations don't have technical issues like AI processing
      }));

      await downloadDOCX(formattedTranslations, metadata, translationScores);
      toast.success('Manual translation session exported to Word document');
    } catch (error) {
      console.error('Failed to export manual translation:', error);
      toast.error('Failed to export session. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSafetyBadgeColor = (flag: string) => {
    switch (flag) {
      case 'safe': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'unsafe': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSafetyIcon = (flag: string) => {
    switch (flag) {
      case 'safe': return <CheckCircle className="h-3 w-3" />;
      case 'warning': return <AlertTriangle className="h-3 w-3" />;
      case 'unsafe': return <AlertTriangle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              Manual Translation Service
            </DialogTitle>
            <DialogDescription>
              Text-based translation with automatic language detection for GP-Patient communication
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="live-session" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="live-session" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Live Session
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live-session" className="flex-1 overflow-hidden flex gap-4 mt-4">
            {/* Consent Dialog */}
            {showConsent && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-lg">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Translation Service Consent
                  </h3>
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-muted-foreground">
                      Before starting the translation session, please confirm:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                      <li>• Patient has consented to translation assistance</li>
                      <li>• Sensitive medical information will be processed</li>
                      <li>• Translations are logged for quality assurance</li>
                      <li>• This is a medical professional consultation tool</li>
                    </ul>
                    <p className="text-sm font-medium">
                      Target Language: <span className="text-primary">{selectedLanguageName}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleConsentDeclined}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleConsentGiven}
                      className="flex-1"
                    >
                      I Consent & Start Session
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Left Panel - Controls */}
            <div className="w-80 flex flex-col gap-4">
              {/* Language Selection */}
              {!isActive && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Select Target Language</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedLanguage}
                      onValueChange={(value) => {
                        setSelectedLanguage(value);
                        const lang = MANUAL_TRANSLATION_LANGUAGES.find(l => l.code === value);
                        setSelectedLanguageName(lang?.name || '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose patient's language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_TRANSLATION_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            <span className="flex items-center gap-2">
                              <span>{language.flag}</span>
                              <span>{language.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleStartSession}
                      className="w-full mt-3"
                      disabled={!selectedLanguage}
                    >
                      Start Translation Session
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Session Controls */}
              {isActive && currentSession && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between text-green-800">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        Active Session
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 font-semibold">
                        English ↔ {currentSession.targetLanguageName}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Listening Controls */}
                    <div className="flex gap-2">
                      <Button
                        onClick={isListening ? stopListening : startListening}
                        variant={isListening ? "destructive" : "default"}
                        size="sm"
                        className="flex-1"
                        disabled={isProcessing}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="h-4 w-4 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-1" />
                            Start Listening
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Session Stats */}
                    {sessionStats && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-center p-2 bg-muted rounded">
                          <div className="font-semibold">{formatTime(sessionStats.duration)}</div>
                          <div className="text-xs text-muted-foreground">Duration</div>
                        </div>
                        <div className="text-center p-2 bg-muted rounded">
                          <div className="font-semibold">{sessionStats.exchangeCount}</div>
                          <div className="text-xs text-muted-foreground">Exchanges</div>
                        </div>
                        <div className="text-center p-2 bg-muted rounded">
                          <div className="font-semibold">{sessionStats.averageAccuracy}%</div>
                          <div className="text-xs text-muted-foreground">Accuracy</div>
                        </div>
                        <div className="text-center p-2 bg-muted rounded">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getSafetyBadgeColor(sessionStats.safetyStatus)}`}
                          >
                            {sessionStats.safetyStatus.toUpperCase()}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">Safety</div>
                        </div>
                      </div>
                    )}

                    {/* Audio Settings moved to main settings cog - removed from here as requested */}


                    {/* Session Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleEndSession}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        End Session
                      </Button>
                      {translations.length > 0 && (
                        <Button
                          onClick={handleExport}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Instructions */}
              <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">How It Works</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowInstructionsInPatientLanguage(!showInstructionsInPatientLanguage);
                            }}
                            title={`Show in ${showInstructionsInPatientLanguage ? 'English' : selectedLanguageName || 'patient language'}`}
                          >
                            <Languages className="h-3 w-3" />
                          </Button>
                          {showInstructions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="text-sm space-y-2">
                      {showInstructionsInPatientLanguage && selectedLanguage ? (
                        // Instructions in patient's language (translated)
                        <>
                          {(() => {
                            const getInstructions = (languageCode: string, languageName: string) => {
                              const instructions = {
                                ar: [ // Arabic
                                  'الطبيب يتحدث بالإنجليزية ← سيتم ترجمة كلماتك إلى العربية',
                                  'كلماتك بالعربية ← سيتم ترجمتها إلى الإنجليزية',
                                  'اكتشاف اللغة التلقائي وتحديد المتحدث',
                                  'تشغيل النص المترجم صوتياً'
                                ],
                                zh: [ // Chinese
                                  '医生用英语讲话 ← 您的话将被翻译成中文',
                                  '您用中文说的话 ← 将被翻译成英语',
                                  '自动语言检测和说话人识别',
                                  '翻译文本的语音播放'
                                ],
                                fr: [ // French
                                  'Le médecin parle en anglais ← Vos mots seront traduits en français',
                                  'Vos mots en français ← Seront traduits en anglais',
                                  'Détection automatique de la langue et identification du locuteur',
                                  'Lecture vocale du texte traduit'
                                ],
                                de: [ // German
                                  'Arzt spricht auf Englisch ← Ihre Worte werden ins Deutsche übersetzt',
                                  'Ihre Worte auf Deutsch ← Werden ins Englische übersetzt',
                                  'Automatische Spracherkennung und Sprecheridentifikation',
                                  'Sprachausgabe für übersetzten Text'
                                ],
                                hi: [ // Hindi
                                  'डॉक्टर अंग्रेजी में बोलते हैं ← आपके शब्दों का हिंदी में अनुवाद होगा',
                                  'आपके हिंदी के शब्द ← अंग्रेजी में अनुवादित होंगे',
                                  'स्वचालित भाषा पहचान और वक्ता पहचान',
                                  'अनुवादित पाठ के लिए टेक्स्ट-टू-स्पीच'
                                ],
                                it: [ // Italian
                                  'Il medico parla in inglese ← Le tue parole saranno tradotte in italiano',
                                  'Le tue parole in italiano ← Saranno tradotte in inglese',
                                  'Rilevamento automatico della lingua e identificazione del parlante',
                                  'Riproduzione vocale del testo tradotto'
                                ],
                                es: [ // Spanish
                                  'El médico habla en inglés ← Tus palabras serán traducidas al español',
                                  'Tus palabras en español ← Serán traducidas al inglés',
                                  'Detección automática de idioma e identificación del hablante',
                                  'Reproducción de voz para texto traducido'
                                ],
                                nl: [ // Dutch
                                  'Arts spreekt in het Engels ← Uw woorden worden vertaald naar het Nederlands',
                                  'Uw woorden in het Nederlands ← Worden vertaald naar het Engels',
                                  'Automatische taalherkenning en sprekeridentificatie',
                                  'Tekst-naar-spraak voor vertaalde tekst'
                                ],
                                pt: [ // Portuguese
                                  'O médico fala em inglês ← Suas palavras serão traduzidas para português',
                                  'Suas palavras em português ← Serão traduzidas para inglês',
                                  'Detecção automática de idioma e identificação do falante',
                                  'Reprodução de voz para texto traduzido'
                                ],
                                ru: [ // Russian
                                  'Врач говорит по-английски ← Ваши слова будут переведены на русский',
                                  'Ваши слова на русском ← Будут переведены на английский',
                                  'Автоматическое определение языка и идентификация говорящего',
                                  'Озвучивание переведённого текста'
                                ],
                                ja: [ // Japanese
                                  '医師は英語で話します ← あなたの言葉は日本語に翻訳されます',
                                  'あなたの日本語の言葉 ← 英語に翻訳されます',
                                  '自動言語検出と話者識別',
                                  '翻訳されたテキストの音声再生'
                                ],
                                ko: [ // Korean
                                  '의사가 영어로 말합니다 ← 당신의 말이 한국어로 번역됩니다',
                                  '당신의 한국어 말 ← 영어로 번역됩니다',
                                  '자동 언어 감지 및 화자 식별',
                                  '번역된 텍스트의 음성 재생'
                                ],
                                pl: [ // Polish
                                  'Lekarz mówi po angielsku ← Twoje słowa będą przetłumaczone na polski',
                                  'Twoje słowa po polsku ← Będą przetłumaczone na angielski',
                                  'Automatyczne wykrywanie języka i identyfikacja mówcy',
                                  'Odtwarzanie głosowe przetłumaczonego tekstu'
                                ],
                                tr: [ // Turkish
                                  'Doktor İngilizce konuşuyor ← Sözleriniz Türkçeye çevrilecek',
                                  'Türkçe sözleriniz ← İngilizceye çevrilecek',
                                  'Otomatik dil algılama ve konuşmacı tanımlama',
                                  'Çevrilmiş metin için sesli okuma'
                                ],
                                uk: [ // Ukrainian
                                  'Лікар говорить англійською ← Ваші слова будуть перекладені українською',
                                  'Ваші слова українською ← Будуть перекладені англійською',
                                  'Автоматичне виявлення мови та ідентифікація мовця',
                                  'Голосове відтворення перекладеного тексту'
                                ],
                                vi: [ // Vietnamese
                                  'Bác sĩ nói tiếng Anh ← Lời nói của bạn sẽ được dịch sang tiếng Việt',
                                  'Lời nói tiếng Việt của bạn ← Sẽ được dịch sang tiếng Anh',
                                  'Tự động phát hiện ngôn ngữ và nhận dạng người nói',
                                  'Phát âm cho văn bản đã dịch'
                                ]
                              };
                              
                              return instructions[languageCode] || [
                                `GP speaks in English → Your words will be translated to ${languageName}`,
                                `Your words in ${languageName} → Will be translated to English`,
                                'Automatic language detection and speaker identification',
                                'Text-to-speech playback for translated text'
                              ];
                            };

                            const translatedInstructions = getInstructions(selectedLanguage, selectedLanguageName);
                            
                            return translatedInstructions.map((instruction, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">
                                  {index + 1}
                                </div>
                                <div>{instruction}</div>
                              </div>
                            ));
                          })()}
                        </>
                      ) : (
                        // Instructions in English (default)
                        <>
                          <div className="flex items-start gap-2">
                            <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                            <div>GP speaks in English → Words will be translated to patient language</div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                            <div>Patient speaks in their language → Words will be translated to English</div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                            <div>Automatic language detection and speaker identification</div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                            <div>Text-to-speech playbook for translated text</div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>

            {/* Right Panel - Translation History */}
            <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">Translation History</h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0 border-primary/20 hover:border-primary/40"
                      title="Translation display settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 z-[60] bg-background border shadow-lg" align="start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Display Settings</h4>
                        <p className="text-sm text-muted-foreground">
                          Configure how translations are displayed
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {showLastOnly ? 'Show Last Translation Only' : 'Show Full History'}
                            </span>
                          </div>
                          <Switch
                            id="manual-history-toggle"
                            checked={showLastOnly}
                            onCheckedChange={setShowLastOnly}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Show Play Buttons</span>
                          </div>
                          <Switch
                            id="show-speakers-toggle"
                            checked={showSpeakers}
                            onCheckedChange={setShowSpeakers}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Show Accuracy & Metrics</span>
                          </div>
                          <Switch
                            id="show-metrics-toggle"
                            checked={showMetrics}
                            onCheckedChange={setShowMetrics}
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Processing Status - moved inline with heading */}
                {isProcessing && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 animate-spin" />
                    <span>Processing translation...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {translations.length > 0 && (
                  <>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="sm"
                      className="h-8"
                      title="Clear session and start fresh"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Badge variant="outline">{translations.length} exchanges</Badge>
                  </>
                )}
              </div>
            </div>

              <ScrollArea ref={scrollAreaRef} className="flex-1 border rounded-lg">
                <div className="p-4 space-y-3">
                  {translations.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <div>No translations yet</div>
                      <div className="text-sm">Start speaking to begin translation</div>
                    </div>
                   ) : (
                     (() => {
                       const reversedTranslations = [...translations].reverse();
                       const displayedTranslations = showLastOnly && reversedTranslations.length > 0 
                         ? [reversedTranslations[0]] 
                         : reversedTranslations;
                       
                       return displayedTranslations.map((translation) => {
                         // Use corrected translation if available, otherwise use original
                         const finalTranslation = correctedTranslations[translation.id] || translation;
                         const toggleState = translationToggles[translation.id] || { textSwapped: false, speakerSwapped: false };
                         const displaySpeaker = finalTranslation.speaker;
                         
                         return (
                         <div
                           key={finalTranslation.id}
                           className={`p-3 rounded-lg border-l-4 ${
                             displaySpeaker === 'gp'
                               ? 'bg-blue-50 border-l-blue-500'
                               : 'bg-green-50 border-l-green-500'
                           }`}
                         >
                           <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {displaySpeaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                                </span>
                               <Badge 
                                 variant="outline" 
                                 className={`text-xs ${getSafetyBadgeColor(finalTranslation.safetyFlag)}`}
                               >
                                 {getSafetyIcon(finalTranslation.safetyFlag)}
                                 {finalTranslation.safetyFlag}
                               </Badge>
                               {correctedTranslations[translation.id] && (
                                 <Badge variant="secondary" className="text-xs">
                                   Corrected
                                 </Badge>
                               )}
                             </div>
                             <div className="flex items-center gap-2">
                               {/* Toggle Button */}
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className={`h-6 w-6 p-0 ${processingTranslations.has(translation.id) ? 'opacity-50 cursor-not-allowed' : ''} ${correctedTranslations[translation.id] ? 'bg-secondary' : ''}`}
                                 onClick={async () => {
                                   if (processingTranslations.has(translation.id)) return;
                                   
                                   // Calculate new toggle state
                                   const currentToggle = translationToggles[translation.id] || { textSwapped: false, speakerSwapped: false };
                                   const newToggleState = {
                                     textSwapped: !currentToggle.textSwapped,
                                     speakerSwapped: !currentToggle.speakerSwapped
                                   };
                                   
                                   // Update toggle state
                                   setTranslationToggles(prev => ({
                                     ...prev,
                                     [translation.id]: newToggleState
                                   }));
                                   
                                   // Pass the new state directly to avoid async state issues
                                   await recalculateTranslationMetrics(translation.id, newToggleState);
                                 }}
                                 disabled={processingTranslations.has(translation.id)}
                                 title={
                                   processingTranslations.has(translation.id) 
                                     ? "Processing correction..." 
                                     : correctedTranslations[translation.id]
                                       ? "Translation corrected"
                                       : "Correct language detection (swap text and speaker)"
                                 }
                               >
                                 {processingTranslations.has(translation.id) ? (
                                   <Clock className="h-3 w-3 animate-spin" />
                                 ) : (
                                   <ArrowUpDown className="h-3 w-3" />
                                 )}
                               </Button>
                               <div className="text-xs text-muted-foreground">
                                 {translation.timestamp.toLocaleTimeString('en-GB', { 
                                   hour: '2-digit', 
                                   minute: '2-digit' 
                                 })}
                               </div>
                             </div>
                           </div>
 
                           <div className="space-y-2">
                             <div>
                               <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                 Original ({finalTranslation.originalLanguageDetected})
                               </div>
                               <div className="text-sm">{finalTranslation.originalText}</div>
                             </div>
                             
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                  All translations will be shown here in {currentSession?.targetLanguageName || finalTranslation.targetLanguage}
                                </div>
                               <div className="text-sm font-medium">{finalTranslation.translatedText}</div>
                               
                               {/* TTS Button */}
                               {showSpeakers && 'speechSynthesis' in window && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-6 px-2 mt-1"
                                   onClick={() => {
                                     const utterance = new SpeechSynthesisUtterance(finalTranslation.translatedText);
                                     utterance.lang = finalTranslation.targetLanguage;
                                     utterance.rate = 0.9;
                                     speechSynthesis.speak(utterance);
                                   }}
                                 >
                                   <Volume2 className="h-3 w-3 mr-1" />
                                   Play
                                 </Button>
                               )}
                             </div>

                           {showMetrics && (
                             <div className="flex items-center justify-between text-xs text-muted-foreground">
                               <span>Accuracy: {finalTranslation.translationAccuracy}%</span>
                               <span>Confidence: {finalTranslation.translationConfidence}%</span>
                               <span>{finalTranslation.processingTimeMs}ms</span>
                             </div>
                           )}

                           {finalTranslation.medicalTermsDetected.length > 0 && (
                             <div className="text-xs">
                               <span className="text-muted-foreground">Medical terms: </span>
                               <span className="text-primary font-medium">
                                 {finalTranslation.medicalTermsDetected.join(', ')}
                               </span>
                             </div>
                           )}
                         </div>
                        </div>
                       );
                     });
                   })()
                 )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-4">
            <ManualTranslationHistory />
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};