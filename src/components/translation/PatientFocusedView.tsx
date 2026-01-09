import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ConversationEntry } from '@/hooks/useGPTranslation';
import { TurnIndicator, TurnState } from './TurnIndicator';
import { TeleprompterDisplay, TextSize } from './TeleprompterDisplay';
import { PatientQuickSettings } from './PatientQuickSettings';
import { PauseOverlay } from './PauseOverlay';
import { Button } from '@/components/ui/button';
import { Square, FileDown } from 'lucide-react';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';


interface PatientFocusedViewProps {
  conversation: ConversationEntry[];
  speakerMode: 'gp' | 'patient';
  onSpeakerModeChange: (mode: 'gp' | 'patient') => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  selectedLanguageName: string;
  selectedLanguageFlag: string;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  isMuted: boolean;
  volume: number;
  onMuteToggle: () => void;
  onVolumeChange: (value: number) => void;
  onPlayAudio: (text: string, languageCode: string) => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onEndSession: () => void;
  onExport: () => void;
  silenceThreshold: number;
  onSilenceThresholdChange: (threshold: number) => void;
  onManualSend: () => void;
  className?: string;
}

export const PatientFocusedView: React.FC<PatientFocusedViewProps> = ({
  conversation,
  speakerMode,
  onSpeakerModeChange,
  selectedLanguage,
  onLanguageChange,
  selectedLanguageName,
  selectedLanguageFlag,
  isListening,
  isProcessing,
  isSpeaking,
  currentTranscript,
  isMuted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onPlayAudio,
  onPause,
  onResume,
  onClose,
  onEndSession,
  onExport,
  silenceThreshold,
  onSilenceThresholdChange,
  onManualSend,
  className,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('large');
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const phrases = getPatientViewPhrases(selectedLanguage);

  // Determine turn state
  const getTurnState = (): TurnState => {
    if (isPaused || resumeCountdown !== null) return 'paused';
    if (speakerMode === 'patient' && isListening && !isProcessing && !isSpeaking) {
      return 'speak';
    }
    return 'wait';
  };

  const turnState = getTurnState();

  // Get the last entry for replay
  const lastEntry = conversation[conversation.length - 1];

  // Calculate if text is too long to show turn indicator (hide when > 200 chars)
  const latestTranslatedText = lastEntry?.speaker === 'gp' 
    ? lastEntry?.translatedText 
    : lastEntry?.englishText;
  const showTurnIndicator = !latestTranslatedText || latestTranslatedText.length < 200;

  // Handle pause toggle
  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      // Start resume countdown
      setResumeCountdown(3);
    } else {
      // Immediate pause
      setIsPaused(true);
      onPause();
    }
  }, [isPaused, onPause]);

  // Countdown effect
  useEffect(() => {
    if (resumeCountdown === null) return;

    if (resumeCountdown > 0) {
      const timer = setTimeout(() => {
        setResumeCountdown(resumeCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished, resume
      setResumeCountdown(null);
      setIsPaused(false);
      onResume();
    }
  }, [resumeCountdown, onResume]);

  // Handle replay
  const handleReplayLast = useCallback(() => {
    if (lastEntry) {
      // Replay the translation audio
      const textToPlay = lastEntry.speaker === 'gp' 
        ? lastEntry.translatedText 
        : lastEntry.englishText;
      const langToPlay = lastEntry.speaker === 'gp' 
        ? selectedLanguage 
        : 'en';
      onPlayAudio(textToPlay, langToPlay);
    }
  }, [lastEntry, selectedLanguage, onPlayAudio]);

  // Handle direct resume (from overlay button)
  const handleDirectResume = useCallback(() => {
    setResumeCountdown(3);
  }, []);
  // Get the latest English text for the bottom bar
  const latestEntry = conversation[conversation.length - 1];
  const latestEnglishText = latestEntry?.englishText || '';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background',
        className
      )}
    >
      {/* Quick settings bar */}
      <PatientQuickSettings
        isPaused={isPaused}
        onPauseToggle={handlePauseToggle}
        isMuted={isMuted}
        onMuteToggle={onMuteToggle}
        volume={volume}
        onVolumeChange={onVolumeChange}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        onReplayLast={handleReplayLast}
        onClose={onClose}
        canReplay={!!lastEntry}
        speakerMode={speakerMode}
        onSpeakerModeChange={onSpeakerModeChange}
        selectedLanguage={selectedLanguage}
        onLanguageChange={onLanguageChange}
        isVoiceActive={isListening && !!currentTranscript && !isProcessing && !isSpeaking}
        silenceThreshold={silenceThreshold}
        onSilenceThresholdChange={onSilenceThresholdChange}
        onManualSend={onManualSend}
        isListening={isListening}
      />

      {/* Main content area with turn indicator */}
      <div className="flex-1 relative overflow-hidden mt-20 mb-16">
        {/* Turn indicator overlay - hidden when text is long */}
        {showTurnIndicator && (
          <TurnIndicator
            turnState={turnState}
            languageCode={selectedLanguage}
          />
        )}

        {/* Teleprompter display */}
        <TeleprompterDisplay
          conversation={conversation}
          textSize={textSize}
          speakerMode={speakerMode}
          languageCode={selectedLanguage}
          consentConfirmed={consentConfirmed}
          onConsentChange={setConsentConfirmed}
        />

        {/* Pause overlay */}
        <PauseOverlay
          isPaused={isPaused}
          languageCode={selectedLanguage}
          resumeCountdown={resumeCountdown}
          onResume={handleDirectResume}
        />
      </div>

      {/* Bottom bar with English transcript and End Session */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-muted/50 border-t">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-medium text-muted-foreground shrink-0">
              🇬🇧 English:
            </span>
            <span className="text-sm text-foreground/80 truncate">
              {latestEnglishText || 'Waiting for conversation...'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={conversation.length === 0}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Download Report</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onEndSession}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
