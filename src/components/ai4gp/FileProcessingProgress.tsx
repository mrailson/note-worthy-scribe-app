import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText, Calculator, AlertTriangle } from 'lucide-react';
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

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="text-xs">
            {(stats.totalSize / 1024 / 1024).toFixed(1)} MB total
          </Badge>
          
          <Badge 
            variant="outline" 
            className={`text-xs ${
              stats.estimatedComplexity === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
              stats.estimatedComplexity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
              'bg-green-100 text-green-700 border-green-300'
            }`}
          >
            {stats.estimatedComplexity} complexity
          </Badge>

          {stats.hasNumericalData && (
            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
              <Calculator className="w-3 h-3 mr-1" />
              Numerical data detected
            </Badge>
          )}
        </div>

        {stats.hasNumericalData && isComplete && (
          <div className="text-xs text-orange-600 p-2 bg-orange-100 rounded flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              Files contain numerical data. Calculations will be automatically verified for accuracy.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};