import { useEffect, useState } from "react";
import { FileText, Sparkles, Bot } from "lucide-react";

interface NotewellAIAnimationProps {
  isVisible: boolean;
}

export const NotewellAIAnimation = ({ isVisible }: NotewellAIAnimationProps) => {
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
      <div className="bg-card rounded-lg p-8 shadow-lg border max-w-md mx-4 text-center">
        <div className="relative mb-6">
          {/* Animated circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-ping"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/40 animate-ping" style={{ animationDelay: '200ms' }}></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-primary/60 animate-ping" style={{ animationDelay: '400ms' }}></div>
          </div>
          
          {/* Central icon */}
          <div className="relative z-10 flex items-center justify-center w-20 h-20 mx-auto">
            <div className="bg-primary rounded-full p-4 animate-pulse">
              <Bot className="h-8 w-8 text-primary-foreground" />
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
            <span>Generating meeting notes{dots}</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Creating comprehensive notes from your recording
          </div>
        </div>
      </div>
    </div>
  );
};