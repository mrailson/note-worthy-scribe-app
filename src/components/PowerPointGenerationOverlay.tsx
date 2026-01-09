import React, { useState, useEffect } from 'react';
import { Presentation, Sparkles, Loader2, Mic, FileText, Package } from 'lucide-react';
import type { VoiceoverPhase } from '@/hooks/useGammaPowerPointWithVoiceover';

interface PowerPointGenerationOverlayProps {
  isVisible: boolean;
  currentPhase?: VoiceoverPhase;
  isFullVersion?: boolean;
}

const TIPS = [
  "Notewell AI is designing your slides...",
  "Adding professional layouts and styling...",
  "Organising content into clear sections...",
  "Creating visual hierarchy for impact...",
  "Preparing your presentation for download...",
  "Did you know? Clear visuals improve retention by 65%",
  "Tip: Review slides before your meeting",
  "Almost there! Finalising your presentation..."
];

const PHASE_TIPS = {
  slides: [
    "Notewell AI is designing your slides...",
    "Adding professional layouts and styling...",
    "Creating visual hierarchy for impact...",
    "Generating presentation structure..."
  ],
  scripts: [
    "Writing professional narration scripts...",
    "Crafting British English presenter notes...",
    "Ensuring clear and engaging content...",
    "Optimising script pacing and flow..."
  ],
  audio: [
    "Recording British English voiceover...",
    "Your presentation will sound professional...",
    "Creating high-quality audio narration...",
    "Almost ready! Finishing audio generation..."
  ],
  packaging: [
    "Packaging your presentation files...",
    "Preparing downloads...",
    "Almost ready for download...",
    "Finalising your complete package..."
  ]
};

const PHASE_INFO = {
  slides: { icon: Presentation, label: 'Creating Slides', color: 'text-blue-500' },
  scripts: { icon: FileText, label: 'Writing Scripts', color: 'text-amber-500' },
  audio: { icon: Mic, label: 'Recording Voiceover', color: 'text-green-500' },
  packaging: { icon: Package, label: 'Packaging Files', color: 'text-purple-500' }
};

export const PowerPointGenerationOverlay: React.FC<PowerPointGenerationOverlayProps> = ({ 
  isVisible, 
  currentPhase,
  isFullVersion = false 
}) => {
  const totalTime = isFullVersion ? 120 : 90;
  const [seconds, setSeconds] = useState(totalTime);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Get the appropriate tips based on phase
  const activeTips = currentPhase && isFullVersion 
    ? PHASE_TIPS[currentPhase] || TIPS 
    : TIPS;

  // Reset timer when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      setSeconds(totalTime);
      setCurrentTipIndex(0);
    }
  }, [isVisible, totalTime]);

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
        setCurrentTipIndex(prev => (prev + 1) % activeTips.length);
        setTipFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(tipTimer);
  }, [isVisible, activeTips.length]);

  // Reset tip index when phase changes
  useEffect(() => {
    setCurrentTipIndex(0);
  }, [currentPhase]);

  if (!isVisible) return null;

  const progress = ((totalTime - seconds) / totalTime) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const PhaseIcon = currentPhase && isFullVersion ? PHASE_INFO[currentPhase].icon : Presentation;

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
            <PhaseIcon className={`w-16 h-16 ${currentPhase && isFullVersion ? PHASE_INFO[currentPhase].color : 'text-primary'}`} />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isFullVersion ? 'Creating Full PowerPoint with Voiceover' : 'Creating PowerPoint Presentation'}
            <Sparkles className="w-5 h-5 text-primary" />
          </h2>
          <p className="text-lg text-muted-foreground font-medium">
            with Notewell AI
          </p>
          
          {/* Phase indicator for full version */}
          {isFullVersion && currentPhase && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted ${PHASE_INFO[currentPhase].color}`}>
                {React.createElement(PHASE_INFO[currentPhase].icon, { className: "w-4 h-4" })}
                <span className="text-sm font-medium">{PHASE_INFO[currentPhase].label}</span>
              </div>
            </div>
          )}
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

        {/* Phase progress for full version */}
        {isFullVersion && (
          <div className="flex items-center gap-2">
            {(['slides', 'scripts', 'audio', 'packaging'] as const).map((phase, index) => (
              <React.Fragment key={phase}>
                <div 
                  className={`w-3 h-3 rounded-full transition-colors ${
                    phase === currentPhase 
                      ? 'bg-primary animate-pulse' 
                      : index < (['slides', 'scripts', 'audio', 'packaging'] as const).indexOf(currentPhase || 'slides')
                        ? 'bg-primary'
                        : 'bg-muted'
                  }`}
                />
                {index < 3 && (
                  <div className={`w-8 h-0.5 ${
                    index < (['slides', 'scripts', 'audio', 'packaging'] as const).indexOf(currentPhase || 'slides')
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Rotating tip */}
        <div className="h-12 flex items-center justify-center">
          <p 
            className={`text-muted-foreground italic transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
          >
            "{activeTips[currentTipIndex % activeTips.length]}"
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            {isFullVersion 
              ? 'Creating your presentation with British English voiceover...' 
              : 'Please wait while we create your presentation...'
            }
          </span>
        </div>
      </div>
    </div>
  );
};
