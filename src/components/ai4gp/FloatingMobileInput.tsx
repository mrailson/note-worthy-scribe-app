import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Send, Paperclip, Mic, MicOff, Stethoscope, MessageSquare, X, ChevronUp } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { UploadedFile } from '@/types/ai4gp';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useEnhancedFileProcessing } from '@/hooks/useEnhancedFileProcessing';
import { SimpleBrowserMic, SimpleBrowserMicRef } from './SimpleBrowserMic';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { detectDevice } from '@/utils/DeviceDetection';
import { FileQuickActions } from './FileQuickActions';


// Role-based placeholder tips
const CLINICAL_TIPS = [
  "Ask about NICE guidelines, drug interactions, or referral pathways...",
  "What's the latest guidance on prescribing, clinical protocols, or treatment options...",
  "Help with clinical letters, patient information leaflets, or treatment plans...",
  "Check BNF guidance, calculate doses, or review QOF indicators...",
  "Summarise uploaded documents, draft referrals, or explain conditions...",
];

const MANAGER_TIPS = [
  "Ask about HR policies, staff management, or CQC requirements...",
  "Help with complaint responses, practice policies, or patient communications...",
  "Draft emails, meeting agendas, or staff announcements...",
  "Summarise uploaded documents, create action plans, or check regulations...",
  "Get guidance on contracts, governance, or practice operations...",
];

const DEFAULT_TIP = "Ask about NHS guidance, policies, documents, or practice operations...";

const getPlaceholderTip = (role?: string): string => {
  const clinicalRoles = ['gp', 'nurse', 'pharmacist', 'healthcare_assistant'];
  const managerRoles = ['practice_manager', 'admin_staff', 'pcn_manager', 'icb_user', 'lmc_user'];
  
  if (role && clinicalRoles.includes(role)) {
    return CLINICAL_TIPS[Math.floor(Math.random() * CLINICAL_TIPS.length)];
  }
  
  if (role && managerRoles.includes(role)) {
    return MANAGER_TIPS[Math.floor(Math.random() * MANAGER_TIPS.length)];
  }
  
  return DEFAULT_TIP;
};

interface FloatingMobileInputProps {
  input: string;
  setInput: (input: string) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onSend: (messageOverride?: string) => void;
  isLoading: boolean;
  isClinical: boolean;
  setIsClinical: (clinical: boolean) => void;
  userRole?: string;
  isMobileView?: boolean;
  hasMessages?: boolean;
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
  setIsClinical,
  userRole,
  isMobileView,
  hasMessages = false
}, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<SimpleBrowserMicRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { processFiles } = useFileUpload();
  const { processFilesWithValidation } = useEnhancedFileProcessing();
  const [browserTranscript, setBrowserTranscript] = useState('');
  const { toast } = useToast();
  const deviceInfo = useDeviceInfo();
  const device = detectDevice();
  
  // Memoize placeholder tip so it doesn't change on every render
  const placeholderTip = useMemo(() => getPlaceholderTip(userRole), [userRole]);

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

  // Helper to create FileList from array
  const createFileList = (files: File[]): FileList => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // Check for pasted images first (screenshots)
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const file = item.getAsFile();
          if (file) {
            // Generate a filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const extension = file.type.split('/')[1] || 'png';
            const renamedFile = new File([file], `Screenshot-${timestamp}.${extension}`, {
              type: file.type
            });
            
            // Add loading placeholder
            const loadingFile: UploadedFile = {
              name: renamedFile.name,
              type: renamedFile.type,
              content: '',
              size: renamedFile.size,
              isLoading: true
            };
            setUploadedFiles(prev => [...prev, loadingFile]);
            
            try {
              const processedFiles = await processFilesWithValidation(
                createFileList([renamedFile])
              );
              // Replace loading file with processed one
              setUploadedFiles(prev => {
                const withoutLoading = prev.filter(f => f.name !== loadingFile.name || !f.isLoading);
                return [...withoutLoading, ...processedFiles];
              });
              
              toast({
                title: "Screenshot pasted",
                description: "Image ready for analysis",
              });
            } catch (error) {
              setUploadedFiles(prev => prev.filter(f => f.name !== loadingFile.name || !f.isLoading));
              toast({
                title: "Failed to process screenshot",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
              });
            }
          }
          return; // Exit after handling image
        }
      }
    }
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

  // Simple ChatGPT-like interface for mobile devices (iPhone and Android)
  // Use isMobileView prop (screen-width based) as primary check, fallback to device detection
  const shouldShowMobileUI = isMobileView ?? device.isMobile;
  
  if (shouldShowMobileUI) {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-x-0 bottom-0 z-[9999] bg-card border-t shadow-strong"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        <div className="p-3 space-y-2">
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <FileUploadArea 
                uploadedFiles={uploadedFiles}
                onRemoveFile={handleRemoveFile}
              />
              <FileQuickActions
                uploadedFiles={uploadedFiles}
                onSelectAction={(prompt) => setInput(prompt)}
                disabled={isLoading}
              />
            </div>
          )}
          
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a,.xls,.xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex-shrink-0 mobile-touch-target"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            
            {/* Voice input button for mobile */}
            <SimpleBrowserMic
              ref={micRef}
              onTranscriptUpdate={handleBrowserTranscriptUpdate}
              disabled={isLoading}
              className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex-shrink-0 mobile-touch-target"
            />
            
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message..."
              className="min-h-[40px] max-h-32 resize-none text-base bg-card border-border"
              disabled={isLoading}
              rows={1}
              style={{
                fontSize: '16px' // Prevent zoom on iPhone
              }}
            />
            
            <Button 
              onClick={handleSend} 
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              size="sm"
              className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex-shrink-0 mobile-touch-target"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded input interface for non-iPhone devices
  if (!isExpanded) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[9999] bg-background border-t border-border shadow-strong",
        "mobile-scroll-container",
        device.hasNotch ? "iphone-notch-safe" : ""
      )}
      style={{
        paddingBottom: `calc(16px + var(--mobile-safe-area-bottom) + ${keyboardHeight}px)`,
        paddingLeft: `var(--iphone-safe-area-left)`,
        paddingRight: `var(--iphone-safe-area-right)`,
        maxHeight: '70vh',
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

        <div className="p-3 space-y-3 overflow-y-auto max-h-[60vh] mobile-scroll-container no-scrollbar">
          <FileUploadArea 
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
          />
          
          <FileQuickActions
            uploadedFiles={uploadedFiles}
            onSelectAction={(prompt) => setInput(prompt)}
            disabled={isLoading}
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
              onPaste={handlePaste}
              placeholder={placeholderTip}
              className="min-h-[100px] max-h-32 resize-none pr-44 bg-background border-border text-base mobile-touch-target"
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