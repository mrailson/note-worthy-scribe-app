import { useEffect, useState } from "react";
import { FileText, Sparkles, Bot, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotewellAIAnimationProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export const NotewellAIAnimation = ({ isVisible, onDismiss }: NotewellAIAnimationProps) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === "") return ".";
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return "";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-lg p-8 shadow-lg border max-w-md mx-4 text-center relative">
        {/* Dismiss button */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0"
            onClick={onDismiss}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        
        <div className="relative mb-6 w-20 h-20 mx-auto">
          {/* Main rotating gear */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary rounded-full p-3 animate-spin" style={{ animationDuration: '3s' }}>
              <Bot className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          
          {/* Secondary rotating gear */}
          <div className="absolute top-0 right-2 flex items-center justify-center">
            <div className="bg-primary/70 rounded-full p-2 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold text-foreground">
              Notewell AI
            </h3>
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Generating notes{dots}</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Creating comprehensive notes from your recording
          </div>
          
          <div className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Eye className="h-3 w-3" />
            <span>Tap eye icon to see debug info</span>
          </div>
        </div>
      </div>
    </div>
  );
};