import React, { useState, useEffect } from 'react';
import { Presentation, Sparkles, Loader2 } from 'lucide-react';

interface PowerPointGenerationOverlayProps {
  isVisible: boolean;
}

const TIPS = [
  "Gamma AI is designing your slides...",
  "Adding professional layouts and styling...",
  "Organising content into clear sections...",
  "Creating visual hierarchy for impact...",
  "Preparing your presentation for download...",
  "Did you know? Clear visuals improve retention by 65%",
  "Tip: Review slides before your meeting",
  "Almost there! Finalising your presentation..."
];

export const PowerPointGenerationOverlay: React.FC<PowerPointGenerationOverlayProps> = ({ isVisible }) => {
  const [seconds, setSeconds] = useState(60);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Reset timer when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      setSeconds(60);
      setCurrentTipIndex(0);
    }
  }, [isVisible]);

  // Countdown timer
  useEffect(() => {
    if (!isVisible || seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, seconds]);

  // Rotate tips every 5 seconds
  useEffect(() => {
    if (!isVisible) return;

    const tipTimer = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setCurrentTipIndex(prev => (prev + 1) % TIPS.length);
        setTipFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(tipTimer);
  }, [isVisible]);

  if (!isVisible) return null;

  const progress = ((60 - seconds) / 60) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8 p-8 max-w-md text-center">
        {/* Animated Icon Section */}
        <div className="relative">
          {/* Rotating sparkles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
            <Sparkles className="absolute -top-4 left-1/2 -translate-x-1/2 w-5 h-5 text-primary/60" />
            <Sparkles className="absolute top-1/2 -right-4 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Sparkles className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-5 h-5 text-primary/50" />
            <Sparkles className="absolute top-1/2 -left-4 -translate-y-1/2 w-4 h-4 text-primary/30" />
          </div>
          
          {/* Counter-rotating sparkles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
            <Sparkles className="absolute -top-2 -right-2 w-3 h-3 text-amber-400/60" />
            <Sparkles className="absolute -bottom-2 -left-2 w-3 h-3 text-amber-400/40" />
          </div>

          {/* Main icon with pulse */}
          <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-6 animate-pulse" style={{ animationDuration: '2s' }}>
            <Presentation className="w-16 h-16 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Creating PowerPoint Presentation
            <Sparkles className="w-5 h-5 text-primary" />
          </h2>
          <p className="text-lg text-muted-foreground font-medium">
            with Notewell AI
          </p>
        </div>

        {/* Progress Ring with Countdown */}
        <div className="relative w-32 h-32">
          {/* Background ring */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-muted/30"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              className="text-primary transition-all duration-1000"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset
              }}
            />
          </svg>
          
          {/* Countdown text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>
        </div>

        {/* Rotating tip */}
        <div className="h-12 flex items-center justify-center">
          <p 
            className={`text-muted-foreground italic transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
          >
            "{TIPS[currentTipIndex]}"
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Please wait while we create your presentation...</span>
        </div>
      </div>
    </div>
  );
};
