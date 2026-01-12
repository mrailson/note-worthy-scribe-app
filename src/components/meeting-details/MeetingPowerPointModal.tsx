import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useMeetingPowerPoint } from '@/hooks/useMeetingPowerPoint';
import { toast } from 'sonner';

interface ActionItem {
  id?: string;
  description: string;
  owner?: string;
  deadline?: string;
  status?: string;
  priority?: string;
}

interface MeetingPowerPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingData: {
    meetingTitle: string;
    meetingDate?: string;
    meetingTime?: string;
    location?: string;
    attendees: string[];
    notesContent: string;
    actionItems: ActionItem[];
    transcript?: string;
  };
}

const GENERATION_TIPS = [
  "Creating executive summary slides...",
  "Extracting key decisions and outcomes...",
  "Designing professional NHS-styled layouts...",
  "Formatting action items and deadlines...",
  "Adding visual hierarchy and branding...",
  "Generating data visualisations...",
  "Optimising for board presentation...",
  "Almost ready! Finalising your presentation...",
];

const TOTAL_DURATION = 90; // 90 seconds

export const MeetingPowerPointModal: React.FC<MeetingPowerPointModalProps> = ({
  isOpen,
  onClose,
  meetingData,
}) => {
  const { generatePowerPoint, isGenerating, currentPhase, error } = useMeetingPowerPoint();
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_DURATION);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start generation when modal opens
  useEffect(() => {
    if (isOpen && !hasStarted && !isComplete) {
      setHasStarted(true);
      setTimeRemaining(TOTAL_DURATION);
      setCurrentTipIndex(0);
      setIsComplete(false);
      setHasFailed(false);

      // Start the generation
      generatePowerPoint(meetingData).then((result) => {
        if (result.success) {
          setIsComplete(true);
          toast.success('PowerPoint presentation downloaded successfully!');
          // Auto-close after short delay
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setHasFailed(true);
          toast.error(result.error || 'Failed to generate presentation');
        }
      });
    }
  }, [isOpen, hasStarted, isComplete, generatePowerPoint, meetingData, onClose]);

  // Countdown timer
  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  // Rotate tips
  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      tipTimerRef.current = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % GENERATION_TIPS.length);
      }, 8000); // Change tip every 8 seconds

      return () => {
        if (tipTimerRef.current) {
          clearInterval(tipTimerRef.current);
        }
      };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      setIsComplete(false);
      setHasFailed(false);
      setTimeRemaining(TOTAL_DURATION);
      setCurrentTipIndex(0);
      if (timerRef.current) clearInterval(timerRef.current);
      if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    }
  }, [isOpen]);

  const progress = ((TOTAL_DURATION - timeRemaining) / TOTAL_DURATION) * 100;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <span className="font-semibold text-foreground">
              {isComplete ? 'Complete!' : hasFailed ? 'Generation Failed' : 'Generating Presentation'}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center space-y-6">
          {/* Progress Ring */}
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="url(#gradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: isComplete ? 0 : strokeDashoffset,
                  transition: 'stroke-dashoffset 1s ease-in-out',
                }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isComplete ? (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              ) : hasFailed ? (
                <AlertCircle className="h-12 w-12 text-destructive" />
              ) : (
                <>
                  <span className="text-2xl font-bold text-foreground">
                    {formatTime(timeRemaining)}
                  </span>
                  <span className="text-xs text-muted-foreground">remaining</span>
                </>
              )}
            </div>
          </div>

          {/* Status text */}
          <div className="text-center space-y-2">
            {isComplete ? (
              <p className="text-sm text-green-600 font-medium">
                Your PowerPoint has been downloaded!
              </p>
            ) : hasFailed ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">
                  {error || 'Failed to generate presentation'}
                </p>
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground animate-pulse min-h-[20px]">
                  {GENERATION_TIPS[currentTipIndex]}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Creating {meetingData.actionItems.length > 0 ? `${meetingData.actionItems.length} action items` : 'executive summary'}
                </p>
              </>
            )}
          </div>

          {/* Branding */}
          {!isComplete && !hasFailed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Sparkles className="h-3 w-3" />
              <span>Powered by Notewell AI</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
