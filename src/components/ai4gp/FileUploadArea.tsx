import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Image, Type, Mail, FileText, Clipboard, AlertCircle, Loader2 } from 'lucide-react';
import { UploadedFile } from '@/types/ai4gp';
import { FileUploadSkeleton } from '@/components/ui/file-upload-skeleton';

// Helper function to get file type icon
const getFileTypeIcon = (fileName: string, fileType?: string, source?: 'file' | 'paste') => {
  // Show clipboard icon for pasted content
  if (source === 'paste') {
    return Clipboard;
  }
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  const type = fileType?.toLowerCase();
  
  if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
    return Image;
  }
  if (type?.startsWith('text/') || fileName.includes('Pasted text')) {
    return Type;
  }
  if (['msg', 'eml'].includes(extension || '')) {
    return Mail;
  }
  return FileText;
};

interface FileUploadAreaProps {
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  uploadedFiles,
  onRemoveFile
}) => {
  if (uploadedFiles.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-md">
      {uploadedFiles.map((file, index) => {
        // Show skeleton for loading files
        if (file.isLoading) {
          return (
            <FileUploadSkeleton
              key={`loading-${index}`}
              fileName={file.name}
              isProcessing={true}
            />
          );
        }

        // Show error state
        if (file.error) {
          return (
            <div 
              key={`error-${index}`}
              className="flex items-center gap-2 p-2 rounded-md border border-destructive/20 bg-destructive/5"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-destructive">{file.name}</div>
                <div className="text-xs text-destructive/80 truncate">{file.error}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto w-4 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onRemoveFile(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          );
        }

        // Show completed file
        const IconComponent = getFileTypeIcon(file.name, file.type, file.source);
        const isPasted = file.source === 'paste';
        
        return (
          <Badge 
            key={`completed-${index}`} 
            variant="secondary" 
            className={`max-w-full px-2 py-1.5 justify-between ${
              isPasted ? 'border-purple-300 dark:border-purple-600' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <IconComponent className={`w-3 h-3 flex-shrink-0 ${
                isPasted ? 'text-purple-600 dark:text-purple-400' : ''
              }`} />
              <span className="truncate text-xs">{file.name}</span>
              {file.size && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  ({(file.size / 1024).toFixed(1)}KB)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 p-0 h-auto w-4 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
              onClick={() => onRemoveFile(index)}
            >
              <X className="w-3 h-3" />
            </Button>
          </Badge>
        );
      })}
    </div>
  );
};