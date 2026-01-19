import React from 'react';
import { Lightbulb, X, MonitorSpeaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TeamsAudioHintProps {
  visible: boolean;
  onSwitchToSystemAudio: () => void;
  onDismiss: () => void;
  onAcknowledgeWorking: () => void;
}

export const TeamsAudioHint: React.FC<TeamsAudioHintProps> = ({
  visible,
  onSwitchToSystemAudio,
  onDismiss,
  onAcknowledgeWorking
}) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
        "p-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Recording a Teams call?
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            If you're not seeing the green indicator flash when others speak, 
            try switching to "Mic + System Audio" mode to capture everyone's voice.
          </p>
          
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="default"
              onClick={onSwitchToSystemAudio}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <MonitorSpeaker className="h-4 w-4 mr-1.5" />
              Switch to System Audio
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onAcknowledgeWorking}
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              It's working fine
            </Button>
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          aria-label="Dismiss hint"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
