import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import dancingScriptUrl from '@/assets/fonts/DancingScript.ttf';
import { format } from 'date-fns';
import QRCode from 'qrcode';

export interface SignatoryInfo {
  id?: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
  signed_ip?: string | null;
  signatory_title?: string | null;
}

export interface SignatoryPosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldPosition {
  page: number;
  x: number;
  y: number;
}

export interface SignaturePlacement {
  method: 'append' | 'stamp' | 'separated';
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Per-signatory positions keyed by signatory ID (block/stamp mode) */
  positions?: Record<string, SignatoryPosition>;
  /** Per-signatory field-level positions keyed by signatory ID (separated mode) */
  fieldPositions?: Record<string, {
    signature?: FieldPosition;
    name?: FieldPosition;
    role?: FieldPosition;
    organisation?: FieldPosition;
    date?: FieldPosition;
  }>;
  /** Font size for separated fields (default 14) */
  separatedFontSize?: number;
}

export interface AuditLogEntry {
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
  ip_address: string | null;
}

interface GenerateSignedPdfOptions {
  originalPdfBytes: ArrayBuffer;
  title: string;
  originalFilename?: string;
  certificateId: string;
  fileHash: string;
  signatories: SignatoryInfo[];
  placement: SignaturePlacement;
  auditLog?: AuditLogEntry[];
  completedAt?: string | null;
}

// ─── Colours ────────────────────────────────────────────────────────────
const NAVY = rgb(0.102, 0.153, 0.267);       // #1a2744
const NAVY_LIGHT = rgb(0.165, 0.239, 0.384); // #2a3d62
const GOLD = rgb(0.788, 0.659, 0.298);       // #c9a84c
const GREEN = rgb(0.086, 0.639, 0.294);      // #16a34a
const GREEN_BG = rgb(0.941, 0.992, 0.957);   // #f0fdf4
const GREEN_BORDER = rgb(0.733, 0.969, 0.816); // #bbf7d0
const GREY_BG = rgb(0.973, 0.976, 0.984);    // #f8f9fb
const GREY_BORDER = rgb(0.886, 0.906, 0.925);// #e2e8f0
const GREY_TEXT = rgb(0.580, 0.639, 0.698);   // #94a3b8
const DARK_TEXT = rgb(0.278, 0.333, 0.388);   // #475569
const BODY_TEXT = rgb(0.102, 0.153, 0.267);   // #1a2744
const WHITE = rgb(1, 1, 1);
const RED = rgb(0.937, 0.267, 0.267);

export async function generateSignedPdf(options: GenerateSignedPdfOptions): Promise<Uint8Array> {
  const { originalPdfBytes, title, certificateId, fileHash, signatories, placement, auditLog } = options;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load Dancing Script custom handwriting font
  let cursiveFont: PDFFont;
  try {
    const fontResponse = await fetch(dancingScriptUrl);
    const fontBytes = await fontResponse.arrayBuffer();
    cursiveFont = await pdfDoc.embedFont(fontBytes, { subset: false });
  } catch (e) {
    console.warn('Failed to load Dancing Script font, falling back to Times Italic', e);
    cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  }

  // For stamp method, draw individual signature blocks at their positions
  if (placement.method === 'stamp') {
    drawStampSignatures(pdfDoc, options, helvetica, helveticaBold, cursiveFont);
  }

  // Always append the full Electronic Signature Certificate
  await drawCertificatePages(pdfDoc, options, helvetica, helveticaBold, cursiveFont);

  return pdfDoc.save();
}

export async function generateCertificatePdf(options: Omit<GenerateSignedPdfOptions, 'originalPdfBytes' | 'placement'>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let cursiveFont: PDFFont;
  try {
    const fontResponse = await fetch(dancingScriptUrl);
    const fontBytes = await fontResponse.arrayBuffer();
    cursiveFont = await pdfDoc.embedFont(fontBytes, { subset: false });
  } catch {
    cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  }

  const fullOptions: GenerateSignedPdfOptions = {
    ...options,
    originalPdfBytes: new ArrayBuffer(0),
    placement: { method: 'append' },
  };

  await drawCertificatePages(pdfDoc, fullOptions, helvetica, helveticaBold, cursiveFont);
  return pdfDoc.save();
}

