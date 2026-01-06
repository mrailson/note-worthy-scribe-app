import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadArea } from '@/components/ai4gp/FileUploadArea';
import { UploadedFile } from '@/types/ai4gp';
import { Upload, FileText, Image as ImageIcon, Type } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { showToast } from '@/utils/toastWrapper';

interface TranscriptContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddContext: (contextTypes: Array<'agenda' | 'attendees' | 'presentation' | 'other' | 'additional-transcript'>, files: UploadedFile[], customLabel?: string) => void;
}

export const TranscriptContextDialog: React.FC<TranscriptContextDialogProps> = ({
  open,
  onOpenChange,
  onAddContext
}) => {
  const { processFiles, isProcessing } = useFileUpload();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Array<'agenda' | 'attendees' | 'presentation' | 'other' | 'additional-transcript'>>(['agenda']);
  const [customLabel, setCustomLabel] = useState('');
  const [textContent, setTextContent] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'image' | 'text'>('file');

  const toggleContextType = (type: 'agenda' | 'attendees' | 'presentation' | 'other' | 'additional-transcript') => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    try {
      const fileList = {
        length: acceptedFiles.length,
        item: (index: number) => acceptedFiles[index],
        [Symbol.iterator]: function* () {
          for (let i = 0; i < acceptedFiles.length; i++) {
            yield acceptedFiles[i];
          }
        }
      } as FileList;

      const processed = await processFiles(fileList);
      setUploadedFiles(prev => [...prev, ...processed]);
    } catch (error) {
      console.error('File processing error:', error);
      showToast.error('Failed to process some files');
    }
  }, [processFiles]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = item.type.split('/')[1] || 'png';
          const namedFile = new File(
            [file], 
            `pasted-image-${timestamp}.${extension}`,
            { type: item.type }
          );
          imageFiles.push(namedFile);
        }
      }
    }
    
    if (imageFiles.length > 0) {
      event.preventDefault();
      await onDrop(imageFiles);
      toast.success(`Pasted ${imageFiles.length} image(s) from clipboard`);
    }
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'text/plain': ['.txt']
    },
    maxSize: 20 * 1024 * 1024 // 20MB
  });

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleAddToTranscript = () => {
    if (selectedTypes.length === 0) {
      showToast.error('Please select at least one context type');
      return;
    }

    if (activeTab === 'text' && textContent.trim()) {
      // Create a text file from the pasted content
      const textFile: UploadedFile = {
        name: `Pasted ${selectedTypes.join(', ')} content`,
        type: 'text/plain',
        content: textContent,
        size: textContent.length,
        isLoading: false
      };
      onAddContext(selectedTypes, [textFile], customLabel);
    } else if (uploadedFiles.length > 0) {
      onAddContext(selectedTypes, uploadedFiles, customLabel);
    } else {
      showToast.error('Please add some content before adding to transcript');
      return;
    }

    // Reset state
    setUploadedFiles([]);
    setTextContent('');
    setCustomLabel('');
    setSelectedTypes(['agenda']);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setUploadedFiles([]);
    setTextContent('');
    setCustomLabel('');
    setSelectedTypes(['agenda']);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] z-[110]">
        <DialogHeader>
          <DialogTitle>Add Context to Transcript</DialogTitle>
          <DialogDescription>
            Upload meeting agendas, attendee lists, presentations, paste text to add context, or add additional transcript content to append directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Type Selection */}
          <div className="space-y-2">
            <Label>Context Type (select one or more)</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="agenda" 
                  checked={selectedTypes.includes('agenda')}
                  onCheckedChange={() => toggleContextType('agenda')}
                />
                <Label htmlFor="agenda" className="cursor-pointer">Meeting Agenda</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="attendees" 
                  checked={selectedTypes.includes('attendees')}
                  onCheckedChange={() => toggleContextType('attendees')}
                />
                <Label htmlFor="attendees" className="cursor-pointer">Attendee List</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="presentation" 
                  checked={selectedTypes.includes('presentation')}
                  onCheckedChange={() => toggleContextType('presentation')}
                />
                <Label htmlFor="presentation" className="cursor-pointer">Presentation</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="other" 
                  checked={selectedTypes.includes('other')}
                  onCheckedChange={() => toggleContextType('other')}
                />
                <Label htmlFor="other" className="cursor-pointer">General Meeting Context</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="additional-transcript" 
                  checked={selectedTypes.includes('additional-transcript')}
                  onCheckedChange={() => toggleContextType('additional-transcript')}
                />
                <Label htmlFor="additional-transcript" className="cursor-pointer">Additional Transcript</Label>
              </div>
            </div>

            {selectedTypes.includes('other') && (
              <Input
                placeholder="Enter custom label (e.g., 'Background Documents')"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Tabs for different input methods */}
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file">
                <FileText className="h-4 w-4 mr-2" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImageIcon className="h-4 w-4 mr-2" />
                Image Upload
              </TabsTrigger>
              <TabsTrigger value="text">
                <Type className="h-4 w-4 mr-2" />
                Paste Text
              </TabsTrigger>
            </TabsList>

            {/* File Upload Tab */}
            <TabsContent value="file" className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {isDragActive ? 'Drop files here...' : 'Drag and drop files here, or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports Word, Excel, PDF, and images (max 20MB)
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <FileUploadArea
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                />
              )}
            </TabsContent>

            {/* Image Upload Tab */}
            <TabsContent value="image" className="space-y-4">
              <div
                {...getRootProps()}
                onPaste={handlePaste}
                tabIndex={0}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} accept="image/*" />
                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {isDragActive ? 'Drop images here...' : 'Drag and drop, click to browse, or paste (Ctrl+V)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PNG, JPG, JPEG, GIF, WebP (max 20MB) - perfect for Teams/Outlook screenshots
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <FileUploadArea
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                />
              )}
            </TabsContent>

            {/* Text Paste Tab */}
            <TabsContent value="text" className="space-y-4">
              <Textarea
                placeholder={
                  selectedTypes.includes('additional-transcript')
                    ? `Paste additional transcript content here...\n\nThis will be appended directly to the existing transcript.`
                    : `Paste your ${selectedTypes.join(', ')} content here...\n\nExample:\n• Dr. Sarah Johnson - GP Partner\n• Michael Chen - Practice Manager\n• Jane Smith - Reception Lead`
                }
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[300px] h-[300px] font-mono text-sm resize-y"
                rows={12}
              />
              {textContent && (
                <p className="text-xs text-muted-foreground">
                  {textContent.length} characters
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {(uploadedFiles.length === 0 && !textContent.trim()) && (
            <p className="text-xs text-muted-foreground text-left w-full">
              Please upload a file or paste text content before adding to transcript
            </p>
          )}
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToTranscript}
              disabled={isProcessing || (uploadedFiles.length === 0 && !textContent.trim())}
              className="relative"
            >
              {isProcessing ? 'Processing...' : 'Add to Transcript'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
