import React from 'react';
import { cn } from '@/lib/utils';
import { Mic, Hand } from 'lucide-react';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';

export type TurnState = 'speak' | 'wait' | 'paused';

interface TurnIndicatorProps {
  turnState: TurnState;
  languageCode: string;
  className?: string;
}

export const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  turnState,
  languageCode,
  className,
}) => {
  const phrases = getPatientViewPhrases(languageCode);

  const getBackgroundClass = () => {
    switch (turnState) {
      case 'speak':
        return 'bg-green-500/20 dark:bg-green-500/30';
      case 'wait':
        return 'bg-amber-500/20 dark:bg-amber-500/30';
      case 'paused':
        return 'bg-slate-500/20 dark:bg-slate-500/30';
    }
  };

  const getBorderClass = () => {
    switch (turnState) {
      case 'speak':
        return 'border-green-500/50';
      case 'wait':
        return 'border-amber-500/50';
      case 'paused':
        return 'border-slate-500/50';
    }
  };

  const getTextClass = () => {
    switch (turnState) {
      case 'speak':
        return 'text-green-700 dark:text-green-300';
      case 'wait':
        return 'text-amber-700 dark:text-amber-300';
      case 'paused':
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getIcon = () => {
    switch (turnState) {
      case 'speak':
        return <Mic className="h-12 w-12 animate-pulse" />;
      case 'wait':
        return <Hand className="h-12 w-12" />;
      case 'paused':
        return <Hand className="h-12 w-12 opacity-50" />;
    }
  };

  const getText = () => {
    switch (turnState) {
      case 'speak':
        return phrases.speakNow;
      case 'wait':
        return phrases.pleaseWait;
      case 'paused':
        return phrases.paused;
    }
  };

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none transition-colors duration-500',
        getBackgroundClass(),
        className
      )}
    >
      {/* Turn indicator at bottom */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center">
        <div
          className={cn(
            'flex items-center gap-4 px-8 py-4 rounded-full border-2',
            getBackgroundClass(),
            getBorderClass(),
            getTextClass()
          )}
        >
          {getIcon()}
          <span className="text-3xl font-bold uppercase tracking-wider">
            {getText()}
          </span>
        </div>
      </div>
    </div>
  );
};
