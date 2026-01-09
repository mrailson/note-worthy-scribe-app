import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ConversationEntry } from '@/hooks/useGPTranslation';

export type TextSize = 'normal' | 'large' | 'xlarge';

interface TeleprompterDisplayProps {
  conversation: ConversationEntry[];
  textSize: TextSize;
  speakerMode: 'gp' | 'patient';
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
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get latest and previous entry only
  const latestEntry = conversation[conversation.length - 1];
  const previousEntry = conversation.length > 1 ? conversation[conversation.length - 2] : null;

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
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-muted-foreground text-2xl text-center px-8">
          The translation will appear here when the conversation begins...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex flex-col justify-center items-center h-full px-8 py-16 overflow-hidden',
        className
      )}
    >
      {/* Previous entry - almost invisible */}
      {previousEntry && (
        <div className="mb-8 w-full max-w-4xl text-center">
          <p
            className={cn(
              sizeClasses.previous,
              'leading-relaxed text-muted-foreground/30 italic'
            )}
          >
            {getDisplayText(previousEntry)}
          </p>
        </div>
      )}

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
