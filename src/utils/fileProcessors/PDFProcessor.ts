import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export class PDFProcessor {
  private static readonly MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit
  
  static async extractText(file: File): Promise<string> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error(`PDF file too large: ${file.name}. Maximum size is 15MB.`);
      }

      console.log('Extracting text from PDF using PDF.js...');
      
      // First, try client-side text extraction with PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const extractedText = await this.extractTextWithPdfJs(arrayBuffer);
      
      // If we got meaningful text (more than just whitespace), return it
      if (extractedText && extractedText.trim().length > 50) {
        console.log('PDF text extracted successfully with PDF.js, length:', extractedText.length);
        return extractedText;
      }
      
      // If PDF.js didn't extract much text, it's likely a scanned PDF
      // Fall back to OCR using the vision API
      console.log('PDF appears to be scanned or has minimal text, using OCR...');
      return await this.extractTextWithOCR(arrayBuffer, file.name);
      
    } catch (error) {
      console.error('PDF processing error:', error);
      if (error instanceof Error && error.message.includes('too large')) {
        throw error;
      }
      throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async extractTextWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF.js extraction error:', error);
      return '';
    }
  }

  private static async extractTextWithOCR(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:application/pdf;base64,${base64}`;
      
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileType: 'pdf',
          dataUrl: dataUrl,
          fileName: fileName
        }
      });

      if (error) {
        console.error('OCR extraction error:', error);
        return `[PDF: ${fileName} - OCR extraction failed: ${error.message}]`;
      }

      const extractedText = data?.extractedText || '';
      if (extractedText) {
        console.log('PDF text extracted successfully via OCR, length:', extractedText.length);
        return extractedText;
      } else {
        return `[PDF: ${fileName} - No text found]`;
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      return `[PDF: ${fileName} - OCR processing failed]`;
    }
  }
}