// ─── Generate QR code as PNG bytes ────────────────────────────────────
async function generateQRCodePng(url: string): Promise<Uint8Array | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#1a2744', light: '#ffffff' },
    });
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// ─── Full Electronic Signature Certificate ─────────────────────────────
async function drawCertificatePages(
  pdfDoc: PDFDocument,
  options: GenerateSignedPdfOptions,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  cursiveFont: PDFFont,
) {
  const { title, originalFilename, certificateId, fileHash, signatories, auditLog, completedAt } = options;
  const W = 595; // A4
  const H = 842;
  const LM = 50; // left margin
  const RM = 50;
  const CW = W - LM - RM; // content width
  const approvedCount = signatories.filter(s => s.signed_at).length;
  const allSigned = approvedCount === signatories.length && signatories.length > 0;
  const verificationUrl = `https://gpnotewell.co.uk/verify/${certificateId}`;

  // Generate QR code
  const qrPngBytes = await generateQRCodePng(verificationUrl);
  let qrImage: any = null;
  if (qrPngBytes) {
    try {
      qrImage = await pdfDoc.embedPng(qrPngBytes);
    } catch { /* fallback: no QR */ }
  }

  // ──────────────────────────────────────────────────────────────────
  // PAGE 1: Certificate
  // ──────────────────────────────────────────────────────────────────
  const page = pdfDoc.addPage([W, H]);
  let y = H - 40;

  // ─── Header Banner ───────────────────────────────────────────────
  const bannerH = 65;
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: bannerH, color: NAVY });
  // Gold accent line
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: 2, color: GOLD });

  // "Notewell" branding
  page.drawText('Notewell', { x: LM, y: y - 8, size: 20, font: helveticaBold, color: WHITE });
  // VERIFIED badge
  const verBadgeX = LM + helveticaBold.widthOfTextAtSize('Notewell', 20) + 12;
  page.drawRectangle({ x: verBadgeX, y: y - 12, width: 58, height: 16, borderColor: GOLD, borderWidth: 1, color: NAVY });
  page.drawText('VERIFIED', { x: verBadgeX + 5, y: y - 8, size: 8, font: helveticaBold, color: GOLD });

  // Subtitle
  page.drawText('ELECTRONIC SIGNATURE CERTIFICATE', {
    x: LM, y: y - 30, size: 13, font: helveticaBold, color: GOLD,
  });

  // COMPLETE badge (right side)
  if (allSigned) {
    const completeText = 'COMPLETE';
    const ctw = helveticaBold.widthOfTextAtSize(completeText, 10);
    page.drawRectangle({ x: W - RM - ctw - 20, y: y - 18, width: ctw + 20, height: 22, color: GREEN_BG, borderColor: GREEN, borderWidth: 1 });
    page.drawText(completeText, { x: W - RM - ctw - 10, y: y - 12, size: 10, font: helveticaBold, color: GREEN });
  }

  y -= bannerH + 10;

  // ─── Document Details Section ────────────────────────────────────
  y -= 8;
  page.drawText('DOCUMENT DETAILS', { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 8;

  // Background box
  const detailBoxH = 120;
  page.drawRectangle({ x: LM, y: y - detailBoxH, width: CW, height: detailBoxH, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });

  let dy = y - 16;
  const col2X = LM + CW / 2 + 10;

  // Document name
  drawLabel(page, 'DOCUMENT', LM + 14, dy, helvetica);
  dy -= 12;
  drawValue(page, originalFilename || title, LM + 14, dy, helveticaBold, CW / 2 - 24);
  
  // Reference
  drawLabel(page, 'REFERENCE', col2X, dy + 12, helvetica);
  drawValueMono(page, certificateId, col2X, dy, helvetica);

  dy -= 18;
  // Status
  drawLabel(page, 'STATUS', LM + 14, dy, helvetica);
  dy -= 12;
  if (allSigned) {
    page.drawCircle({ x: LM + 14 + 4, y: dy + 4, size: 4, color: GREEN });
    page.drawText('All parties signed', { x: LM + 14 + 14, y: dy, size: 10, font: helveticaBold, color: GREEN });
  } else {
    page.drawCircle({ x: LM + 14 + 4, y: dy + 4, size: 4, color: rgb(0.961, 0.620, 0.043) });
    page.drawText(`Awaiting ${signatories.length - approvedCount} signature(s)`, { x: LM + 14 + 14, y: dy, size: 10, font: helveticaBold, color: rgb(0.573, 0.251, 0.055) });
  }

  dy -= 18;
  // SHA-256 hash
  page.drawLine({ start: { x: LM + 14, y: dy }, end: { x: LM + CW - 14, y: dy }, thickness: 0.5, color: GREY_BORDER });
  dy -= 14;
  page.drawText('SHA-256 DOCUMENT HASH', { x: LM + 14, y: dy, size: 8, font: helveticaBold, color: GREY_TEXT });
  dy -= 14;
  // Hash in box
  page.drawRectangle({ x: LM + 14, y: dy - 6, width: CW - 28, height: 18, color: WHITE, borderColor: GREY_BORDER, borderWidth: 0.5 });
  const hashDisplay = fileHash.length > 64 ? fileHash.substring(0, 64) + '...' : fileHash;
  page.drawText(hashDisplay, { x: LM + 20, y: dy, size: 8, font: helvetica, color: DARK_TEXT });

  y -= detailBoxH + 20;

  // ─── Signatories Section ─────────────────────────────────────────
  page.drawText(`SIGNATORIES (${approvedCount} OF ${signatories.length})`, { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 14;

  for (const sig of signatories) {
    const isSigned = !!sig.signed_at;
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || '';
    const org = sig.signed_organisation || sig.organisation || '';
    const sigBoxH = 130;

    // Check if we need a new page
    if (y - sigBoxH < 100) {
      y = startNewPage(pdfDoc, W, H);
    }

    // Signatory card
    const bgColor = isSigned ? GREEN_BG : WHITE;
    const borderColor = isSigned ? GREEN_BORDER : GREY_BORDER;
    page.drawRectangle({ x: LM, y: y - sigBoxH, width: CW, height: sigBoxH, color: bgColor, borderColor, borderWidth: 0.75 });

    // Status badge (top right)
    const badgeText = isSigned ? 'SIGNED' : 'PENDING';
    const badgeColor = isSigned ? GREEN : rgb(0.573, 0.251, 0.055);
    const badgeBg = isSigned ? rgb(0.9, 0.97, 0.93) : rgb(0.99, 0.95, 0.88);
    const btw = helveticaBold.widthOfTextAtSize(badgeText, 8);
    page.drawRectangle({ x: LM + CW - btw - 24, y: y - 18, width: btw + 16, height: 16, color: badgeBg });
    page.drawText(badgeText, { x: LM + CW - btw - 16, y: y - 14, size: 8, font: helveticaBold, color: badgeColor });

    // Handwritten signature
    let sy = y - 22;
    drawHandwrittenSignature(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], name, LM + 16, sy, CW - 100, cursiveFont);
    sy -= 26;

    // Details grid
    const detailCol2 = LM + CW / 2;
    drawLabel(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], 'NAME', LM + 16, sy, helvetica);
    sy -= 12;
    const fullName = (sig.signatory_title ? sig.signatory_title + ' ' : '') + name;
    drawValue(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], fullName, LM + 16, sy, helveticaBold, CW / 2 - 30);

    drawLabel(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], 'ROLE', detailCol2, sy + 12, helvetica);
    drawValue(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], role || '—', detailCol2, sy, helveticaBold, CW / 2 - 30);

    sy -= 16;
    drawLabel(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], 'EMAIL', LM + 16, sy, helvetica);
    sy -= 12;
    pdfDoc.getPages()[pdfDoc.getPageCount() - 1].drawText(sig.email, { x: LM + 16, y: sy, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.55) });

    drawLabel(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], 'ORGANISATION', detailCol2, sy + 12, helvetica);
    drawValue(pdfDoc.getPages()[pdfDoc.getPageCount() - 1], org || '—', detailCol2, sy, helveticaBold, CW / 2 - 30);

    // Signing timestamp
    if (isSigned && sig.signed_at) {
      sy -= 18;
      const pg = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      pg.drawLine({ start: { x: LM + 16, y: sy + 4 }, end: { x: LM + CW - 16, y: sy + 4 }, thickness: 0.5, color: GREY_BORDER, dashArray: [3, 3] });
      const dateStr = format(new Date(sig.signed_at), "dd MMM yyyy 'at' HH:mm:ss 'UTC'");
      pg.drawText(dateStr, { x: LM + 16, y: sy - 8, size: 9, font: helvetica, color: DARK_TEXT });
      if (sig.signed_ip) {
        pg.drawText(`IP: ${sig.signed_ip}`, { x: LM + 240, y: sy - 8, size: 9, font: helvetica, color: GREY_TEXT });
      }
    }

    y -= sigBoxH + 12;
  }

  // ─── Verification Section ────────────────────────────────────────
  if (y < 200) {
    y = startNewPage(pdfDoc, W, H);
  }

  y -= 8;
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText('VERIFICATION', { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 14;

  const verBoxH = 100;
  lastPage.drawRectangle({ x: LM, y: y - verBoxH, width: CW, height: verBoxH, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });

  // QR code
  if (qrImage) {
    lastPage.drawImage(qrImage, { x: LM + 14, y: y - verBoxH + 10, width: 80, height: 80 });
  }

  const qrTextX = LM + 110;
  lastPage.drawText('Scan the QR code or visit the URL below to independently verify', {
    x: qrTextX, y: y - 20, size: 10, font: helvetica, color: DARK_TEXT,
  });
  lastPage.drawText('the authenticity and integrity of this signed document.', {
    x: qrTextX, y: y - 34, size: 10, font: helvetica, color: DARK_TEXT,
  });

  // URL box
  lastPage.drawRectangle({ x: qrTextX, y: y - 64, width: CW - 124, height: 20, color: WHITE, borderColor: GREY_BORDER, borderWidth: 0.5 });
  lastPage.drawText(verificationUrl, { x: qrTextX + 8, y: y - 58, size: 9, font: helvetica, color: BODY_TEXT });

  y -= verBoxH + 16;

  // ─── Legal Footer ────────────────────────────────────────────────
  if (y < 120) {
    y = startNewPage(pdfDoc, W, H);
  }

  const lp = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lp.drawLine({ start: { x: LM, y }, end: { x: W - RM, y }, thickness: 0.5, color: GREY_BORDER });
  y -= 14;

  const legalLines1 = wrapText('Legal Basis: This electronic signature certificate is issued in accordance with the Electronic Communications Act 2000 and UK eIDAS regulations. Electronic signatures applied via this service are legally binding for the purposes of document approval and authorisation.', helvetica, 8, CW);
  for (const line of legalLines1) {
    lp.drawText(line, { x: LM, y, size: 8, font: helvetica, color: GREY_TEXT });
    y -= 11;
  }
  y -= 4;
  const legalLines2 = wrapText('Integrity: The SHA-256 hash above was computed at the time of signing. Any modification to the original document after signing will produce a different hash value, indicating the document has been altered.', helvetica, 8, CW);
  for (const line of legalLines2) {
    lp.drawText(line, { x: LM, y, size: 8, font: helvetica, color: GREY_TEXT });
    y -= 11;
  }
  y -= 8;
  lp.drawLine({ start: { x: LM, y }, end: { x: W - RM, y }, thickness: 0.5, color: GREY_BORDER });
  y -= 12;
  const footerText = 'Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device';
  const ftw = helvetica.widthOfTextAtSize(footerText, 8);
  lp.drawText(footerText, { x: (W - ftw) / 2, y, size: 8, font: helvetica, color: GREY_TEXT });

  // ──────────────────────────────────────────────────────────────────
  // PAGE 2+: Audit Trail (if audit log provided)
  // ──────────────────────────────────────────────────────────────────
  if (auditLog && auditLog.length > 0) {
    await drawAuditTrailPage(pdfDoc, options, helvetica, helveticaBold, auditLog);
  }
}

// ─── Audit Trail Page ─────────────────────────────────────────────────
async function drawAuditTrailPage(
  pdfDoc: PDFDocument,
  options: GenerateSignedPdfOptions,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  auditLog: AuditLogEntry[],
) {
  const W = 595;
  const H = 842;
  const LM = 50;
  const RM = 50;
  const CW = W - LM - RM;

  const page = pdfDoc.addPage([W, H]);
  let y = H - 40;

  // Header
  const bannerH = 45;
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: bannerH, color: NAVY });
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: 2, color: GOLD });
  page.drawText('Notewell', { x: LM, y: y - 5, size: 16, font: helveticaBold, color: WHITE });
  page.drawText('AUDIT TRAIL', { x: LM + 90, y: y - 5, size: 12, font: helveticaBold, color: GOLD });
  page.drawText(options.certificateId, { x: W - RM - helvetica.widthOfTextAtSize(options.certificateId, 9), y: y - 5, size: 9, font: helvetica, color: GREY_TEXT });

  y -= bannerH + 20;

  page.drawText('EVENT TIMELINE', { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 20;

  const eventLabels: Record<string, string> = {
    created: 'Document created',
    sent: 'Sent for signing',
    viewed: 'Document viewed',
    approved: 'Document signed',
    declined: 'Document declined',
    revoked: 'Approval revoked',
    reminder_sent: 'Reminder sent',
    signed_document_generated: 'Certificate of Completion issued',
    email_sent_completed_document: 'Completed document emailed',
  };

  for (const entry of auditLog) {
    if (y < 80) {
      const newPage = pdfDoc.addPage([W, H]);
      y = H - 60;
    }

    const currentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];

    // Timeline dot
    currentPage.drawCircle({ x: LM + 8, y: y + 4, size: 5, color: entry.action === 'signed_document_generated' ? GREEN : GREY_BORDER, borderColor: entry.action === 'signed_document_generated' ? GREEN : GREY_TEXT, borderWidth: 1 });
    
    // Vertical line
    if (auditLog.indexOf(entry) < auditLog.length - 1) {
      currentPage.drawLine({ start: { x: LM + 8, y: y - 2 }, end: { x: LM + 8, y: y - 28 }, thickness: 1, color: GREY_BORDER });
    }

    // Event label
    const label = eventLabels[entry.action] || entry.action.replace(/_/g, ' ');
    const isCompletion = entry.action === 'signed_document_generated';
    currentPage.drawText(label, {
      x: LM + 24, y: y + 2,
      size: 10, font: isCompletion ? helveticaBold : helvetica,
      color: isCompletion ? GREEN : BODY_TEXT,
    });

    // Details line
    const detailParts: string[] = [];
    if (entry.actor_name) detailParts.push(entry.actor_name);
    detailParts.push(format(new Date(entry.created_at), "dd MMM yyyy 'at' HH:mm:ss 'UTC'"));
    if (entry.ip_address) detailParts.push(`IP: ${entry.ip_address}`);

    currentPage.drawText(detailParts.join('  ·  '), {
      x: LM + 24, y: y - 12,
      size: 8, font: helvetica, color: GREY_TEXT,
    });

    y -= 34;
  }

  // Audit summary
  y -= 10;
  const summaryPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  if (y < 100) {
    y = startNewPage(pdfDoc, W, H) - 20;
  }

  summaryPage.drawRectangle({ x: LM, y: y - 50, width: CW, height: 50, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });
  const sp = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  sp.drawText('AUDIT SUMMARY', { x: LM + 14, y: y - 16, size: 9, font: helveticaBold, color: GREY_TEXT });

  const summaryText = `This document was sent to ${options.signatories.length} signator${options.signatories.length !== 1 ? 'ies' : 'y'}. All events were captured with timestamps and IP addresses.`;
  sp.drawText(summaryText, { x: LM + 14, y: y - 32, size: 9, font: helvetica, color: DARK_TEXT });

  // Footer
  y -= 70;
  const footerText = 'Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device';
  const ftw = helvetica.widthOfTextAtSize(footerText, 8);
  sp.drawText(footerText, { x: (W - ftw) / 2, y: y, size: 8, font: helvetica, color: GREY_TEXT });
}

