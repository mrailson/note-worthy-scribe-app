import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Volume2, Mic, Languages, Square, Maximize2, Download, FileText, Mail, User, MicOff, Settings } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsentModal } from '@/components/ConsentModal';
import { useManualTranslation } from '@/hooks/useManualTranslation';
import { downloadManualTranslationDOCX } from '@/utils/manualTranslationDocxExport';

interface TranslationEntry {
  id: string;
  speaker: 'staff' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

export const MobileTranslationInterface = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<{code: string, name: string} | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Use the manual translation hook
  const {
    isActive,
    isListening,
    currentSession,
    translations,
    isProcessing,
    error,
    startSession,
    endSession,
    clearSession,
    startListening,
    stopListening,
    updateTranslation,
    transcriptionService,
    switchTranscriptionService
  } = useManualTranslation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedLang = HEALTHCARE_LANGUAGES.find(lang => lang.code === selectedLanguage);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [translations]);

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    
    // Auto-start session flow
    const lang = HEALTHCARE_LANGUAGES.find(l => l.code === languageCode);
    if (lang) {
      setPendingLanguage({
        code: lang.code,
        name: lang.name
      });
      setShowConsentModal(true);
    }
  };

  const handleConsentGiven = async () => {
    if (!pendingLanguage) return;
    
    setShowConsentModal(false);
    try {
      await startSession(pendingLanguage.code, pendingLanguage.name, true);
      // Start listening immediately on user gesture; startSession also has a fallback auto-start
      await startListening();
      toast.success(`Translation session started with consent for ${pendingLanguage.name}`);
    } catch (error) {
      toast.error('Failed to start translation session');
      console.error('Error starting session:', error);
    }
    setPendingLanguage(null);
  };

  const handleConsentDenied = () => {
    setShowConsentModal(false);
    setPendingLanguage(null);
    toast.info('Translation session cancelled - consent not given');
  };

  const handleEndSession = async () => {
    try {
      await endSession();
      toast.success('Translation session ended');
    } catch (error) {
      toast.error('Error ending session');
      console.error('Error ending session:', error);
    }
  };

  const handleDownloadWord = async () => {
    if (!currentSession || translations.length === 0) {
      toast.error('No translation data available');
      return;
    }

    try {
      const sessionDuration = currentSession.sessionStart ? 
        Math.floor((new Date().getTime() - currentSession.sessionStart.getTime()) / 1000) : 0;

      const translationEntries = translations.map((t, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        exchangeNumber: index + 1,
        speaker: t.speaker,
        originalText: t.originalText,
        translatedText: t.translatedText,
        originalLanguageDetected: 'en',
        targetLanguage: currentSession.targetLanguageCode,
        detectionConfidence: 95,
        translationAccuracy: t.translationAccuracy || 95,
        translationConfidence: t.translationConfidence || 90,
        safetyFlag: t.safetyFlag || 'safe',
        medicalTermsDetected: [],
        processingTimeMs: 1000,
        timestamp: t.timestamp
      }));

      const session = {
        id: Math.random().toString(36).substr(2, 9),
        sessionTitle: `Translation Session - ${currentSession.targetLanguageName}`,
        targetLanguageCode: currentSession.targetLanguageCode,
        targetLanguageName: currentSession.targetLanguageName,
        totalExchanges: translations.length,
        sessionDurationSeconds: sessionDuration,
        averageAccuracy: 95,
        averageConfidence: 90,
        overallSafetyRating: 'safe' as const,
        sessionStart: currentSession.sessionStart || new Date(),
        sessionEnd: new Date(),
        isCompleted: true,
        entries: translationEntries
      };

      await downloadManualTranslationDOCX(session, translationEntries);
      toast.success('Translation document downloaded successfully');
    } catch (error) {
      toast.error('Failed to download document');
      console.error('Error downloading document:', error);
    }
  };

  const handleEmailToMe = () => {
    toast.info('Email to practitioner feature coming soon');
  };

  const handleEmailToPatient = () => {
    toast.info('Email to patient feature coming soon');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopListening();
      toast.info('Microphone muted');
    } else {
      startListening();
      toast.info('Microphone unmuted');
    }
  };

  const handleSpeakerChange = async (translationIndex: number, newSpeaker: 'gp' | 'patient') => {
    if (!currentSession) return;
    
    const translation = translations[translationIndex];
    if (!translation) return;

    try {
      // Determine new translation direction based on new speaker
      const sourceLanguage = newSpeaker === 'gp' ? 'en' : currentSession.targetLanguageCode;
      const targetLanguage = newSpeaker === 'gp' ? currentSession.targetLanguageCode : 'en';
      
      // Only retranslate if direction changed
      let newTranslatedText = translation.translatedText;
      if (sourceLanguage !== translation.originalLanguageDetected || 
          targetLanguage !== translation.targetLanguage) {
        
        toast.info('Retranslating with corrected speaker...');
        
        const { data, error } = await supabase.functions.invoke('manual-translation-service', {
          body: {
            text: translation.originalText,
            targetLanguage,
            sourceLanguage
          }
        });

        if (error) throw error;
        newTranslatedText = data.translatedText;
      }

      // Update the translation in state
      updateTranslation(translationIndex, {
        speaker: newSpeaker,
        translatedText: newTranslatedText,
        originalLanguageDetected: sourceLanguage,
        targetLanguage: targetLanguage
      });

      // Update in database
      await supabase
        .from('manual_translation_entries')
        .update({
          speaker: newSpeaker,
          translated_text: newTranslatedText,
          original_language_detected: sourceLanguage,
          target_language: targetLanguage
        })
        .eq('session_id', currentSession.id)
        .eq('exchange_number', translation.exchangeNumber);

      toast.success(`Speaker changed to ${newSpeaker === 'gp' ? 'GP' : 'Patient'}`);
    } catch (error) {
      console.error('Error changing speaker:', error);
      toast.error('Failed to change speaker');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex flex-col">
      <Card className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        <div className="p-6 bg-background">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
              <Languages className="w-8 h-8" />
              Manual Translation Service
            </div>
            
            {!isActive ? (
              <>
                <div className="space-y-4">
                  <div className="text-lg font-medium">Select Patient Language to Begin</div>
                  <Select value={selectedLanguage} onValueChange={handleLanguageSelect}>
                    <SelectTrigger className="text-lg h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTHCARE_LANGUAGES.filter(lang => 
                        lang.code !== 'none'
                      ).map((lang) => (
                        <SelectItem key={lang.code} value={lang.code} className="text-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{lang.flag}</span>
                            <span>{lang.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground text-center">
                    Selecting a language will start the translation session
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {currentSession && (
                  <div className="text-center space-y-2">
                    <div className="text-lg font-medium text-primary">
                      Active Session: {currentSession.targetLanguageName}
                    </div>
                    {currentSession.consentGiven && (
                      <div className="text-sm text-green-600 bg-green-50 rounded-lg p-2">
                        ✓ Patient consent obtained at {currentSession.consentTimestamp?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-center">
                  <Button
                    onClick={toggleListening}
                    size="lg"
                    variant={isListening ? "destructive" : "default"}
                    className="flex items-center gap-2 h-14 px-8"
                  >
                    {isListening ? (
                      <>
                        <Square className="w-6 h-6" />
                        Stop Listening
                      </>
                    ) : (
                      <>
                        <Mic className="w-6 h-6" />
                        Start Listening
                      </>
                    )}
                  </Button>
                </div>
                
                {isProcessing && (
                  <div className="text-center text-sm text-muted-foreground">
                    Processing translation...
                  </div>
                )}
                
                {error && (
                  <div className="text-center text-sm text-red-600 bg-red-50 rounded-lg p-2">
                    {error}
                  </div>
                )}
                
                <div className="text-center text-xs text-muted-foreground">
                  Using: {transcriptionService === 'deepgram' ? 'Deepgram (High Accuracy)' : 'Browser Speech (Fast)'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Translation History */}
        {isActive && translations.length > 0 && (
          <div className="flex-1 overflow-hidden">
            <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
              <h3 className="font-medium">Translation History</h3>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Transcription service settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => switchTranscriptionService('browser')}
                      className={transcriptionService === 'browser' ? 'bg-accent' : ''}
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      Browser Speech {transcriptionService === 'browser' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => switchTranscriptionService('deepgram')}
                      className={transcriptionService === 'deepgram' ? 'bg-accent' : ''}
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Deepgram (Better Accuracy) {transcriptionService === 'deepgram' && '✓'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="h-8 w-8 p-0"
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadWord}
                  className="h-8 w-8 p-0"
                  title="Download as Word document"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullScreen(true)}
                  className="h-8 w-8 p-0"
                  title="View full screen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {translations.map((translation, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    translation.speaker === 'gp' 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <button 
                      className="font-medium text-sm hover:bg-muted rounded px-2 py-1 transition-colors cursor-pointer"
                      onClick={() => handleSpeakerChange(index, translation.speaker === 'gp' ? 'patient' : 'gp')}
                      title="Click to change speaker and retranslate"
                    >
                      {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} ✏️
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Original:</span> {translation.originalText}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Translation:</span> {translation.translatedText}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Consent Modal */}
      <ConsentModal
        open={showConsentModal}
        onConsentGiven={handleConsentGiven}
        onConsentDenied={handleConsentDenied}
        languageCode={pendingLanguage?.code || ''}
        languageName={pendingLanguage?.name || ''}
      />

      {/* Full Screen Translation History Modal */}
      <Dialog open={showFullScreen} onOpenChange={setShowFullScreen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                Translation History - Full Screen View
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadWord}>
                    <FileText className="mr-2 h-4 w-4" />
                    Download as Word
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEmailToMe}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email to Me
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEmailToPatient}>
                    <User className="mr-2 h-4 w-4" />
                    Email to Patient
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {translations.map((translation, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-lg ${
                    translation.speaker === 'gp' 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <button 
                      className="font-semibold text-lg hover:bg-muted rounded px-2 py-1 transition-colors cursor-pointer"
                      onClick={() => handleSpeakerChange(index, translation.speaker === 'gp' ? 'patient' : 'gp')}
                      title="Click to change speaker and retranslate"
                    >
                      {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} ✏️
                    </button>
                    <div className="text-sm text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="text-lg">
                      <span className="font-semibold">Original:</span> 
                      <div className="mt-2 text-foreground leading-relaxed">{translation.originalText}</div>
                    </div>
                    <div className="text-lg">
                      <span className="font-semibold">Translation:</span>
                      <div className="mt-2 text-foreground leading-relaxed">{translation.translatedText}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Accuracy: {translation.translationAccuracy}% | Confidence: {translation.translationConfidence}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};