import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Send, Paperclip, Mic, MicOff, Stethoscope, MessageSquare, X, ChevronUp } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { UploadedFile } from '@/types/ai4gp';
import { useFileUpload } from '@/hooks/useFileUpload';
import { SimpleBrowserMic, SimpleBrowserMicRef } from './SimpleBrowserMic';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FloatingMobileInputProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: () => void;
  isLoading: boolean;
  isClinical: boolean;
  setIsClinical: (clinical: boolean) => void;
}

export interface FloatingMobileInputRef {
  focus: () => void;
}

export const FloatingMobileInput = forwardRef<FloatingMobileInputRef, FloatingMobileInputProps>(({
  input,
  setInput,
  uploadedFiles,
  setUploadedFiles,
  onSend,
  isLoading,
  isClinical,
  setIsClinical
}, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<SimpleBrowserMicRef>(null);
  const { processFiles } = useFileUpload();
  const [browserTranscript, setBrowserTranscript] = useState('');
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (isExpanded) {
        textareaRef.current?.focus();
      } else {
        setIsExpanded(true);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
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
      // Clear both transcript state and input text after sending for smooth mic workflow
      setBrowserTranscript('');
      setInput('');
      micRef.current?.clearTranscript();
    }
  };

  const handleSend = () => {
    onSend();
    // Clear both transcript state and input text after sending for smooth mic workflow
    setBrowserTranscript('');
    setInput('');
    micRef.current?.clearTranscript();
    // Keep expanded after sending so user can see the response and send follow-ups
  };

  const handleBrowserTranscriptUpdate = (text: string) => {
    setBrowserTranscript(text);
    setInput(text);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // Floating toggle button
  if (!isExpanded) {
    return (
      <div 
        className="fixed z-[9999]" 
        style={{
          bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
          right: '16px'
        }}
      >
        <Button
          onClick={toggleExpanded}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground mobile-touch-target"
          disabled={isLoading}
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  // Expanded input interface
  return (
    <div 
      className="fixed inset-x-0 bottom-0 z-[9999] bg-background border-t border-border shadow-2xl"
      style={{
        paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px))`
      }}
    >
      <div className="max-w-full mx-auto">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">AI Assistant</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-8 w-8 p-0"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          <FileUploadArea 
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
          />
          
          {/* Clinical Query Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Clinical Query</span>
            </div>
            <Switch
              checked={isClinical}
              onCheckedChange={setIsClinical}
              disabled={isLoading}
            />
          </div>
          
          {/* Input area */}
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about NHS guidelines, clinical protocols, prescribing, referrals..."
                className="min-h-[100px] max-h-32 resize-none pr-20 bg-background border-border text-base"
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
              
              <div className="absolute right-1 top-1 flex gap-1">
                <div className="flex flex-col gap-1">
                  <SimpleBrowserMic
                    ref={micRef}
                    onTranscriptUpdate={handleBrowserTranscriptUpdate}
                    disabled={isLoading}
                    className="justify-center"
                  />
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 hover:bg-accent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="w-6 h-6" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Ctrl+Enter to send • <span className="text-blue-600 font-medium">🎙️ Browser Speech live transcription</span>
              </div>
              
              <Button 
                onClick={handleSend} 
                disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                size="sm"
                className="px-6"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

FloatingMobileInput.displayName = "FloatingMobileInput";