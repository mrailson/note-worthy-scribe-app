export class ImageProcessor {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max for processing
  private static readonly OPENAI_MAX_SIZE = 4 * 1024 * 1024; // 4MB max for OpenAI
  private static readonly SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  static async processImage(file: File): Promise<string> {
    try {
      // Validate file type
      if (!this.SUPPORTED_TYPES.includes(file.type)) {
        throw new Error(`Unsupported image type: ${file.type}. Please use JPEG, PNG, or WEBP format.`);
      }

      // Check file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
      }

      if (file.size === 0) {
        throw new Error('File appears to be empty.');
      }

      const dataUrl = await this.readFileAsDataURL(file);
      
      // Additional validation - check if we need to compress for OpenAI
      if (file.size > this.OPENAI_MAX_SIZE) {
        console.warn(`Image size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds OpenAI limit. Consider compressing.`);
      }

      return `IMAGE_DATA_URL:${dataUrl}`;
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        if (!result || !result.startsWith('data:')) {
          reject(new Error('Invalid file data format'));
          return;
        }
        resolve(result);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read image file. Please try again.'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted.'));
      };
      
      try {
        reader.readAsDataURL(file);
      } catch (error) {
        reject(new Error('Failed to start reading file.'));
      }
    });
  }

  static getFileSizeInfo(file: File): { size: string; withinLimits: boolean; openaiCompatible: boolean } {
    const sizeInMB = file.size / 1024 / 1024;
    return {
      size: `${sizeInMB.toFixed(1)}MB`,
      withinLimits: file.size <= this.MAX_FILE_SIZE,
      openaiCompatible: file.size <= this.OPENAI_MAX_SIZE
    };
  }

  static isSupported(fileType: string): boolean {
    return this.SUPPORTED_TYPES.includes(fileType);
  }
}