import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, X, Users, Target, FileText, MessageSquare, ChevronDown, Upload, Image as ImageIcon, File, Loader2, RectangleHorizontal, RectangleVertical, Square, Clipboard } from 'lucide-react';
import { TARGET_AUDIENCES, PURPOSE_TYPES, LAYOUT_OPTIONS } from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { CompactMicButton } from './CompactMicButton';
import { toast } from 'sonner';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getImageStudioRouting, hasLongQuotedText, PATIENT_AREA_POSTER_NEGATIVE_PROMPT, PATIENT_AREA_POSTER_PREFIX, RECRAFT_V4_SVG_MODEL } from '@/utils/imageStudioRouting';

interface ContextTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
  onFilesChange?: (hasFiles: boolean) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  content?: string;
  preview?: string;
}

// Use-case oriented pills instead of template-based ones
const USE_CASE_PILLS = [
  {
    id: 'summarise-doc',
    label: '📄 Summarise a Document',
    description: 'Upload a file and turn it into a visual',
    prompt: 'Create an infographic that summarises the key information from the uploaded document',
    defaults: { purpose: 'infographic' as const },
    focusUpload: true,
  },
  {
    id: 'create-poster',
    label: '🖼️ Create a Poster',
    description: 'Design a poster or notice from scratch',
    prompt: '',
    defaults: { purpose: 'poster' as const, layoutPreference: 'portrait' as const },
    focusUpload: false,
  },
  {
    id: 'design-notice',
    label: '📋 Patient Notice',
    description: 'Waiting room or reception display',
    prompt: '',
    defaults: { targetAudience: 'patients' as const, purpose: 'waiting-room' as const },
    focusUpload: false,
  },
  {
    id: 'patient-area-poster',
    label: '🏥 Patient Area Poster',
    description: 'Text-safe waiting room poster',
    prompt: '',
    defaults: {
      purpose: 'poster' as const,
      layoutPreference: 'portrait' as const,
      imageModel: RECRAFT_V4_SVG_MODEL,
      isModelManuallyOverridden: false,
      promptPrefix: PATIENT_AREA_POSTER_PREFIX,
      negativePrompt: PATIENT_AREA_POSTER_NEGATIVE_PROMPT,
      selectedPreset: 'patient-area-poster' as const,
    },
    focusUpload: false,
  },
  {
    id: 'social-media',
    label: '📱 Social Media',
    description: 'Post or story graphic',
    prompt: '',
    defaults: { purpose: 'social' as const, layoutPreference: 'square' as const },
    focusUpload: false,
  },
];

const ORIENTATION_OPTIONS = [
  { id: 'landscape' as const, label: 'Landscape', icon: RectangleHorizontal, ratio: '16:9' },
  { id: 'portrait' as const, label: 'Portrait', icon: RectangleVertical, ratio: '3:4' },
  { id: 'square' as const, label: 'Square', icon: Square, ratio: '1:1' },
];

