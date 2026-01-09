import React from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, Play, RotateCcw, Languages } from 'lucide-react';
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
      
      {/* Consent message in patient's language */}
      <div className="flex items-center gap-3 text-muted-foreground text-lg md:text-xl text-center mb-8 max-w-2xl">
        <ThumbsUp className="h-8 w-8 flex-shrink-0 text-primary" />
        <p>{phrases.consentMessage}</p>
      </div>

      {/* Clinician consent checkbox */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg border mb-12">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">
            🇬🇧 Clinician: I confirm the patient has given consent (thumbs up/nod)
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
    </div>
  );
};