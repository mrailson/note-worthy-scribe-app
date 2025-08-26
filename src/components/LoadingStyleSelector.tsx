import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface LoadingStyleSelectorProps {
  onStyleSelect: (style: string) => void;
  currentStyle?: string;
}

export const LoadingStyleSelector: React.FC<LoadingStyleSelectorProps> = ({
  onStyleSelect,
  currentStyle = 'dots'
}) => {
  const [selectedStyle, setSelectedStyle] = useState(currentStyle);

  const handleSelectStyle = (style: string) => {
    setSelectedStyle(style);
    onStyleSelect(style);
  };

  const LoadingStyle1 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="animate-pulse">●</span>
      <span className="animate-pulse delay-100">●</span>
      <span className="animate-pulse delay-200">●</span>
    </span>
  );

  const LoadingStyle2 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full"></span>
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full delay-100"></span>
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full delay-200"></span>
    </span>
  );

  const LoadingStyle3 = () => (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.3s]"></span>
    </span>
  );

  const LoadingStyle4 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce"></span>
      <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-75"></span>
      <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-150"></span>
    </span>
  );

  const styles = [
    {
      id: 'dots',
      name: 'Pulsing Dots',
      description: 'Classic three-dot pulse animation',
      component: <LoadingStyle1 />
    },
    {
      id: 'spinners',
      name: 'Spinning Circles',
      description: 'Three spinning circular indicators',
      component: <LoadingStyle2 />
    },
    {
      id: 'wave',
      name: 'Wave Animation',
      description: 'Vertical bars with wave motion',
      component: <LoadingStyle3 />
    },
    {
      id: 'bounce',
      name: 'Bouncing Dots',
      description: 'Three dots with bounce animation',
      component: <LoadingStyle4 />
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose AI Thinking Animation Style</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select your preferred animation for when the AI is processing your request
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {styles.map((style) => (
          <Card 
            key={style.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedStyle === style.id 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => handleSelectStyle(style.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{style.name}</CardTitle>
                {selectedStyle === style.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <CardDescription className="text-xs">
                {style.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-center h-12 bg-muted/30 rounded">
                {style.component}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="flex justify-center pt-4">
        <Button 
          onClick={() => {
            // Close the selector or apply the choice
            console.log(`Selected style: ${selectedStyle}`);
          }}
          className="min-w-32"
        >
          Apply Style
        </Button>
      </div>
    </div>
  );
};

export default LoadingStyleSelector;