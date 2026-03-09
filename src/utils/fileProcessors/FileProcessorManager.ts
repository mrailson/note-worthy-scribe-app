import { WordProcessor } from './WordProcessor';
import { ExcelProcessor } from './ExcelProcessor';
import { PDFProcessor } from './PDFProcessor';
import { ImageProcessor } from './ImageProcessor';
import { TextProcessor } from './TextProcessor';
import { AudioProcessor } from './AudioProcessor';
import { PowerPointProcessor } from './PowerPointProcessor';

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
    '.html': 'text',
    '.htm': 'text',
    
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
    
    // File size validation (20MB limit for PDFs, 15MB for others)
    const maxSize = fileType === 'pdf' ? 20 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.name} (max ${fileType === 'pdf' ? '20' : '15'}MB)`);
    }
    
    let content: string;
    
    try {
      switch (fileType) {
        case 'word': {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'doc') {
            throw new Error(
              "This Word document couldn't be processed. Please try:\n" +
              '1. Open in Word and Save As PDF, then upload the PDF\n' +
              '2. Open in Google Docs and download as PDF\n' +
              '3. If this is a .doc file, re-save as .docx first'
            );
          }
          // Process .docx with 3-attempt fallback chain
          console.log('📝 Processing Word document with fallback chain...');
          const wordResult = await WordProcessor.processWithFallbacks(file);
          console.log(`📝 Word processing used attempt ${wordResult.attempt} (${wordResult.outputMode} mode)` +
            (wordResult.characterCount ? `, ${wordResult.characterCount.toLocaleString()} characters` : ''));
          content = wordResult.content;
          // Store output mode for downstream type resolution
          (file as any).__wordOutputMode = wordResult.outputMode;
          break;
        }
          
        case 'excel':
          content = await ExcelProcessor.extractText(file);
          break;
          
        case 'pdf':
          // PDFs are sent as base64 data URLs for native Gemini multimodal processing
          // No text extraction needed - Gemini reads each page as an image natively
          content = await PDFProcessor.toBase64DataUrl(file);
          break;
          
        case 'powerpoint':
          content = await PowerPointProcessor.extractText(file);
          break;
          
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
      
      // Word docs: determine effective type based on which fallback attempt succeeded
      let effectiveType: string = fileType;
      if (fileType === 'word') {
        effectiveType = content.startsWith('data:application/pdf') ? 'pdf' : 'text';
      }

      return {
        name: file.name,
        type: effectiveType === 'pdf' ? 'application/pdf' : file.type,
        content,
        size: file.size,
        isLoading: false,
        processedType: effectiveType as ProcessedFile['processedType']
      };
      
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      throw error;
    }
  }
}
