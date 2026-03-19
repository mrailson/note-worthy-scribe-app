import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Colours ────────────────────────────────────────────────────────────
const NAVY = rgb(0.102, 0.153, 0.267);
const GOLD = rgb(0.788, 0.659, 0.298);
const GREEN = rgb(0.086, 0.639, 0.294);
const GREEN_BG = rgb(0.941, 0.992, 0.957);
const GREEN_BORDER = rgb(0.733, 0.969, 0.816);
const GREY_BG = rgb(0.973, 0.976, 0.984);
const GREY_BORDER = rgb(0.886, 0.906, 0.925);
const GREY_TEXT = rgb(0.580, 0.639, 0.698);
const DARK_TEXT = rgb(0.278, 0.333, 0.388);
const BODY_TEXT = rgb(0.102, 0.153, 0.267);
const WHITE = rgb(1, 1, 1);

interface SignatoryInfo {
  id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
  signed_ip: string | null;
  signatory_title: string | null;
  signature_font: string | null;
}

interface AuditLogEntry {
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
  ip_address: string | null;
}

// ─── Date formatting ────────────────────────────────────────────────────
function formatDateStr(dateStr: string, withTime = false): string {
  const d = new Date(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = d.getUTCDate().toString().padStart(2, "0");
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  if (!withTime) return `${day} ${mon} ${year}`;
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${day} ${mon} ${year} at ${hh}:${mm}:${ss} UTC`;
}

// ─── QR Code ────────────────────────────────────────────────────────────
async function generateQRCodePng(url: string): Promise<Uint8Array | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: "#1a2744", light: "#ffffff" },
    });
    const base64 = dataUrl.split(",")[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

// ─── SHA-256 hash ───────────────────────────────────────────────────────
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Text helpers ───────────────────────────────────────────────────────
function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text, { x, y, size: 8, font, color: GREY_TEXT });
}
function drawValue(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  const truncated = text.length > 40 ? text.substring(0, 37) + "..." : text;
  page.drawText(truncated, { x, y, size: 10, font, color: BODY_TEXT });
}
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
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
function startNewPage(pdfDoc: PDFDocument, w: number, h: number): number {
  pdfDoc.addPage([w, h]);
  return h - 50;
}

// ─── Handwritten signature ──────────────────────────────────────────────
function drawHandwrittenSignature(page: PDFPage, name: string, x: number, y: number, maxWidth: number, cursiveFont: PDFFont) {
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

// ─── Stamp signatures ───────────────────────────────────────────────────
function drawStampSignatures(
  pdfDoc: PDFDocument, signatories: SignatoryInfo[],
  placement: any, helvetica: PDFFont, helveticaBold: PDFFont, cursiveFont: PDFFont,
) {
  const pages = pdfDoc.getPages();
  const positions = placement.positions || {};

  if (Object.keys(positions).length > 0) {
    for (const sig of signatories) {
      const pos = sig.id ? positions[sig.id] : null;
      if (!pos) continue;
      const pageIdx = (pos.page || 1) - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) continue;
      const page = pages[pageIdx];
      const pw = page.getWidth(), ph = page.getHeight();
      const areaX = (pos.x / 100) * pw;
      const areaW = ((pos.width || 14) / 100) * pw;
      const areaH = ((pos.height || 6) / 100) * ph;
      const areaY = ph - ((pos.y / 100) * ph) - areaH;

      page.drawRectangle({ x: areaX, y: areaY, width: areaW, height: areaH, color: rgb(0.98, 0.98, 0.98), opacity: 0.9, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });

      const name = sig.signed_name || sig.name;
      const date = sig.signed_at ? formatDateStr(sig.signed_at) : "";
      const sigFontSize = Math.min(14, Math.max(9, areaW / (name.length * 0.55)));
      const inkColor = rgb(0.05, 0.1, 0.45);
      const sigY = areaY + areaH - 4 - sigFontSize;
      page.drawText(name, { x: areaX + 4, y: sigY, size: sigFontSize, font: cursiveFont, color: inkColor });
      const textWidth = cursiveFont.widthOfTextAtSize(name, sigFontSize);
      page.drawLine({ start: { x: areaX + 4, y: sigY - 1.5 }, end: { x: areaX + 4 + Math.min(textWidth, areaW - 8), y: sigY - 1.5 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.7) });

      const detailFontSize = Math.min(6.5, areaH / 6);
      let currentY = sigY - detailFontSize - 3;
      const role = sig.signed_role || sig.role;
      if (role && currentY > areaY + 2) { page.drawText(role, { x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3) }); currentY -= detailFontSize + 1.5; }
      const org = sig.signed_organisation || sig.organisation;
      if (org && currentY > areaY + 2) { page.drawText(org, { x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3) }); currentY -= detailFontSize + 1.5; }
      if (date && currentY > areaY + 2) { page.drawText(`Signed: ${date}`, { x: areaX + 4, y: currentY, size: detailFontSize, font: helvetica, color: rgb(0.3, 0.3, 0.3) }); currentY -= detailFontSize + 1.5; }
      const footerY = areaY + 2;
      if (footerY < currentY) page.drawText("Electronically signed via Notewell", { x: areaX + 4, y: footerY, size: Math.min(4.5, detailFontSize - 1), font: helvetica, color: rgb(0.7, 0.7, 0.7) });
    }
    return;
  }

  // Fallback legacy single-area
  const pageIdx = (placement.page || 1) - 1;
  if (pageIdx < 0 || pageIdx >= pages.length) return;
  const page = pages[pageIdx];
  const pw = page.getWidth(), ph = page.getHeight();
  const areaX = ((placement.x || 10) / 100) * pw;
  const areaW = ((placement.width || 80) / 100) * pw;
  const areaH = ((placement.height || 40) / 100) * ph;
  const areaY = ph - (((placement.y || 55) / 100) * ph) - areaH;

  page.drawRectangle({ x: areaX, y: areaY, width: areaW, height: areaH, color: rgb(0.98, 0.98, 0.98), opacity: 0.9, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });

  const useTwoCols = areaW > 300 && signatories.length > 1;
  const cols = useTwoCols ? 2 : 1;
  const colWidth = (areaW - 20) / cols;
  const entryHeight = Math.min(70, (areaH - 30) / Math.ceil(signatories.length / cols));
  const fontSize = Math.min(8.5, Math.max(6.5, entryHeight / 8));

  let curY = areaY + areaH - 14;
  page.drawText("Electronically signed via Notewell", { x: areaX + 6, y: curY, size: fontSize - 1, font: helveticaBold, color: rgb(0.35, 0.35, 0.35) });
  curY -= entryHeight * 0.3 + 6;

  for (let i = 0; i < signatories.length; i++) {
    const col = useTwoCols ? (i % 2) : 0;
    const row = useTwoCols ? Math.floor(i / 2) : i;
    const x = areaX + 8 + col * colWidth;
    const sy = curY - row * entryHeight;
    if (sy < areaY + 10) break;

    const sig = signatories[i];
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || "";
    const org = sig.signed_organisation || sig.organisation || "";
    const date = sig.signed_at ? formatDateStr(sig.signed_at) : "";

    drawHandwrittenSignature(page, name, x, sy, colWidth - 16, cursiveFont);
    const detailY = sy - 18;
    page.drawText(name, { x, y: detailY, size: fontSize, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(sig.email, { x, y: detailY - fontSize - 1, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.6) });
    if (role || org) page.drawText([role, org].filter(Boolean).join(" - "), { x, y: detailY - (fontSize * 2) - 2, size: fontSize - 1, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(`${date}  [Approved] Electronically signed`, { x, y: detailY - (fontSize * 3) - 4, size: fontSize - 1.5, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  }
}

// ─── Separated signatures ───────────────────────────────────────────────
function drawSeparatedSignatures(
  pdfDoc: PDFDocument, signatories: SignatoryInfo[],
  placement: any, helvetica: PDFFont, cursiveFont: PDFFont,
) {
  const pages = pdfDoc.getPages();
  const fieldPositions = placement.fieldPositions || {};
  const fontSize = placement.separatedFontSize || 14;
  const inkColor = rgb(0.05, 0.1, 0.45);
  const textColor = rgb(0.1, 0.1, 0.1);

  for (const sig of signatories) {
    const sigFields = sig.id ? fieldPositions[sig.id] : null;
    if (!sigFields) continue;
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || "";
    const org = sig.signed_organisation || sig.organisation || "";
    const date = sig.signed_at ? formatDateStr(sig.signed_at) : "";

    const fields: { key: string; text: string; useCursive?: boolean }[] = [
      { key: "signature", text: name, useCursive: true },
      { key: "name", text: (sig.signatory_title ? sig.signatory_title + " " : "") + name },
      { key: "role", text: role },
      { key: "organisation", text: org },
      { key: "date", text: date },
    ];

    for (const field of fields) {
      const pos = sigFields[field.key];
      if (!pos || !field.text) continue;
      const pageIdx = (pos.page || 1) - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) continue;
      const page = pages[pageIdx];
      const pw = page.getWidth(), ph = page.getHeight();
      const drawX = (pos.x / 100) * pw;
      const drawY = ph - ((pos.y / 100) * ph) - fontSize;

      if (field.useCursive) {
        page.drawText(field.text, { x: drawX, y: drawY, size: fontSize, font: cursiveFont, color: inkColor });
        const tw = cursiveFont.widthOfTextAtSize(field.text, fontSize);
        page.drawLine({ start: { x: drawX, y: drawY - 2 }, end: { x: drawX + tw, y: drawY - 2 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.7) });
      } else {
        page.drawText(field.text, { x: drawX, y: drawY, size: fontSize, font: helvetica, color: textColor });
      }
    }
  }
}

// ─── Text annotations ───────────────────────────────────────────────────
function drawTextAnnotations(pdfDoc: PDFDocument, annotations: any[], helvetica: PDFFont, defaultFontSize: number) {
  const pages = pdfDoc.getPages();
  const textColor = rgb(0.1, 0.1, 0.1);
  for (const ann of annotations) {
    const pageIdx = (ann.page || 1) - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;
    const page = pages[pageIdx];
    const pw = page.getWidth(), ph = page.getHeight();
    const fontSize = ann.fontSize || defaultFontSize;
    const drawX = (ann.x / 100) * pw;
    const drawY = ph - ((ann.y / 100) * ph) - fontSize;
    page.drawText(ann.text, { x: drawX, y: drawY, size: fontSize, font: helvetica, color: textColor });
  }
}

// ─── Certificate pages ──────────────────────────────────────────────────
async function drawCertificatePages(
  pdfDoc: PDFDocument, title: string, originalFilename: string,
  certificateId: string, fileHash: string, signatories: SignatoryInfo[],
  auditLog: AuditLogEntry[], completedAt: string | null,
  helvetica: PDFFont, helveticaBold: PDFFont, cursiveFont: PDFFont,
) {
  const W = 595, H = 842, LM = 50, RM = 50, CW = W - LM - RM;
  const approvedCount = signatories.filter(s => s.signed_at).length;
  const allSigned = approvedCount === signatories.length && signatories.length > 0;
  const verificationUrl = `https://gpnotewell.co.uk/verify/${certificateId}`;
  const qrPngBytes = await generateQRCodePng(verificationUrl);
  let qrImage: any = null;
  if (qrPngBytes) { try { qrImage = await pdfDoc.embedPng(qrPngBytes); } catch {} }

  // PAGE 1: Certificate
  const page = pdfDoc.addPage([W, H]);
  let y = H - 40;

  // Header Banner
  const bannerH = 65;
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: bannerH, color: NAVY });
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: 2, color: GOLD });
  page.drawText("Notewell", { x: LM, y: y - 8, size: 20, font: helveticaBold, color: WHITE });
  const verBadgeX = LM + helveticaBold.widthOfTextAtSize("Notewell", 20) + 12;
  page.drawRectangle({ x: verBadgeX, y: y - 12, width: 58, height: 16, borderColor: GOLD, borderWidth: 1, color: NAVY });
  page.drawText("VERIFIED", { x: verBadgeX + 5, y: y - 8, size: 8, font: helveticaBold, color: GOLD });
  page.drawText("ELECTRONIC SIGNATURE CERTIFICATE", { x: LM, y: y - 30, size: 13, font: helveticaBold, color: GOLD });

  if (allSigned) {
    const completeText = "COMPLETE";
    const ctw = helveticaBold.widthOfTextAtSize(completeText, 10);
    page.drawRectangle({ x: W - RM - ctw - 20, y: y - 18, width: ctw + 20, height: 22, color: GREEN_BG, borderColor: GREEN, borderWidth: 1 });
    page.drawText(completeText, { x: W - RM - ctw - 10, y: y - 12, size: 10, font: helveticaBold, color: GREEN });
  }
  y -= bannerH + 10;

  // Document Details
  y -= 8;
  page.drawText("DOCUMENT DETAILS", { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 8;
  const detailBoxH = 120;
  page.drawRectangle({ x: LM, y: y - detailBoxH, width: CW, height: detailBoxH, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });

  let dy = y - 16;
  const col2X = LM + CW / 2 + 10;
  drawLabel(page, "DOCUMENT", LM + 14, dy, helvetica);
  dy -= 12;
  drawValue(page, originalFilename || title, LM + 14, dy, helveticaBold);
  drawLabel(page, "REFERENCE", col2X, dy + 12, helvetica);
  page.drawText(certificateId, { x: col2X, y: dy, size: 10, font: helvetica, color: BODY_TEXT });

  dy -= 18;
  drawLabel(page, "STATUS", LM + 14, dy, helvetica);
  dy -= 12;
  if (allSigned) {
    page.drawCircle({ x: LM + 14 + 4, y: dy + 4, size: 4, color: GREEN });
    page.drawText("All parties signed", { x: LM + 14 + 14, y: dy, size: 10, font: helveticaBold, color: GREEN });
  }

  dy -= 18;
  page.drawLine({ start: { x: LM + 14, y: dy }, end: { x: LM + CW - 14, y: dy }, thickness: 0.5, color: GREY_BORDER });
  dy -= 14;
  page.drawText("SHA-256 DOCUMENT HASH", { x: LM + 14, y: dy, size: 8, font: helveticaBold, color: GREY_TEXT });
  dy -= 14;
  page.drawRectangle({ x: LM + 14, y: dy - 6, width: CW - 28, height: 18, color: WHITE, borderColor: GREY_BORDER, borderWidth: 0.5 });
  const hashDisplay = fileHash.length > 64 ? fileHash.substring(0, 64) + "..." : fileHash;
  page.drawText(hashDisplay, { x: LM + 20, y: dy, size: 8, font: helvetica, color: DARK_TEXT });
  y -= detailBoxH + 20;

  // Signatories
  page.drawText(`SIGNATORIES (${approvedCount} OF ${signatories.length})`, { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 14;

  for (const sig of signatories) {
    const isSigned = !!sig.signed_at;
    const name = sig.signed_name || sig.name;
    const role = sig.signed_role || sig.role || "";
    const org = sig.signed_organisation || sig.organisation || "";
    const sigBoxH = 130;
    if (y - sigBoxH < 100) y = startNewPage(pdfDoc, W, H);

    const currentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const bgColor = isSigned ? GREEN_BG : WHITE;
    const borderColor = isSigned ? GREEN_BORDER : GREY_BORDER;
    currentPage.drawRectangle({ x: LM, y: y - sigBoxH, width: CW, height: sigBoxH, color: bgColor, borderColor, borderWidth: 0.75 });

    const badgeText = isSigned ? "SIGNED" : "PENDING";
    const badgeColor = isSigned ? GREEN : rgb(0.573, 0.251, 0.055);
    const badgeBg = isSigned ? rgb(0.9, 0.97, 0.93) : rgb(0.99, 0.95, 0.88);
    const btw = helveticaBold.widthOfTextAtSize(badgeText, 8);
    currentPage.drawRectangle({ x: LM + CW - btw - 24, y: y - 18, width: btw + 16, height: 16, color: badgeBg });
    currentPage.drawText(badgeText, { x: LM + CW - btw - 16, y: y - 14, size: 8, font: helveticaBold, color: badgeColor });

    let sy = y - 22;
    drawHandwrittenSignature(currentPage, name, LM + 16, sy, CW - 100, cursiveFont);
    sy -= 26;

    const detailCol2 = LM + CW / 2;
    drawLabel(currentPage, "NAME", LM + 16, sy, helvetica);
    sy -= 12;
    const fullName = (sig.signatory_title ? sig.signatory_title + " " : "") + name;
    drawValue(currentPage, fullName, LM + 16, sy, helveticaBold);
    drawLabel(currentPage, "ROLE", detailCol2, sy + 12, helvetica);
    drawValue(currentPage, role || "—", detailCol2, sy, helveticaBold);

    sy -= 16;
    drawLabel(currentPage, "EMAIL", LM + 16, sy, helvetica);
    sy -= 12;
    currentPage.drawText(sig.email, { x: LM + 16, y: sy, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.55) });
    drawLabel(currentPage, "ORGANISATION", detailCol2, sy + 12, helvetica);
    drawValue(currentPage, org || "—", detailCol2, sy, helveticaBold);

    if (isSigned && sig.signed_at) {
      sy -= 18;
      currentPage.drawLine({ start: { x: LM + 16, y: sy + 4 }, end: { x: LM + CW - 16, y: sy + 4 }, thickness: 0.5, color: GREY_BORDER, dashArray: [3, 3] });
      const dateStr = formatDateStr(sig.signed_at, true);
      currentPage.drawText(dateStr, { x: LM + 16, y: sy - 8, size: 9, font: helvetica, color: DARK_TEXT });
      if (sig.signed_ip) currentPage.drawText(`IP: ${sig.signed_ip}`, { x: LM + 240, y: sy - 8, size: 9, font: helvetica, color: GREY_TEXT });
    }
    y -= sigBoxH + 12;
  }

  // Verification
  if (y < 200) y = startNewPage(pdfDoc, W, H);
  y -= 8;
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText("VERIFICATION", { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 14;
  const verBoxH = 100;
  lastPage.drawRectangle({ x: LM, y: y - verBoxH, width: CW, height: verBoxH, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });
  if (qrImage) lastPage.drawImage(qrImage, { x: LM + 14, y: y - verBoxH + 10, width: 80, height: 80 });
  const qrTextX = LM + 110;
  lastPage.drawText("Scan the QR code or visit the URL below to independently verify", { x: qrTextX, y: y - 20, size: 10, font: helvetica, color: DARK_TEXT });
  lastPage.drawText("the authenticity and integrity of this signed document.", { x: qrTextX, y: y - 34, size: 10, font: helvetica, color: DARK_TEXT });
  lastPage.drawRectangle({ x: qrTextX, y: y - 64, width: CW - 124, height: 20, color: WHITE, borderColor: GREY_BORDER, borderWidth: 0.5 });
  lastPage.drawText(verificationUrl, { x: qrTextX + 8, y: y - 58, size: 9, font: helvetica, color: BODY_TEXT });
  y -= verBoxH + 16;

  // Legal Footer
  if (y < 120) y = startNewPage(pdfDoc, W, H);
  const lp = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lp.drawLine({ start: { x: LM, y }, end: { x: W - RM, y }, thickness: 0.5, color: GREY_BORDER });
  y -= 14;
  for (const line of wrapText("Legal Basis: This electronic signature certificate is issued in accordance with the Electronic Communications Act 2000 and UK eIDAS regulations. Electronic signatures applied via this service are legally binding for the purposes of document approval and authorisation.", helvetica, 8, CW)) {
    lp.drawText(line, { x: LM, y, size: 8, font: helvetica, color: GREY_TEXT }); y -= 11;
  }
  y -= 4;
  for (const line of wrapText("Integrity: The SHA-256 hash above was computed at the time of signing. Any modification to the original document after signing will produce a different hash value, indicating the document has been altered.", helvetica, 8, CW)) {
    lp.drawText(line, { x: LM, y, size: 8, font: helvetica, color: GREY_TEXT }); y -= 11;
  }
  y -= 8;
  lp.drawLine({ start: { x: LM, y }, end: { x: W - RM, y }, thickness: 0.5, color: GREY_BORDER });
  y -= 12;
  const footerText = "Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device";
  const ftw = helvetica.widthOfTextAtSize(footerText, 8);
  lp.drawText(footerText, { x: (W - ftw) / 2, y, size: 8, font: helvetica, color: GREY_TEXT });

  // Audit Trail page
  if (auditLog && auditLog.length > 0) {
    await drawAuditTrailPage(pdfDoc, certificateId, signatories, auditLog, helvetica, helveticaBold);
  }
}

// ─── Audit Trail Page ───────────────────────────────────────────────────
async function drawAuditTrailPage(
  pdfDoc: PDFDocument, certificateId: string, signatories: SignatoryInfo[],
  auditLog: AuditLogEntry[], helvetica: PDFFont, helveticaBold: PDFFont,
) {
  const W = 595, H = 842, LM = 50, RM = 50, CW = W - LM - RM;
  const page = pdfDoc.addPage([W, H]);
  let y = H - 40;

  const bannerH = 45;
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: bannerH, color: NAVY });
  page.drawRectangle({ x: 0, y: y - bannerH + 20, width: W, height: 2, color: GOLD });
  page.drawText("Notewell", { x: LM, y: y - 5, size: 16, font: helveticaBold, color: WHITE });
  page.drawText("AUDIT TRAIL", { x: LM + 90, y: y - 5, size: 12, font: helveticaBold, color: GOLD });
  page.drawText(certificateId, { x: W - RM - helvetica.widthOfTextAtSize(certificateId, 9), y: y - 5, size: 9, font: helvetica, color: GREY_TEXT });
  y -= bannerH + 20;

  page.drawText("EVENT TIMELINE", { x: LM, y, size: 9, font: helveticaBold, color: GREY_TEXT });
  y -= 20;

  const eventLabels: Record<string, string> = {
    created: "Document created", sent: "Sent for signing", viewed: "Document viewed",
    approved: "Document signed", declined: "Document declined", revoked: "Approval revoked",
    reminder_sent: "Reminder sent", signed_document_generated: "Certificate of Completion issued",
    email_sent_completed_document: "Completed document emailed",
  };

  for (let idx = 0; idx < auditLog.length; idx++) {
    const entry = auditLog[idx];
    if (y < 80) {
      pdfDoc.addPage([W, H]);
      y = H - 60;
    }
    const currentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const isCompletion = entry.action === "signed_document_generated";
    currentPage.drawCircle({ x: LM + 8, y: y + 4, size: 5, color: isCompletion ? GREEN : GREY_BORDER, borderColor: isCompletion ? GREEN : GREY_TEXT, borderWidth: 1 });
    if (idx < auditLog.length - 1) currentPage.drawLine({ start: { x: LM + 8, y: y - 2 }, end: { x: LM + 8, y: y - 28 }, thickness: 1, color: GREY_BORDER });

    const label = eventLabels[entry.action] || entry.action.replace(/_/g, " ");
    currentPage.drawText(label, { x: LM + 24, y: y + 2, size: 10, font: isCompletion ? helveticaBold : helvetica, color: isCompletion ? GREEN : BODY_TEXT });

    const detailParts: string[] = [];
    if (entry.actor_name) detailParts.push(entry.actor_name);
    detailParts.push(formatDateStr(entry.created_at, true));
    if (entry.ip_address) detailParts.push(`IP: ${entry.ip_address}`);
    currentPage.drawText(detailParts.join("  ·  "), { x: LM + 24, y: y - 12, size: 8, font: helvetica, color: GREY_TEXT });
    y -= 34;
  }

  y -= 10;
  if (y < 100) y = startNewPage(pdfDoc, W, H) - 20;
  const sp = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  sp.drawRectangle({ x: LM, y: y - 50, width: CW, height: 50, color: GREY_BG, borderColor: GREY_BORDER, borderWidth: 0.5 });
  sp.drawText("AUDIT SUMMARY", { x: LM + 14, y: y - 16, size: 9, font: helveticaBold, color: GREY_TEXT });
  sp.drawText(`This document was sent to ${signatories.length} signator${signatories.length !== 1 ? "ies" : "y"}. All events were captured with timestamps and IP addresses.`, { x: LM + 14, y: y - 32, size: 9, font: helvetica, color: DARK_TEXT });

  y -= 70;
  const footerText = "Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device";
  const ftw = helvetica.widthOfTextAtSize(footerText, 8);
  sp.drawText(footerText, { x: (W - ftw) / 2, y, size: 8, font: helvetica, color: GREY_TEXT });
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { document_id, skip_email } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("generate-signed-pdf-server: starting for document", document_id);

    // 1. Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("approval_documents").select("*").eq("id", document_id).single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fetch signatories
    const { data: signatories } = await supabase
      .from("approval_signatories").select("*").eq("document_id", document_id).order("sort_order", { ascending: true });

    // 3. Fetch audit log
    const { data: auditLog } = await supabase
      .from("approval_audit_log").select("action, actor_name, actor_email, created_at, ip_address")
      .eq("document_id", document_id).order("created_at", { ascending: true });

    // 4. Download original PDF
    const storagePath = doc.file_url.replace(/^.*approval-documents\//, "");
    console.log("generate-signed-pdf-server: downloading", storagePath);
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("approval-documents").download(storagePath);
    if (fileErr || !fileData) {
      console.error("Failed to download PDF:", fileErr);
      return new Response(JSON.stringify({ error: "Failed to download original PDF" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const originalPdfBytes = await fileData.arrayBuffer();
    const fileHash = await sha256(originalPdfBytes);

    // 5. Generate signed PDF
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const placement = doc.signature_placement || { method: "append" };
    const sigs: SignatoryInfo[] = (signatories || []).map((s: any) => ({
      id: s.id, name: s.name, email: s.email, role: s.role,
      organisation: s.organisation, signed_at: s.signed_at,
      signed_name: s.signed_name, signed_role: s.signed_role,
      signed_organisation: s.signed_organisation, signed_ip: s.signed_ip,
      signatory_title: s.signatory_title, signature_font: s.signature_font,
    }));

    // Draw signatures based on placement method
    if (placement.method === "stamp") {
      drawStampSignatures(pdfDoc, sigs, placement, helvetica, helveticaBold, cursiveFont);
    } else if (placement.method === "separated") {
      drawSeparatedSignatures(pdfDoc, sigs, placement, helvetica, cursiveFont);
    }

    // Draw text annotations
    if (placement.textAnnotations && placement.textAnnotations.length > 0) {
      drawTextAnnotations(pdfDoc, placement.textAnnotations, helvetica, placement.separatedFontSize || 14);
    }

    // Draw certificate + audit trail
    const certificateId = doc.id;
    await drawCertificatePages(
      pdfDoc, doc.title, doc.original_filename, certificateId,
      fileHash, sigs, auditLog || [], doc.completed_at,
      helvetica, helveticaBold, cursiveFont,
    );

    const signedPdfBytes = await pdfDoc.save();
    console.log("generate-signed-pdf-server: PDF generated, size =", signedPdfBytes.length);

    // 6. Upload to storage
    const signedPath = `signed/${document_id}-signed.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("approval-documents")
      .upload(signedPath, signedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Failed to upload signed PDF:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload signed PDF" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("approval-documents")
      .getPublicUrl(signedPath);
    const signedFileUrl = urlData?.publicUrl || signedPath;

    // 7. Update document with signed_file_url
    await supabase
      .from("approval_documents")
      .update({ signed_file_url: signedFileUrl })
      .eq("id", document_id);

    // 8. Log to audit trail
    await supabase.from("approval_audit_log").insert({
      document_id,
      action: "signed_document_generated",
      actor_name: "System",
      metadata: { trigger: "auto_all_approved", file_hash: fileHash },
    });

    console.log("generate-signed-pdf-server: signed PDF uploaded, triggering send_completed email");

    // 9. Trigger send_completed email
    await fetch(`${supabaseUrl}/functions/v1/send-approval-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: "send_completed",
        document_id,
        signed_file_url: signedFileUrl,
      }),
    });

    return new Response(JSON.stringify({
      success: true,
      signed_file_url: signedFileUrl,
      file_hash: fileHash,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-signed-pdf-server error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
