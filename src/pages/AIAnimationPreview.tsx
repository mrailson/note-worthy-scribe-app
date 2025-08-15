import { useState } from "react";
import { AIThinkingOptions } from "../components/AIThinkingOptions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function AIAnimationPreview() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

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
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            AI Thinking Animation Options
          </h1>
          <p className="text-muted-foreground">
            Choose from 8 different animation styles to replace the spinning circles
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {options.map((option) => (
            <Card key={option.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <CardTitle className="text-lg">Option {option.id}</CardTitle>
                <CardDescription className="font-medium">{option.name}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {option.description}
                </p>
                <Button
                  onClick={() => setSelectedOption(option.id)}
                  variant="outline"
                  className="w-full"
                >
                  Preview
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedOption && (
          <div className="text-center">
            <Button
              onClick={() => setSelectedOption(null)}
              variant="secondary"
              className="mb-4"
            >
              Close Preview
            </Button>
          </div>
        )}
      </div>

      <AIThinkingOptions 
        isVisible={selectedOption !== null} 
        option={selectedOption || 1} 
      />
    </div>
  );
}