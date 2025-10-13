import { supabase } from '@/integrations/supabase/client';

export class PowerPointProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:application/vnd.ms-powerpoint;base64,${base64}`;
      
      console.log('Extracting text from PowerPoint...');
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileType: 'powerpoint',
          dataUrl: dataUrl,
          fileName: file.name
        }
      });

      if (error) {
        console.error('PowerPoint extraction error:', error);
        return `[PowerPoint: ${file.name} - Extraction failed: ${error.message}]`;
      }

      const extractedText = data?.extractedText || '';
      if (extractedText) {
        console.log('PowerPoint text extracted successfully, length:', extractedText.length);
        return extractedText;
      } else {
        return `[PowerPoint: ${file.name} - No text found]`;
      }
      
    } catch (error) {
      console.error('PowerPoint processing error:', error);
      throw new Error(`Failed to process PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}