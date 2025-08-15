import { useEffect, useState } from "react";
import { FileText, Sparkles, Bot, Brain, Lightbulb, Zap, Target, Cpu } from "lucide-react";

interface AIThinkingOptionProps {
  isVisible: boolean;
  option: number;
}

export const AIThinkingOptions = ({ isVisible, option }: AIThinkingOptionProps) => {
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

  const renderOption = () => {
    switch (option) {
      case 1:
        // Option 1: Typing Dots Animation
        return (
          <div className="relative mb-6">
            <div className="bg-primary rounded-full p-4">
              <Bot className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="flex items-center justify-center mt-4 space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        );

      case 2:
        // Option 2: Pulsing Brain
        return (
          <div className="relative mb-6">
            <div className="bg-primary rounded-full p-4 animate-pulse">
              <Brain className="h-8 w-8 text-primary-foreground animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-2 border-primary/30 animate-ping"></div>
            </div>
          </div>
        );

      case 3:
        // Option 3: Floating Particles
        return (
          <div className="relative mb-6 w-20 h-20 mx-auto">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-primary rounded-full p-4">
                <Lightbulb className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-primary/60 rounded-full animate-ping"
                style={{
                  top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 30}px`,
                  left: `${20 + Math.cos(i * 60 * Math.PI / 180) * 30}px`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
        );

      case 4:
        // Option 4: Morphing Squares to Circle
        return (
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-primary animate-pulse" 
                 style={{ 
                   borderRadius: '50%',
                   animation: 'morph 2s ease-in-out infinite'
                 }}>
              <div className="flex items-center justify-center w-full h-full">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <style>{`
              @keyframes morph {
                0%, 100% { border-radius: 50%; }
                50% { border-radius: 20%; }
              }
            `}</style>
          </div>
        );

      case 5:
        // Option 5: Loading Bars
        return (
          <div className="relative mb-6">
            <div className="bg-primary rounded-full p-4 mb-4">
              <Target className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="flex space-x-1 justify-center">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${20 + i * 5}px`,
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 6:
        // Option 6: Breathing Circle
        return (
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto bg-primary rounded-full flex items-center justify-center"
                 style={{ animation: 'breathe 2s ease-in-out infinite' }}>
              <Cpu className="h-8 w-8 text-primary-foreground" />
            </div>
            <style>{`
              @keyframes breathe {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
              }
            `}</style>
          </div>
        );

      case 7:
        // Option 7: Rotating Gears (using multiple bots)
        return (
          <div className="relative mb-6 w-20 h-20 mx-auto">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-primary rounded-full p-3 animate-spin" style={{ animationDuration: '3s' }}>
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="absolute top-0 right-2 flex items-center justify-center">
              <div className="bg-primary/70 rounded-full p-2 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
        );

      case 8:
        // Option 8: Wave Animation
        return (
          <div className="relative mb-6">
            <div className="bg-primary rounded-full p-4">
              <FileText className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="flex justify-center mt-4 space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-8 bg-primary/60 rounded-full"
                  style={{
                    animation: `wave 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
            <style>{`
              @keyframes wave {
                0%, 100% { transform: scaleY(0.5); }
                50% { transform: scaleY(1); }
              }
            `}</style>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-lg p-8 shadow-lg border max-w-md mx-4 text-center">
        {renderOption()}

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
            Option {option}: Animation Style {option}
          </div>
        </div>
      </div>
    </div>
  );
};