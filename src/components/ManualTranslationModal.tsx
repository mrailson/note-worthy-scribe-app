import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Users,
  FileText
} from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { useManualTranslation } from '@/hooks/useManualTranslation';
import { toast } from 'sonner';

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

  const handleStartSession = async () => {
    console.log('🚀 Starting manual translation session:', { selectedLanguage, selectedLanguageName });
    
    if (!selectedLanguage || !selectedLanguageName) {
      toast.error('Please select a language first');
      return;
    }

    try {
      await startSession(selectedLanguage, selectedLanguageName);
      console.log('✅ Session started successfully');
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      toast.error('Failed to start translation session');
    }
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

  const handleClose = () => {
    if (isActive) {
      stopListening();
      clearSession();
    }
    onClose();
  };

  const handleExport = () => {
    if (currentSession && onExportSession) {
      onExportSession(currentSession);
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
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                Manual Translation Service
              </DialogTitle>
              <DialogDescription>
                Text-based translation with automatic language detection for GP-Patient communication
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
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
            {isActive && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Active Session
                    {selectedLanguageName && (
                      <Badge variant="secondary">{selectedLanguageName}</Badge>
                    )}
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

                  {/* Processing Status */}
                  {isProcessing && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Processing translation...
                      </AlertDescription>
                    </Alert>
                  )}

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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
                  <div>GP speaks in English → Translates to patient language</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
                  <div>Patient speaks in their language → Translates to English</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
                  <div>Automatic language detection and speaker identification</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</div>
                  <div>Text-to-speech playback for translated text</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Translation History */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Translation History</h3>
              {translations.length > 0 && (
                <Badge variant="outline">{translations.length} exchanges</Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-3">
                {translations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <div>No translations yet</div>
                    <div className="text-sm">Start speaking to begin translation</div>
                  </div>
                ) : (
                  translations.map((translation) => (
                    <div
                      key={translation.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        translation.speaker === 'gp'
                          ? 'bg-blue-50 border-l-blue-500'
                          : 'bg-green-50 border-l-green-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            #{translation.exchangeNumber}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getSafetyBadgeColor(translation.safetyFlag)}`}
                          >
                            {getSafetyIcon(translation.safetyFlag)}
                            {translation.safetyFlag}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {translation.timestamp.toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Original ({translation.originalLanguageDetected})
                          </div>
                          <div className="text-sm">{translation.originalText}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Translation ({translation.targetLanguage})
                          </div>
                          <div className="text-sm font-medium">{translation.translatedText}</div>
                          
                          {/* TTS Button */}
                          {'speechSynthesis' in window && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 mt-1"
                              onClick={() => {
                                const utterance = new SpeechSynthesisUtterance(translation.translatedText);
                                utterance.lang = translation.targetLanguage;
                                utterance.rate = 0.9;
                                speechSynthesis.speak(utterance);
                              }}
                            >
                              <Volume2 className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Accuracy: {translation.translationAccuracy}%</span>
                          <span>Confidence: {translation.translationConfidence}%</span>
                          <span>{translation.processingTimeMs}ms</span>
                        </div>

                        {translation.medicalTermsDetected.length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Medical terms: </span>
                            <span className="text-primary font-medium">
                              {translation.medicalTermsDetected.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

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