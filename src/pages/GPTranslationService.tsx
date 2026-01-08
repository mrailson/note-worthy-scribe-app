import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Play, Square, RotateCcw, FileDown, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { SpeakerModeToggle } from '@/components/translation/SpeakerModeToggle';
import { ConversationPanel } from '@/components/translation/ConversationPanel';
import { AudioControls } from '@/components/translation/AudioControls';
import { useGPTranslation, ConversationEntry } from '@/hooks/useGPTranslation';
import { ELEVENLABS_LANGUAGES } from '@/constants/elevenLabsLanguages';

const GPTranslationService: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [speakerMode, setSpeakerMode] = useState<'gp' | 'patient'>('gp');
  const [autoDetect, setAutoDetect] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  
  const {
    isListening,
    isProcessing,
    isSpeaking,
    conversation,
    currentTranscript,
    startListening,
    stopListening,
    playAudio,
    stopAudio,
    clearConversation,
    exportConversation
  } = useGPTranslation({
    selectedLanguage,
    speakerMode,
    autoDetect,
    volume,
    isMuted,
    onSpeakerDetected: (detected) => {
      if (autoDetect && detected !== speakerMode) {
        setSpeakerMode(detected);
      }
    },
    onError: (error) => {
      toast({
        title: 'Translation Error',
        description: error,
        variant: 'destructive'
      });
    }
  });

  const handleStartSession = useCallback(async () => {
    if (!selectedLanguage) {
      toast({
        title: 'Select Language',
        description: 'Please select the patient\'s language before starting.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await startListening();
      setIsSessionActive(true);
      toast({
        title: 'Session Started',
        description: `Translation session active for ${ELEVENLABS_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Start',
        description: error instanceof Error ? error.message : 'Could not start session',
        variant: 'destructive'
      });
    }
  }, [selectedLanguage, startListening, toast]);

  const handleEndSession = useCallback(() => {
    stopListening();
    stopAudio();
    setIsSessionActive(false);
    toast({
      title: 'Session Ended',
      description: 'Translation session has been stopped.',
    });
  }, [stopListening, stopAudio, toast]);

  const handleNewSession = useCallback(() => {
    clearConversation();
    setSelectedLanguage('');
    setSpeakerMode('gp');
    toast({
      title: 'New Session',
      description: 'Ready to start a new translation session.',
    });
  }, [clearConversation, toast]);

  const handleExport = useCallback(async () => {
    try {
      await exportConversation();
      toast({
        title: 'Export Complete',
        description: 'Conversation exported successfully.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export conversation.',
        variant: 'destructive'
      });
    }
  }, [exportConversation, toast]);

  const selectedLangData = ELEVENLABS_LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/ai4gp')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">GP-Patient Translation</h1>
                <p className="text-sm text-muted-foreground">Real-time two-way translation service</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isSessionActive && (
                <Badge 
                  variant={isListening ? 'default' : 'secondary'}
                  className="animate-pulse"
                >
                  {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Ready'}
                </Badge>
              )}
              
              {!isSessionActive ? (
                <Button onClick={handleStartSession} disabled={!selectedLanguage}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Session
                </Button>
              ) : (
                <Button onClick={handleEndSession} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-3 space-y-4">
            {/* Language Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Patient Language</CardTitle>
              </CardHeader>
              <CardContent>
                <LanguageSelector
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  disabled={isSessionActive}
                />
              </CardContent>
            </Card>

            {/* Speaker Mode */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Speaker Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SpeakerModeToggle
                  mode={speakerMode}
                  onModeChange={setSpeakerMode}
                  disabled={!isSessionActive}
                  isListening={isListening}
                />
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-detect" className="text-sm">
                    Auto-detect speaker
                  </Label>
                  <Switch
                    id="auto-detect"
                    checked={autoDetect}
                    onCheckedChange={setAutoDetect}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Audio Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Audio Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <AudioControls
                  volume={volume}
                  onVolumeChange={setVolume}
                  isMuted={isMuted}
                  onMuteToggle={() => setIsMuted(!isMuted)}
                  isSpeaking={isSpeaking}
                  onStopAudio={stopAudio}
                />
              </CardContent>
            </Card>

            {/* Session Actions */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleNewSession}
                  disabled={isSessionActive}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  New Session
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleExport}
                  disabled={conversation.length === 0}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export Conversation
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Conversation */}
          <div className="lg:col-span-9">
            <ConversationPanel
              conversation={conversation}
              currentTranscript={currentTranscript}
              speakerMode={speakerMode}
              selectedLanguage={selectedLanguage}
              selectedLanguageName={selectedLangData?.name || ''}
              selectedLanguageFlag={selectedLangData?.flag || ''}
              onPlayAudio={playAudio}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPTranslationService;
