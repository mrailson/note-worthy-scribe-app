import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Brain, FileText, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ConsultationGeneratingStateProps {
  duration: string;
  wordCount: number;
}

export const ConsultationGeneratingState = ({
  duration,
  wordCount
}: ConsultationGeneratingStateProps) => {
  const [step, setStep] = useState(0);

  const steps = [
    { icon: Brain, label: 'Analysing transcript...', delay: 0 },
    { icon: FileText, label: 'Generating SOAP notes...', delay: 1500 },
    { icon: CheckCircle, label: 'Finalising notes...', delay: 3000 }
  ];

  useEffect(() => {
    const timers = steps.map((_, idx) => {
      if (idx === 0) return null;
      return setTimeout(() => setStep(idx), steps[idx].delay);
    });

    return () => {
      timers.forEach(timer => timer && clearTimeout(timer));
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 space-y-8">
          {/* Main Loading Indicator */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">
                Generating Notes
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                This usually takes 10-15 seconds
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            {steps.map((stepInfo, idx) => {
              const Icon = stepInfo.icon;
              const isActive = idx === step;
              const isComplete = idx < step;
              
              return (
                <div 
                  key={idx}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-primary/10 border border-primary/20' 
                      : isComplete 
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : 'bg-muted/50'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : isComplete 
                        ? 'bg-green-500 text-white' 
                        : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    {isComplete ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`
                    text-sm font-medium
                    ${isActive 
                      ? 'text-foreground' 
                      : isComplete 
                        ? 'text-green-700 dark:text-green-400' 
                        : 'text-muted-foreground'
                    }
                  `}>
                    {stepInfo.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Consultation Stats */}
          <div className="flex justify-center gap-6 pt-2 text-sm text-muted-foreground">
            <span>Duration: {duration}</span>
            <span>•</span>
            <span>{wordCount} words</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
