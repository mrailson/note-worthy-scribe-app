import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { UploadedFile } from '@/types/ai4gp';
import { useFileUpload } from '@/hooks/useFileUpload';

interface InputAreaProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: () => void;
  isLoading: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  uploadedFiles,
  setUploadedFiles,
  onSend,
  isLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { processFiles } = useFileUpload();

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
    <div className="border-t bg-background/95 backdrop-blur-sm p-4 space-y-3 shadow-lg">
      <FileUploadArea 
        uploadedFiles={uploadedFiles}
        onRemoveFile={handleRemoveFile}
      />
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NHS guidelines, clinical protocols, prescribing, referrals, or practice management..."
            className="min-h-[40px] max-h-32 resize-none pr-12"
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
          
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-8 w-8 p-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
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
        Press Ctrl+Enter to send • Upload files: PDF, Word, text, images, audio
      </div>
    </div>
  );
};