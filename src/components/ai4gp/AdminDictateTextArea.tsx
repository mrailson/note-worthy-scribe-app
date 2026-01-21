import React, { useRef, useEffect, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Mic } from 'lucide-react';
import { AdminDictationStatus } from '@/hooks/useAdminDictation';
import { cn } from '@/lib/utils';

interface AdminDictateTextAreaProps {
  content: string;
  onChange: (content: string) => void;
  status: AdminDictationStatus;
  error: string | null;
  disabled?: boolean;
}

// Format text into readable paragraphs
function formatIntoParagraphs(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  for (const sentence of sentences) {
    currentParagraph.push(sentence);
    if (currentParagraph.length >= 4) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }
  
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }
  
  return paragraphs.join('\n\n');
}

export const AdminDictateTextArea: React.FC<AdminDictateTextAreaProps> = ({
  content,
  onChange,
  status,
  error,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll during recording
  useEffect(() => {
    if (status === 'recording' && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [content, status]);

  // Format content for display
  const displayContent = useMemo(() => {
    if (status === 'recording') {
      return content;
    }
    // Only format if content doesn't already have paragraph breaks
    if (content && !content.includes('\n\n')) {
      return formatIntoParagraphs(content);
    }
    return content;
  }, [content, status]);

  const isRecording = status === 'recording';
  const isConnecting = status === 'connecting';

  return (
    <div ref={containerRef} className="flex flex-col h-full gap-2">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="relative flex-1 min-h-0">
        <Textarea
          ref={textareaRef}
          value={displayContent}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            isConnecting 
              ? "Connecting to transcription service..."
              : isRecording 
                ? "Speak now... Your words will appear here."
                : "Select a template and start recording, or type directly..."
          }
          className={cn(
            "h-full min-h-[200px] resize-none text-base leading-relaxed bg-white dark:bg-white text-foreground",
            "font-serif",
            isRecording && "border-red-500 border-2",
            isConnecting && "border-yellow-500 border-2",
            error && "border-destructive"
          )}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          disabled={disabled}
        />
        
        {isConnecting && (
          <div className="absolute top-2 right-2 flex items-center gap-2 text-yellow-600 text-xs font-medium">
            <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
            <span>Connecting...</span>
          </div>
        )}
      </div>
    </div>
  );
};
