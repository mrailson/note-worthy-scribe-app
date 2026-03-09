import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload } from 'lucide-react';
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

  // Generate descriptive status message based on file types
  const getStatusMessage = () => {
    if (isComplete && !isProcessing) return null;
    
    if (stats.pdfPageEstimate && stats.pdfPageEstimate > 0) {
      return `Uploading ~${stats.pdfPageEstimate}-page PDF to Gemini for analysis...`;
    }
    
    if (stats.hasLargeWordDoc) {
      return 'Extracting Word document text for analysis...';
    }
    
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <Card className="mb-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium">File Processing</span>
            {isComplete && !isProcessing && (
              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                Complete
              </Badge>
            )}
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {stats.processedFiles}/{stats.totalFiles} files
          </span>
        </div>

        {isProcessing && (
          <Progress value={progress} className="h-2" />
        )}

        {statusMessage && isProcessing && (
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium animate-pulse">
            {statusMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {(stats.totalSize / 1024 / 1024).toFixed(1)} MB total
        </div>
      </CardContent>
    </Card>
  );
};
