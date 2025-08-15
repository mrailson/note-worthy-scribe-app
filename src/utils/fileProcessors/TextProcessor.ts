export class TextProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const text = await file.text();
      
      if (text && text.trim().length > 0) {
        return `TEXT FILE CONTENT FROM: ${file.name}

${text.trim()}

[Plain text file]`;
      }
      
      throw new Error('No text content found in file');
    } catch (error) {
      console.error('Text processing error:', error);
      throw new Error(`Failed to process text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}