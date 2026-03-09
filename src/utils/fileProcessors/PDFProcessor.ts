/**
 * PDF Processor - Dual mode:
 * 1. toBase64DataUrl(): For Ask AI - sends PDFs as base64 for native Gemini multimodal processing
 * 2. extractTextLegacy(): For other features (policy upload, etc.) that need text content
 */
import { supabase } from '@/integrations/supabase/client';

export class PDFProcessor {
  private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit
  
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
   */
  static estimatePageCount(fileSize: number): number {
    const avgPageSize = 100 * 1024;
    return Math.max(1, Math.round(fileSize / avgPageSize));
  }

  /**
   * Extract text from PDF using OCR edge function.
   * Used by policy upload, BP calculator, and other features that need text content.
   */
  static async extractText(file: File): Promise<string> {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`PDF file too large: ${file.name}. Maximum size is 20MB.`);
    }

    console.log('📄 Extracting text from PDF:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    try {
      // Convert to base64 for the OCR service
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64 = btoa(binaryString);
      const dataUrl = `data:application/pdf;base64,${base64}`;

      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileType: 'pdf',
          dataUrl: dataUrl,
          fileName: file.name
        }
      });

      if (error) {
        console.error('❌ PDF text extraction error:', error);
        return `[PDF: ${file.name} - Text extraction failed: ${error.message}]`;
      }

      const extractedText = data?.extractedText || '';
      if (extractedText) {
        console.log('✅ PDF text extracted successfully, length:', extractedText.length);
        return extractedText;
      }
      
      return `[PDF: ${file.name} - No text found]`;
    } catch (error) {
      console.error('❌ PDF processing error:', error);
      return `[PDF: ${file.name} - Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }
}
