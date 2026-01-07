import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { UploadedFile } from '@/types/ai4gp';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';

export interface FileProcessingStats {
  totalFiles: number;
  processedFiles: number;
  totalSize: number;
  hasNumericalData: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

// File upload limits
export const FILE_LIMITS = {
  MAX_FILES: 20,
  MAX_FILE_SIZE_MB: 15,
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024,
};

export const useEnhancedFileProcessing = () => {
  const [processingStats, setProcessingStats] = useState<FileProcessingStats>({
    totalFiles: 0,
    processedFiles: 0,
    totalSize: 0,
    hasNumericalData: false,
    estimatedComplexity: 'low'
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const validateFileContent = useCallback((content: string, fileName: string) => {
    // Check for potential data integrity issues
    const issues: string[] = [];
    
    // Check for truncation indicators
    if (content.endsWith('...') || content.includes('[truncated]')) {
      issues.push('File appears to be truncated');
    }

    // Check for encoding issues
    if (content.includes('�') || content.includes('???')) {
      issues.push('File may have encoding issues');
    }

    // Check for numerical data
    const hasNumbers = /\d+/.test(content);
    const hasCurrency = /£[\d,]+\.?\d*/.test(content);
    const hasPercentages = /\d+\s*%/.test(content);

    return {
      hasNumericalData: hasNumbers || hasCurrency || hasPercentages,
      issues,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length
    };
  }, []);

  const processFilesWithValidation = useCallback(async (files: FileList): Promise<UploadedFile[]> => {
    setIsProcessing(true);
    
    try {
      // Validate file count limit
      if (files.length > FILE_LIMITS.MAX_FILES) {
        throw new Error(`Maximum ${FILE_LIMITS.MAX_FILES} files allowed per upload. You selected ${files.length}.`);
      }
      
      const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      
      setProcessingStats({
        totalFiles: files.length,
        processedFiles: 0,
        totalSize,
        hasNumericalData: false,
        estimatedComplexity: files.length > 3 ? 'high' : files.length > 1 ? 'medium' : 'low'
      });

      const filePromises = Array.from(files).map(async (file, index) => {
        // Validate file type
        if (!FileProcessorManager.isSupported(file.name)) {
          throw new Error(`Unsupported file type: ${file.name}. Supported: Word, Excel, PDF, Text, Images`);
        }
        
        // Process file
        const processedFile = await FileProcessorManager.processFile(file);
        
        // Validate content
        const validation = validateFileContent(processedFile.content, processedFile.name);
        
        if (validation.issues.length > 0) {
          console.warn(`File ${processedFile.name} has issues:`, validation.issues);
        }

        // Update stats
        setProcessingStats(prev => ({
          ...prev,
          processedFiles: index + 1,
          hasNumericalData: prev.hasNumericalData || validation.hasNumericalData
        }));

        // Add validation metadata to file
        const enhancedFile: UploadedFile = {
          name: processedFile.name,
          type: processedFile.type,
          content: processedFile.content,
          size: processedFile.size,
          isLoading: false,
          metadata: {
            hasNumericalData: validation.hasNumericalData,
            wordCount: validation.wordCount,
            issues: validation.issues
          }
        };

        return enhancedFile;
      });

      const processedFiles = await Promise.all(filePromises);
      return processedFiles;
      
    } catch (error) {
      console.error('Error processing files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process files';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [validateFileContent]);

  const getProcessingSummary = useCallback(() => {
    return {
      ...processingStats,
      isComplete: processingStats.processedFiles === processingStats.totalFiles && processingStats.totalFiles > 0
    };
  }, [processingStats]);

  const chunkLargeFileSet = useCallback((files: UploadedFile[], maxChunkSize = 3): UploadedFile[][] => {
    if (files.length <= maxChunkSize) {
      return [files];
    }

    const chunks: UploadedFile[][] = [];
    for (let i = 0; i < files.length; i += maxChunkSize) {
      chunks.push(files.slice(i, i + maxChunkSize));
    }

    return chunks;
  }, []);

  return {
    processFilesWithValidation,
    isProcessing,
    processingStats,
    getProcessingSummary,
    chunkLargeFileSet,
    validateFileContent
  };
};