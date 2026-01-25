import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ImportedQuestion {
  question_text: string;
  question_type: 'rating' | 'text' | 'multiple_choice' | 'yes_no' | 'scale';
  options: string[];
  is_required: boolean;
  confidence: number;
}

export interface ImportResult {
  title: string;
  questions: ImportedQuestion[];
}

type FileType = 'word' | 'excel' | 'powerpoint' | 'pdf' | 'image';

const FILE_TYPE_MAP: Record<string, FileType> = {
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
};

const EXTENSION_MAP: Record<string, FileType> = {
  '.doc': 'word',
  '.docx': 'word',
  '.xls': 'excel',
  '.xlsx': 'excel',
  '.ppt': 'powerpoint',
  '.pptx': 'powerpoint',
  '.pdf': 'pdf',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.heic': 'image',
};

function getFileType(file: File): FileType | null {
  // Try MIME type first
  if (FILE_TYPE_MAP[file.type]) {
    return FILE_TYPE_MAP[file.type];
  }
  
  // Fall back to extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return EXTENSION_MAP[ext] || null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export function useSurveyImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const { toast } = useToast();

  const processFile = useCallback(async (file: File): Promise<ImportResult | null> => {
    const fileType = getFileType(file);
    
    if (!fileType) {
      toast({
        title: 'Unsupported file type',
        description: `${file.name} is not a supported file type. Please use Word, Excel, PowerPoint, PDF, or image files.`,
        variant: 'destructive',
      });
      return null;
    }

    setIsProcessing(true);
    setProgress(`Reading ${file.name}...`);

    try {
      let dataUrl = await fileToBase64(file);
      
      // For images, check size and compress if needed
      if (fileType === 'image') {
        const sizeKB = (dataUrl.length * 0.75) / 1024;
        if (sizeKB > 3000) {
          setProgress('Compressing image...');
          dataUrl = await compressImage(dataUrl, 1200, 0.7);
        }
      }

      // For non-image files, extract text first using extract-document-text
      let contentForParsing: string;
      let contentType: 'text' | 'image';

      if (fileType === 'image') {
        contentForParsing = dataUrl;
        contentType = 'image';
      } else {
        setProgress('Extracting text...');
        
        const { data: extractData, error: extractError } = await supabase.functions.invoke(
          'extract-document-text',
          {
            body: {
              fileType,
              dataUrl,
              fileName: file.name,
            },
          }
        );

        if (extractError) {
          console.error('Text extraction error:', extractError);
          throw new Error(`Failed to extract text: ${extractError.message}`);
        }

        if (!extractData?.extractedText || extractData.extractedText.trim().length === 0) {
          toast({
            title: 'No content found',
            description: 'The file appears to be empty or could not be read.',
            variant: 'destructive',
          });
          return null;
        }

        contentForParsing = extractData.extractedText;
        contentType = 'text';
      }

      setProgress('Analysing content with AI...');

      const { data, error } = await supabase.functions.invoke('parse-survey-questions', {
        body: {
          content: contentForParsing,
          contentType,
          fileName: file.name,
        },
      });

      if (error) {
        console.error('Parse error:', error);
        
        // Handle specific error codes
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          toast({
            title: 'Rate limit exceeded',
            description: 'Please wait a moment and try again.',
            variant: 'destructive',
          });
          return null;
        }
        
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast({
            title: 'AI credits exhausted',
            description: 'Please add credits to continue using AI features.',
            variant: 'destructive',
          });
          return null;
        }

        throw new Error(`Failed to parse questions: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from parser');
      }

      const result: ImportResult = {
        title: data.title || file.name.replace(/\.[^/.]+$/, ''),
        questions: data.questions || [],
      };

      if (result.questions.length === 0) {
        toast({
          title: 'No questions found',
          description: 'The AI could not identify any survey questions in this file. Try a file with clearer question formatting.',
        });
      } else {
        toast({
          title: 'Questions extracted',
          description: `Found ${result.questions.length} question${result.questions.length === 1 ? '' : 's'}. Review and edit before importing.`,
        });
      }

      return result;

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [toast]);

  return {
    processFile,
    isProcessing,
    progress,
  };
}
