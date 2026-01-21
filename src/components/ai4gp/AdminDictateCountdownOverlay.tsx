import React from 'react';
import { createPortal } from 'react-dom';

interface AdminDictateCountdownOverlayProps {
  countdown: number;
}

export const AdminDictateCountdownOverlay: React.FC<AdminDictateCountdownOverlayProps> = ({
  countdown,
}) => {
  const circumference = 2 * Math.PI * 60; // radius = 60
  const progress = (3 - countdown) / 3;
  const strokeDashoffset = circumference * (1 - progress);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="relative w-40 h-40">
          {/* Background circle */}
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              className="text-muted-foreground/20"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r="60"
              cx="80"
              cy="80"
            />
            {/* Animated progress circle */}
            <circle
              className="text-primary transition-all duration-1000 ease-linear"
              strokeWidth="6"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="60"
              cx="80"
              cy="80"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          </svg>
          {/* Countdown number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl font-bold text-primary animate-pulse">
              {countdown}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl font-medium text-foreground">
            Get ready...
          </span>
          <span className="text-lg text-muted-foreground">
            Listening starts in {countdown} second{countdown !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
