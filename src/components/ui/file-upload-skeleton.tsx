import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText } from 'lucide-react';

interface FileUploadSkeletonProps {
  fileName: string;
  isProcessing?: boolean;
}

export const FileUploadSkeleton: React.FC<FileUploadSkeletonProps> = ({
  fileName,
  isProcessing = true
}) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{fileName}</span>
            {isProcessing && (
              <span className="text-xs text-muted-foreground">Processing...</span>
            )}
          </div>
          
          {isProcessing && (
            <div className="mt-1">
              <Skeleton className="h-1 w-full rounded-full">
                <div className="h-full bg-primary/30 rounded-full animate-pulse" />
              </Skeleton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};