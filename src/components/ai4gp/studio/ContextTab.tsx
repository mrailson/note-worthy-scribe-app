import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, Users, Target, FileText, MessageSquare, ChevronDown, Upload, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import { TARGET_AUDIENCES, PURPOSE_TYPES } from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { CompactMicButton } from './CompactMicButton';
import { toast } from 'sonner';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';

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

export const ContextTab: React.FC<ContextTabProps> = ({ settings, onUpdate, onFilesChange }) => {
  const [newMessage, setNewMessage] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
    
    // For images, just create a preview
    if (isImage) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id,
            name: file.name,
            type: file.type,
            preview: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    }
    
    // For documents (Word, PDF, Excel, PowerPoint, etc.), use FileProcessorManager
    try {
      const processedFile = await FileProcessorManager.processFile(file);
      return {
        id,
        name: file.name,
        type: file.type,
        content: processedFile.content,
      };
    } catch (error) {
      console.error('Error processing document:', error);
      // Fall back to just storing the filename if processing fails
      return {
        id,
        name: file.name,
        type: file.type,
        content: `[Document: ${file.name} - Could not extract content]`,
      };
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsProcessing(true);
    try {
      const processedFiles = await Promise.all(acceptedFiles.map(processFile));
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      
      // For documents with extracted content, add the actual content to supporting content
      // For images, just add a reference
      const newContentParts: string[] = [];
      for (const f of processedFiles) {
        if (f.content && !f.content.startsWith('[Document:')) {
          // Successfully extracted content - add it
          newContentParts.push(`--- Content from ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`);
        } else if (f.preview) {
          // Image file - just add reference
          newContentParts.push(`[Image attached: ${f.name}]`);
        } else {
          // Fallback for failed extraction
          newContentParts.push(`[Attached: ${f.name}]`);
        }
      }
      
      const currentContent = settings.supportingContent || '';
      const newContent = currentContent 
        ? `${currentContent}\n\n${newContentParts.join('\n\n')}` 
        : newContentParts.join('\n\n');
      onUpdate({ supportingContent: newContent });
      
      const successCount = processedFiles.filter(f => f.content && !f.content.startsWith('[Document:')).length;
      if (successCount > 0) {
        toast.success(`${successCount} document(s) processed and content extracted`);
      } else {
        toast.success(`${processedFiles.length} file(s) uploaded`);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process some files');
    } finally {
      setIsProcessing(false);
    }
  }, [settings.supportingContent, onUpdate]);

  const removeFile = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      
      // Remove the content block from supporting content
      let newContent = settings.supportingContent || '';
      
      // Try to remove the full content block first
      const contentBlockPattern = new RegExp(
        `--- Content from ${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---[\\s\\S]*?--- End of ${file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---\\n*`,
        'g'
      );
      newContent = newContent.replace(contentBlockPattern, '');
      
      // Also try to remove simple references
      newContent = newContent.replace(`[Image attached: ${file.name}]`, '');
      newContent = newContent.replace(`[Attached: ${file.name}]`, '');
      
      // Clean up extra whitespace
      newContent = newContent.replace(/\n{3,}/g, '\n\n').trim();
      
      onUpdate({ supportingContent: newContent });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return File;
  };

  // Quick pick prompts for Practice Managers
  const quickPicks = [
    { 
      label: 'Summarise Attachments', 
      prompt: 'Create an infographic that summarises the key information from the uploaded attachments'
    },
    { 
      label: 'Staff Poster', 
      prompt: 'Create a professional poster for the staff room with key information and clear messaging' 
    },
    { 
      label: 'Patient Notice', 
      prompt: 'Create a patient-friendly waiting room notice with clear, accessible messaging' 
    },
  ];

  const handleQuickPick = (prompt: string) => {
    onUpdate({ description: prompt });
  };

  return (
    <div className="space-y-6">
      {/* Description with mic */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="description" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            What do you want to create?
          </Label>
          <div className="flex gap-1.5 flex-wrap">
            {quickPicks.map((pick) => {
              const isDisabled = false;
              return (
                <Button
                  key={pick.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPick(pick.prompt)}
                  disabled={isDisabled}
                  className="h-7 text-xs px-2"
                  title={isDisabled ? 'Upload a file first' : pick.prompt}
                >
                  {pick.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Textarea
            id="description"
            placeholder="Describe the image you want... e.g., 'A flu vaccination reminder poster for our waiting room with friendly imagery and clear call-to-action'"
            value={settings.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="min-h-[100px] resize-none flex-1"
          />
          <CompactMicButton
            currentValue={settings.description}
            onTranscriptUpdate={(text) => onUpdate({ description: text })}
            className="self-start"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Be specific about content, style, and any text you want included.
        </p>
      </div>

      {/* Key Messages & Supporting Info - Collapsible */}
      <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="font-medium">Key Messages & Supporting Documents (Upload here)</span>
              {(settings.keyMessages.length > 0 || uploadedFiles.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {settings.keyMessages.length > 0 && `${settings.keyMessages.length} message${settings.keyMessages.length > 1 ? 's' : ''}`}
                  {settings.keyMessages.length > 0 && uploadedFiles.length > 0 && ', '}
                  {uploadedFiles.length > 0 && `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}`}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              additionalOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          {/* Key Messages with mic */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              Key Messages (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a must-include message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyMessage())}
                disabled={settings.keyMessages.length >= 5}
                className="flex-1"
              />
              <CompactMicButton
                currentValue={newMessage}
                onTranscriptUpdate={setNewMessage}
                disabled={settings.keyMessages.length >= 5}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={addKeyMessage}
                disabled={!newMessage.trim() || settings.keyMessages.length >= 5}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {settings.keyMessages.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {settings.keyMessages.map((msg, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                    {msg}
                    <button
                      type="button"
                      onClick={() => removeKeyMessage(idx)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Up to 5 key messages that must appear in the image.
            </p>
          </div>

          {/* Supporting Content with file upload */}
          <div className="space-y-2">
            <Label htmlFor="supportingContent" className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Supporting Information (optional)
            </Label>
            <Textarea
              id="supportingContent"
              placeholder="Paste any additional content, facts, statistics, or text you want incorporated..."
              value={settings.supportingContent}
              onChange={(e) => onUpdate({ supportingContent: e.target.value })}
              className="min-h-[80px] resize-none"
            />
            
            {/* File Upload Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
                isProcessing && "opacity-50 pointer-events-none"
              )}
            >
              <input {...getInputProps()} />
              {isProcessing ? (
                <>
                  <Loader2 className="h-6 w-6 mx-auto text-primary mb-1 animate-spin" />
                  <p className="text-sm text-primary font-medium">
                    Extracting content from documents...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a moment for large files</p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive ? "Drop files here..." : "Drag & drop files, or click to select"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, PowerPoint, Excel, Images (max 10MB)</p>
                </>
              )}
            </div>

            {/* Uploaded Files Preview */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
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
                      title={hasExtractedContent ? "Content extracted successfully" : file.preview ? "Image attached" : "File attached"}
                    >
                      {file.preview ? (
                        <img src={file.preview} alt={file.name} className="h-6 w-6 object-cover rounded" />
                      ) : (
                        <FileIcon className={cn("h-4 w-4", hasExtractedContent ? "text-primary" : "text-muted-foreground")} />
                      )}
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      {hasExtractedContent && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          ✓
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="rounded-full p-0.5 hover:bg-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summarise Supporting Info Checkbox - only show when there's content */}
            {(settings.supportingContent?.trim() || uploadedFiles.length > 0) && (
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.summariseSupportingContent || false}
                  onChange={(e) => onUpdate({ summariseSupportingContent: e.target.checked })}
                  className="h-4 w-4 rounded border-muted-foreground/30"
                />
                <span className="text-sm">Summarise supporting info for the image</span>
              </label>
            )}
            
            <p className="text-xs text-muted-foreground">
              Include dates, statistics, contact details, or any specific text to appear.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Target Audience - Collapsible */}
      <Collapsible open={audienceOpen} onOpenChange={setAudienceOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-medium">Target Audience</span>
              {selectedAudience && (
                <Badge variant="secondary" className="ml-2">
                  {selectedAudience.label}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              audienceOpen && "rotate-180"
            )} />
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

      {/* Purpose / Format - Collapsible */}
      <Collapsible open={purposeOpen} onOpenChange={setPurposeOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Purpose / Format</span>
              {selectedPurpose && (
                <Badge variant="secondary" className="ml-2">
                  {selectedPurpose.label}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              purposeOpen && "rotate-180"
            )} />
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
