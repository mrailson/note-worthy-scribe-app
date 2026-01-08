import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User, Users, Mic } from 'lucide-react';

interface SpeakerModeToggleProps {
  mode: 'gp' | 'patient';
  onModeChange: (mode: 'gp' | 'patient') => void;
  disabled?: boolean;
  isListening?: boolean;
}

export const SpeakerModeToggle: React.FC<SpeakerModeToggleProps> = ({
  mode,
  onModeChange,
  disabled,
  isListening
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === 'gp' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-4 flex flex-col gap-2 relative",
            mode === 'gp' && isListening && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => onModeChange('gp')}
          disabled={disabled}
        >
          {mode === 'gp' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <User className="h-6 w-6" />
          <div className="text-center">
            <div className="font-semibold">GP Speaking</div>
            <div className="text-xs opacity-70">English</div>
          </div>
        </Button>
        
        <Button
          variant={mode === 'patient' ? 'default' : 'outline'}
          className={cn(
            "h-auto py-4 flex flex-col gap-2 relative",
            mode === 'patient' && isListening && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => onModeChange('patient')}
          disabled={disabled}
        >
          {mode === 'patient' && isListening && (
            <span className="absolute top-2 right-2">
              <Mic className="h-4 w-4 animate-pulse text-red-500" />
            </span>
          )}
          <Users className="h-6 w-6" />
          <div className="text-center">
            <div className="font-semibold">Patient Speaking</div>
            <div className="text-xs opacity-70">Their Language</div>
          </div>
        </Button>
      </div>
      
      <div className="text-center">
        <span className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
          mode === 'gp' 
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" 
            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        )}>
          {isListening ? (
            <>
              <Mic className="h-3 w-3 animate-pulse" />
              Listening for {mode === 'gp' ? 'English' : 'patient\'s language'}...
            </>
          ) : (
            <>
              {mode === 'gp' ? 'GP mode: English → Patient language' : 'Patient mode: Their language → English'}
            </>
          )}
        </span>
      </div>
    </div>
  );
};
