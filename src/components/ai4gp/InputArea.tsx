import React, { useRef, forwardRef, useImperativeHandle, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SendHorizontal, Paperclip, Mic, MicOff, Stethoscope, Languages, Plus, MessageSquareMore, Eraser, Upload, ClipboardList, Camera, QrCode, Monitor } from 'lucide-react';
import { FileUploadArea } from './FileUploadArea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadedFile, PracticeContext } from '@/types/ai4gp';
import { useEnhancedFileProcessing } from '@/hooks/useEnhancedFileProcessing';
import { EnhancedBrowserMic, EnhancedBrowserMicRef } from './EnhancedBrowserMic';
import { useToast } from '@/hooks/use-toast';
import { FileProcessingProgress } from './FileProcessingProgress';
import { DocumentTranslateModal } from '@/components/ai4gp/DocumentTranslateModal';
import { FileQuickActions } from './FileQuickActions';
import { InputTipsHover } from './InputTipsHover';
import { ChatCameraModal } from './ChatCameraModal';
import { ChatQRCaptureModal } from './ChatQRCaptureModal';

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
  userRole?: string;
  practiceContext?: PracticeContext;
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
  onNewChat,
  userRole,
  practiceContext
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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showQRCaptureModal, setShowQRCaptureModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  
  // Memoize placeholder tip so it doesn't change on every render
  const placeholderTip = useMemo(() => getPlaceholderTip(userRole), [userRole]);

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
    
    // Handle text paste (existing logic)
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
    }
    // If text is below threshold, allow normal paste behavior
  };


  const handleClearInput = () => {
    setInput('');
    setBrowserTranscript('');
    micRef.current?.clearTranscript();
    textareaRef.current?.focus();
  };

  const [detailsPopoverOpen, setDetailsPopoverOpen] = useState(false);

  const insertPracticeDetails = (type: 'name-only' | 'name-email-phone' | 'full-details' | 'my-details') => {
    let details = '';
    const { practiceName, practiceEmail, practicePhone, practiceAddress, userFullName, userEmail, userPhone } = practiceContext || {};
    
    switch (type) {
      case 'name-only':
        if (practiceName) {
          details = `My practice details: ${practiceName}`;
        }
        break;
      case 'name-email-phone':
        const contactParts = [practiceName, practiceEmail, practicePhone].filter(Boolean);
        if (contactParts.length > 0) {
          details = `Please include my practice contact details: ${contactParts.join(', ')}`;
        }
        break;
      case 'full-details':
        const fullParts = [practiceName, practicePhone, practiceEmail, practiceAddress].filter(Boolean);
        if (fullParts.length > 0) {
          details = `Please include my full practice details: ${fullParts.join(', ')}`;
        }
        break;
      case 'my-details':
        const myParts = [userFullName, userEmail, userPhone].filter(Boolean);
        if (myParts.length > 0) {
          details = `My personal contact details are: ${myParts.join(', ')}`;
        }
        break;
    }
    
    if (details) {
      setInput(input + (input.trim() ? '\n\n' : '') + details);
    }
    setDetailsPopoverOpen(false);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the container entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
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
      console.error('Error processing dropped files:', error);
      // Remove failed loading files
      setUploadedFiles(prev => prev.filter(f => !loadingFiles.some(lf => lf.name === f.name && f.isLoading)));
      toast({
        title: "Error processing files",
        description: error instanceof Error ? error.message : "Failed to process dropped files",
        variant: "destructive",
      });
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <>
      {uploadedFiles.length > 0 && (
        <FileProcessingProgress 
          stats={getProcessingSummary()}
          isProcessing={isFileProcessing}
        />
      )}
      <div 
        className="p-3 space-y-3 bg-accent rounded-xl relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center z-50 backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto text-primary mb-2" />
              <p className="text-primary font-medium text-lg">Drop files here</p>
              <p className="text-sm text-muted-foreground">PDF, Word, Excel, Images, Text, Audio</p>
            </div>
          </div>
        )}
      <FileUploadArea 
        uploadedFiles={uploadedFiles}
        onRemoveFile={handleRemoveFile}
      />
      
      <FileQuickActions
        uploadedFiles={uploadedFiles}
        onSelectAction={handleQuickAction}
        disabled={isLoading}
      />
      
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholderTip}
            className="min-h-[60px] max-h-80 resize-none bg-white border-border pr-28 pl-10 rounded-lg leading-relaxed py-3 ai4gp-text-scaled"
            disabled={isLoading}
            rows={2}
          />
          
          {/* Insert details button - only shown when there's text and practice context exists */}
          {input.trim().length > 0 && (practiceContext?.practiceName || practiceContext?.userFullName) && (
            <Popover open={detailsPopoverOpen} onOpenChange={setDetailsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 bottom-10 h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                  title="Insert details"
                >
                  <ClipboardList className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-72 p-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    Insert Details
                  </p>
                  {practiceContext?.practiceName && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm h-auto py-2 flex-col items-start"
                        onClick={() => insertPracticeDetails('name-only')}
                      >
                        <span>My Practice Name</span>
                        <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                          {practiceContext.practiceName}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm h-auto py-2 flex-col items-start"
                        onClick={() => insertPracticeDetails('name-email-phone')}
                      >
                        <span>Practice Name, Email & Phone</span>
                        <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                          {[practiceContext.practiceName, practiceContext.practiceEmail, practiceContext.practicePhone].filter(Boolean).join(', ')}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm h-auto py-2 flex-col items-start"
                        onClick={() => insertPracticeDetails('full-details')}
                      >
                        <span>Full Practice Details</span>
                        <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                          {[practiceContext.practiceName, practiceContext.practicePhone, practiceContext.practiceEmail, practiceContext.practiceAddress].filter(Boolean).join(', ')}
                        </span>
                      </Button>
                    </>
                  )}
                  {practiceContext?.userFullName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm h-auto py-2 flex-col items-start"
                      onClick={() => insertPracticeDetails('my-details')}
                    >
                      <span>My Personal Details</span>
                      <span className="text-xs text-muted-foreground font-normal whitespace-normal break-words">
                        {[practiceContext.userFullName, practiceContext.userEmail].filter(Boolean).join(', ')}
                      </span>
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {/* Clear button - only shown when there's text */}
          {input.trim().length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-2 bottom-3 h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              onClick={handleClearInput}
              title="Clear input (Esc)"
            >
              <Eraser className="w-4 h-4" />
            </Button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.rtf,.txt,.eml,.msg,.jpg,.jpeg,.png,.wav,.mp3,.m4a,.xls,.xlsx,.csv,application/msword"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-accent/50 rounded-md flex items-center justify-center"
                    disabled={isLoading}
                    title="More options"
                  >
                    <Plus className="w-5 h-5" />
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
                    onClick={() => setShowCameraModal(true)}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 mr-2" />
                    PC Capture Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowQRCaptureModal(true)}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Phone Camera (QR)
                  </DropdownMenuItem>
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
          className={`self-stretch px-4 flex-shrink-0 rounded-lg ${
            uploadedFiles.some(file => file.isLoading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <SendHorizontal className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 pb-1 px-3 bg-background/50 rounded-md border-t border-border/20">
        <InputTipsHover />
        <span className="text-amber-600">AI can make mistakes — please verify important information</span>
      </div>
      
      <DocumentTranslateModal
        isOpen={showDocumentTranslate}
        onClose={() => setShowDocumentTranslate(false)}
        onInsertToChat={(text) => setInput(input + (input ? '\n\n' : '') + text)}
      />
      
      <ChatCameraModal
        open={showCameraModal}
        onOpenChange={setShowCameraModal}
        onImagesCapture={(files) => setUploadedFiles(prev => [...prev, ...files])}
      />
      
      <ChatQRCaptureModal
        open={showQRCaptureModal}
        onOpenChange={setShowQRCaptureModal}
        onImagesReceived={(files) => setUploadedFiles(prev => [...prev, ...files])}
      />
    </div>
    </>
  );
});