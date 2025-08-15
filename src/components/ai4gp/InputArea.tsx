import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { UploadedFile } from '@/types/ai4gp';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useToast } from '@/hooks/use-toast';

interface InputAreaProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: () => void;
  isLoading: boolean;
}

export interface InputAreaRef {
  focus: () => void;
}

export const InputArea = forwardRef<InputAreaRef, InputAreaProps>(({
  input,
  setInput,
  uploadedFiles,
  setUploadedFiles,
  onSend,
  isLoading
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { processFiles } = useFileUpload();
  const { isRecording, isProcessing, toggleRecording } = useVoiceRecording();
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const processedFiles = await processFiles(files);
      setUploadedFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  };

  // Show toast when recording starts
  useEffect(() => {
    if (isRecording) {
      toast({
        title: "🎙️ Recording",
        description: "Click the mic again to stop recording",
        duration: 3000,
      });
    }
  }, [isRecording, toast]);

  return (
    <div className="p-4 space-y-3">{/* Removed bg and border styling since it's handled by parent */}
      <FileUploadArea 
        uploadedFiles={uploadedFiles}
        onRemoveFile={handleRemoveFile}
      />
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NHS guidelines, clinical protocols, prescribing, referrals, or practice management..."
            className="min-h-[40px] max-h-32 resize-none pr-20"
            disabled={isLoading}
          />
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="absolute right-1 top-1 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
                  : isProcessing 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' 
                    : 'hover:bg-accent'
              }`}
              onClick={async () => {
                const text = await toggleRecording();
                if (text) {
                  setInput(input + (input ? ' ' : '') + text);
                }
              }}
              disabled={isLoading}
              title={isRecording ? 'Click to stop recording' : isProcessing ? 'Processing speech...' : 'Click to start recording'}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button 
          onClick={onSend} 
          disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
          size="sm"
          className="h-[40px]"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Press Ctrl+Enter to send • Upload files: PDF, Word, text, images, audio • {
          isRecording 
            ? '🔴 Recording... click mic to stop' 
            : isProcessing 
              ? '⏳ Processing speech...' 
              : '🎙️ Click mic to record voice'
        }
      </div>
    </div>
  );
});