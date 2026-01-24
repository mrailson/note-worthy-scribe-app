import React from 'react';
import { cn } from '@/lib/utils';
import { Mic, Languages } from 'lucide-react';

export type DictateMode = 'dictate' | 'translate';

interface AdminDictateModeSelectorProps {
  mode: DictateMode;
  onModeChange: (mode: DictateMode) => void;
  disabled?: boolean;
}

export const AdminDictateModeSelector: React.FC<AdminDictateModeSelectorProps> = ({
  mode,
  onModeChange,
  disabled = false
}) => {
  return (
    <div className="w-full">
      <div 
        className={cn(
          "relative flex rounded-xl p-1 bg-muted/50 border transition-all",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Sliding background indicator */}
        <div 
          className={cn(
            "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-md transition-all duration-300 ease-out",
            mode === 'dictate' ? "left-1" : "left-[calc(50%+2px)]"
          )}
        />
        
        {/* Free Dictation Option */}
        <button
          type="button"
          onClick={() => onModeChange('dictate')}
          className={cn(
            "relative flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-lg transition-colors z-10",
            mode === 'dictate' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            mode === 'dictate' 
              ? "bg-primary/10 scale-110" 
              : "bg-muted"
          )}>
            <Mic className={cn(
              "w-6 h-6 transition-all duration-300",
              mode === 'dictate' && "text-primary"
            )} />
          </div>
          <div className="text-center">
            <p className={cn(
              "font-semibold text-sm transition-colors",
              mode === 'dictate' ? "text-foreground" : "text-muted-foreground"
            )}>
              Free Dictation
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Speak & transcribe
            </p>
          </div>
        </button>

        {/* Translate Live Option */}
        <button
          type="button"
          onClick={() => onModeChange('translate')}
          className={cn(
            "relative flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-lg transition-colors z-10",
            mode === 'translate' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            mode === 'translate' 
              ? "bg-violet-500/10 scale-110" 
              : "bg-muted"
          )}>
            <Languages className={cn(
              "w-6 h-6 transition-all duration-300",
              mode === 'translate' && "text-violet-500"
            )} />
          </div>
          <div className="text-center">
            <p className={cn(
              "font-semibold text-sm transition-colors",
              mode === 'translate' ? "text-foreground" : "text-muted-foreground"
            )}>
              Translate Live
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              2-way patient translation
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
