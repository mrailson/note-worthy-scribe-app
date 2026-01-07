import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { UploadedFile } from '@/types/ai4gp';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';

export const useFileUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (files: FileList): Promise<UploadedFile[]> => {
    setIsProcessing(true);
    
    try {
      const filePromises = Array.from(files).map(async (file) => {
        // Validate file type using FileProcessorManager
        if (!FileProcessorManager.isSupported(file.name)) {
          throw new Error(`Unsupported file type: ${file.name}. Supported: Word, Excel, PDF, Text, Images`);
        }
        
        // Process file using the appropriate processor
        const processedFile = await FileProcessorManager.processFile(file);
        
        // Convert to UploadedFile format
        return {
          name: processedFile.name,
          type: processedFile.type,
          content: processedFile.content,
          size: processedFile.size,
          isLoading: false
        };
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
  }, []);

  return {
    processFiles,
    isProcessing
  };
};