import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SendHorizontal, Paperclip, Mic, MicOff, Stethoscope, Plus } from 'lucide-react';
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
    <div className="p-6 space-y-4">
      <FileUploadArea 
        uploadedFiles={uploadedFiles}
        onRemoveFile={handleRemoveFile}
      />
      
      <div className="relative">
        <div className="relative bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NHS guidelines, clinical protocols, prescribing, referrals, or practice management..."
            className="min-h-[120px] max-h-32 resize-none border-0 focus:ring-0 bg-transparent px-4 py-3 text-sm leading-relaxed"
            disabled={isLoading}
          />
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a,.xls,.xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-accent/80 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach files"
              >
                <Plus className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 w-9 p-0 rounded-lg transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' 
                    : isProcessing 
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20' 
                      : 'hover:bg-accent/80'
                }`}
                onClick={async () => {
                  const text = await toggleRecording();
                  if (text) {
                    setInput(input + (input ? ' ' : '') + text);
                  }
                }}
                disabled={isLoading}
                title={isRecording ? 'Stop recording' : isProcessing ? 'Processing speech...' : 'Start voice recording'}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              
              {(isRecording || isProcessing) && (
                <span className="text-xs font-medium text-muted-foreground animate-pulse">
                  {isRecording ? 'Recording...' : 'Processing...'}
                </span>
              )}
            </div>
            
            <Button 
              onClick={onSend} 
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              size="sm"
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
            >
              <SendHorizontal className="w-4 h-4 mr-1.5" />
              Send
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
          <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Enter</kbd> to send
          <span className="mx-2">•</span>
          Supports: PDF, Word, Excel, images, audio files
        </div>
      </div>
    </div>
  );
});