import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { FileText, Sparkles, Bot, Brain, Lightbulb, Zap, Target, Cpu } from "lucide-react";

export default function AIAnimationPreview() {
  const options = [
    { id: 1, name: "Typing Dots", description: "Three bouncing dots below the icon" },
    { id: 2, name: "Pulsing Brain", description: "Brain icon with gentle pulse and expanding ring" },
    { id: 3, name: "Floating Particles", description: "Lightbulb with particles floating around it" },
    { id: 4, name: "Morphing Shape", description: "Shape that morphs from circle to square with lightning" },
    { id: 5, name: "Loading Bars", description: "Equalizer-style bars with target icon" },
    { id: 6, name: "Breathing Circle", description: "Gentle breathing animation with CPU icon" },
    { id: 7, name: "Rotating Gears", description: "Two gears rotating in opposite directions" },
    { id: 8, name: "Sound Wave", description: "Audio wave animation with document icon" }
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            AI Thinking Animation Options
          </h1>
          <p className="text-muted-foreground">
            All 8 animation styles displayed simultaneously - choose your favorite!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {options.map((option) => (
            <Card key={option.id} className="relative overflow-hidden">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Option {option.id}</CardTitle>
                <CardDescription className="font-medium">{option.name}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="h-32 flex items-center justify-center mb-4 bg-muted/20 rounded-lg relative">
                  <MiniAnimation option={option.id} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mini version of each animation for the grid display
const MiniAnimation = ({ option }: { option: number }) => {
  switch (option) {
    case 1:
      return (
        <div className="flex flex-col items-center">
          <div className="bg-primary rounded-full p-2 mb-2">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );

    case 2:
      return (
        <div className="relative">
          <div className="bg-primary rounded-full p-2 animate-pulse">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-primary/30 animate-ping"></div>
          </div>
        </div>
      );

    case 3:
      return (
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary rounded-full p-2">
              <Lightbulb className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-primary/60 rounded-full animate-ping"
              style={{
                top: `${10 + Math.sin(i * 90 * Math.PI / 180) * 15}px`,
                left: `${10 + Math.cos(i * 90 * Math.PI / 180) * 15}px`,
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
      );

    case 4:
      return (
        <div className="relative">
          <div 
            className="w-8 h-8 bg-primary flex items-center justify-center animate-pulse"
            style={{ 
              borderRadius: '50%',
              animation: 'morph 2s ease-in-out infinite'
            }}
          >
            <Zap className="h-4 w-4 text-primary-foreground" />
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
      return (
        <div className="flex flex-col items-center">
          <div className="bg-primary rounded-full p-2 mb-2">
            <Target className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${8 + i * 2}px`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
        </div>
      );

    case 6:
      return (
        <div className="relative">
          <div 
            className="w-10 h-10 bg-primary rounded-full flex items-center justify-center"
            style={{ animation: 'breathe 2s ease-in-out infinite' }}
          >
            <Cpu className="h-4 w-4 text-primary-foreground" />
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
      return (
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-primary rounded-full p-1.5 animate-spin" style={{ animationDuration: '3s' }}>
              <Bot className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          <div className="absolute top-0 right-1 flex items-center justify-center">
            <div className="bg-primary/70 rounded-full p-1 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
              <Sparkles className="h-2 w-2 text-primary-foreground" />
            </div>
          </div>
        </div>
      );

    case 8:
      return (
        <div className="relative">
          <div className="flex flex-col items-center">
            <div className="bg-primary rounded-full p-2 mb-2">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 h-4 bg-primary/60 rounded-full"
                  style={{
                    animation: `wave 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
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