export const ContextTab: React.FC<ContextTabProps> = ({ settings, onUpdate, onFilesChange }) => {
  const [newMessage, setNewMessage] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [keyMessagesOpen, setKeyMessagesOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeUseCase, setActiveUseCase] = useState<string | null>(null);
  const routing = getImageStudioRouting(settings);
  const showLongTextHint = hasLongQuotedText(settings.description);

  // Notify parent when files change
  React.useEffect(() => {
    onFilesChange?.(uploadedFiles.length > 0);
  }, [uploadedFiles.length, onFilesChange]);

  const addKeyMessage = () => {
    if (newMessage.trim() && settings.keyMessages.length < 5) {
      onUpdate({ keyMessages: [...settings.keyMessages, newMessage.trim()] });
      setNewMessage('');
    }
  };

  const removeKeyMessage = (index: number) => {
    onUpdate({ 
      keyMessages: settings.keyMessages.filter((_, i) => i !== index) 
    });
  };

  const selectedAudience = TARGET_AUDIENCES.find(a => a.id === settings.targetAudience);
  const selectedPurpose = PURPOSE_TYPES.find(p => p.id === settings.purpose);

  const processFile = async (file: File): Promise<UploadedFile> => {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      const preview = URL.createObjectURL(file);
      let content: string | undefined;
      try {
        const processed = await FileProcessorManager.processFile(file);
        if (processed.content && !processed.content.includes('No text found')) {
          content = processed.content;
        }
      } catch (e) {
        console.warn('Image OCR extraction failed:', e);
      }
      return { id, name: file.name, type: file.type, preview, content };
    }
    
    try {
      const processedFile = await FileProcessorManager.processFile(file);
      return { id, name: file.name, type: file.type, content: processedFile.content };
    } catch (error) {
      console.error('Error processing document:', error);
      return { id, name: file.name, type: file.type, content: `[Document: ${file.name} - Could not extract content]` };
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsProcessing(true);
    try {
      const processedFiles = await Promise.all(acceptedFiles.map(processFile));
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      
      const newContentParts: string[] = [];
      for (const f of processedFiles) {
        if (f.content && !f.content.startsWith('[Document:')) {
          newContentParts.push(`--- Content from ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`);
        } else if (f.preview && f.content) {
          newContentParts.push(`--- Content extracted from image: ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`);
        } else if (f.preview) {
          newContentParts.push(`[Image attached: ${f.name}]`);
        } else {
          newContentParts.push(`[Attached: ${f.name}]`);
        }
      }
      
      const currentContent = settings.supportingContent || '';
      const newContent = currentContent 
        ? `${currentContent}\n\n${newContentParts.join('\n\n')}` 
        : newContentParts.join('\n\n');
      onUpdate({ supportingContent: newContent });
      
      // Auto-set description if empty and files uploaded (likely summarise use case)
      if (!settings.description.trim() && processedFiles.some(f => f.content && !f.content.startsWith('[Document:'))) {
        onUpdate({ 
          description: 'Create an infographic that summarises the key information from the uploaded document',
          summariseSupportingContent: true,
        });
      }
      
      const successCount = processedFiles.filter(f => f.content && !f.content.startsWith('[Document:')).length;
      if (successCount > 0) {
        toast.success(`${successCount} document(s) processed — content extracted and ready`);
      } else {
        toast.success(`${processedFiles.length} file(s) uploaded`);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process some files');
    } finally {
      setIsProcessing(false);
    }
  }, [settings.supportingContent, settings.description, onUpdate]);

  const removeFile = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
      // Revoke blob URL to free memory
      if (file.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(file.preview);
      }
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      
      let newContent = settings.supportingContent || '';
      const contentBlockPattern = new RegExp(
        `--- Content from ${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---[\\s\\S]*?--- End of ${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---\\n*`,
        'g'
      );
      newContent = newContent.replace(contentBlockPattern, '');
      newContent = newContent.replace(`[Image attached: ${file.name}]`, '');
      newContent = newContent.replace(`[Attached: ${file.name}]`, '');
      newContent = newContent.replace(/\n{3,}/g, '\n\n').trim();
      
      onUpdate({ supportingContent: newContent });
    }
  };

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.svg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024,
    noClick: false,
    noKeyboard: false,
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return File;
  };

  const handleUseCasePick = (useCase: typeof USE_CASE_PILLS[number]) => {
    setActiveUseCase(useCase.id);
    if (useCase.prompt) {
      onUpdate({ description: useCase.prompt, ...useCase.defaults });
    } else {
      onUpdate({ ...useCase.defaults });
    }
    if (useCase.focusUpload) {
      // Trigger file picker for summarise flows
      setTimeout(() => openFilePicker(), 100);
    }
  };

  // Handle paste (Ctrl+V) for file uploads
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await onDrop(files);
    }
  }, [onDrop]);

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* 1. PROMINENT DRAG & DROP ZONE — Top of page */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all",
          isDragActive 
            ? "border-primary bg-primary/10 scale-[1.01]" 
            : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10",
          isProcessing && "opacity-50 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="space-y-1">
            <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium text-primary">Extracting content from documents...</p>
            <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {isDragActive ? "Drop files here..." : "Upload a document or image"}
            </p>
            <p className="text-xs text-muted-foreground">
              Drop files here, click to browse, or <span className="font-medium text-primary/80">Ctrl+V</span> to paste
            </p>
            <p className="text-xs text-primary/70 font-medium mt-1">
              💡 Upload a document and we'll turn it into a professional infographic
            </p>
          </div>
        )}
      </div>

      {/* Uploaded files display */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((file) => {
            const FileIcon = getFileIcon(file.type);
            const hasExtractedContent = file.content && !file.content.startsWith('[Document:') && !file.content.startsWith('[Attached:');
            return (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                  hasExtractedContent ? "bg-primary/10 border border-primary/20" : "bg-muted"
                )}
                title={hasExtractedContent ? "Content extracted successfully" : "File attached"}
              >
                {file.preview ? (
                  <img src={file.preview} alt={file.name} className="h-6 w-6 object-cover rounded" />
                ) : (
                  <FileIcon className={cn("h-4 w-4", hasExtractedContent ? "text-primary" : "text-muted-foreground")} />
                )}
                <span className="truncate max-w-[120px]">{file.name}</span>
                {hasExtractedContent && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">✓</Badge>
                )}
                <button type="button" onClick={() => removeFile(file.id)} className="rounded-full p-0.5 hover:bg-background">
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Summarise checkbox — show when files uploaded */}
      {(settings.supportingContent?.trim() || uploadedFiles.length > 0) && (
        <label className="flex items-center gap-2 cursor-pointer px-1">
          <input
            type="checkbox"
            checked={settings.summariseSupportingContent || false}
            onChange={(e) => onUpdate({ summariseSupportingContent: e.target.checked })}
            className="h-4 w-4 rounded border-muted-foreground/30"
          />
          <span className="text-sm">Summarise uploaded content into the visual</span>
        </label>
      )}

      {/* 2. USE-CASE PILLS */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">What would you like to do?</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {USE_CASE_PILLS.map((uc) => (
            <button
              key={uc.id}
              type="button"
              onClick={() => handleUseCasePick(uc)}
              className={cn(
                "flex flex-col items-start gap-0.5 p-3 rounded-lg border text-left transition-all",
                activeUseCase === uc.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <span className="text-sm font-medium">{uc.label}</span>
              <span className="text-xs text-muted-foreground">{uc.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. DESCRIPTION */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Describe what you want
        </Label>
        <div className="flex gap-2">
          <Textarea
            id="description"
            placeholder="e.g. 'A flu vaccination reminder poster for our waiting room' or describe what to show from your uploaded document..."
            value={settings.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="min-h-[80px] resize-none flex-1"
          />
          <CompactMicButton
            currentValue={settings.description}
            onTranscriptUpdate={(text) => onUpdate({ description: text })}
            className="self-start"
          />
        </div>
        {settings.selectedPreset === 'patient-area-poster' && (
          <p className="text-xs text-muted-foreground">Describe the message and audience, e.g. 'Handwashing reminder for waiting room, friendly, includes 5 steps'</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {routing && (
            <Badge variant="secondary" className="gap-1">
              Auto-selected {routing.label} for text rendering
              <button
                type="button"
                className="ml-1 underline underline-offset-2"
                onClick={() => onUpdate({ imageModel: 'google/gemini-3-pro-image-preview', isModelManuallyOverridden: true })}
              >
                Override
              </button>
            </Badge>
          )}
          {showLongTextHint && (
            <TooltipProvider>
              <Tooltip defaultOpen>
                <TooltipTrigger asChild>
                  <Badge variant="outline">Text length hint</Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Long text on images can render imperfectly. Keep on-image text under 6 words for best results, or split across multiple posters.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* 4. ORIENTATION TOGGLE — visible upfront */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          Orientation
        </Label>
        <div className="flex gap-2">
          {ORIENTATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = settings.layoutPreference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdate({ layoutPreference: opt.id })}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all flex-1 justify-center",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{opt.label}</span>
                <span className="text-xs opacity-60">({opt.ratio})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. KEY MESSAGES — Collapsible */}
      <Collapsible open={keyMessagesOpen} onOpenChange={setKeyMessagesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="font-medium text-sm">Key Messages</span>
              {settings.keyMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {settings.keyMessages.length}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", keyMessagesOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a must-include message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyMessage())}
              disabled={settings.keyMessages.length >= 5}
              className="flex-1"
            />
            <CompactMicButton currentValue={newMessage} onTranscriptUpdate={setNewMessage} disabled={settings.keyMessages.length >= 5} />
            <Button type="button" variant="outline" size="icon" onClick={addKeyMessage} disabled={!newMessage.trim() || settings.keyMessages.length >= 5}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {settings.keyMessages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.keyMessages.map((msg, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                  {msg}
                  <button type="button" onClick={() => removeKeyMessage(idx)} className="ml-1 rounded-full p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Up to 5 key messages that must appear in the image.</p>

          {/* Supporting content textarea */}
          <div className="space-y-2">
            <Label htmlFor="supportingContent" className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Additional Notes (optional)
            </Label>
            <Textarea
              id="supportingContent"
              placeholder="Paste any additional content, facts, statistics, or text you want incorporated..."
              value={settings.supportingContent}
              onChange={(e) => onUpdate({ supportingContent: e.target.value })}
              className="min-h-[60px] resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Target Audience — Collapsible */}
      <Collapsible open={audienceOpen} onOpenChange={setAudienceOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-medium text-sm">Target Audience</span>
              {selectedAudience && <Badge variant="secondary" className="ml-1">{selectedAudience.label}</Badge>}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", audienceOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TARGET_AUDIENCES.map((audience) => (
              <Card 
                key={audience.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.targetAudience === audience.id && "border-primary bg-primary/5"
                )}
                onClick={() => onUpdate({ targetAudience: audience.id })}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{audience.label}</p>
                  <p className="text-xs text-muted-foreground">{audience.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Purpose / Format — Collapsible */}
      <Collapsible open={purposeOpen} onOpenChange={setPurposeOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-sm">Purpose / Format</span>
              {selectedPurpose && <Badge variant="secondary" className="ml-1">{selectedPurpose.label}</Badge>}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", purposeOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PURPOSE_TYPES.map((purpose) => (
              <Card 
                key={purpose.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.purpose === purpose.id && "border-primary bg-primary/5"
                )}
                onClick={() => onUpdate({ purpose: purpose.id })}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{purpose.label}</p>
                  <p className="text-xs text-muted-foreground">{purpose.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
