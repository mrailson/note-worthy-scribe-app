import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useComplaintInfographic } from '@/hooks/useComplaintInfographic';
import { toast } from 'sonner';

interface ComplaintInfographicData {
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
}

interface ComplaintInfographicModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaintData: ComplaintInfographicData;
}

const GENERATION_TIPS = [
  "Preparing complaint learning overview...",
  "Anonymising patient and staff details...",
  "Extracting key learnings for the team...",
  "Highlighting what the practice did well...",
  "Designing improvement areas...",
  "Creating a friendly, supportive layout...",
  "Adding professional NHS styling...",
  "Almost ready! Finalising your infographic...",
];

const TOTAL_DURATION = 60;

export const ComplaintInfographicModal: React.FC<ComplaintInfographicModalProps> = ({
  isOpen,
  onClose,
  complaintData,
}) => {
  const { generateInfographic, downloadInfographic, isGenerating, currentPhase, error } = useComplaintInfographic();
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_DURATION);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tipTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && !hasStarted && !isComplete) {
      setHasStarted(true);
      setTimeRemaining(TOTAL_DURATION);
      setCurrentTipIndex(0);
      setIsComplete(false);
      setHasFailed(false);

      generateInfographic(complaintData).then((result) => {
        if (result.success) {
          setIsComplete(true);
          // Auto-download from the hook
          downloadInfographic(complaintData.referenceNumber);
          toast.success('Staff learning infographic downloaded!');
          setTimeout(() => onClose(), 2000);
        } else {
          setHasFailed(true);
          toast.error(result.error || 'Failed to generate infographic');
        }
      });
    }
  }, [isOpen, hasStarted, isComplete, generateInfographic, downloadInfographic, complaintData, onClose]);

  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      tipTimerRef.current = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % GENERATION_TIPS.length);
      }, 6000);
      return () => { if (tipTimerRef.current) clearInterval(tipTimerRef.current); };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

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
  const circumference = 2 * Math.PI * 45;
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
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <span className="font-semibold text-foreground">
              {isComplete ? 'Complete!' : hasFailed ? 'Generation Failed' : 'Creating Staff Learning Infographic'}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 flex flex-col items-center space-y-6">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64" cy="64" r="45"
                stroke="currentColor" strokeWidth="8" fill="none"
                className="text-muted/30"
              />
              <circle
                cx="64" cy="64" r="45"
                stroke="url(#complaint-infographic-gradient)" strokeWidth="8" fill="none"
                strokeLinecap="round"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: isComplete ? 0 : strokeDashoffset,
                  transition: 'stroke-dashoffset 1s ease-in-out',
                }}
              />
              <defs>
                <linearGradient id="complaint-infographic-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
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
                Your staff learning infographic has been downloaded!
              </p>
            ) : hasFailed ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">
                  {error || 'Failed to generate infographic'}
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
                  Creating anonymised learning overview for your team
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
