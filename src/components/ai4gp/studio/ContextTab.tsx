import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, Users, Target, FileText, MessageSquare, ChevronDown, Upload, Image as ImageIcon, File } from 'lucide-react';
import { TARGET_AUDIENCES, PURPOSE_TYPES } from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { CompactMicButton } from './CompactMicButton';
import { toast } from 'sonner';

interface ContextTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  content?: string;
  preview?: string;
}

export const ContextTab: React.FC<ContextTabProps> = ({ settings, onUpdate }) => {
  const [newMessage, setNewMessage] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (isImage) {
          resolve({
            id,
            name: file.name,
            type: file.type,
            preview: reader.result as string,
          });
        } else {
          // For documents, we just store the name - content extraction would need backend
          resolve({
            id,
            name: file.name,
            type: file.type,
            content: `[Document: ${file.name}]`,
          });
        }
      };
      
      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsProcessing(true);
    try {
      const processedFiles = await Promise.all(acceptedFiles.map(processFile));
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      
      // Add file references to supporting content
      const fileRefs = processedFiles.map(f => `[Attached: ${f.name}]`).join('\n');
      const currentContent = settings.supportingContent || '';
      const newContent = currentContent ? `${currentContent}\n${fileRefs}` : fileRefs;
      onUpdate({ supportingContent: newContent });
      
      toast.success(`${processedFiles.length} file(s) uploaded`);
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
      // Remove reference from supporting content
      const fileRef = `[Attached: ${file.name}]`;
      const newContent = settings.supportingContent?.replace(fileRef, '').replace(/\n\n+/g, '\n').trim() || '';
      onUpdate({ supportingContent: newContent });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return File;
  };

  return (
    <div className="space-y-6">
      {/* Description with mic */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          What do you want to create?
        </Label>
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

      {/* Key Messages with mic */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Target className="h-4 w-4" />
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
        <Label htmlFor="supportingContent" className="flex items-center gap-2">
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
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop files here..." : "Drag & drop files, or click to select"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF, Word, PowerPoint, Images (max 10MB)</p>
        </div>

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {uploadedFiles.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-sm"
                >
                  {file.preview ? (
                    <img src={file.preview} alt={file.name} className="h-6 w-6 object-cover rounded" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate max-w-[120px]">{file.name}</span>
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
        
        <p className="text-xs text-muted-foreground">
          Include dates, statistics, contact details, or any specific text to appear.
        </p>
      </div>

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