// ─── Helper: start new page, return starting Y ─────────────────────────
function startNewPage(pdfDoc: PDFDocument, w: number, h: number): number {
  pdfDoc.addPage([w, h]);
  return h - 50;
}

// ─── Draw handwritten-style signature ─────────────────────────────────
function drawHandwrittenSignature(
  page: PDFPage,
  name: string,
  x: number,
  y: number,
  maxWidth: number,
  cursiveFont: PDFFont,
) {
  const sigSize = Math.min(16, maxWidth / (name.length * 0.45));
  const actualSize = Math.max(10, sigSize);
  const inkColor = rgb(0.05, 0.1, 0.45);

  page.drawText(name, { x, y, size: actualSize, font: cursiveFont, color: inkColor });

  const textWidth = cursiveFont.widthOfTextAtSize(name, actualSize);
  page.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + Math.min(textWidth, maxWidth), y: y - 2 },
    thickness: 0.5, color: rgb(0.6, 0.6, 0.7),
  });
}

// ─── Stamp Method — per-signatory positioned blocks ──────────────────
function drawStampSignatures(
  pdfDoc: PDFDocument,
  options: GenerateSignedPdfOptions,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  cursiveFont: PDFFont,
) {
  const { signatories, placement } = options;
  const pages = pdfDoc.getPages();
  const positions = placement.positions || {};

  // If we have per-signatory positions, draw each at their own location
  if (Object.keys(positions).length > 0) {
    for (const sig of signatories) {
      const pos = sig.id ? positions[sig.id] : null;
      if (!pos) continue;

      const pageIdx = (pos.page || 1) - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) continue;

      const page = pages[pageIdx];
      const pw = page.getWidth();
      const ph = page.getHeight();

      const pctX = (pos.x || 10) / 100;
      const pctY = (pos.y || 55) / 100;
      const pctW = (pos.width || 14) / 100;
      const pctH = (pos.height || 6) / 100;

      const areaX = pctX * pw;
      const areaW = pctW * pw;
      const areaH = pctH * ph;
      const areaY = ph - (pctY * ph) - areaH;

      // Light background for the signature block
      page.drawRectangle({
        x: areaX, y: areaY, width: areaW, height: areaH,
        color: rgb(0.98, 0.98, 0.98), opacity: 0.9,
        borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
      });

      const name = sig.signed_name || sig.name;
      const date = sig.signed_at ? format(new Date(sig.signed_at), 'dd MMM yyyy') : '';

      // Draw handwritten signature name
      const sigFontSize = Math.min(14, Math.max(9, areaW / (name.length * 0.55)));
      const inkColor = rgb(0.05, 0.1, 0.45);
      const sigY = areaY + areaH - 4 - sigFontSize;
      page.drawText(name, { x: areaX + 4, y: sigY, size: sigFontSize, font: cursiveFont, color: inkColor });

      // Underline
      const textWidth = cursiveFont.widthOfTextAtSize(name, sigFontSize);
      page.drawLine({
        start: { x: areaX + 4, y: sigY - 1.5 },
        end: { x: areaX + 4 + Math.min(textWidth, areaW - 8), y: sigY - 1.5 },
        thickness: 0.5, color: rgb(0.6, 0.6, 0.7),
      });

      // Details below signature
      const detailFontSize = Math.min(6.5, areaH / 6);
      let currentY = sigY - detailFontSize - 3;

      // Role
      const role = sig.signed_role || sig.role;
      if (role && currentY > areaY + 2) {
        page.drawText(role, {
          x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3),
        });
        currentY -= detailFontSize + 1.5;
      }

      // Organisation
      const org = sig.signed_organisation || (sig as any).organisation;
      if (org && currentY > areaY + 2) {
        page.drawText(org, {
          x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3),
        });
        currentY -= detailFontSize + 1.5;
      }

      // Signed date
      if (date && currentY > areaY + 2) {
        page.drawText(`Signed: ${date}`, {
          x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3),
        });
        currentY -= detailFontSize + 1.5;
      }

      // Small "Electronically signed" footer
      const footerY = areaY + 2;
      if (footerY < currentY) {
        page.drawText('Electronically signed via Notewell', {
          x: areaX + 4, y: footerY, size: Math.min(4.5, detailFontSize - 1), font: helvetica, color: rgb(0.7, 0.7, 0.7),
        });
      }
    }
    return;
  }

  // Fallback: legacy single-area stamp for all signatories
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
  const areaY = ph - (pctY * ph) - areaH;

  page.drawRectangle({
    x: areaX, y: areaY, width: areaW, height: areaH,
    color: rgb(0.98, 0.98, 0.98), opacity: 0.9,
    borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
  });

  const useTwoCols = areaW > 300 && signatories.length > 1;
  const cols = useTwoCols ? 2 : 1;
  const colWidth = (areaW - 20) / cols;
  const entryHeight = Math.min(70, (areaH - 30) / Math.ceil(signatories.length / cols));
  const fontSize = Math.min(8.5, Math.max(6.5, entryHeight / 8));

  let curY = areaY + areaH - 14;

  page.drawText('Electronically signed via Notewell', {
    x: areaX + 6, y: curY,
    size: fontSize - 1, font: helveticaBold, color: rgb(0.35, 0.35, 0.35),
  });
  curY -= entryHeight * 0.3 + 6;

  for (let i = 0; i < signatories.length; i++) {
    const col = useTwoCols ? (i % 2) : 0;
    const row = useTwoCols ? Math.floor(i / 2) : i;
    const x = areaX + 8 + col * colWidth;
    const sy = curY - row * entryHeight;

    if (sy < areaY + 10) break;

    const sig = signatories[i];
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || '';
    const org = sig.signed_organisation || sig.organisation || '';
    const date = sig.signed_at ? format(new Date(sig.signed_at), 'dd MMM yyyy') : '';

    drawHandwrittenSignature(page, name, x, sy, colWidth - 16, cursiveFont);

    const detailY = sy - 12 - 6;
    page.drawText(name, { x, y: detailY, size: fontSize, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(sig.email, { x, y: detailY - fontSize - 1, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.6) });
    if (role || org) {
      page.drawText([role, org].filter(Boolean).join(' - '), {
        x, y: detailY - (fontSize * 2) - 2, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.3),
      });
    }
    page.drawText(`${date}  [Approved] Electronically signed`, {
      x, y: detailY - (fontSize * 3) - 4, size: fontSize - 1.5, font: helvetica, color: rgb(0.4, 0.4, 0.4),
    });
  }

  page.drawText('Electronically signed via Notewell', {
    x: areaX + areaW / 2 - helvetica.widthOfTextAtSize('Electronically signed via Notewell', 6) / 2,
    y: areaY + 4,
    size: 6, font: helvetica, color: rgb(0.78, 0.78, 0.78),
  });
}

// ─── Text helpers ─────────────────────────────────────────────────────
function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text, { x, y, size: 8, font, color: GREY_TEXT });
}

function drawValue(page: PDFPage, text: string, x: number, y: number, font: PDFFont, maxWidth: number) {
  const truncated = text.length > 40 ? text.substring(0, 37) + '...' : text;
  page.drawText(truncated, { x, y, size: 10, font, color: BODY_TEXT });
}

function drawValueMono(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text, { x, y, size: 10, font, color: BODY_TEXT });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
