import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useContentInfographic } from '@/hooks/useContentInfographic';
import { useInfographicVideo } from '@/hooks/useInfographicVideo';
import { CheckCircle, AlertCircle, Image, Video, Download, Loader2 } from 'lucide-react';

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

const VIDEO_GENERATION_TIPS = [
  "Preparing animation sequence...",
  "Creating smooth reveal transitions...",
  "Rendering frame-by-frame animation...",
  "Processing video encoding...",
  "Optimising for smooth playback...",
  "Finalising video output...",
];

export const ContentInfographicModal: React.FC<ContentInfographicModalProps> = ({
  isOpen,
  onClose,
  content,
  title = 'Infographic',
  imageModel = 'google/gemini-2.5-flash-image-preview',
  orientation = 'portrait',
}) => {
  const { generateInfographic, isGenerating: isGeneratingImage, currentPhase: imagePhase, error: imageError } = useContentInfographic();
  const { generateVideo, isGenerating: isGeneratingVideo, currentPhase: videoPhase, error: videoError, reset: resetVideo } = useInfographicVideo();
  
  const [progress, setProgress] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showVideoOption, setShowVideoOption] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const generationResultRef = useRef<{ success: boolean; imageUrl?: string } | null>(null);

  // Start generation immediately when modal opens
  useEffect(() => {
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      setProgress(0);
      setShowVideoOption(false);
      setGeneratedImageBase64(null);
      generationResultRef.current = null;
      
      generateInfographic(content, title, { imageModel, orientation }).then((result) => {
        generationResultRef.current = result;
        if (result.success && result.imageUrl) {
          // Store the image URL/base64 for video generation
          setGeneratedImageBase64(result.imageUrl);
        }
      });
    }
  }, [isOpen, hasStarted, content, title, imageModel, orientation, generateInfographic]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      setProgress(0);
      setCurrentTip(0);
      setShowVideoOption(false);
      setGeneratedImageBase64(null);
      generationResultRef.current = null;
      resetVideo();
    }
  }, [isOpen, resetVideo]);

  // Progress animation for image generation
  useEffect(() => {
    if (!isGeneratingImage || showVideoOption) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (imagePhase === 'complete') return 100;
        if (imagePhase === 'downloading') return Math.min(prev + 5, 95);
        if (imagePhase === 'generating') return Math.min(prev + 1, 85);
        return Math.min(prev + 2, 20);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isGeneratingImage, imagePhase, showVideoOption]);

  // Progress animation for video generation
  useEffect(() => {
    if (!isGeneratingVideo) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (videoPhase === 'complete') return 100;
        if (videoPhase === 'downloading') return Math.min(prev + 3, 98);
        if (videoPhase === 'generating' || videoPhase === 'polling') return Math.min(prev + 0.5, 90);
        return Math.min(prev + 2, 15);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGeneratingVideo, videoPhase]);

  // Rotate tips based on current mode
  useEffect(() => {
    if (!isGeneratingImage && !isGeneratingVideo) return;

    const tips = isGeneratingVideo ? VIDEO_GENERATION_TIPS : IMAGE_GENERATION_TIPS;
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % tips.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isGeneratingImage, isGeneratingVideo]);

  // Show video option when image generation completes
  useEffect(() => {
    if (imagePhase === 'complete' && !imageError && generatedImageBase64) {
      setProgress(100);
      setShowVideoOption(true);
    }
  }, [imagePhase, imageError, generatedImageBase64]);

  // Handle video generation completion
  useEffect(() => {
    if (videoPhase === 'complete') {
      setProgress(100);
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [videoPhase, onClose]);

  const handleCreateVideo = async () => {
    if (!generatedImageBase64) {
      return;
    }
    
    setProgress(0);
    setCurrentTip(0);
    await generateVideo(generatedImageBase64, orientation, title);
  };

  const handleClose = () => {
    onClose();
  };

  const getPhaseLabel = () => {
    if (isGeneratingVideo) {
      switch (videoPhase) {
        case 'uploading':
          return 'Preparing image...';
        case 'generating':
        case 'polling':
          return 'Generating video (this may take 1-2 minutes)...';
        case 'downloading':
          return 'Downloading video...';
        case 'complete':
          return 'Complete!';
        case 'error':
          return 'Error';
        default:
          return 'Processing...';
      }
    }
    
    switch (imagePhase) {
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

  const tips = isGeneratingVideo ? VIDEO_GENERATION_TIPS : IMAGE_GENERATION_TIPS;
  const currentError = videoError || imageError;
  const isComplete = showVideoOption && !isGeneratingVideo;
  const isVideoComplete = videoPhase === 'complete';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGeneratingVideo ? (
              <>
                <Video className="h-5 w-5 text-primary" />
                Creating Video
              </>
            ) : (
              <>
                <Image className="h-5 w-5 text-primary" />
                Creating Infographic
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {currentError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Generation Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{currentError}</p>
              </div>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          ) : isVideoComplete ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">Video Ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Your video has been downloaded</p>
              </div>
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
              
              <div className="w-full space-y-3 pt-2">
                <Button 
                  onClick={handleCreateVideo} 
                  className="w-full"
                  disabled={isGeneratingVideo}
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Create Reveal Video
                    </>
                  )}
                </Button>
                
                <Button variant="outline" onClick={handleClose} className="w-full">
                  Done
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Video generation creates a smooth animation from white to the full infographic (takes 1-2 minutes)
              </p>
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
                  {tips[currentTip % tips.length]}
                </p>
              </div>

              {/* Linear progress bar */}
              <Progress value={progress} className="h-2" />

              <p className="text-xs text-center text-muted-foreground">
                {isGeneratingVideo 
                  ? 'Video generation typically takes 1-2 minutes'
                  : 'This typically takes 30-60 seconds'
                }
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
