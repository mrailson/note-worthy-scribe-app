import React, { useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Image, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StepUploadProps {
  supportingText: string;
  onSupportingTextChange: (text: string) => void;
  uploadedFiles: File[];
  onFilesChange: (files: File[]) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const getFileIcon = (file: File) => {
  if (file.type.startsWith('image/')) return Image;
  if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.csv')) return FileSpreadsheet;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const StepUpload: React.FC<StepUploadProps> = ({
  supportingText,
  onSupportingTextChange,
  uploadedFiles,
  onFilesChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const valid: File[] = [];
    
    for (const file of fileArr) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      valid.push(file);
    }
    
    if (valid.length > 0) {
      onFilesChange([...uploadedFiles, ...valid]);
    }
  }, [uploadedFiles, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    onFilesChange(uploadedFiles.filter((_, i) => i !== index));
  }, [uploadedFiles, onFilesChange]);

  return (
    <div className="space-y-5" onPaste={handlePaste}>
      {/* Supporting Text */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Supporting Information</label>
        <Textarea
          value={supportingText}
          onChange={(e) => onSupportingTextChange(e.target.value)}
          placeholder="Paste any content, data, notes, or text you want incorporated..."
          className="min-h-[120px] resize-y"
        />
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Upload Files</label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800',
            'hover:border-primary hover:bg-primary/5'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.html,.htm"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">
            Drag & drop files, click to select, or <span className="font-semibold">Ctrl+V</span> to paste
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Word, Excel, CSV, Images (max 10MB each)
          </p>
        </div>
      </div>

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached
          </label>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file, idx) => {
              const Icon = getFileIcon(file);
              return (
                <Badge key={idx} variant="secondary" className="max-w-[250px] px-2 py-1.5 gap-1.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                  <span className="truncate text-xs">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">({formatSize(file.size)})</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper */}
      <p className="text-xs text-muted-foreground">
        Include any data, previous versions, meeting notes, or reference documents that should inform the output.
      </p>
    </div>
  );
};
