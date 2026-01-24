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
          "relative flex rounded-lg p-0.5 bg-muted/50 border transition-all",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Sliding background indicator */}
        <div 
          className={cn(
            "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-background shadow-sm transition-all duration-300 ease-out",
            mode === 'dictate' ? "left-0.5" : "left-[calc(50%+1px)]"
          )}
        />
        
        {/* Free Dictation Option */}
        <button
          type="button"
          onClick={() => onModeChange('dictate')}
          className={cn(
            "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-colors z-10",
            mode === 'dictate' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Mic className={cn(
            "w-4 h-4 transition-all duration-300",
            mode === 'dictate' && "text-primary"
          )} />
          <span className={cn(
            "font-medium text-sm transition-colors",
            mode === 'dictate' ? "text-foreground" : "text-muted-foreground"
          )}>
            Free Dictation
          </span>
        </button>

        {/* Translate Live Option */}
        <button
          type="button"
          onClick={() => onModeChange('translate')}
          className={cn(
            "relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-colors z-10",
            mode === 'translate' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Languages className={cn(
            "w-4 h-4 transition-all duration-300",
            mode === 'translate' && "text-violet-500"
          )} />
          <span className={cn(
            "font-medium text-sm transition-colors",
            mode === 'translate' ? "text-foreground" : "text-muted-foreground"
          )}>
            Translate Live
          </span>
        </button>
      </div>
    </div>
  );
};
