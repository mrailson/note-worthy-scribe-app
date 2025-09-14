import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
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
import { useDeviceInfo } from '@/hooks/use-mobile';
import { detectDevice } from '@/utils/DeviceDetection';

interface FloatingMobileInputProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: (messageOverride?: string) => void;
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<SimpleBrowserMicRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { processFiles } = useFileUpload();
  const [browserTranscript, setBrowserTranscript] = useState('');
  const { toast } = useToast();
  const deviceInfo = useDeviceInfo();
  const device = detectDevice();

  // iPhone keyboard handling
  useEffect(() => {
    if (!device.needsKeyboardWorkaround) return;

    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const viewport = window.visualViewport;
        if (viewport && isExpanded) {
          const keyboardHeight = window.innerHeight - viewport.height;
          setKeyboardHeight(Math.max(0, keyboardHeight));
          
          // Update CSS custom property for keyboard height
          document.documentElement.style.setProperty(
            '--iphone-keyboard-height', 
            `${Math.max(0, keyboardHeight)}px`
          );
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [device.needsKeyboardWorkaround, isExpanded]);

  // Handle iPhone specific focus behavior
  useEffect(() => {
    if (!device.isIPhone || !isExpanded) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleFocus = () => {
      // Scroll to input on iPhone when focused
      setTimeout(() => {
        textarea.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    };

    textarea.addEventListener('focus', handleFocus);
    return () => textarea.removeEventListener('focus', handleFocus);
  }, [device.isIPhone, isExpanded]);

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
      // Add haptic feedback for iPhone
      if (device.isIPhone && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      setTimeout(() => {
        textareaRef.current?.focus();
        
        // iPhone-specific smooth scroll to input
        if (device.isIPhone) {
          setTimeout(() => {
            textareaRef.current?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }, 200);
        }
      }, 100);
    } else {
      // Reset keyboard height when closing
      setKeyboardHeight(0);
      document.documentElement.style.setProperty('--iphone-keyboard-height', '0px');
    }
  };

  // Floating toggle button
  if (!isExpanded) {
    return (
      <div 
        className={cn(
          "fixed z-[9999]",
          device.hasNotch ? "iphone-notch-safe" : ""
        )}
        style={{
          bottom: `calc(16px + var(--mobile-safe-area-bottom))`,
          right: `calc(16px + var(--iphone-safe-area-right))`
        }}
      >
        <Button
          onClick={toggleExpanded}
          size="lg"
          className="h-14 w-14 rounded-full shadow-strong bg-primary hover:bg-primary-hover text-primary-foreground mobile-touch-target transition-all duration-200 hover:scale-105"
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
      ref={containerRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[9999] bg-background border-t border-border shadow-strong",
        "iphone-optimized mobile-scroll-container",
        device.hasNotch ? "iphone-notch-safe" : ""
      )}
      style={{
        paddingBottom: `calc(16px + var(--mobile-safe-area-bottom) + ${keyboardHeight}px)`,
        paddingLeft: `var(--iphone-safe-area-left)`,
        paddingRight: `var(--iphone-safe-area-right)`,
        maxHeight: device.isIPhone ? '70dvh' : '70vh',
        transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'none',
        transition: 'transform 0.3s ease-out, padding-bottom 0.3s ease-out'
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

        <div className={cn(
          "p-3 space-y-3 overflow-y-auto",
          "mobile-scroll-container no-scrollbar",
          device.isIPhone ? "max-h-[60dvh]" : "max-h-[60vh]"
        )}>
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
                placeholder={device.isIPhone 
                  ? "Ask me anything about NHS guidelines..." 
                  : "Ask about NHS guidelines, clinical protocols, prescribing, referrals..."
                }
                className={cn(
                  "min-h-[100px] max-h-32 resize-none pr-44 bg-background border-border",
                  device.isIPhone ? "text-base iphone-input" : "text-base",
                  "mobile-touch-target"
                )}
                disabled={isLoading}
                style={{
                  fontSize: device.isIPhone ? '16px' : 'inherit' // Prevent zoom on iPhone
                }}
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
                  className="h-20 w-20 p-0 hover:bg-accent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="w-14 h-14" />
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