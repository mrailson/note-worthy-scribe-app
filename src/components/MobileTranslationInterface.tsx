import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Volume2, Mic, Languages, Square, Maximize2, Download, FileText, Mail, User, MicOff, Settings, ArrowLeft, Home, ChevronDown, ChevronUp, LayoutList, Layout } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsentModal } from '@/components/ConsentModal';
import { useManualTranslation } from '@/hooks/useManualTranslation';
import { downloadManualTranslationDOCX } from '@/utils/manualTranslationDocxExport';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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
  const deviceInfo = useDeviceInfo();
  const navigate = useNavigate();
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<{code: string, name: string} | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'single'>('timeline');
  
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
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-background to-muted flex flex-col",
      deviceInfo.isIPhone ? "p-2 pb-safe" : "p-4"
    )}>
      <Card className={cn(
        "flex-1 flex flex-col w-full",
        deviceInfo.isIPhone ? "max-w-full" : "max-w-2xl mx-auto"
      )}>
        <div className={cn(
          "bg-background transition-all duration-300",
          deviceInfo.isIPhone ? "sticky top-0 z-10 border-b" : "p-6",
          deviceInfo.isIPhone && (isHeaderCollapsed ? "p-2" : "p-4")
        )}>
          {deviceInfo.isIPhone && (
            <div className={cn(
              "flex items-center justify-between",
              isHeaderCollapsed ? "mb-0" : "mb-3"
            )}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {!isHeaderCollapsed && "Home"}
              </Button>
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                  className="flex items-center gap-1"
                >
                  {isHeaderCollapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span className="text-xs">Expand</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span className="text-xs">Collapse</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
          
          {!isHeaderCollapsed && (
          <div className="text-center space-y-4">
            <div className={cn(
              "flex items-center justify-center gap-2 font-bold text-primary",
              deviceInfo.isIPhone ? "text-xl" : "text-2xl"
            )}>
              <Languages className={cn(deviceInfo.isIPhone ? "w-6 h-6" : "w-8 h-8")} />
              {deviceInfo.isIPhone ? "Translation" : "Manual Translation Service"}
            </div>
            
            {!isActive ? (
              <>
                <div className="space-y-4">
                  <div className={cn(
                    "font-medium",
                    deviceInfo.isIPhone ? "text-base" : "text-lg"
                  )}>Select Patient Language to Begin</div>
                  <Select value={selectedLanguage} onValueChange={handleLanguageSelect}>
                    <SelectTrigger className={cn(
                      "text-lg",
                      deviceInfo.isIPhone ? "h-14" : "h-12"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTHCARE_LANGUAGES.filter(lang => 
                        lang.code !== 'none'
                      ).map((lang) => (
                        <SelectItem 
                          key={lang.code} 
                          value={lang.code} 
                          className={cn(
                            deviceInfo.isIPhone ? "text-base py-3" : "text-lg"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(deviceInfo.isIPhone ? "text-2xl" : "text-xl")}>{lang.flag}</span>
                            <span>{lang.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className={cn(
                    "text-muted-foreground text-center",
                    deviceInfo.isIPhone ? "text-xs" : "text-sm"
                  )}>
                    Selecting a language will start the translation session
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {currentSession && (
                  <div className="text-center space-y-2">
                    <div className={cn(
                      "font-medium text-primary",
                      deviceInfo.isIPhone ? "text-base" : "text-lg"
                    )}>
                      Active Session: {currentSession.targetLanguageName}
                    </div>
                    {currentSession.consentGiven && (
                      <div className={cn(
                        "text-green-600 bg-green-50 rounded-lg p-2",
                        deviceInfo.isIPhone ? "text-xs" : "text-sm"
                      )}>
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
                    className={cn(
                      "flex items-center gap-2",
                      deviceInfo.isIPhone ? "h-16 px-10 text-lg" : "h-14 px-8"
                    )}
                  >
                    {isListening ? (
                      <>
                        <Square className={cn(deviceInfo.isIPhone ? "w-7 h-7" : "w-6 h-6")} />
                        Stop Listening
                      </>
                    ) : (
                      <>
                        <Mic className={cn(deviceInfo.isIPhone ? "w-7 h-7" : "w-6 h-6")} />
                        Start Listening
                      </>
                    )}
                  </Button>
                </div>
                
                {deviceInfo.isIPhone && (
                  <div className="flex justify-center">
                    <Button
                      onClick={handleEndSession}
                      variant="outline"
                      className="h-12 px-8 text-base"
                    >
                      End Session
                    </Button>
                  </div>
                )}
                
                {isProcessing && (
                  <div className={cn(
                    "text-center text-muted-foreground",
                    deviceInfo.isIPhone ? "text-xs" : "text-sm"
                  )}>
                    Processing translation...
                  </div>
                )}
                
                {error && (
                  <div className={cn(
                    "text-center text-red-600 bg-red-50 rounded-lg p-2",
                    deviceInfo.isIPhone ? "text-xs" : "text-sm"
                  )}>
                    {error}
                  </div>
                )}
                
                <div className={cn(
                  "text-center text-muted-foreground",
                  deviceInfo.isIPhone ? "text-[10px]" : "text-xs"
                )}>
                  Using: {transcriptionService === 'deepgram' ? 'Deepgram (High Accuracy)' : 'Browser Speech (Fast)'}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Translation History */}
        {isActive && translations.length > 0 && (
          <div className="flex-1 overflow-hidden">
            <div className={cn(
              "border-b bg-muted/50 flex items-center justify-between",
              deviceInfo.isIPhone ? "p-3" : "p-4"
            )}>
              <h3 className={cn(
                "font-medium",
                deviceInfo.isIPhone ? "text-sm" : "text-base"
              )}>
                {viewMode === 'timeline' ? 'Translation History' : 'Current Translation'}
              </h3>
              <div className="flex items-center gap-2">
                {deviceInfo.isIPhone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'timeline' ? 'single' : 'timeline')}
                    className="h-10 w-10 p-0"
                    title={viewMode === 'timeline' ? 'Single translation view' : 'Timeline view'}
                  >
                    {viewMode === 'timeline' ? (
                      <Layout className="h-5 w-5" />
                    ) : (
                      <LayoutList className="h-5 w-5" />
                    )}
                  </Button>
                )}
                {!deviceInfo.isIPhone && (
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
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className={cn(
                    "p-0",
                    deviceInfo.isIPhone ? "h-10 w-10" : "h-8 w-8"
                  )}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? (
                    <MicOff className={cn(deviceInfo.isIPhone ? "h-5 w-5" : "h-4 w-4")} />
                  ) : (
                    <Mic className={cn(deviceInfo.isIPhone ? "h-5 w-5" : "h-4 w-4")} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadWord}
                  className={cn(
                    "p-0",
                    deviceInfo.isIPhone ? "h-10 w-10" : "h-8 w-8"
                  )}
                  title="Download as Word document"
                >
                  <Download className={cn(deviceInfo.isIPhone ? "h-5 w-5" : "h-4 w-4")} />
                </Button>
                {!deviceInfo.isIPhone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullScreen(true)}
                    className="h-8 w-8 p-0"
                    title="View full screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div 
              ref={scrollRef} 
              className={cn(
                "flex-1 overflow-y-auto",
                deviceInfo.isIPhone ? "p-3" : "p-4",
                viewMode === 'single' && "flex items-center justify-center"
              )}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {viewMode === 'timeline' ? (
                // Timeline view - show all translations
                <div className="space-y-4">
                  {translations.map((translation, index) => (
                    <div
                      key={index}
                      className={cn(
                        "rounded-lg touch-manipulation",
                        deviceInfo.isIPhone ? "p-3" : "p-4",
                        translation.speaker === 'gp' 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'bg-green-50 border-l-4 border-green-500'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <button 
                          className={cn(
                            "font-medium hover:bg-muted rounded px-2 py-1 transition-colors cursor-pointer touch-manipulation",
                            deviceInfo.isIPhone ? "text-xs min-h-[32px]" : "text-sm"
                          )}
                          onClick={() => handleSpeakerChange(index, translation.speaker === 'gp' ? 'patient' : 'gp')}
                          title="Click to change speaker and retranslate"
                        >
                          {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} ✏️
                        </button>
                        <div className={cn(
                          "text-muted-foreground",
                          deviceInfo.isIPhone ? "text-[10px]" : "text-xs"
                        )}>
                          {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className={cn(deviceInfo.isIPhone ? "text-xs" : "text-sm")}>
                          <span className="font-medium">Original:</span> {translation.originalText}
                        </div>
                        <div className={cn(deviceInfo.isIPhone ? "text-xs" : "text-sm")}>
                          <span className="font-medium">Translation:</span> {translation.translatedText}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Single translation view - show only the latest translation
                translations.length > 0 && (
                  <div className="w-full max-w-lg">
                    <div
                      className={cn(
                        "rounded-xl p-6 shadow-lg",
                        translations[translations.length - 1].speaker === 'gp' 
                          ? 'bg-blue-50 border-2 border-blue-500' 
                          : 'bg-green-50 border-2 border-green-500'
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <button 
                          className="font-medium text-lg hover:bg-muted rounded px-3 py-2 transition-colors cursor-pointer touch-manipulation"
                          onClick={() => handleSpeakerChange(translations.length - 1, translations[translations.length - 1].speaker === 'gp' ? 'patient' : 'gp')}
                          title="Click to change speaker and retranslate"
                        >
                          {translations[translations.length - 1].speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} ✏️
                        </button>
                        <div className="text-sm text-muted-foreground">
                          {translations[translations.length - 1].timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="text-base">
                          <div className="font-semibold mb-2 text-muted-foreground">Original:</div>
                          <div className="text-lg">{translations[translations.length - 1].originalText}</div>
                        </div>
                        <div className="border-t pt-4">
                          <div className="font-semibold mb-2 text-muted-foreground">Translation:</div>
                          <div className="text-lg font-medium">{translations[translations.length - 1].translatedText}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center mt-4 text-sm text-muted-foreground">
                      Translation {translations.length} of {translations.length}
                    </div>
                  </div>
                )
              )}
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