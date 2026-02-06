import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Presentation, Sparkles, Loader2, Mic, FileText, Package, CheckCircle, AlertCircle } from 'lucide-react';
import type { VoiceoverPhase } from '@/hooks/useGammaPowerPointWithVoiceover';

interface PowerPointGenerationOverlayProps {
  isVisible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPhase?: VoiceoverPhase;
  isFullVersion?: boolean;
  slideCount?: number;
  isComplete?: boolean;
  error?: string | null;
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
  open,
  onOpenChange,
  currentPhase,
  isFullVersion = false,
  slideCount = 10,
  isComplete = false,
  error = null
}) => {
  // Base 90s (or 120s for full version), plus 10s per slide above 10
  const extraTime = slideCount > 10 ? (slideCount - 10) * 10 : 0;
  const totalTime = (isFullVersion ? 120 : 90) + extraTime;
  const [seconds, setSeconds] = useState(totalTime);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Get the appropriate tips based on phase
  const activeTips = currentPhase && isFullVersion 
    ? PHASE_TIPS[currentPhase] || TIPS 
    : TIPS;

  // Reset timer when generation starts
  useEffect(() => {
    if (isVisible) {
      setSeconds(totalTime);
      setCurrentTipIndex(0);
    }
  }, [isVisible, totalTime]);

  // Countdown timer
  useEffect(() => {
    if (!isVisible || seconds <= 0 || isComplete) return;

    const timer = setInterval(() => {
      setSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, seconds, isComplete]);

  // Rotate tips every 5 seconds
  useEffect(() => {
    if (!isVisible || isComplete) return;

    const tipTimer = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setCurrentTipIndex(prev => (prev + 1) % activeTips.length);
        setTipFade(true);
      }, 300);
    }, 5000);

    return () => clearInterval(tipTimer);
  }, [isVisible, activeTips.length, isComplete]);

  // Reset tip index when phase changes
  useEffect(() => {
    setCurrentTipIndex(0);
  }, [currentPhase]);

  if (!isVisible && !isComplete && !error) return null;

  const progress = isComplete ? 100 : ((totalTime - seconds) / totalTime) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const PhaseIcon = currentPhase && isFullVersion ? PHASE_INFO[currentPhase].icon : Presentation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary" />
            {isFullVersion ? 'Creating Presentation with Voiceover' : 'Creating Presentation'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Generation Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : isComplete ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">Presentation Ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Your presentation has been downloaded automatically</p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* Progress ring */}
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-muted/30"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold tabular-nums">
                      {formatTime(seconds)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase indicator for full version */}
              {isFullVersion && currentPhase && (
                <div className="flex items-center justify-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted ${PHASE_INFO[currentPhase].color}`}>
                    {React.createElement(PHASE_INFO[currentPhase].icon, { className: "w-4 h-4" })}
                    <span className="text-sm font-medium">{PHASE_INFO[currentPhase].label}</span>
                  </div>
                </div>
              )}

              {/* Phase progress dots for full version */}
              {isFullVersion && (
                <div className="flex items-center justify-center gap-2">
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
              <div className="text-center">
                <p 
                  className={`text-sm text-muted-foreground italic transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
                >
                  {activeTips[currentTipIndex % activeTips.length]}
                </p>
              </div>

              {/* Linear progress bar */}
              <Progress value={progress} className="h-2" />

              {/* Loading indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>You can close this and carry on — it will auto-download when ready</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
