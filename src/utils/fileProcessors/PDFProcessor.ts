import { supabase } from '@/integrations/supabase/client';

export class PDFProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:application/pdf;base64,${base64}`;
      
      console.log('Extracting text from PDF...');
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileType: 'pdf',
          dataUrl: dataUrl,
          fileName: file.name
        }
      });

      if (error) {
        console.error('PDF extraction error:', error);
        return `[PDF: ${file.name} - Extraction failed: ${error.message}]`;
      }

      const extractedText = data?.extractedText || '';
      if (extractedText) {
        console.log('PDF text extracted successfully, length:', extractedText.length);
        return extractedText;
      } else {
        return `[PDF: ${file.name} - No text found]`;
      }
      
    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}