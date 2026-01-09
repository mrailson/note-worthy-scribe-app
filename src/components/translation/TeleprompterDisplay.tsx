import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ConversationEntry } from '@/hooks/useGPTranslation';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';
import { ThumbsUp } from 'lucide-react';

export type TextSize = 'normal' | 'large' | 'xlarge';

interface TeleprompterDisplayProps {
  conversation: ConversationEntry[];
  textSize: TextSize;
  speakerMode: 'gp' | 'patient';
  languageCode: string;
  consentConfirmed: boolean;
  onConsentChange: (confirmed: boolean) => void;
  className?: string;
}

const TEXT_SIZE_CLASSES: Record<TextSize, { latest: string; previous: string }> = {
  normal: { latest: 'text-3xl', previous: 'text-lg' },
  large: { latest: 'text-5xl', previous: 'text-xl' },
  xlarge: { latest: 'text-7xl', previous: 'text-2xl' },
};

export const TeleprompterDisplay: React.FC<TeleprompterDisplayProps> = ({
  conversation,
  textSize,
  speakerMode,
  languageCode,
  consentConfirmed,
  onConsentChange,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get latest entry only
  const latestEntry = conversation[conversation.length - 1];

  // Get translations for the selected language
  const phrases = getPatientViewPhrases(languageCode);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const getDisplayText = (entry: ConversationEntry) => {
    // In patient view, show translated text (patient's language)
    // If GP spoke, show the translation; if patient spoke, show their original text
    return entry.speaker === 'gp' ? entry.translatedText : entry.originalText;
  };

  const sizeClasses = TEXT_SIZE_CLASSES[textSize];

  if (conversation.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full px-8', className)}>
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
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
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
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex flex-col justify-start items-center h-full px-8 pt-16 pb-40 overflow-y-auto',
        className
      )}
    >

      {/* Latest entry - prominent */}
      {latestEntry && (
        <div className="w-full max-w-4xl text-center animate-fade-in">
          <p
            className={cn(
              sizeClasses.latest,
              'font-semibold leading-tight',
              latestEntry.speaker === 'gp' ? 'text-primary' : 'text-foreground'
            )}
          >
            {getDisplayText(latestEntry)}
          </p>
        </div>
      )}
    </div>
  );
};
