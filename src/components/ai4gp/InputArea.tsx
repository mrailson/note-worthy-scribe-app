import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SendHorizontal, Paperclip, Mic, MicOff, Stethoscope } from 'lucide-react';
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
  isClinical: boolean;
  setIsClinical: (clinical: boolean) => void;
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
  isLoading,
  isClinical,
  setIsClinical
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


  return (
    <div className="p-3 space-y-3 bg-muted/30 rounded-xl">
      <FileUploadArea 
        uploadedFiles={uploadedFiles}
        onRemoveFile={handleRemoveFile}
      />
      
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NHS guidelines, clinical protocols, prescribing, referrals, or practice management..."
            className="min-h-[120px] max-h-80 resize-none bg-white border-border pr-20 rounded-lg leading-relaxed py-4"
            disabled={isLoading}
            style={{ minHeight: '120px' }}
          />
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a,.xls,.xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-accent rounded-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 rounded-md transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : isProcessing 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'hover:bg-accent'
              }`}
              onClick={async () => {
                const text = await toggleRecording();
                if (text) {
                  setInput(input + (input ? ' ' : '') + text);
                }
              }}
              disabled={isLoading}
              title={isRecording ? 'Stop recording' : isProcessing ? 'Processing speech...' : 'Start recording'}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        <Button 
          onClick={onSend} 
          disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
          size="default"
          className="h-[120px] px-6 flex-shrink-0 rounded-lg"
        >
          <SendHorizontal className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground text-center pt-1">
        <kbd className="px-1 py-0.5 text-xs bg-muted rounded mr-1">Ctrl+Enter</kbd>
        to send • Supports: PDF, Word, Excel, images, audio
        {(isRecording || isProcessing) && (
          <span className="ml-2 text-amber-600 font-medium">
            {isRecording ? '🎤 Recording...' : '⏳ Processing...'}
          </span>
        )}
      </div>
    </div>
  );
});