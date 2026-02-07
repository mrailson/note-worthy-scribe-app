import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Presentation, X, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { useComplaintPowerPoint } from '@/hooks/useComplaintPowerPoint';
import { toast } from 'sonner';

interface ComplaintPowerPointData {
  referenceNumber: string;
  category: string;
  receivedDate: string;
  outcomeType?: string;
  complaintOverview: string;
  keyLearnings: Array<{
    learning: string;
    category: string;
    impact: string;
  }>;
  practiceStrengths: string[];
  improvementSuggestions: Array<{
    suggestion: string;
    rationale: string;
    priority: string;
  }>;
  outcomeRationale?: string;
}

interface ComplaintPowerPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintData: ComplaintPowerPointData;
}

const GENERATION_TIPS = [
  "Preparing anonymised complaint summary...",
  "Building key learnings slides...",
  "Adding improvement action slides...",
  "Highlighting what the team did well...",
  "Creating professional NHS-styled design...",
  "Adding speaker notes for the presenter...",
  "Generating photorealistic imagery...",
  "Almost ready! Finalising your presentation...",
];

export const ComplaintPowerPointModal: React.FC<ComplaintPowerPointModalProps> = ({
  isOpen,
  onClose,
  complaintData,
}) => {
  const { generatePowerPoint, isGenerating, currentPhase, error } = useComplaintPowerPoint();
  const [slideCount, setSlideCount] = useState<number>(7);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tipTimerRef = useRef<NodeJS.Timeout | null>(null);

  const estimatedDuration = slideCount * 15; // 15s per slide (accounts for polling)

  const handleGenerate = () => {
    setHasStarted(true);
    setIsComplete(false);
    setHasFailed(false);
    setTimeRemaining(estimatedDuration);
    setCurrentTipIndex(0);

    generatePowerPoint(complaintData, slideCount).then((result) => {
      if (result.success) {
        setIsComplete(true);
        setTimeout(() => onClose(), 2000);
      } else {
        setHasFailed(true);
        toast.error(result.error || 'Failed to generate PowerPoint');
      }
    });
  };

  // Countdown timer
  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  // Rotating tips
  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      tipTimerRef.current = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % GENERATION_TIPS.length);
      }, 5000);
      return () => { if (tipTimerRef.current) clearInterval(tipTimerRef.current); };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      setIsComplete(false);
      setHasFailed(false);
      setTimeRemaining(0);
      setCurrentTipIndex(0);
      if (timerRef.current) clearInterval(timerRef.current);
      if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    }
  }, [isOpen]);

  const progress = estimatedDuration > 0
    ? ((estimatedDuration - timeRemaining) / estimatedDuration) * 100
    : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeEstimateLabel = (count: number): string => {
    const totalSeconds = count * 15;
    if (totalSeconds <= 60) return '~1 min';
    return `~${Math.ceil(totalSeconds / 60)} min`;
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary animate-pulse" />
            <span className="font-semibold text-foreground">
              {isComplete ? 'Complete!' : hasFailed ? 'Generation Failed' : hasStarted ? 'Creating Staff Training PowerPoint' : 'Staff Training PowerPoint'}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 flex flex-col items-center space-y-6">
          {/* Pre-generation: slide count selector */}
          {!hasStarted && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Create an anonymised staff training presentation for PLT sessions and team learning.
              </p>

              <div className="w-full space-y-3">
                <label className="text-sm font-medium text-foreground">Number of slides</label>
                <Select
                  value={String(slideCount)}
                  onValueChange={(val) => setSlideCount(Number(val))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} slides ({getTimeEstimateLabel(n)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  More slides provide deeper detail on learnings and improvements.
                </p>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                <Presentation className="h-4 w-4 mr-2" />
                Generate PowerPoint
              </Button>
            </>
          )}

          {/* Generating: progress ring */}
          {hasStarted && (
            <>
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64" cy="64" r="45"
                    stroke="currentColor" strokeWidth="8" fill="none"
                    className="text-muted/30"
                  />
                  <circle
                    cx="64" cy="64" r="45"
                    stroke="url(#complaint-pptx-gradient)" strokeWidth="8" fill="none"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: circumference,
                      strokeDashoffset: isComplete ? 0 : strokeDashoffset,
                      transition: 'stroke-dashoffset 1s ease-in-out',
                    }}
                  />
                  <defs>
                    <linearGradient id="complaint-pptx-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" />
                    </linearGradient>
                  </defs>
                </svg>

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

              <div className="text-center space-y-2">
                {isComplete ? (
                  <p className="text-sm text-green-600 font-medium">
                    Your staff training PowerPoint has been downloaded!
                  </p>
                ) : hasFailed ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive font-medium">
                      {error || 'Failed to generate PowerPoint'}
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
                      Creating {slideCount}-slide anonymised training presentation
                    </p>
                  </>
                )}
              </div>

              {!isComplete && !hasFailed && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                  <Sparkles className="h-3 w-3" />
                  <span>Powered by NoteWell AI</span>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
