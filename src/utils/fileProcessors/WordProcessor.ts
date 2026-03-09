import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';

export class WordProcessor {
  /**
   * Convert .docx to PDF base64 data URL for native Gemini multimodal processing.
   * Pipeline: .docx → HTML (mammoth) → PDF (html2pdf.js) → base64 data URL
   */
  static async convertToPdfBase64(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // Reject legacy .doc format
    if (ext === 'doc') {
      throw new Error(
        'Please save this document as .docx or PDF format and re-upload. ' +
        'The older .doc format is not supported.'
      );
    }

    try {
      console.log('📝 Converting Word document to PDF:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Step 1: Convert .docx to HTML using mammoth
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      if (!html || html.trim().length === 0) {
        throw new Error('No content extracted from Word document');
      }

      console.log('✅ Word → HTML conversion complete, HTML length:', html.length);

      // Step 2: Convert HTML to PDF using html2pdf.js in a hidden container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '210mm'; // A4 width
      container.innerHTML = html;
      document.body.appendChild(container);

      try {
        const pdfBlob: Blob = await html2pdf()
          .set({
            margin: [10, 10, 10, 10],
            filename: file.name.replace(/\.docx?$/i, '.pdf'),
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(container)
          .outputPdf('blob');

        console.log('✅ HTML → PDF conversion complete, PDF size:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB');

        // Step 3: Convert PDF blob to base64 data URL
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to convert PDF to base64'));
          reader.readAsDataURL(pdfBlob);
        });

        console.log('✅ Word document fully converted to PDF base64, length:', base64DataUrl.length);
        return base64DataUrl;
      } finally {
        document.body.removeChild(container);
      }
    } catch (error) {
      console.error('Word to PDF conversion error:', error);
      throw new Error(`Failed to convert Word document to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Legacy text extraction — kept for non-AI features (BP calculator, policy upload, etc.)
   */
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
