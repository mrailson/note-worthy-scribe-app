import { useEffect, useState } from "react";
import { FileText, Sparkles, Bot, Clock, Zap, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MeetingGenerationAnimationProps {
  isVisible: boolean;
  onDismiss?: () => void;
  estimatedTime?: number; // in seconds, default 45
  title?: string;
  subtitle?: string;
}

export const MeetingGenerationAnimation = ({ 
  isVisible, 
  onDismiss, 
  estimatedTime = 45,
  title = "Notewell AI",
  subtitle = "Analyzing transcript and generating comprehensive meeting notes"
}: MeetingGenerationAnimationProps) => {
  const [dots, setDots] = useState("");
  const [timeLeft, setTimeLeft] = useState(estimatedTime);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const phases = [
    { text: "Analyzing transcript structure", icon: FileText },
    { text: "Identifying key discussion points", icon: Sparkles },
    { text: "Extracting decisions and actions", icon: Zap },
    { text: "Formatting professional notes", icon: Bot },
  ];

  useEffect(() => {
    if (!isVisible) {
      setTimeLeft(estimatedTime);
      setProgress(0);
      setPhase(0);
      return;
    }

    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, estimatedTime - elapsed);
      const progressPercent = Math.min(100, (elapsed / estimatedTime) * 100);
      
      setTimeLeft(Math.ceil(remaining));
      setProgress(progressPercent);
      
      // Update phase based on progress
      const currentPhase = Math.min(phases.length - 1, Math.floor((elapsed / estimatedTime) * phases.length));
      setPhase(currentPhase);

      // Animated dots
      setDots(prev => {
        if (prev === "") return ".";
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return "";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible, estimatedTime]);

  if (!isVisible) return null;

  const CurrentPhaseIcon = phases[phase]?.icon || FileText;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[9999] flex items-center justify-center animate-fade-in">
      <div className="bg-card rounded-2xl p-8 shadow-2xl border max-w-lg mx-4 text-center relative animate-scale-in">
        {/* Dismiss button */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 h-8 w-8 p-0 hover-scale"
            onClick={onDismiss}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        
        {/* Main animated icon area */}
        <div className="relative mb-8 w-24 h-24 mx-auto">
          {/* Rotating outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"></div>
          </div>
          
          {/* Counter-rotating inner ring */}
          <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-primary/60 rounded-full"></div>
          </div>
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-full p-4 animate-pulse shadow-lg">
              <CurrentPhaseIcon className="h-8 w-8 text-primary-foreground animate-fade-in" />
            </div>
          </div>
          
          {/* Floating sparkles */}
          <div className="absolute -top-2 -right-2">
            <Sparkles className="h-4 w-4 text-primary animate-bounce" style={{ animationDelay: '0s' }} />
          </div>
          <div className="absolute -bottom-1 -left-2">
            <Sparkles className="h-3 w-3 text-primary/70 animate-bounce" style={{ animationDelay: '1s' }} />
          </div>
        </div>

        {/* Title and phase */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-center gap-2">
            <Bot className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-xl font-bold text-foreground animate-fade-in">
              {title}
            </h3>
            <Bot className="h-5 w-5 text-primary animate-pulse" />
          </div>
          
          <div className="text-muted-foreground animate-fade-in">
            {subtitle}
          </div>
          
          <div className="flex items-center justify-center gap-2 text-primary font-medium">
            <CurrentPhaseIcon className="h-4 w-4" />
            <span className="animate-fade-in">{phases[phase]?.text}{dots}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-3 mb-6">
          <Progress value={progress} className="w-full h-2 animate-fade-in" />
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>{Math.round(progress)}% complete</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="font-mono">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Phase indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {phases.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index <= phase 
                  ? 'bg-primary scale-110' 
                  : 'bg-muted-foreground/30 scale-75'
              }`}
            />
          ))}
        </div>

        {/* Footer tip */}
        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 animate-fade-in">
          <Eye className="h-3 w-3" />
          <span>Large transcripts may take longer to process</span>
        </div>
      </div>
    </div>
  );
};