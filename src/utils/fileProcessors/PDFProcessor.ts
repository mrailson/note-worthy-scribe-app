import { supabase } from '@/integrations/supabase/client';

export class PDFProcessor {
  private static readonly MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit
  
  static async extractText(file: File): Promise<string> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error(`PDF file too large: ${file.name}. Maximum size is 15MB.`);
      }

      console.log('📄 Starting PDF text extraction for:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      // Create a copy for potential OCR use (since PDF.js may detach the original)
      const arrayBufferCopy = arrayBuffer.slice(0);
      
      try {
        console.log('🔍 Attempting PDF.js text extraction...');
        const extractedText = await this.extractTextWithPdfJs(arrayBuffer);
        
        // If we got meaningful text (more than just whitespace), return it
        if (extractedText && extractedText.trim().length > 50) {
          console.log('✅ PDF text extracted successfully with PDF.js, length:', extractedText.length);
          return extractedText;
        }
        
        console.log('⚠️ PDF.js extracted minimal text (', extractedText.trim().length, 'chars). Likely a scanned PDF.');
      } catch (pdfJsError) {
        console.warn('⚠️ PDF.js extraction failed:', pdfJsError);
        console.log('📸 Falling back to OCR method...');
      }
      
      // If PDF.js didn't extract much text or failed, fall back to OCR using the copy
      return await this.extractTextWithOCR(arrayBufferCopy, file.name);
      
    } catch (error) {
      console.error('❌ PDF processing error:', error);
      if (error instanceof Error && error.message.includes('too large')) {
        throw error;
      }
      throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async extractTextWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamic import to avoid loading pdfjs-dist at startup
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configure worker dynamically
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();

      console.log('📚 Loading PDF document...');
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      console.log(`📖 PDF loaded successfully. Pages: ${pdf.numPages}`);
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
            console.log(`✓ Page ${pageNum}: ${pageText.length} characters extracted`);
          } else {
            console.log(`⚠️ Page ${pageNum}: No text found (possibly scanned)`);
          }
        } catch (pageError) {
          console.error(`❌ Error extracting text from page ${pageNum}:`, pageError);
        }
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('❌ PDF.js extraction error:', error);
      throw error; // Re-throw to trigger OCR fallback
    }
  }

  private static async extractTextWithOCR(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
      console.log('📸 Converting PDF to base64 for OCR...');
      
      // Convert to base64 in chunks to avoid stack overflow on large files
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64 = btoa(binaryString);
      const dataUrl = `data:application/pdf;base64,${base64}`;
      
      console.log('📤 Sending to OCR service...');
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileType: 'pdf',
          dataUrl: dataUrl,
          fileName: fileName
        }
      });

      if (error) {
        console.error('❌ OCR extraction error:', error);
        return `[PDF: ${fileName} - OCR extraction failed: ${error.message}]`;
      }

      const extractedText = data?.extractedText || '';
      if (extractedText) {
        console.log('✅ PDF text extracted successfully via OCR, length:', extractedText.length);
        return extractedText;
      } else {
        console.warn('⚠️ OCR returned no text');
        return `[PDF: ${fileName} - No text found via OCR]`;
      }
    } catch (error) {
      console.error('❌ OCR processing error:', error);
      return `[PDF: ${fileName} - OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }
}
