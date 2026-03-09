import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, FileSpreadsheet, Image as ImageIcon, FileAudio } from 'lucide-react';
import { FileProcessingStats } from '@/hooks/useEnhancedFileProcessing';
import { UploadedFile } from '@/types/ai4gp';

interface FileProcessingProgressProps {
  stats: FileProcessingStats;
  isProcessing: boolean;
  uploadedFiles?: UploadedFile[];
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-blue-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <ImageIcon className="w-3.5 h-3.5 text-purple-500" />;
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return <FileAudio className="w-3.5 h-3.5 text-orange-500" />;
  return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
};

export const FileProcessingProgress: React.FC<FileProcessingProgressProps> = ({
  stats,
  isProcessing,
  uploadedFiles
}) => {
  const progress = stats.totalFiles > 0 ? (stats.processedFiles / stats.totalFiles) * 100 : 0;
  const isComplete = stats.processedFiles === stats.totalFiles && stats.totalFiles > 0;

  if (stats.totalFiles === 0 && !isProcessing) {
    return null;
  }

  // Generate descriptive status message based on file types
  const getStatusMessage = () => {
    if (isComplete && !isProcessing) return 'Sending full document to AI for analysis...';
    
    if (stats.pdfPageEstimate && stats.pdfPageEstimate > 0) {
      return `Uploading ~${stats.pdfPageEstimate}-page PDF to Gemini for analysis...`;
    }
    
    if (stats.hasLargeWordDoc) {
      return 'Converting Word document for analysis...';
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
                Ready
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

        {/* Upload confirmation: file details */}
        {uploadedFiles && uploadedFiles.length > 0 && isComplete && !isProcessing && (
          <div className="space-y-1.5">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                {getFileIcon(file.name)}
                <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                <span className="text-muted-foreground/70">({formatFileSize(file.size)})</span>
                <span className="text-muted-foreground/70">
                  {file.type || file.name.split('.').pop()?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}

        {statusMessage && (
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium animate-pulse">
            {statusMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {formatFileSize(stats.totalSize)} total
        </div>
      </CardContent>
    </Card>
  );
};
