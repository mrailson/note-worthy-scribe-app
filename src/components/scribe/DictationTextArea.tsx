import { useRef, useEffect, useMemo } from 'react';
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

// Format content into paragraphs based on sentence structure
function formatIntoParagraphs(text: string): string {
  if (!text.trim()) return '';
  
  // Split by existing double newlines first
  const existingParagraphs = text.split(/\n\n+/);
  
  const formattedParagraphs = existingParagraphs.map(para => {
    // Count sentences (ending with . ! ?)
    const sentences = para.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    
    // If paragraph has more than 4 sentences, consider breaking it
    if (sentences.length > 4) {
      const midPoint = Math.ceil(sentences.length / 2);
      const firstHalf = sentences.slice(0, midPoint).join(' ');
      const secondHalf = sentences.slice(midPoint).join(' ');
      return `${firstHalf}\n\n${secondHalf}`;
    }
    
    return para;
  });
  
  return formattedParagraphs.join('\n\n');
}

export function DictationTextArea({
  content,
  onChange,
  status,
  error,
  isRecording,
}: DictationTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes during recording
  useEffect(() => {
    if (isRecording && textareaRef.current) {
      // Scroll to the very bottom
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [content, isRecording]);

  // Format display content with paragraphs
  const displayContent = useMemo(() => {
    if (!isRecording) return content;
    return formatIntoParagraphs(content);
  }, [content, isRecording]);

  // Update content when display changes (for paragraph formatting)
  useEffect(() => {
    if (!isRecording && displayContent !== content) {
      onChange(displayContent);
    }
  }, [displayContent, isRecording, content, onChange]);

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Recording indicator - positioned ABOVE the textarea */}
      {isRecording && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            </div>
            <span className="text-sm font-medium">Recording</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Speak clearly • British English
          </span>
        </div>
      )}
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isRecording ? 'Speak now... your words will appear here as you dictate.' : 'Click "Start Dictation" to begin, or type here directly...'}
          spellCheck="true"
          lang="en-GB"
          className={cn(
            // Base styles - much larger, cleaner
            'w-full rounded-lg border bg-white px-6 py-5',
            'text-lg leading-relaxed tracking-normal',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-none overflow-y-auto',
            // Height - much taller for better dictation experience
            isRecording ? 'min-h-[500px]' : 'min-h-[400px]',
            // Recording state - subtle highlight
            isRecording && 'border-primary/50 ring-2 ring-primary/20 shadow-lg shadow-primary/5',
            // Error state
            error && 'border-destructive',
            // Typography for readability
            'font-sans whitespace-pre-wrap'
          )}
          style={{
            // Ensure proper paragraph spacing in textarea
            lineHeight: '1.75',
            letterSpacing: '0.01em',
          }}
          disabled={status === 'connecting'}
        />

        {/* Live status indicator at bottom */}
        {isRecording && (
          <div className="absolute bottom-4 left-6 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Listening...
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
