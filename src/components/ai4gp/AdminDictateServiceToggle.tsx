import React from 'react';
import { cn } from '@/lib/utils';
import { DictationTranscriptionService } from '@/hooks/useAdminDictation';

interface AdminDictateServiceToggleProps {
  service: DictationTranscriptionService;
  onServiceChange: (service: DictationTranscriptionService) => void;
  disabled?: boolean;
}

const PILLS: { id: DictationTranscriptionService; label: string }[] = [
  { id: 'assemblyai', label: 'AssemblyAI' },
  { id: 'deepgram', label: 'Deepgram' },
  { id: 'gpt-realtime-whisper', label: 'GPT-Realtime-Whisper' },
];

export const AdminDictateServiceToggle: React.FC<AdminDictateServiceToggleProps> = ({
  service,
  onServiceChange,
  disabled = false,
}) => {
  return (
    <div
      className={cn(
        'flex items-center rounded-md bg-muted/50 p-0.5 border text-xs',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {PILLS.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => onServiceChange(pill.id)}
          className={cn(
            'px-2 py-1 rounded transition-colors font-medium whitespace-nowrap',
            service === pill.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
};
