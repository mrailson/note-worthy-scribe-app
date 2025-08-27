export class ImageProcessor {
  static async processImage(file: File): Promise<string> {
    try {
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            // Return image as base64 data without OCR processing
            resolve(`IMAGE_DATA_URL:${dataUrl}`);
          } catch (error) {
            console.error('Image processing error:', error);
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