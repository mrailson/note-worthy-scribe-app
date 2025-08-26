import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoadingAnimationDemo() {
  const navigate = useNavigate();

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
      name: 'Style 1: Pulsing Dots',
      description: 'Classic three-dot pulse animation (current)',
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/ai4gp')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to AI4GP
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">AI Loading Animation Styles</h1>
            <p className="text-muted-foreground text-lg">
              Choose your preferred animation for when the AI is thinking
            </p>
          </div>
        </div>
        
        {/* Animation Styles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {styles.map((style, index) => (
            <Card key={index} className="hover:shadow-lg transition-all duration-200 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center justify-between">
                  {style.name}
                  {index === 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-base">{style.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-20 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground font-medium">AI is thinking</span>
                    {style.component}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview Section */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              See how each animation looks in a realistic chat message context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {styles.map((style, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm text-gray-600 mb-2">
                      Let me help you with information about diabetes management...
                    </p>
                    <div className="flex items-center gap-2">
                      {style.component}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <Card className="bg-blue-50 dark:bg-blue-950/50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-blue-800 dark:text-blue-200">
                <strong>How to choose:</strong> Look at each animation above and see which one feels most pleasant and professional to you. 
                Let me know which style number you prefer (1, 2, 3, or 4) and I'll implement it in the AI chat.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}