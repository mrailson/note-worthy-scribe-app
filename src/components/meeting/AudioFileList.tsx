import React from 'react';
import { Button } from '@/components/ui/button';
import { FileAudio, X, GripVertical, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AudioFileItem {
  id: string;
  file: File;
  duration?: number;
  status: 'pending' | 'transcribing' | 'completed' | 'error';
  transcript?: string;
  error?: string;
}

interface AudioFileListProps {
  files: AudioFileItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioFileList: React.FC<AudioFileListProps> = ({
  files,
  onRemove,
  onReorder,
  disabled = false
}) => {
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        {files.length} file{files.length !== 1 ? 's' : ''} selected
      </div>
      <div className="space-y-2">
        {files.map((item, index) => (
          <div
            key={item.id}
            draggable={!disabled && files.length > 1}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
              item.status === 'completed' && "border-green-500/30 bg-green-500/5",
              item.status === 'error' && "border-destructive/30 bg-destructive/5",
              item.status === 'transcribing' && "border-primary/30 bg-primary/5",
              !disabled && files.length > 1 && "cursor-grab active:cursor-grabbing"
            )}
          >
            {files.length > 1 && !disabled && (
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            
            <div className="shrink-0">
              {item.status === 'pending' && (
                <FileAudio className="h-5 w-5 text-muted-foreground" />
              )}
              {item.status === 'transcribing' && (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
              {item.status === 'completed' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {item.status === 'error' && (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.file.name}</div>
              <div className="text-xs text-muted-foreground flex gap-2">
                <span>{formatFileSize(item.file.size)}</span>
                {item.duration !== undefined && item.duration > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(item.duration)}</span>
                  </>
                )}
                {item.status === 'completed' && item.transcript && (
                  <>
                    <span>•</span>
                    <span>{item.transcript.split(' ').filter(w => w).length} words</span>
                  </>
                )}
                {item.error && (
                  <>
                    <span>•</span>
                    <span className="text-destructive">{item.error}</span>
                  </>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onRemove(item.id)}
              disabled={disabled || item.status === 'transcribing'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
