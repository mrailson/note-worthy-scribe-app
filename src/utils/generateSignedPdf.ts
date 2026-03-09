import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import dancingScriptUrl from '@/assets/fonts/DancingScript.ttf';
import { format } from 'date-fns';

export interface SignatoryInfo {
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
}

export interface SignaturePlacement {
  method: 'append' | 'stamp';
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface GenerateSignedPdfOptions {
  originalPdfBytes: ArrayBuffer;
  title: string;
  certificateId: string;
  fileHash: string;
  signatories: SignatoryInfo[];
  placement: SignaturePlacement;
}

export async function generateSignedPdf(options: GenerateSignedPdfOptions): Promise<Uint8Array> {
  const { originalPdfBytes, title, certificateId, fileHash, signatories, placement } = options;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load Dancing Script custom handwriting font
  let cursiveFont;
  try {
    const fontResponse = await fetch(dancingScriptUrl);
    const fontBytes = await fontResponse.arrayBuffer();
    cursiveFont = await pdfDoc.embedFont(fontBytes);
  } catch (e) {
    console.warn('Failed to load Dancing Script font, falling back to Times Italic', e);
    cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  }

  if (placement.method === 'stamp' && placement.page != null) {
    drawStampSignatures(pdfDoc, options, helvetica, helveticaBold, cursiveFont);
  } else {
    drawAppendSignatures(pdfDoc, options, helvetica, helveticaBold, cursiveFont);
  }

  return pdfDoc.save();
}

// ─── Draw handwritten-style signature ─────────────────────────────────────

function drawHandwrittenSignature(
  page: PDFPage,
  name: string,
  x: number,
  y: number,
  maxWidth: number,
  cursiveFont: any,
) {
  // Draw the name in a large italic serif font to simulate handwriting
  const sigSize = Math.min(16, maxWidth / (name.length * 0.45));
  const actualSize = Math.max(10, sigSize);
  
  // Signature colour — dark blue ink
  const inkColor = rgb(0.05, 0.1, 0.45);
  
  page.drawText(name, {
    x,
    y,
    size: actualSize,
    font: cursiveFont,
    color: inkColor,
  });

  // Draw a subtle underline
  const textWidth = cursiveFont.widthOfTextAtSize(name, actualSize);
  page.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + Math.min(textWidth, maxWidth), y: y - 2 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.7),
  });
}

// ─── Append Method ──────────────────────────────────────────────────────

function drawAppendSignatures(
  pdfDoc: PDFDocument,
  options: GenerateSignedPdfOptions,
  helvetica: any,
  helveticaBold: any,
  cursiveFont: any,
) {
  const { title, certificateId, fileHash, signatories } = options;
  const SIGS_PER_PAGE = 6; // Reduced to accommodate larger signature boxes
  const chunks = chunkArray(signatories, SIGS_PER_PAGE);

  for (let ci = 0; ci < chunks.length; ci++) {
    const page = pdfDoc.addPage([595, 842]); // A4
    const w = page.getWidth();
    const h = page.getHeight();

    let y = h - 50;

    // Header (only first page)
    if (ci === 0) {
      // Title bar
      page.drawRectangle({ x: 40, y: y - 5, width: w - 80, height: 30, color: rgb(0.13, 0.13, 0.40) });
      page.drawText('ELECTRONIC SIGNATURE PAGE', {
        x: w / 2 - helveticaBold.widthOfTextAtSize('ELECTRONIC SIGNATURE PAGE', 14) / 2,
        y: y + 2,
        size: 14,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      y -= 45;

      // Meta info
      const meta = [
        `Document: ${title}`,
        `Reference: ${certificateId}`,
        `Original file hash (SHA-256): ${fileHash.substring(0, 32)}...`,
      ];
      for (const line of meta) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
        y -= 14;
      }
      y -= 8;

      // Legal note
      const legalLines = [
        'The following individuals have electronically approved this document',
        'in accordance with the Electronic Communications Act 2000.',
      ];
      for (const line of legalLines) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: rgb(0.35, 0.35, 0.35) });
        y -= 13;
      }
      y -= 20;
    } else {
      page.drawText('ELECTRONIC SIGNATURE PAGE (continued)', {
        x: 50, y, size: 11, font: helveticaBold, color: rgb(0.13, 0.13, 0.40),
      });
      y -= 30;
    }

    // Draw 2-column grid of signature boxes
    const chunk = chunks[ci];
    const colWidth = (w - 100) / 2;
    const boxHeight = 110; // Taller to fit signature + email
    const gap = 12;

    for (let i = 0; i < chunk.length; i += 2) {
      const row = Math.floor(i / 2);
      const boxY = y - (row * (boxHeight + gap));

      for (let col = 0; col < 2 && (i + col) < chunk.length; col++) {
        const sig = chunk[i + col];
        const boxX = 50 + col * (colWidth + 10);
        drawSignatureBox(page, sig, boxX, boxY, colWidth, boxHeight, helvetica, helveticaBold, cursiveFont);
      }
    }

    // Footer
    const footerY = 40;
    page.drawText(`Generated by Notewell AI`, {
      x: 50, y: footerY + 14, size: 8, font: helvetica, color: rgb(0.55, 0.55, 0.55),
    });
    page.drawText(`Certificate: ${certificateId}`, {
      x: 50, y: footerY, size: 8, font: helvetica, color: rgb(0.55, 0.55, 0.55),
    });
    const now = format(new Date(), "dd MMMM yyyy 'at' HH:mm 'UTC'");
    page.drawText(`Generated: ${now}`, {
      x: w - 50 - helvetica.widthOfTextAtSize(`Generated: ${now}`, 8),
      y: footerY, size: 8, font: helvetica, color: rgb(0.55, 0.55, 0.55),
    });
  }
}

