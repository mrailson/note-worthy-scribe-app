import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ConversationEntry } from '@/hooks/useGPTranslation';
import { TurnIndicator, TurnState } from './TurnIndicator';
import { TeleprompterDisplay, TextSize } from './TeleprompterDisplay';
import { UnifiedControlBar } from './UnifiedControlBar';
import { PauseOverlay } from './PauseOverlay';
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
      {/* Main content area with turn indicator */}
      <div className="flex-1 relative overflow-hidden mb-28">
        {/* Turn indicator overlay */}
        <TurnIndicator
          turnState={turnState}
          languageCode={selectedLanguage}
        />

        {/* Teleprompter display */}
        <TeleprompterDisplay
          conversation={conversation}
          textSize={textSize}
          speakerMode={speakerMode}
          languageCode={selectedLanguage}
        />

        {/* Pause overlay */}
        <PauseOverlay
          isPaused={isPaused}
          languageCode={selectedLanguage}
          resumeCountdown={resumeCountdown}
          onResume={handleDirectResume}
        />
      </div>

      {/* Unified Control Bar */}
      <UnifiedControlBar
        selectedLanguage={selectedLanguage}
        onLanguageChange={onLanguageChange}
        speakerMode={speakerMode}
        onSpeakerModeChange={onSpeakerModeChange}
        isPaused={isPaused}
        onPauseToggle={handlePauseToggle}
        silenceThreshold={silenceThreshold}
        onSilenceThresholdChange={onSilenceThresholdChange}
        onManualSend={onManualSend}
        isListening={isListening}
        isMuted={isMuted}
        onMuteToggle={onMuteToggle}
        volume={volume}
        onVolumeChange={onVolumeChange}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        onReplayLast={handleReplayLast}
        latestEnglishText={latestEnglishText}
        onExport={onExport}
        onEndSession={onEndSession}
      />
    </div>
  );
};
