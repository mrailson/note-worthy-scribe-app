import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2 } from 'lucide-react';
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
  accept = '.pdf,.doc,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.tif',
  maxSize = 10,
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/bmp': ['.bmp'],
      'image/svg+xml': ['.svg'],
      'image/tiff': ['.tiff', '.tif']
    },
    maxSize: maxSizeBytes,
    multiple
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        data-allow-file-drop
        onClick={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
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
            PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG, GIF, WebP, BMP, SVG, TIFF (max {maxSize}MB)
          </p>
        </div>
      </div>
    </div>
  );
};