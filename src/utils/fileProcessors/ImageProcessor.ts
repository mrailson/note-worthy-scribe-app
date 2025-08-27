import { supabase } from '@/integrations/supabase/client';

export class ImageProcessor {
  static async processImage(file: File): Promise<string> {
    try {
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const dataUrl = reader.result as string;
            
            // Use the OCR edge function to extract text from the image
            const { data, error } = await supabase.functions.invoke('image-ocr-transcription', {
              body: {
                imageData: dataUrl,
                fileName: file.name
              }
            });

            if (error) {
              console.error('OCR error:', error);
              // Fallback to basic image data if OCR fails
              resolve(`IMAGE_DATA_URL:${dataUrl}`);
              return;
            }

            if (data.success && data.extractedText) {
              // Return extracted text with image context
              resolve(`EXTRACTED_TEXT_FROM_IMAGE[${file.name}]:\n\n${data.extractedText}\n\n[End of extracted text from ${file.name}]`);
            } else {
              // Fallback to basic image data
              resolve(`IMAGE_DATA_URL:${dataUrl}`);
            }
          } catch (ocrError) {
            console.error('OCR processing error:', ocrError);
            // Fallback to basic image data
            const dataUrl = reader.result as string;
            resolve(`IMAGE_DATA_URL:${dataUrl}`);
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