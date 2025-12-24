import React, { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SendHorizontal, Paperclip, Mic, MicOff, Stethoscope, Languages, Plus, MessageSquareMore, X } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UploadedFile } from '@/types/ai4gp';
import { useEnhancedFileProcessing } from '@/hooks/useEnhancedFileProcessing';
import { EnhancedBrowserMic, EnhancedBrowserMicRef } from './EnhancedBrowserMic';
import { useToast } from '@/hooks/use-toast';
import { FileProcessingProgress } from './FileProcessingProgress';
import { DocumentTranslateModal } from '@/components/ai4gp/DocumentTranslateModal';

interface InputAreaProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: (messageOverride?: string) => void;
  isLoading: boolean;
  isClinical: boolean;
  setIsClinical: (clinical: boolean) => void;
  onNewChat?: () => void;
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
  setIsClinical,
  onNewChat
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<EnhancedBrowserMicRef>(null);
  const { 
    processFilesWithValidation, 
    isProcessing: isFileProcessing,
    getProcessingSummary 
  } = useEnhancedFileProcessing();
  const [browserTranscript, setBrowserTranscript] = useState('');
  const [showDocumentTranslate, setShowDocumentTranslate] = useState(false);
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Add loading placeholders immediately
    const loadingFiles: UploadedFile[] = Array.from(files).map(file => ({
      name: file.name,
      type: file.type,
      content: '',
      size: file.size,
      isLoading: true
    }));
    setUploadedFiles(prev => [...prev, ...loadingFiles]);

    try {
      const processedFiles = await processFilesWithValidation(files);
      // Replace loading files with processed ones
      setUploadedFiles(prev => {
        const withoutLoading = prev.filter(f => !loadingFiles.some(lf => lf.name === f.name && f.isLoading));
        return [...withoutLoading, ...processedFiles];
      });
    } catch (error) {
      console.error('Error processing files:', error);
      // Remove failed loading files
      setUploadedFiles(prev => prev.filter(f => !loadingFiles.some(lf => lf.name === f.name && f.isLoading)));
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

  const handleBrowserTranscriptUpdate = (text: string) => {
    setBrowserTranscript(text);
    // Apply the transcript to input, preserving any existing text
    setInput(text);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    const CHARACTER_THRESHOLD = 1500;
    
    if (pastedText.length > CHARACTER_THRESHOLD) {
      e.preventDefault();
      
      // Create a virtual file from the pasted text
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const virtualFile: UploadedFile = {
        name: `Pasted Transcript - ${timestamp}.txt`,
        type: 'text/plain',
        content: `PASTED TRANSCRIPT CONTENT FROM: Clipboard

${pastedText.trim()}

[Pasted text content]`,
        size: new Blob([pastedText]).size,
        isLoading: false
      };
      
      // Add to uploaded files
      setUploadedFiles(prev => [...prev, virtualFile]);
      
      // Show toast notification
      toast({
        title: "Large text converted to file",
        description: `Text with ${pastedText.length.toLocaleString()} characters converted to file attachment`,
      });
    }
    // If text is below threshold, allow normal paste behavior
  };


  const handleClearInput = () => {
    setInput('');
    setBrowserTranscript('');
    micRef.current?.clearTranscript();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
      // Clear both transcript state and input text after sending for smooth mic workflow
      setBrowserTranscript('');
      setInput('');
      micRef.current?.clearTranscript();
    }
    // Escape key to clear input
    if (e.key === 'Escape' && input.trim()) {
      e.preventDefault();
      handleClearInput();
    }
  };

  return (
    <>
      {uploadedFiles.length > 0 && (
        <FileProcessingProgress 
          stats={getProcessingSummary()}
          isProcessing={isFileProcessing}
        />
      )}
      <div className="p-3 space-y-3 bg-accent rounded-xl">
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
            onPaste={handlePaste}
            placeholder={isClinical ? "Ask about NHS guidelines, clinical protocols, prescribing, referrals..." : "Ask about NHS guidelines, clinical protocols, prescribing, referrals, or practice management..."}
            className="min-h-[140px] max-h-80 resize-none bg-white border-border pr-28 pl-10 rounded-lg leading-relaxed py-4 ai4gp-text-scaled"
            disabled={isLoading}
            style={{ minHeight: '140px' }}
          />
          
          {/* Clear button - only shown when there's text */}
          {input.trim().length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-2 bottom-3 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              onClick={handleClearInput}
              title="Clear input (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a,.xls,.xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="absolute right-3 top-4 bottom-4 flex flex-col justify-center items-center">
            <div className="flex flex-col gap-1 items-center justify-center h-full">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-20 w-20 p-0 hover:bg-accent/50 rounded-md flex items-center justify-center"
                    disabled={isLoading}
                    title="More options"
                  >
                    <Plus className="w-12 h-12" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-48 bg-white border border-border shadow-lg z-50">
                  {onNewChat && (
                    <DropdownMenuItem 
                      onClick={onNewChat}
                      disabled={isLoading}
                      className="cursor-pointer"
                    >
                      <MessageSquareMore className="w-4 h-4 mr-2" />
                      Start New Chat
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    Attach Files
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDocumentTranslate(true)}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <Languages className="w-4 h-4 mr-2" />
                    Translate Document
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <EnhancedBrowserMic
                ref={micRef}
                key="enhanced-browser-mic-component"
                onTranscriptUpdate={handleBrowserTranscriptUpdate}
                onRecordingStart={() => textareaRef.current?.focus()}
                disabled={isLoading}
                className=""
              />
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => {
            onSend();
            // Clear both transcript state and input text after sending for smooth mic workflow
            setBrowserTranscript('');
            setInput('');
            micRef.current?.clearTranscript();
          }} 
          disabled={isLoading || (!input.trim() && uploadedFiles.length === 0) || uploadedFiles.some(file => file.isLoading) || isFileProcessing}
          size="default"
          className={`h-[140px] px-6 flex-shrink-0 rounded-lg ${
            uploadedFiles.some(file => file.isLoading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <SendHorizontal className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground text-center pt-2 pb-1 px-3 bg-background/50 rounded-md border-t border-border/20">
        <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded mr-1">Ctrl+Enter</kbd>
        to send • <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded mr-1">Esc</kbd>
        to clear • Supports: PDF, Word, Excel, images, audio • 
        <span className="text-blue-600 font-medium">🎙️ Voice control available</span>
      </div>
      
      <DocumentTranslateModal
        isOpen={showDocumentTranslate}
        onClose={() => setShowDocumentTranslate(false)}
        onInsertToChat={(text) => setInput(input + (input ? '\n\n' : '') + text)}
      />
    </div>
    </>
  );
});