// ─── Stamp Method ────────────────────────────────────────────────────────

function drawStampSignatures(
  pdfDoc: PDFDocument,
  options: GenerateSignedPdfOptions,
  helvetica: any,
  helveticaBold: any,
  cursiveFont: any,
) {
  const { signatories, placement } = options;
  const pages = pdfDoc.getPages();
  const pageIdx = (placement.page || 1) - 1;
  if (pageIdx < 0 || pageIdx >= pages.length) return;

  const page = pages[pageIdx];
  const pw = page.getWidth();
  const ph = page.getHeight();

  const pctX = (placement.x || 10) / 100;
  const pctY = (placement.y || 55) / 100;
  const pctW = (placement.width || 80) / 100;
  const pctH = (placement.height || 40) / 100;

  const areaX = pctX * pw;
  const areaW = pctW * pw;
  const areaH = pctH * ph;
  // PDF coords: bottom-left origin. placement.y is from top.
  const areaY = ph - (pctY * ph) - areaH;

  // Semi-transparent background
  page.drawRectangle({
    x: areaX, y: areaY, width: areaW, height: areaH,
    color: rgb(0.98, 0.98, 0.98), opacity: 0.9,
    borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
  });

  // Determine layout: stack vertically or use 2 columns
  const useTwoCols = areaW > 300 && signatories.length > 1;
  const cols = useTwoCols ? 2 : 1;
  const colWidth = (areaW - 20) / cols;
  const entryHeight = Math.min(70, (areaH - 30) / Math.ceil(signatories.length / cols));
  const fontSize = Math.min(8.5, Math.max(6.5, entryHeight / 8));

  let curY = areaY + areaH - 14;

  // Small header
  page.drawText('Electronically signed via Notewell', {
    x: areaX + 6, y: curY,
    size: fontSize - 1, font: helveticaBold, color: rgb(0.35, 0.35, 0.35),
  });
  curY -= entryHeight * 0.3 + 6;

  for (let i = 0; i < signatories.length; i++) {
    const col = useTwoCols ? (i % 2) : 0;
    const row = useTwoCols ? Math.floor(i / 2) : i;
    const x = areaX + 8 + col * colWidth;
    const y = curY - row * entryHeight;

    if (y < areaY + 10) break; // out of area

    const sig = signatories[i];
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || '';
    const org = sig.signed_organisation || sig.organisation || '';
    const date = sig.signed_at ? format(new Date(sig.signed_at), 'dd MMM yyyy') : '';

    // Handwritten signature
    const sigFontSize = Math.min(12, Math.max(8, fontSize + 3));
    drawHandwrittenSignature(page, name, x, y, colWidth - 16, cursiveFont);

    // Name and email below signature
    const detailY = y - sigFontSize - 6;
    page.drawText(name, { x, y: detailY, size: fontSize, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    
    page.drawText(sig.email, { 
      x, y: detailY - fontSize - 1, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.6) 
    });

    if (role || org) {
      page.drawText([role, org].filter(Boolean).join(' · '), {
        x, y: detailY - (fontSize * 2) - 2, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.3),
      });
    }
    page.drawText(`${date}  [Approved] Electronically signed`, {
      x, y: detailY - (fontSize * 3) - 4, size: fontSize - 1.5, font: helvetica, color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Watermark at bottom of area
  page.drawText('Electronically signed via Notewell', {
    x: areaX + areaW / 2 - helvetica.widthOfTextAtSize('Electronically signed via Notewell', 6) / 2,
    y: areaY + 4,
    size: 6, font: helvetica, color: rgb(0.78, 0.78, 0.78),
  });
}

// ─── Shared helpers ──────────────────────────────────────────────────────

function drawSignatureBox(
  page: PDFPage,
  sig: SignatoryInfo,
  x: number,
  y: number,
  width: number,
  height: number,
  helvetica: any,
  helveticaBold: any,
  cursiveFont: any,
) {
  // Box with light grey border
  page.drawRectangle({
    x, y: y - height, width, height,
    borderColor: rgb(0.82, 0.82, 0.82),
    borderWidth: 0.75,
    color: rgb(0.98, 0.98, 0.98),
  });

  const px = x + 10;
  let py = y - 14;

  // Handwritten signature at top of box
  const name = sig.signed_name || sig.name;
  drawHandwrittenSignature(page, name, px, py, width - 20, cursiveFont);
  py -= 22;

  // Signed by label + name
  page.drawText('Signed by:', { x: px, y: py, size: 7.5, font: helvetica, color: rgb(0.45, 0.45, 0.45) });
  py -= 12;

  page.drawText(name, { x: px, y: py, size: 10, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  py -= 12;

  // Email
  page.drawText(sig.email, { x: px, y: py, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.55) });
  py -= 11;

  const role = sig.signed_role || sig.role || '';
  if (role) {
    page.drawText(role, { x: px, y: py, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    py -= 11;
  }

  const org = sig.signed_organisation || sig.organisation || '';
  if (org) {
    page.drawText(org, { x: px, y: py, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    py -= 11;
  }

  if (sig.signed_at) {
    const dateStr = format(new Date(sig.signed_at), 'dd MMM yyyy');
    page.drawText(dateStr, { x: px, y: py, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    py -= 11;
  }

  page.drawText('[Approved] Electronically signed', { x: px, y: py, size: 7.5, font: helveticaBold, color: rgb(0.13, 0.55, 0.27) });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
