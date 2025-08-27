import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Image, Type, Mail, FileText, Check, Loader2 } from 'lucide-react';
import { UploadedFile } from '@/types/ai4gp';

// Helper function to get file type icon
const getFileTypeIcon = (fileName: string, fileType?: string) => {
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
        const IconComponent = getFileTypeIcon(file.name, file.type);
        
        return (
          <Badge 
            key={index} 
            variant="secondary" 
            className={`max-w-[200px] px-2 py-1 ${file.isLoading ? 'bg-muted border-muted-foreground/20' : 'bg-green-50 border-green-200'}`}
          >
            <IconComponent className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate text-xs">{file.name}</span>
            
            {file.isLoading ? (
              <Loader2 className="w-3 h-3 ml-1 animate-spin text-muted-foreground" />
            ) : (
              <Check className="w-3 h-3 ml-1 text-green-600" />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 p-0 h-auto w-4 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveFile(index)}
              disabled={file.isLoading}
            >
              <X className="w-3 h-3" />
            </Button>
          </Badge>
        );
      })}
    </div>
  );
};