import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const AILoadingDemo: React.FC = () => {
  // Style 1: Current Pulsing Dots
  const Style1 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="animate-pulse">●</span>
      <span className="animate-pulse delay-100">●</span>
      <span className="animate-pulse delay-200">●</span>
    </span>
  );

  // Style 2: Spinning Circles
  const Style2 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full"></span>
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full delay-100"></span>
      <span className="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full delay-200"></span>
    </span>
  );

  // Style 3: Wave Animation
  const Style3 = () => (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></span>
      <span className="w-1 h-3 bg-current rounded-full animate-[wave_1.2s_ease-in-out_infinite_0.3s]"></span>
    </span>
  );

  // Style 4: Bouncing Dots
  const Style4 = () => (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce"></span>
      <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-75"></span>
      <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-150"></span>
    </span>
  );

  const styles = [
    {
      name: 'Style 1: Pulsing Dots (Current)',
      description: 'Classic three-dot pulse animation',
      component: <Style1 />
    },
    {
      name: 'Style 2: Spinning Circles',
      description: 'Three spinning circular indicators',
      component: <Style2 />
    },
    {
      name: 'Style 3: Wave Animation', 
      description: 'Vertical bars with wave motion',
      component: <Style3 />
    },
    {
      name: 'Style 4: Bouncing Dots',
      description: 'Three dots with bounce animation',
      component: <Style4 />
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">AI Loading Animation Styles</h2>
        <p className="text-muted-foreground">
          Choose your preferred animation for when the AI is thinking
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {styles.map((style, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{style.name}</CardTitle>
              <CardDescription>{style.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-16 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground mr-2">AI is thinking</div>
                {style.component}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center text-sm text-muted-foreground mt-8">
        <p>Each animation shows while the AI processes your request</p>
      </div>
    </div>
  );
};

export default AILoadingDemo;