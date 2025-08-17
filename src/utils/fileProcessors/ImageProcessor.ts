export class ImageProcessor {
  static async processImage(file: File): Promise<string> {
    try {
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(`IMAGE_DATA_URL:${dataUrl}`);
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