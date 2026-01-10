import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsultationContextFile } from "@/types/scribe";
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  X, 
  Loader2,
  ClipboardPaste,
  AlertCircle
} from "lucide-react";
import { showToast } from "@/utils/toastWrapper";
import { FileProcessorManager } from "@/utils/fileProcessors/FileProcessorManager";

interface ContextUploadPanelProps {
  files: ConsultationContextFile[];
  onAddFile: (file: ConsultationContextFile) => void;
  onRemoveFile: (fileId: string) => void;
}

const SUPPORTED_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

export const ContextUploadPanel = ({ files, onAddFile, onRemoveFile }: ContextUploadPanelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const fileId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isImage = SUPPORTED_TYPES.image.includes(file.type);
    const isDocument = SUPPORTED_TYPES.document.includes(file.type);

    if (!isImage && !isDocument) {
      showToast.error(`Unsupported file type: ${file.type}`, { section: 'gpscribe' });
      return;
    }

    // Add file in processing state
    const newFile: ConsultationContextFile = {
      id: fileId,
      name: file.name,
      type: isImage ? 'image' : 'document',
      content: '',
      addedAt: new Date().toISOString(),
      isProcessing: true
    };
    onAddFile(newFile);

    try {
      // Use FileProcessorManager to process the file
      const processed = await FileProcessorManager.processFile(file);
      
      // Update with extracted content
      const updatedFile: ConsultationContextFile = {
        ...newFile,
        content: processed.content || '',
        preview: isImage ? await getImagePreview(file) : undefined,
        isProcessing: false
      };
      
      // Remove and re-add with updated content
      onRemoveFile(fileId);
      onAddFile(updatedFile);
      
      showToast.success(`${file.name} added`, { section: 'gpscribe' });
    } catch (error) {
      console.error('File processing error:', error);
      
      // Update with error state
      const errorFile: ConsultationContextFile = {
        ...newFile,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
      onRemoveFile(fileId);
      onAddFile(errorFile);
    }
  }, [onAddFile, onRemoveFile]);

  const getImagePreview = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle paste events
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!isFocused) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
        }
      }
    }
  }, [isFocused, processFile]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      await processFile(file);
    }
  }, [processFile]);

  // Handle file input change
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    for (const file of Array.from(selectedFiles)) {
      await processFile(file);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  // Global paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={[...SUPPORTED_TYPES.image, ...SUPPORTED_TYPES.document].join(',')}
        multiple
        onChange={handleFileSelect}
      />

      {/* Upload Zone */}
      <div className="p-4 pb-2">
        <div
          ref={dropZoneRef}
          tabIndex={0}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => dropZoneRef.current?.focus()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-primary bg-primary/10' 
              : isFocused 
                ? 'border-primary/70 bg-primary/5' 
                : 'border-muted-foreground/30 hover:border-muted-foreground/50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${isDragging ? 'bg-primary/20' : 'bg-muted'}
            `}>
              {isDragging ? (
                <Upload className="h-6 w-6 text-primary" />
              ) : (
                <ClipboardPaste className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">
                {isDragging ? 'Drop files here' : 'Click here, then paste or drag files'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ctrl+V • Right-click paste • Drag & drop
              </p>
            </div>
          </div>
        </div>

        {/* Upload Buttons */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = SUPPORTED_TYPES.image.join(',');
                fileInputRef.current.click();
              }
            }}
          >
            <ImageIcon className="h-4 w-4" />
            Upload Image
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = SUPPORTED_TYPES.document.join(',');
                fileInputRef.current.click();
              }
            }}
          >
            <FileText className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        {files.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Added Context ({files.length} {files.length === 1 ? 'file' : 'files'})
            </span>
          </div>
        )}
        
        <ScrollArea className="h-[calc(100%-28px)]">
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className={`
                ${file.error ? 'border-destructive/50 bg-destructive/5' : ''}
              `}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Icon/Preview */}
                    <div className="flex-shrink-0">
                      {file.preview ? (
                        <img 
                          src={file.preview} 
                          alt={file.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className={`
                          w-10 h-10 rounded flex items-center justify-center
                          ${file.type === 'image' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}
                        `}>
                          {file.type === 'image' ? (
                            <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{file.name}</span>
                        {file.isProcessing && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        {!file.isProcessing && !file.error && (
                          <span className="text-xs text-green-600 dark:text-green-400">✓ Processed</span>
                        )}
                        {file.error && (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      
                      {file.isProcessing ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Processing...
                        </p>
                      ) : file.error ? (
                        <p className="text-xs text-destructive mt-1">
                          {file.error}
                        </p>
                      ) : file.content ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {truncateContent(file.content)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          No text extracted
                        </p>
                      )}
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {files.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No context files added</p>
                <p className="text-xs mt-1">
                  Add blood results, screenshots, or documents
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
