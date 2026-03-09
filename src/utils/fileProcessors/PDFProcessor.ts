/**
 * PDF Processor - Sends PDFs as base64 for native Gemini multimodal processing.
 * 
 * Gemini natively supports PDF input as images (each page rendered internally).
 * No text extraction, regex parsing, or OCR is needed.
 */
export class PDFProcessor {
  private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit for Gemini
  
  /**
   * Convert PDF to base64 data URL for direct Gemini multimodal input.
   * Does NOT extract text - Gemini handles PDF pages natively.
   */
  static async toBase64DataUrl(file: File): Promise<string> {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`PDF file too large: ${file.name}. Maximum size is 20MB.`);
    }

    console.log('📄 Converting PDF to base64 for Gemini:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        console.log('✅ PDF converted to base64 successfully, length:', dataUrl.length);
        resolve(dataUrl);
      };
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Estimate page count from PDF file size (rough heuristic).
   * Average PDF page is ~50-100KB for text, ~200-500KB with images.
   */
  static estimatePageCount(fileSize: number): number {
    const avgPageSize = 100 * 1024; // ~100KB per page as middle estimate
    return Math.max(1, Math.round(fileSize / avgPageSize));
  }

  /**
   * @deprecated Use toBase64DataUrl instead. Gemini handles PDF analysis natively.
   */
  static async extractText(file: File): Promise<string> {
    // Legacy fallback - just return base64 data URL
    return this.toBase64DataUrl(file);
  }
}
