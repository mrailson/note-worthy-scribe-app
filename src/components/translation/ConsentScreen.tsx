import React from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, Play, RotateCcw, Languages, Lightbulb, Mic, MessageSquare, Clock, Send } from 'lucide-react';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { LanguageSelector } from './LanguageSelector';
import { cn } from '@/lib/utils';

interface ConsentScreenProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  consentConfirmed: boolean;
  onConsentChange: (confirmed: boolean) => void;
  onStartSession: () => void;
  onNewSession: () => void;
  hasExistingConversation: boolean;
  isStartDisabled: boolean;
  className?: string;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  selectedLanguage,
  onLanguageChange,
  consentConfirmed,
  onConsentChange,
  onStartSession,
  onNewSession,
  hasExistingConversation,
  isStartDisabled,
  className,
}) => {
  const phrases = getPatientViewPhrases(selectedLanguage);

  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-8', className)}>
      {/* Language Selection at top */}
      <div className="mb-12 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Languages className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Select Patient Language</span>
        </div>
        <LanguageSelector
          value={selectedLanguage}
          onChange={onLanguageChange}
          disabled={false}
        />
      </div>

      {/* Welcome message in patient's language */}
      <p className="text-muted-foreground text-2xl md:text-3xl text-center mb-8">
        {phrases.translationWillAppear}
      </p>

      {/* Clinician consent checkbox */}
      <div className="mb-8 p-4 bg-muted/50 rounded-lg border max-w-md">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">
            GP Practice: I confirm the patient has given consent
          </span>
        </label>
      </div>

      {/* Session Controls */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={onStartSession}
          disabled={isStartDisabled}
          className="gap-2 px-8"
        >
          <Play className="h-5 w-5" />
          Start Session
        </Button>
        
        {hasExistingConversation && (
          <Button
            variant="outline"
            size="lg"
            onClick={onNewSession}
            className="gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            New Session
          </Button>
        )}
      </div>

      {/* Helper text */}
      {!selectedLanguage && (
        <p className="text-sm text-muted-foreground mt-4">
          Please select a language to continue
        </p>
      )}
      {selectedLanguage && !consentConfirmed && (
        <p className="text-sm text-muted-foreground mt-4">
          Please confirm consent to start the session
        </p>
      )}

      {/* Tips for best results */}
      <div className="mt-10 w-full max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Tips for Best Results</span>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Mic className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Hold the device close to the speaker or use a headset</span>
          </div>
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Speak clearly at a steady pace</span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Pause briefly between sentences — use the Wait Time slider to allow longer pauses</span>
          </div>
          <div className="flex items-start gap-2">
            <Send className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Tap 'Send Now' if the system hasn't picked up your speech</span>
          </div>
        </div>
      </div>
    </div>
  );
};