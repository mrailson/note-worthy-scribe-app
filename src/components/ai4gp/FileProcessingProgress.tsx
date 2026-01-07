import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { FileProcessingStats } from '@/hooks/useEnhancedFileProcessing';

interface FileProcessingProgressProps {
  stats: FileProcessingStats;
  isProcessing: boolean;
}

export const FileProcessingProgress: React.FC<FileProcessingProgressProps> = ({
  stats,
  isProcessing
}) => {
  const progress = stats.totalFiles > 0 ? (stats.processedFiles / stats.totalFiles) * 100 : 0;
  const isComplete = stats.processedFiles === stats.totalFiles && stats.totalFiles > 0;

  if (stats.totalFiles === 0 && !isProcessing) {
    return null;
  }

  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">File Processing</span>
            {isComplete && !isProcessing && (
              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                Complete
              </Badge>
            )}
          </div>
          <span className="text-xs text-blue-600">
            {stats.processedFiles}/{stats.totalFiles} files
          </span>
        </div>

        {isProcessing && (
          <Progress value={progress} className="h-2" />
        )}

        <div className="text-xs text-muted-foreground">
          {(stats.totalSize / 1024 / 1024).toFixed(1)} MB total
        </div>
      </CardContent>
    </Card>
  );
};
