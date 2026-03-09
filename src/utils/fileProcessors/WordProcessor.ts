import mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';

export interface WordProcessingResult {
  content: string;
  /** 'pdf' if sent as base64 PDF, 'text' if sent as extracted text */
  outputMode: 'pdf' | 'text';
  /** Which attempt succeeded */
  attempt: 1 | 2 | 3;
  /** Character count of extracted content (text mode only) */
  characterCount?: number;
}

export class WordProcessor {
  /**
   * Process a .docx file with a 3-attempt fallback chain:
   *   1. mammoth → HTML → html2pdf → PDF base64 (best quality, multimodal)
   *   2. mammoth → HTML → plain text (good quality, loses layout)
   *   3. JSZip → raw XML → w:t tag extraction (last resort)
   *
   * Returns the content string and metadata about which method was used.
   */
  static async processWithFallbacks(file: File): Promise<WordProcessingResult> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'doc') {
      throw new Error(
        "This Word document couldn't be processed. Please try:\n" +
        '1. Open in Word and Save As PDF, then upload the PDF\n' +
        '2. Open in Google Docs and download as PDF\n' +
        '3. If this is a .doc file, re-save as .docx first'
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let mammothHtml: string | null = null;

    // ── ATTEMPT 1 & 2: mammoth-based ──────────────────────────────
    try {
      console.log('📝 Attempt 1: Converting .docx → HTML via mammoth…', file.name);
      const result = await mammoth.convertToHtml({ arrayBuffer });
      mammothHtml = result.value;

      if (!mammothHtml || mammothHtml.trim().length === 0) {
        throw new Error('Mammoth returned empty HTML');
      }

      console.log('✅ Mammoth HTML extracted, length:', mammothHtml.length);

      // ── ATTEMPT 1: HTML → PDF → base64 ───────────────────────
      try {
        console.log('📄 Attempt 1: Converting HTML → PDF via html2pdf…');
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.width = '210mm';
        container.style.minHeight = '297mm';
        container.style.background = 'white';
        container.style.color = 'black';
        container.style.fontSize = '12pt';
        container.style.fontFamily = 'Arial, Helvetica, sans-serif';
        container.style.lineHeight = '1.5';
        container.style.padding = '20mm';
        container.style.zIndex = '-9999';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'auto';
        container.innerHTML = mammothHtml;
        document.body.appendChild(container);

        // Allow browser to fully paint before html2canvas captures
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          const pdfBlob: Blob = await html2pdf()
            .set({
              margin: [10, 10, 10, 10],
              filename: file.name.replace(/\.docx?$/i, '.pdf'),
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            })
            .from(container)
            .outputPdf('blob');

          console.log('✅ PDF blob created, size:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB');

          const base64DataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to convert PDF to base64'));
            reader.readAsDataURL(pdfBlob);
          });

          console.log('✅ Attempt 1 SUCCESS — Word → PDF base64, length:', base64DataUrl.length);
          return { content: base64DataUrl, outputMode: 'pdf', attempt: 1 };
        } finally {
          document.body.removeChild(container);
        }
      } catch (pdfError) {
        console.warn('⚠️ Attempt 1 FAILED (PDF conversion):', pdfError);
        // Fall through to Attempt 2
      }

      // ── ATTEMPT 2: HTML → plain text ──────────────────────────
      console.log('📝 Attempt 2: Stripping HTML to plain text…');
      const plainText = mammothHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (plainText.length > 100) {
        const charCount = plainText.length;
        console.log(`✅ Attempt 2 SUCCESS — Extracted ${charCount.toLocaleString()} characters from document`);

        const textContent = `WORD DOCUMENT CONTENT FROM: ${file.name}\n\n${plainText}`;
        return {
          content: textContent,
          outputMode: 'text',
          attempt: 2,
          characterCount: charCount,
        };
      }

      console.warn('⚠️ Attempt 2 FAILED — text too short:', plainText.length, 'characters');
    } catch (mammothError) {
      console.warn('⚠️ Mammoth FAILED, trying XML extraction:', mammothError);
    }

    // ── ATTEMPT 3: Raw XML extraction via JSZip ─────────────────
    try {
      console.log('📝 Attempt 3: Extracting text from raw XML via JSZip…');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXml = zip.file('word/document.xml');

      if (!docXml) {
        throw new Error('word/document.xml not found in archive');
      }

      const xml = await docXml.async('string');
      const textParts: string[] = [];
      const regex = /<w:t[^>]*>(.*?)<\/w:t>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        textParts.push(match[1]);
      }

      const plainText = textParts.join(' ').trim();

      if (plainText.length > 100) {
        const charCount = plainText.length;
        console.log(`✅ Attempt 3 SUCCESS — Extracted ${charCount.toLocaleString()} characters via XML`);

        const textContent = `WORD DOCUMENT CONTENT FROM: ${file.name}\n\n${plainText}`;
        return {
          content: textContent,
          outputMode: 'text',
          attempt: 3,
          characterCount: charCount,
        };
      }

      console.warn('⚠️ Attempt 3 FAILED — text too short:', plainText.length, 'characters');
    } catch (xmlError) {
      console.warn('⚠️ Attempt 3 FAILED (XML extraction):', xmlError);
    }

    // ── ALL ATTEMPTS FAILED ─────────────────────────────────────
    throw new Error(
      "This Word document couldn't be processed. Please try:\n" +
      '1. Open in Word and Save As PDF, then upload the PDF\n' +
      '2. Open in Google Docs and download as PDF\n' +
      '3. If this is a .doc file, re-save as .docx first'
    );
  }

  /**
   * Legacy text extraction — kept for non-AI features (BP calculator, policy upload, etc.)
   */
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });

      if (result.value && result.value.trim().length > 0) {
        return `WORD DOCUMENT CONTENT FROM: ${file.name}\n\n${result.value.trim()}\n\n[Extracted using Mammoth.js Word processor]`;
      }

      throw new Error('No text content extracted from Word document');
    } catch (error) {
      console.error('Word processing error:', error);
      throw new Error(`Failed to process Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
