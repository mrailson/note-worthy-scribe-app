import React, { useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { AdminDictationStatus } from '@/hooks/useAdminDictation';
import { cn } from '@/lib/utils';

interface AdminDictateTextAreaProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  status: AdminDictationStatus;
  error: string | null;
  disabled?: boolean;
}

export const AdminDictateTextArea: React.FC<AdminDictateTextAreaProps> = ({
  content,
  onChange,
  onBlur,
  status,
  error,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastContentLengthRef = useRef(0);
  
  // Auto-scroll during recording when new content arrives
  useEffect(() => {
    if (status === 'recording' && textareaRef.current) {
      // Only scroll if content is growing (new transcription coming in)
      if (content.length > lastContentLengthRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
      lastContentLengthRef.current = content.length;
    }
  }, [content, status]);

  // Reset the length tracker when not recording
  useEffect(() => {
    if (status !== 'recording') {
      lastContentLengthRef.current = 0;
    }
  }, [status]);

  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

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
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={
            isConnecting 
              ? "Connecting to transcription service..."
              : isRecording 
                ? "Speak now... Your words will appear here."
                : "Select a template and start recording, or type directly..."
          }
          className={cn(
            "h-full min-h-[200px] resize-none text-base leading-relaxed bg-white dark:bg-white text-foreground",
            "font-serif cursor-text",
            isRecording && "border-red-500 border-2",
            isConnecting && "border-yellow-500 border-2",
            error && "border-destructive"
          )}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          disabled={disabled || isRecording}
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
