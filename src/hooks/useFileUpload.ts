import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { UploadedFile } from '@/types/ai4gp';

export const useFileUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (files: FileList): Promise<UploadedFile[]> => {
    setIsProcessing(true);
    
    try {
      const filePromises = Array.from(files).map(async (file) => {
        // Add file type validation
        const validTypes = ['.pdf', '.doc', '.docx', '.rtf', '.txt', '.eml', '.msg', '.jpg', '.jpeg', '.png', '.wav', '.mp3', '.m4a', '.xls', '.xlsx', '.csv'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!validTypes.includes(fileExtension)) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }
        
        // Add file size validation (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File too large: ${file.name} (max 10MB)`);
        }
        
        const reader = new FileReader();
        
        return new Promise<UploadedFile>((resolve, reject) => {
          reader.onload = () => {
            try {
              const content = reader.result as string;
              resolve({
                name: file.name,
                type: file.type,
                content: content,
                size: file.size,
                isLoading: false
              });
            } catch (error: any) {
              reject(new Error(`Failed to process ${file.name}: ${error.message}`));
            }
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          
          // Use readAsText for text files, readAsDataURL for binary files
          if (['.jpg', '.jpeg', '.png', '.wav', '.mp3', '.m4a', '.xls', '.xlsx', '.pdf', '.doc', '.docx'].includes(fileExtension)) {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        });
      });

      const processedFiles = await Promise.all(filePromises);
      toast.success(`${processedFiles.length} file(s) uploaded successfully`);
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