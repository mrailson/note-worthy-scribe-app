import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useContentInfographic } from '@/hooks/useContentInfographic';
import { CheckCircle, AlertCircle, Image } from 'lucide-react';

interface ContentInfographicModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title?: string;
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  orientation?: 'portrait' | 'landscape';
}

const IMAGE_GENERATION_TIPS = [
  "Creating visual hierarchy for key information...",
  "Designing icons to represent main concepts...",
  "Applying professional colour palette...",
  "Organising content into visual sections...",
  "Ensuring British English spelling throughout...",
  "Optimising layout for printing...",
  "Adding visual flow indicators...",
  "Balancing text and graphics...",
  "Generating high-resolution output...",
];

export const ContentInfographicModal: React.FC<ContentInfographicModalProps> = ({
  isOpen,
  onClose,
  content,
  title = 'Infographic',
  imageModel = 'google/gemini-2.5-flash-image-preview',
  orientation = 'portrait',
}) => {
  const { generateInfographic, isGenerating, currentPhase, error } = useContentInfographic();
  
  const [progress, setProgress] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const generationResultRef = useRef<{ success: boolean; imageUrl?: string } | null>(null);

  // Start generation immediately when modal opens
  useEffect(() => {
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      setProgress(0);
      setIsComplete(false);
      generationResultRef.current = null;
      
      generateInfographic(content, title, { imageModel, orientation }).then((result) => {
        generationResultRef.current = result;
      });
    }
  }, [isOpen, hasStarted, content, title, imageModel, orientation, generateInfographic]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      setProgress(0);
      setCurrentTip(0);
      setIsComplete(false);
      generationResultRef.current = null;
    }
  }, [isOpen]);

  // Progress animation
  useEffect(() => {
    if (!isGenerating || isComplete) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (currentPhase === 'complete') return 100;
        if (currentPhase === 'downloading') return Math.min(prev + 5, 95);
        if (currentPhase === 'generating') return Math.min(prev + 1, 85);
        return Math.min(prev + 2, 20);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isGenerating, currentPhase, isComplete]);

  // Rotate tips
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % IMAGE_GENERATION_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Handle completion
  useEffect(() => {
    if (currentPhase === 'complete' && !error) {
      setProgress(100);
      setIsComplete(true);
    }
  }, [currentPhase, error]);

  const handleClose = () => {
    onClose();
  };

  const getPhaseLabel = () => {
    switch (currentPhase) {
      case 'preparing':
        return 'Preparing content...';
      case 'generating':
        return 'Generating infographic...';
      case 'downloading':
        return 'Downloading image...';
      case 'complete':
        return 'Infographic Ready!';
      default:
        return 'Processing...';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Creating Infographic
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
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          ) : isComplete ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">Infographic Ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Your infographic has been downloaded</p>
              </div>
              
              <Button variant="outline" onClick={handleClose} className="w-full">
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
                      strokeWidth="8"
                      fill="none"
                      className="text-muted"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * progress) / 100}
                      className="text-primary transition-all duration-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>

              {/* Phase label */}
              <div className="text-center">
                <p className="font-medium">{getPhaseLabel()}</p>
                <p className="text-sm text-muted-foreground mt-2 h-5 transition-opacity duration-300">
                  {IMAGE_GENERATION_TIPS[currentTip % IMAGE_GENERATION_TIPS.length]}
                </p>
              </div>

              {/* Linear progress bar */}
              <Progress value={progress} className="h-2" />

              <p className="text-xs text-center text-muted-foreground">
                This typically takes 30-60 seconds
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};