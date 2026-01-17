import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SimpleFileUploadProps {
  onFileUpload: (files: File[]) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
  multiple?: boolean;
}

export const SimpleFileUpload: React.FC<SimpleFileUploadProps> = ({
  onFileUpload,
  accept = '.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif,.ppt,.pptx,.mp3,.mp4,.wav,.m4a,.webm,.ogg,.mov,.avi,.mkv,.flac,.aac',
  maxSize = 30,
  className = '',
  multiple = true
}) => {
  const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        if (errors.some((e: any) => e.code === 'file-too-large')) {
          toast.error(`File ${file.name} is too large. Maximum size is ${maxSize}MB.`);
        } else if (errors.some((e: any) => e.code === 'file-invalid-type')) {
          toast.error(`File ${file.name} has an invalid type.`);
        }
      });
    }

    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles);
    }
  }, [onFileUpload, maxSize]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      // Documents
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      // Spreadsheets
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      // Presentations
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      // Text
      'text/plain': ['.txt'],
      // Images
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/bmp': ['.bmp'],
      'image/svg+xml': ['.svg'],
      'image/tiff': ['.tiff', '.tif'],
      // Audio
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/x-m4a': ['.m4a'],
      'audio/ogg': ['.ogg'],
      'audio/webm': ['.webm'],
      'audio/flac': ['.flac'],
      'audio/aac': ['.aac'],
      // Video
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/x-matroska': ['.mkv']
    },
    maxSize: maxSizeBytes,
    multiple,
    noClick: true,
  });

  const rootProps = getRootProps({
    role: 'button',
    tabIndex: 0,
    onClick: (e) => {
      e.stopPropagation();
      open();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    }
  });

  return (
    <div className={className}>
      <div
        {...rootProps}
        data-allow-file-drop
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-2">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? 'Drop files here'
              : 'Drag & drop files here or click to browse'
            }
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, Word, Excel, PowerPoint, Images, Audio, Video (max {maxSize}MB)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); open(); }}
          >
            Browse files
          </Button>
        </div>
      </div>
    </div>
  );
};