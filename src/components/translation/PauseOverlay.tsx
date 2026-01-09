import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPatientViewPhrases } from '@/constants/patientViewTranslations';

interface PauseOverlayProps {
  isPaused: boolean;
  languageCode: string;
  resumeCountdown: number | null;
  onResume: () => void;
  className?: string;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isPaused,
  languageCode,
  resumeCountdown,
  onResume,
  className,
}) => {
  const phrases = getPatientViewPhrases(languageCode);

  if (!isPaused && resumeCountdown === null) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300',
        isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
    >
      {resumeCountdown !== null ? (
        // Countdown display
        <div className="text-center">
          <div className="text-8xl font-bold text-white mb-4 animate-pulse">
            {resumeCountdown}
          </div>
          <p className="text-2xl text-white/80">
            {phrases.resumingIn}...
          </p>
        </div>
      ) : (
        // Paused state
        <div className="text-center">
          <div className="mb-8">
            <Pause className="h-24 w-24 text-white/80 mx-auto" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-4">
            {phrases.paused}
          </h2>
          <p className="text-xl text-white/60 mb-8 max-w-md">
            {phrases.standbyMessage}
          </p>
          <Button
            size="lg"
            onClick={onResume}
            className="gap-3 text-xl px-8 py-6 h-auto"
          >
            <Play className="h-6 w-6" />
            {phrases.resume}
          </Button>
        </div>
      )}
    </div>
  );
};
