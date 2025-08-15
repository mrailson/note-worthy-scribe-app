import mammoth from 'mammoth';

export class WordProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (result.value && result.value.trim().length > 0) {
        return `WORD DOCUMENT CONTENT FROM: ${file.name}

${result.value.trim()}

[Extracted using Mammoth.js Word processor]`;
      }
      
      throw new Error('No text content extracted from Word document');
    } catch (error) {
      console.error('Word processing error:', error);
      throw new Error(`Failed to process Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}