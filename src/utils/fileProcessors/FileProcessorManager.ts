import { WordProcessor } from './WordProcessor';
import { ExcelProcessor } from './ExcelProcessor';
import { PDFProcessor } from './PDFProcessor';
import { ImageProcessor } from './ImageProcessor';
import { TextProcessor } from './TextProcessor';

export interface ProcessedFile {
  name: string;
  type: string;
  content: string;
  size: number;
  isLoading: false;
  processedType: 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'email' | 'calendar' | 'unknown';
}

export class FileProcessorManager {
  private static readonly SUPPORTED_TYPES = {
    // Text files
    '.txt': 'text',
    '.rtf': 'text',
    '.csv': 'text',
    
    // Email files
    '.eml': 'email',
    '.msg': 'email',
    '.mbox': 'email',
    
    // Calendar files
    '.ics': 'calendar',
    '.vcs': 'calendar',
    '.ical': 'calendar',
    
    // Word documents
    '.doc': 'word',
    '.docx': 'word',
    
    // Excel files
    '.xls': 'excel',
    '.xlsx': 'excel',
    
    // PDF files
    '.pdf': 'pdf',
    
    // Images
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.webp': 'image',
    '.svg': 'image'
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
        case 'word':
          content = await WordProcessor.extractText(file);
          break;
          
        case 'excel':
          content = await ExcelProcessor.extractText(file);
          break;
          
        case 'pdf':
          content = await PDFProcessor.extractText(file);
          break;
          
        case 'image':
          content = await ImageProcessor.processImage(file);
          break;
          
        case 'text':
          content = await TextProcessor.extractText(file);
          break;
          
        case 'email':
          content = await TextProcessor.extractEmailContent(file);
          break;
          
        case 'calendar':
          content = await TextProcessor.extractCalendarContent(file);
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