import { ImageProcessor } from './ImageProcessor';
import { TextProcessor } from './TextProcessor';
import { AudioProcessor } from './AudioProcessor';

export interface ProcessedFile {
  name: string;
  type: string;
  content: string;
  size: number;
  isLoading: false;
  processedType: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'audio' | 'powerpoint' | 'unknown';
}

export class FileProcessorManager {
  private static readonly SUPPORTED_TYPES = {
    // Text files
    '.txt': 'text',
    '.rtf': 'text',
    '.eml': 'text',
    '.msg': 'text',
    '.csv': 'text',
    
    // Word documents
    '.doc': 'word',
    '.docx': 'word',
    
    // Excel files
    '.xls': 'excel',
    '.xlsx': 'excel',
    
    // PDF files
    '.pdf': 'pdf',
    
    // PowerPoint files
    '.ppt': 'powerpoint',
    '.pptx': 'powerpoint',
    
    // Images
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.webp': 'image',
    '.svg': 'image',
    '.bmp': 'image',
    '.tiff': 'image',
    '.tif': 'image',
    
    // Audio files
    '.mp3': 'audio',
    '.wav': 'audio',
    '.m4a': 'audio',
    '.ogg': 'audio',
    '.flac': 'audio',
    '.aac': 'audio',
    '.opus': 'audio',
    '.amr': 'audio',
    '.3gp': 'audio'
  };

  static getFileType(fileName: string): string {
    const extension = '.' + fileName.split('.').pop()?.toLowerCase();
    return this.SUPPORTED_TYPES[extension as keyof typeof this.SUPPORTED_TYPES] || 'unknown';
  }

  static isSupported(fileName: string): boolean {
    return this.getFileType(fileName) !== 'unknown';
  }

  static async processFile(file: File): Promise<ProcessedFile> {
    const fileType = this.getFileType(file.name);
    
    if (!this.isSupported(file.name)) {
      throw new Error(`Unsupported file type: ${file.name}`);
    }
    
    // File size validation (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      throw new Error(`File too large: ${file.name} (max 15MB)`);
    }
    
    let content: string;
    
    try {
      switch (fileType) {
        case 'word': {
          // Dynamic import to avoid loading mammoth at startup
          const { WordProcessor } = await import('./WordProcessor');
          content = await WordProcessor.extractText(file);
          break;
        }
          
        case 'excel': {
          // Dynamic import to avoid loading xlsx-js-style at startup
          const { ExcelProcessor } = await import('./ExcelProcessor');
          content = await ExcelProcessor.extractText(file);
          break;
        }
          
        case 'pdf': {
          // Dynamic import to avoid loading pdfjs-dist at startup
          const { PDFProcessor } = await import('./PDFProcessor');
          content = await PDFProcessor.extractText(file);
          break;
        }
          
        case 'powerpoint': {
          // Dynamic import for PowerPoint processor
          const { PowerPointProcessor } = await import('./PowerPointProcessor');
          content = await PowerPointProcessor.extractText(file);
          break;
        }
          
        case 'image':
          content = await ImageProcessor.processImage(file);
          break;
          
        case 'audio':
          content = await AudioProcessor.transcribeAudio(file);
          break;
          
        case 'text':
          content = await TextProcessor.extractText(file);
          break;
          
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      return {
        name: file.name,
        type: file.type,
        content,
        size: file.size,
        isLoading: false,
        processedType: fileType as ProcessedFile['processedType']
      };
      
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      throw error;
    }
  }
}
