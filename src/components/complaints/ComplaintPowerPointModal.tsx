import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Presentation,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Download,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { useComplaintPowerPoint } from '@/hooks/useComplaintPowerPoint';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  complaintId?: string;
  complaintData: ComplaintPowerPointData;
}

const SLIDE_COUNT_PRESETS = [
  { label: 'Quick', value: 4, description: '4 slides' },
  { label: 'Standard', value: 6, description: '6 slides' },
  { label: 'Detailed', value: 8, description: '8 slides' },
  { label: 'Comprehensive', value: 10, description: '10 slides' },
];

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
  complaintId,
  complaintData,
}) => {
  const { generatePowerPoint, isGenerating, currentPhase, error } = useComplaintPowerPoint(complaintId);
  const [slideCount, setSlideCount] = useState(6);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tipTimerRef = useRef<NodeJS.Timeout | null>(null);

  const estimatedDuration = slideCount * 15;

  // Countdown timer during generation
  useEffect(() => {
    if (isOpen && hasStarted && !isComplete && !hasFailed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [isOpen, hasStarted, isComplete, hasFailed]);

  // Rotating tips during generation
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

  const handleGenerate = async () => {
    setHasStarted(true);
    setIsComplete(false);
    setHasFailed(false);
    setTimeRemaining(estimatedDuration);
    setCurrentTipIndex(0);

    const result = await generatePowerPoint(complaintData, slideCount);
    if (result.success) {
      setIsComplete(true);
      toast.success('Staff training PowerPoint downloaded!');
      setTimeout(() => onClose(), 2500);
    } else {
      setHasFailed(true);
      toast.error(result.error || 'Failed to generate PowerPoint');
    }
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    onClose();
  };

  const progress = estimatedDuration > 0
    ? Math.min(((estimatedDuration - timeRemaining) / estimatedDuration) * 100, 100)
    : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPresetLabel = () => {
    const preset = SLIDE_COUNT_PRESETS.find(p => p.value === slideCount);
    return preset?.label || 'Custom';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-4 pb-3 border-b bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Presentation className="h-5 w-5 text-primary" />
              Staff Training PowerPoint
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-5">
            {/* Pre-generation config — shown before starting */}
            {!hasStarted && (
              <>
                {/* Complaint Summary */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Complaint Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Reference:</span>{' '}
                        <span className="font-medium">{complaintData.referenceNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Category:</span>{' '}
                        <span className="font-medium">{complaintData.category}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Badge variant="secondary" className="text-xs">Speaker Notes</Badge>
                      <Badge variant="secondary" className="text-xs">AI Images</Badge>
                      <Badge variant="secondary" className="text-xs">Anonymised</Badge>
                      <Badge variant="secondary" className="text-xs">Just Culture</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Slide Count Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      Number of Slides
                    </Label>
                    <span className="text-sm font-medium text-primary">{slideCount} slides</span>
                  </div>

                  {/* Quick presets */}
                  <div className="grid grid-cols-4 gap-2">
                    {SLIDE_COUNT_PRESETS.map((preset) => (
                      <Card
                        key={preset.value}
                        className={cn(
                          "cursor-pointer transition-all hover:border-primary/50",
                          slideCount === preset.value && "border-primary bg-primary/5"
                        )}
                        onClick={() => setSlideCount(preset.value)}
                      >
                        <CardContent className="p-2 text-center">
                          <p className="text-xs font-medium">{preset.label}</p>
                          <p className="text-[10px] text-muted-foreground">{preset.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Slider for fine control */}
                  <Slider
                    value={[slideCount]}
                    onValueChange={(value) => setSlideCount(value[0])}
                    min={4}
                    max={15}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>4</span>
                    <span>15</span>
                  </div>
                </div>

                {/* Estimated time */}
                <div className="text-sm text-muted-foreground text-center">
                  Estimated generation time:{' '}
                  <span className="font-medium">
                    {Math.ceil((slideCount * 15) / 60)} min{Math.ceil((slideCount * 15) / 60) > 1 ? 's' : ''}
                  </span>
                  {' '}(~15s per slide)
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate {slideCount}-Slide Presentation
                </Button>
              </>
            )}

            {/* Generation in progress */}
            {hasStarted && !isComplete && !hasFailed && (
              <div className="space-y-5">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="font-medium">Creating your presentation...</span>
                    </div>

                    <Progress value={progress} className="h-2" />

                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground animate-pulse min-h-[20px]">
                        {GENERATION_TIPS[currentTipIndex]}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {slideCount} slides • Estimated {formatTime(timeRemaining)} remaining
                      </p>
                    </div>

                    <Button variant="outline" onClick={handleClose} className="w-full">
                      Cancel
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>Powered by NoteWell AI</span>
                </div>
              </div>
            )}

            {/* Success */}
            {isComplete && (
              <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <div className="text-center">
                      <h4 className="font-medium text-green-800">Presentation Ready!</h4>
                      <p className="text-sm text-green-600 mt-1">
                        Your {slideCount}-slide staff training PowerPoint has been downloaded.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {hasFailed && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Generation Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {error || 'Failed to generate PowerPoint. Please try again.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHasStarted(false);
                        setHasFailed(false);
                      }}
                      className="flex-1"
                    >
                      Try Again
                    </Button>
                    <Button variant="ghost" onClick={handleClose} className="flex-1">
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
