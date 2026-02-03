import React from 'react';
import { cn } from '@/lib/utils';
import { DictationTranscriptionService } from '@/hooks/useAdminDictation';

interface AdminDictateServiceToggleProps {
  service: DictationTranscriptionService;
  onServiceChange: (service: DictationTranscriptionService) => void;
  disabled?: boolean;
}

export const AdminDictateServiceToggle: React.FC<AdminDictateServiceToggleProps> = ({
  service,
  onServiceChange,
  disabled = false
}) => {
  return (
    <div 
      className={cn(
        "flex items-center rounded-md bg-muted/50 p-0.5 border text-xs",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {/* Sliding background indicator */}
      <div 
        className={cn(
          "absolute h-[calc(100%-4px)] w-[calc(50%-2px)] rounded bg-background shadow-sm transition-all duration-200",
          service === 'assemblyai' ? "translate-x-0" : "translate-x-full"
        )}
        style={{ display: 'none' }} // Hidden for inline buttons approach
      />
      
      <button
        type="button"
        onClick={() => onServiceChange('assemblyai')}
        className={cn(
          "px-2 py-1 rounded transition-colors font-medium",
          service === 'assemblyai' 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        AssemblyAI
      </button>
      
      <button
        type="button"
        onClick={() => onServiceChange('deepgram')}
        className={cn(
          "px-2 py-1 rounded transition-colors font-medium",
          service === 'deepgram' 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Deepgram
      </button>
    </div>
  );
};
