import { useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DictationStatus } from '@/hooks/useDictation';

interface DictationTextAreaProps {
  content: string;
  onChange: (content: string) => void;
  status: DictationStatus;
  error: string | null;
  isRecording: boolean;
}

export function DictationTextArea({
  content,
  onChange,
  status,
  error,
  isRecording,
}: DictationTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when content changes during recording
  useEffect(() => {
    if (isRecording && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [content, isRecording]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isRecording ? 'Speak now...' : 'Click "Start Dictation" to begin, or type here directly...'}
          className={cn(
            'min-h-[300px] text-base leading-relaxed resize-none font-mono',
            'focus:ring-2 focus:ring-primary/20',
            isRecording && 'border-primary border-2 bg-primary/5',
            error && 'border-destructive'
          )}
          disabled={status === 'connecting'}
        />
        
        {/* Recording indicator overlay */}
        {isRecording && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2 text-primary">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping" />
            </div>
            <span className="text-xs font-medium">Live</span>
          </div>
        )}

        {/* Blinking cursor effect when recording */}
        {isRecording && content && (
          <span className="absolute bottom-3 left-3 text-xs text-muted-foreground">
            Listening...
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
