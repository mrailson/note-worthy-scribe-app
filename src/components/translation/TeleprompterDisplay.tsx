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
  normal: { latest: 'text-3xl', previous: 'text-xl' },
  large: { latest: 'text-5xl', previous: 'text-2xl' },
  xlarge: { latest: 'text-7xl', previous: 'text-3xl' },
};

export const TeleprompterDisplay: React.FC<TeleprompterDisplayProps> = ({
  conversation,
  textSize,
  speakerMode,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get recent entries for patient language (translated text for patient)
  const recentEntries = conversation.slice(-4);
  const latestEntry = recentEntries[recentEntries.length - 1];
  const previousEntries = recentEntries.slice(0, -1);

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
      {/* Previous entries - faded and smaller */}
      <div className="space-y-6 mb-8 w-full max-w-4xl text-center">
        {previousEntries.map((entry, idx) => {
          // Calculate opacity: older = more faded
          const opacity = 0.2 + (idx * 0.15);
          // Calculate scale: older = smaller
          const scale = 0.7 + (idx * 0.1);
          
          return (
            <p
              key={entry.id}
              className={cn(
                sizeClasses.previous,
                'leading-relaxed transition-all duration-300',
                entry.speaker === 'gp' ? 'text-primary/70' : 'text-foreground'
              )}
              style={{
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              {getDisplayText(entry)}
            </p>
          );
        })}
      </div>

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
