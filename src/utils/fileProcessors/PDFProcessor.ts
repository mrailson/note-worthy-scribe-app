export class PDFProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      // First, try to extract text directly from PDF
      const arrayBuffer = await file.arrayBuffer();
      
      // Convert to data URL for potential vision processing
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:application/pdf;base64,${base64}`;
      
      // For now, return the base64 data URL for the edge function to handle
      // The edge function will attempt text extraction with better libraries
      return `PDF_DATA_URL:${dataUrl}`;
      
    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}