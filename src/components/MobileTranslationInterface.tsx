import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Volume2, Mic, Languages, Square, Maximize2 } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsentModal } from '@/components/ConsentModal';
import { useManualTranslation } from '@/hooks/useManualTranslation';

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
    stopListening
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

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
                        lang.code !== 'none' && lang.manualTranslationOnly
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
                
                <div className="flex gap-4 justify-center">
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
                  
                  <Button
                    onClick={handleEndSession}
                    size="lg"
                    variant="outline"
                    className="h-14 px-8"
                  >
                    End Session
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
              </div>
            )}
          </div>
        </div>

        {/* Translation History */}
        {isActive && translations.length > 0 && (
          <div className="flex-1 overflow-hidden">
            <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
              <h3 className="font-medium">Translation History</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullScreen(true)}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
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
                    <div className="font-medium text-sm">
                      {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {translation.safetyFlag !== 'safe' && (
                      <div className={`text-xs px-2 py-1 rounded ${
                        translation.safetyFlag === 'warning' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {translation.safetyFlag.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Original:</span> {translation.originalText}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Translation:</span> {translation.translatedText}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Accuracy: {translation.translationAccuracy}% | Confidence: {translation.translationConfidence}%
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
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              Translation History - Full Screen View
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
                    <div className="font-semibold text-lg">
                      {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {translation.safetyFlag !== 'safe' && (
                      <div className={`text-sm px-3 py-1 rounded ${
                        translation.safetyFlag === 'warning' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {translation.safetyFlag.toUpperCase()}
                      </div>
                    )}
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