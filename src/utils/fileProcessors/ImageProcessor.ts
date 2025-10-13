import { supabase } from '@/integrations/supabase/client';

export class ImageProcessor {
  static async processImage(file: File): Promise<string> {
    try {
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const dataUrl = reader.result as string;
            
            // Call edge function to extract text from image using OCR
            console.log('Extracting text from image using OCR...');
            const { data, error } = await supabase.functions.invoke('extract-document-text', {
              body: {
                fileType: 'image',
                dataUrl: dataUrl,
                fileName: file.name
              }
            });

            if (error) {
              console.error('OCR extraction error:', error);
              resolve(`[Image: ${file.name} - OCR failed: ${error.message}]`);
              return;
            }

            const extractedText = data?.extractedText || '';
            if (extractedText && extractedText !== 'No text found in image') {
              console.log('OCR extracted text successfully, length:', extractedText.length);
              resolve(extractedText);
            } else {
              resolve(`[Image: ${file.name} - No text found]`);
            }
          } catch (error) {
            console.error('Image processing error:', error);
            resolve(`[Image: ${file.name} - Processing failed]`);
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read image file'));
        };
        
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}