import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Square, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { SpeakerModeToggle } from '@/components/translation/SpeakerModeToggle';
import { ConversationPanel, ViewMode } from '@/components/translation/ConversationPanel';
import { AudioControls } from '@/components/translation/AudioControls';
import { PatientFocusedView } from '@/components/translation/PatientFocusedView';
import { ConsentScreen } from '@/components/translation/ConsentScreen';
import { useGPTranslation } from '@/hooks/useGPTranslation';
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
  const [silenceThreshold, setSilenceThreshold] = useState(3000);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  
  const {
    isListening,
    isProcessing,
    isSpeaking,
    conversation,
    currentTranscript,
    startListening,
    stopListening,
    manualSend,
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
    silenceThreshold,
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

    if (!consentConfirmed) {
      toast({
        title: 'Consent Required',
        description: 'Please confirm patient consent before starting.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await startListening();
      setIsSessionActive(true);
    } catch (error) {
      toast({
        title: 'Failed to Start',
        description: error instanceof Error ? error.message : 'Could not start session',
        variant: 'destructive'
      });
    }
  }, [selectedLanguage, consentConfirmed, startListening, toast]);

  const handleEndSession = useCallback(() => {
    stopListening();
    stopAudio();
    setIsSessionActive(false);
  }, [stopListening, stopAudio]);

  const handleNewSession = useCallback(() => {
    clearConversation();
    setSelectedLanguage('');
    setSpeakerMode('gp');
    setConsentConfirmed(false);
    setIsSessionActive(false);
  }, [clearConversation]);

  const handleExport = useCallback(async () => {
    try {
      await exportConversation();
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export conversation.',
        variant: 'destructive'
      });
    }
  }, [exportConversation, toast]);

  const handlePatientViewPause = useCallback(() => {
    stopListening();
    stopAudio();
  }, [stopListening, stopAudio]);

  const handlePatientViewResume = useCallback(async () => {
    if (isSessionActive) {
      try {
        await startListening();
      } catch (error) {
        toast({
          title: 'Failed to Resume',
          description: 'Could not resume listening. Please try again.',
          variant: 'destructive'
        });
      }
    }
  }, [isSessionActive, startListening, toast]);

  const handleClosePatientView = useCallback(() => {
    setViewMode('standard');
  }, []);

  const handlePatientViewEndSession = useCallback(() => {
    stopListening();
    stopAudio();
    clearConversation();
    setIsSessionActive(false);
    setSelectedLanguage('');
    setSpeakerMode('gp');
    setViewMode('standard');
    setConsentConfirmed(false);
  }, [stopListening, stopAudio, clearConversation]);

  const selectedLangData = ELEVENLABS_LANGUAGES.find(l => l.code === selectedLanguage);

  // Show consent screen as default when session is not active
  if (!isSessionActive) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <ConsentScreen
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          consentConfirmed={consentConfirmed}
          onConsentChange={setConsentConfirmed}
          onStartSession={handleStartSession}
          onNewSession={handleNewSession}
          hasExistingConversation={conversation.length > 0}
          isStartDisabled={!selectedLanguage || !consentConfirmed}
        />
      </div>
    );
  }

  // When session is active, always show the patient-focused fullscreen view
  return (
    <PatientFocusedView
      conversation={conversation}
      speakerMode={speakerMode}
      onSpeakerModeChange={setSpeakerMode}
      selectedLanguage={selectedLanguage}
      onLanguageChange={setSelectedLanguage}
      selectedLanguageName={selectedLangData?.name || ''}
      selectedLanguageFlag={selectedLangData?.flag || ''}
      isListening={isListening}
      isProcessing={isProcessing}
      isSpeaking={isSpeaking}
      currentTranscript={currentTranscript}
      isMuted={isMuted}
      volume={volume}
      onMuteToggle={() => setIsMuted(!isMuted)}
      onVolumeChange={setVolume}
      onPlayAudio={playAudio}
      onPause={handlePatientViewPause}
      onResume={handlePatientViewResume}
      onClose={() => setIsSessionActive(false)}
      onEndSession={handlePatientViewEndSession}
      onExport={handleExport}
      silenceThreshold={silenceThreshold}
      onSilenceThresholdChange={setSilenceThreshold}
      onManualSend={manualSend}
    />
  );
};

export default GPTranslationService;
