import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import type { DictationStatus } from '@/hooks/useDictation';

interface DictationControlsProps {
  status: DictationStatus;
  isRecording: boolean;
  isConnecting: boolean;
  onStart: () => void;
  onStop: () => void;
  hasContent: boolean;
}

export function DictationControls({
  status,
  isRecording,
  isConnecting,
  onStart,
  onStop,
  hasContent,
}: DictationControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {isRecording ? (
        <Button
          size="lg"
          variant="destructive"
          onClick={onStop}
          className="gap-2 h-14 px-8 text-lg font-medium"
        >
          <Square className="h-5 w-5 fill-current" />
          Stop Dictation
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          disabled={isConnecting}
          className="gap-2 h-14 px-8 text-lg font-medium bg-primary hover:bg-primary/90"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              {hasContent ? 'Continue Dictation' : 'Start Dictation'}
            </>
          )}
        </Button>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 text-destructive animate-pulse">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span className="text-sm font-medium">Recording</span>
        </div>
      )}
    </div>
  );
}
