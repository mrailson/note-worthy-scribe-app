import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPracticeName, getOdsCode } from '@/data/nresPractices';
import { NRES_PRACTICE_ADDRESSES, NRES_PRACTICE_CONTACTS, NRES_PRACTICE_BANK_DETAILS } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import { getSDAClaimGLCode, getGLInvoiceLabel } from '@/utils/glCodes';

interface InvoiceData {
  claim: BuyBackClaim;
  invoiceNumber: string;
  neighbourhoodName: string;
}

const fmt = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NHS_DARK_BLUE: [number, number, number] = [0, 48, 135];
const NHS_BLUE: [number, number, number] = [0, 94, 184];
const GREY_60: number = 60;
const GREY_100: number = 100;
const INVOICE_TABLE_START = '[[INVOICE_TABLE]]';
const INVOICE_TABLE_END = '[[/INVOICE_TABLE]]';

function parseInvoiceTableDescription(description: string) {
  const start = description.indexOf(INVOICE_TABLE_START);
  const end = description.indexOf(INVOICE_TABLE_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const rows = description.slice(start + INVOICE_TABLE_START.length, end).trim().split('\n').map(line => {
    const [date = '', startTime = '', stop = '', ...details] = line.split('|').map(part => part.trim());
    return { date, start: startTime, stop, details: details.join(' | ') };
  }).filter(row => row.date || row.start || row.stop || row.details);
  return rows.length ? rows : null;
}

// Detect a pasted "pipe-aligned" table (produced by the Excel paste handler in the verifier).
// Requires 2+ data lines with the same column count separated by "|". Ignores a header
// underline row made of dashes/box-drawing characters.
function parsePipeAlignedTable(description: string): { head: string[]; body: string[][] } | null {
  const text = description.trim();
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trimEnd());
  const isSep = (l: string) => /[─\-]/.test(l) && /^[\s\-─┼|+]+$/.test(l);
  const split = (l: string) => l.split('|').map(c => c.trim());
  const dataLines = lines.filter(l => l.includes('|') && !isSep(l));
  if (dataLines.length < 2) return null;
  const rows = dataLines.map(split);
  const cols = rows[0].length;
  if (cols < 2) return null;
  if (!rows.every(r => r.length === cols)) return null;
  return { head: rows[0], body: rows.slice(1) };
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const { claim, invoiceNumber, neighbourhoodName } = data;
  const doc = new jsPDF();
  const practiceName = getPracticeName(claim.practice_key);
  const odsCode = getOdsCode(claim.practice_key);
  const staffDetails = (claim.staff_details as any[]) || [];
  const claimDate = new Date(claim.claim_month);
  const claimMonthLabel = claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const resolveGLCode = (line: any) => getSDAClaimGLCode(line, claim.claim_type || 'buyback');

  const practiceKey = claim.practice_key as NRESPracticeKey;
  const practiceAddress = NRES_PRACTICE_ADDRESSES[practiceKey] || '';
  const practiceContact = NRES_PRACTICE_CONTACTS[practiceKey];
  const bankDetails = NRES_PRACTICE_BANK_DETAILS[practiceKey];

  // --- Header band ---
  doc.setFillColor(...NHS_DARK_BLUE);
  doc.rect(0, 0, 210, 8, 'F');

  // --- INVOICE title ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('INVOICE', 14, 22);

  // --- From: Practice details (left side) ---
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_100);
  doc.text('FROM', 14, 30);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text(practiceName, 14, 36);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_60);
  doc.text(`ODS Code: ${odsCode}`, 14, 42);

  // Practice address — split by comma into separate lines like PML address
  if (practiceAddress) {
    const addressParts = practiceAddress.split(',').map(s => s.trim()).filter(Boolean);
    let addrY = 47;
    addressParts.forEach(part => {
      doc.text(part, 14, addrY);
      addrY += 4.5;
    });
  }

  // Practice Manager contact
  let practiceInfoY = practiceAddress ? 47 + (practiceAddress.split(',').filter(s => s.trim()).length * 4.5) + 2 : 52;
  if (practiceContact) {
    doc.setFontSize(8);
    doc.setTextColor(GREY_100);
    doc.text('Key Contact:', 14, practiceInfoY);
    doc.setFontSize(9);
    doc.setTextColor(GREY_60);
    doc.text(`${practiceContact.practiceManager} (Practice Manager)`, 14, practiceInfoY + 4.5);
    doc.text(practiceContact.email, 14, practiceInfoY + 9);
    if (practiceContact.phone) {
      doc.text(`Tel: ${practiceContact.phone}`, 14, practiceInfoY + 13.5);
    }
  }

  // --- To: PML details (right side) ---
  const rightX = 125;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_100);
  doc.text('INVOICE TO', rightX, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('PML (Principal Medical Limited)', rightX, 36);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_60);
  doc.text('3 Barberry Place', rightX, 42);
  doc.text('Bicester, Oxfordshire', rightX, 46.5);
  doc.text('OX26 3HA', rightX, 51);
  doc.text('Tel: 01295 981166', rightX, 56);
  doc.text('Email: pml.info@nhs.net', rightX, 60.5);

  // --- Invoice meta (right side, below PML address) ---
  const metaY = 70;
  doc.setFillColor(240, 244, 248);
  doc.roundedRect(rightX - 2, metaY - 4, 78, 34, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(GREY_100);
  doc.text('Invoice No:', rightX, metaY);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceNumber, rightX + 40, metaY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_100);
  doc.text('Claim ID:', rightX, metaY + 6);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(claim.claim_ref != null ? `#${claim.claim_ref}` : '—', rightX + 40, metaY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_100);
  doc.text('Invoice Date:', rightX, metaY + 12);
  doc.setTextColor(0);
  doc.text(new Date().toLocaleDateString('en-GB'), rightX + 40, metaY + 12);

  doc.setTextColor(GREY_100);
  doc.text('Claim Period:', rightX, metaY + 18);
  doc.setTextColor(0);
  doc.text(claimMonthLabel, rightX + 40, metaY + 18);

  doc.setTextColor(GREY_100);
  doc.text('Payment Terms:', rightX, metaY + 24);
  doc.setTextColor(0);
  doc.text('30 days', rightX + 40, metaY + 24);

  // --- Programme reference ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(GREY_100);
  doc.text(`${neighbourhoodName} Neighbourhood Access Service`, 14, metaY + 22);

  // --- Separator ---
  doc.setDrawColor(...NHS_BLUE);
  doc.setLineWidth(0.6);
  doc.line(14, metaY + 26, 196, metaY + 26);

  // --- Staff Lines Table ---
  const tableStartY = metaY + 30;
  const tableData = staffDetails.map((s: any, i: number) => [
    i + 1,
    s.staff_name || '—',
    s.staff_role || '—',
    getGLInvoiceLabel(resolveGLCode(s)),
    s.staff_category === 'gp_locum'
      ? (s.allocation_type === 'daily'
        ? `${s.allocation_value} day${s.allocation_value !== 1 ? 's' : ''} @ £750/day`
        : `${s.allocation_value} session${s.allocation_value !== 1 ? 's' : ''} @ £375`)
      : s.allocation_type === 'sessions'
        ? `${s.allocation_value} session${s.allocation_value !== 1 ? 's' : ''}`
        : s.allocation_type === 'hours'
          ? `${s.allocation_value} hrs/wk`
          : s.allocation_type === 'daily'
            ? `${s.allocation_value}/day`
            : `${s.allocation_value} WTE`,
    fmt(s.claimed_amount || 0),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Staff Member', 'Role', 'GL Category', 'Allocation', 'Amount']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 94, 184], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      5: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [240, 244, 245] },
  });

  // --- Optional invoice-facing claim description ---
  const invoiceDescription = String((claim as any).practice_notes || '').trim();
  const invoiceTableRows = parseInvoiceTableDescription(invoiceDescription);
  const pipeTable = !invoiceTableRows ? parsePipeAlignedTable(invoiceDescription) : null;
  const MAX_LINE_CHARS = 106;
  const cappedDescription = invoiceDescription
    .split('\n')
    .map(l => l.length > MAX_LINE_CHARS ? l.slice(0, MAX_LINE_CHARS) : l)
    .join('\n');
  const descriptionLines = invoiceDescription && !invoiceTableRows && !pipeTable ? doc.splitTextToSize(cappedDescription, 176) : [];
  let finalY = (doc as any).lastAutoTable.finalY + 10;
  if (invoiceTableRows) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NHS_DARK_BLUE);
    doc.text('Details', 14, finalY);
    autoTable(doc, {
      startY: finalY + 3,
      head: [['Date', 'Start', 'Stop', 'Details']],
      body: invoiceTableRows.map(row => [row.date || '—', row.start || '—', row.stop || '—', row.details || '—']),
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [239, 246, 255], textColor: NHS_DARK_BLUE, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 18 }, 2: { cellWidth: 18 }, 3: { cellWidth: 116 } },
      margin: { left: 14, right: 14 },
    });
    finalY = (doc as any).lastAutoTable.finalY + 10;
  } else if (pipeTable) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NHS_DARK_BLUE);
    doc.text('Details', 14, finalY);
    autoTable(doc, {
      startY: finalY + 3,
      head: [pipeTable.head],
      body: pipeTable.body,
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [239, 246, 255], textColor: NHS_DARK_BLUE, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    finalY = (doc as any).lastAutoTable.finalY + 10;
  } else if (descriptionLines.length > 0) {
    const descHeight = Math.min(94, 10 + descriptionLines.length * 4.2);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, finalY - 4, 182, descHeight, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NHS_DARK_BLUE);
    doc.text('Details', 18, finalY + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GREY_60);
    doc.text(descriptionLines.slice(0, 20), 18, finalY + 8);
    finalY += descHeight + 8;
  }

  // --- GL Subtotals (grouped by GL code) ---
  const glGroups: Record<string, number> = {};
  staffDetails.forEach((s: any) => {
    const glCode = resolveGLCode(s) || 'N/A';
    glGroups[glCode] = (glGroups[glCode] || 0) + (s.claimed_amount || 0);
  });
  const grandTotal = Object.values(glGroups).reduce((a, b) => a + b, 0);

  const glEntries = Object.entries(glGroups).sort((a, b) => a[0].localeCompare(b[0]));
  const boxHeight = Math.max(30, 10 + glEntries.length * 6 + 12);

  // Subtotals box
  doc.setFillColor(240, 244, 248);
  doc.roundedRect(120, finalY - 5, 76, boxHeight, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_60);

  let lineY = finalY;
  glEntries.forEach(([code, amount]) => {
    doc.text(`GL ${getGLInvoiceLabel(code)}:`, 124, lineY);
    doc.text(fmt(amount), 192, lineY, { align: 'right' });
    lineY += 6;
  });

  doc.setDrawColor(...NHS_BLUE);
  doc.setLineWidth(0.4);
  doc.line(124, lineY, 192, lineY);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('TOTAL:', 124, lineY + 8);
  doc.text(fmt(grandTotal), 192, lineY + 8, { align: 'right' });

  // --- Bank Details (if available) ---
  let bankY = lineY + 18;
  if (bankDetails) {
    doc.setFillColor(245, 248, 252);
    doc.roundedRect(14, bankY - 4, 100, 30, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NHS_DARK_BLUE);
    doc.text('Payment Details', 18, bankY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GREY_60);
    doc.text(`Bank: ${bankDetails.bankName}`, 18, bankY + 6);
    doc.text(`Sort Code: ${bankDetails.sortCode}`, 18, bankY + 11);
    doc.text(`Account No: ${bankDetails.accountNumber}`, 18, bankY + 16);
    doc.text(`Account Name: ${bankDetails.accountName}`, 18, bankY + 21);
  }

  // --- Footer band ---
  doc.setFillColor(...NHS_DARK_BLUE);
  doc.rect(0, 284, 210, 13, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255);
  doc.text(`Claim ID: ${claim.id}`, 14, 289);
  doc.text(`Generated by Notewell AI — ${neighbourhoodName} SDA Programme`, 14, 293);
  doc.text(new Date().toLocaleDateString('en-GB'), 196, 289, { align: 'right' });

  return doc;
}
