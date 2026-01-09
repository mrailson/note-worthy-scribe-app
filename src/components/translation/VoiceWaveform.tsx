import React from 'react';
import { cn } from '@/lib/utils';

interface VoiceWaveformProps {
  isActive: boolean;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  className,
}) => {
  const bars = [
    { delay: '0ms', height: 'h-2' },
    { delay: '150ms', height: 'h-3' },
    { delay: '300ms', height: 'h-4' },
    { delay: '150ms', height: 'h-3' },
    { delay: '0ms', height: 'h-2' },
  ];

  return (
    <div className={cn('flex items-center gap-0.5 h-4', className)}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full bg-primary/70 transition-all',
            isActive ? 'animate-voice-wave' : bar.height,
            !isActive && 'opacity-40'
          )}
          style={{
            animationDelay: isActive ? bar.delay : '0ms',
          }}
        />
      ))}
    </div>
  );
};
