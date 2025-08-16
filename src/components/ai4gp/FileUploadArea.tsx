import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Image, Type, Mail, FileText, Clipboard } from 'lucide-react';
import { UploadedFile } from '@/types/ai4gp';

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
    <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md">
      {uploadedFiles.map((file, index) => {
        const IconComponent = getFileTypeIcon(file.name, file.type, file.source);
        const isPasted = file.source === 'paste';
        
        return (
          <Badge 
            key={index} 
            variant="secondary" 
            className={`max-w-[200px] px-2 py-1 ${isPasted ? 'border-purple-300 dark:border-purple-600' : ''}`}
          >
            <IconComponent className={`w-3 h-3 mr-1 flex-shrink-0 ${isPasted ? 'text-purple-600 dark:text-purple-400' : ''}`} />
            <span className="truncate text-xs">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 p-0 h-auto w-4 hover:bg-destructive hover:text-destructive-foreground"
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