import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useContentInfographic, BrandingLevel, LogoPlacement } from '@/hooks/useContentInfographic';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { CheckCircle, AlertCircle, Image, Building2, ImageIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PracticeContext } from '@/types/ai4gp';

interface ContentInfographicModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title?: string;
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  orientation?: 'portrait' | 'landscape';
  // Allow passing practice context from parent (optional)
  practiceContextOverride?: PracticeContext;
}

const GENERATION_TIPS = [
  "Creating visual hierarchy for key information...",
  "Designing icons to represent main concepts...",
  "Applying professional colour palette...",
  "Organising content into visual sections...",
  "Ensuring British English spelling throughout...",
  "Optimising layout for A4 printing...",
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
  practiceContextOverride,
}) => {
  const { generateInfographic, isGenerating, currentPhase, error } = useContentInfographic();
  const { practiceContext: hookPracticeContext } = usePracticeContext();
  
  // Use override if provided, otherwise use hook
  const practiceContext = practiceContextOverride || hookPracticeContext;
  
  const [progress, setProgress] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Branding options state
  const [showBrandingStep, setShowBrandingStep] = useState(true);
  const [includeBranding, setIncludeBranding] = useState(false);
  const [brandingLevel, setBrandingLevel] = useState<BrandingLevel>('name-only');
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>('top-right');
  
  // Check if practice has logo available
  const hasLogo = !!practiceContext?.logoUrl;
  const hasPracticeDetails = !!practiceContext?.practiceName;

  // Start generation
  const startGeneration = () => {
    setShowBrandingStep(false);
    setHasStarted(true);
    setProgress(0);
    generateInfographic(content, title, { 
      imageModel, 
      orientation,
      practiceContext,
      includeBranding,
      brandingLevel,
      includeLogo: includeLogo && hasLogo,
      logoPlacement,
    });
  };

  // Skip branding and generate immediately
  const skipBranding = () => {
    setShowBrandingStep(false);
    setHasStarted(true);
    setProgress(0);
    generateInfographic(content, title, { imageModel, orientation });
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      setProgress(0);
      setCurrentTip(0);
      setShowBrandingStep(true);
      // Reset branding options to defaults
      setIncludeBranding(false);
      setBrandingLevel('name-only');
      setIncludeLogo(false);
      setLogoPlacement('top-right');
    }
  }, [isOpen]);

  // Progress animation
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (currentPhase === 'complete') return 100;
        if (currentPhase === 'downloading') return Math.min(prev + 5, 95);
        if (currentPhase === 'generating') return Math.min(prev + 1, 85);
        return Math.min(prev + 2, 20);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isGenerating, currentPhase]);

  // Rotate tips
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % GENERATION_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Auto-close on completion
  useEffect(() => {
    if (currentPhase === 'complete') {
      setProgress(100);
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, onClose]);

  const getPhaseLabel = () => {
    switch (currentPhase) {
      case 'preparing':
        return 'Preparing content...';
      case 'generating':
        return 'Generating infographic...';
      case 'downloading':
        return 'Downloading image...';
      case 'complete':
        return 'Complete!';
      default:
        return 'Processing...';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            {showBrandingStep ? 'Infographic Options' : 'Creating Infographic'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {showBrandingStep ? (
            // Branding options step
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Would you like to include practice branding in your infographic?
              </p>
              
              {/* Include branding toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="include-branding" className="text-sm font-medium">
                    Include practice branding
                  </Label>
                </div>
                <Switch
                  id="include-branding"
                  checked={includeBranding}
                  onCheckedChange={setIncludeBranding}
                  disabled={!hasPracticeDetails}
                />
              </div>
              
              {!hasPracticeDetails && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  No practice details configured. Set up your practice in Settings to enable branding.
                </p>
              )}
              
              {/* Branding options (shown when branding enabled) */}
              {includeBranding && hasPracticeDetails && (
                <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                  {/* Practice name preview */}
                  <p className="text-sm font-medium text-primary">
                    {practiceContext?.practiceName}
                  </p>
                  
                  {/* Branding level selector */}
                  <div className="space-y-2">
                    <Label className="text-sm">Branding detail</Label>
                    <Select value={brandingLevel} onValueChange={(v) => setBrandingLevel(v as BrandingLevel)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-only">Name only</SelectItem>
                        <SelectItem value="name-address">Name + Address</SelectItem>
                        <SelectItem value="full">Full (Name, Address, Contact)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Logo toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="include-logo" className="text-sm">
                        Reserve space for logo
                      </Label>
                    </div>
                    <Switch
                      id="include-logo"
                      checked={includeLogo}
                      onCheckedChange={setIncludeLogo}
                      disabled={!hasLogo}
                    />
                  </div>
                  
                  {!hasLogo && (
                    <p className="text-xs text-muted-foreground">
                      No logo uploaded. Add one in Practice Settings.
                    </p>
                  )}
                  
                  {/* Logo placement (shown when logo enabled) */}
                  {includeLogo && hasLogo && (
                    <div className="space-y-2">
                      <Label className="text-sm">Logo position</Label>
                      <Select value={logoPlacement} onValueChange={(v) => setLogoPlacement(v as LogoPlacement)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top-left">Top Left</SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={skipBranding} className="flex-1">
                  Skip
                </Button>
                <Button onClick={startGeneration} className="flex-1">
                  Generate
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Generation Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          ) : currentPhase === 'complete' ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">Infographic Ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Your download should start automatically</p>
              </div>
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
                  {GENERATION_TIPS[currentTip]}
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
