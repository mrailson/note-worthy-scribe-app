import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { UploadedFile } from '@/types/ai4gp';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';

export const useFileUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (
    files: FileList,
    onFileUpdate?: (fileIndex: number, file: UploadedFile) => void
  ): Promise<UploadedFile[]> => {
    setIsProcessing(true);
    
    try {
      // Create initial loading state files
      const initialFiles: UploadedFile[] = Array.from(files).map((file, index) => {
        // Validate file type first
        if (!FileProcessorManager.isSupported(file.name)) {
          return {
            name: file.name,
            type: file.type,
            content: '',
            size: file.size,
            isLoading: false,
            error: `Unsupported file type. Supported: Word, Excel, PDF, Text, Email, Calendar, Images`
          };
        }
        
        return {
          name: file.name,
          type: file.type,
          content: '',
          size: file.size,
          isLoading: true
        };
      });

      // Return initial files immediately for UI update
      if (onFileUpdate) {
        initialFiles.forEach((file, index) => {
          onFileUpdate(index, file);
        });
      }

      // Process files individually
      const processedFiles: UploadedFile[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (initialFiles[i].error) {
          processedFiles.push(initialFiles[i]);
          continue;
        }
        
        try {
          // Process file using the appropriate processor
          const processedFile = await FileProcessorManager.processFile(file);
          
          const finalFile: UploadedFile = {
            name: processedFile.name,
            type: processedFile.type,
            content: processedFile.content,
            size: processedFile.size,
            isLoading: false
          };
          
          processedFiles.push(finalFile);
          
          // Update individual file status
          if (onFileUpdate) {
            onFileUpdate(i, finalFile);
          }
          
        } catch (error) {
          const errorFile: UploadedFile = {
            name: file.name,
            type: file.type,
            content: '',
            size: file.size,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to process file'
          };
          
          processedFiles.push(errorFile);
          
          if (onFileUpdate) {
            onFileUpdate(i, errorFile);
          }
        }
      }

      const successCount = processedFiles.filter(f => !f.error).length;
      const errorCount = processedFiles.filter(f => f.error).length;
      
      if (successCount > 0) {
        toast.success(`${successCount} file(s) processed successfully`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} file(s) failed to process`);
      }
      
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