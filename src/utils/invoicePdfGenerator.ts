import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPracticeName, getOdsCode } from '@/data/nresPractices';
import { NRES_PRACTICE_ADDRESSES, NRES_PRACTICE_CONTACTS, NRES_PRACTICE_BANK_DETAILS } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';

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

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const { claim, invoiceNumber, neighbourhoodName } = data;
  const doc = new jsPDF();
  const practiceName = getPracticeName(claim.practice_key);
  const odsCode = getOdsCode(claim.practice_key);
  const staffDetails = (claim.staff_details as any[]) || [];
  const claimDate = new Date(claim.claim_month);
  const claimMonthLabel = claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

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
  doc.roundedRect(rightX - 2, metaY - 4, 78, 28, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(GREY_100);
  doc.text('Invoice No:', rightX, metaY);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceNumber, rightX + 40, metaY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_100);
  doc.text('Invoice Date:', rightX, metaY + 6);
  doc.setTextColor(0);
  doc.text(new Date().toLocaleDateString('en-GB'), rightX + 40, metaY + 6);

  doc.setTextColor(GREY_100);
  doc.text('Claim Period:', rightX, metaY + 12);
  doc.setTextColor(0);
  doc.text(claimMonthLabel, rightX + 40, metaY + 12);

  doc.setTextColor(GREY_100);
  doc.text('Payment Terms:', rightX, metaY + 18);
  doc.setTextColor(0);
  doc.text('30 days', rightX + 40, metaY + 18);

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
    s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical'),
    s.allocation_type === 'sessions'
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

  // --- GL Subtotals ---
  const gpTotal = staffDetails
    .filter((s: any) => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical')) === 'GP')
    .reduce((sum: number, s: any) => sum + (s.claimed_amount || 0), 0);
  const otherTotal = staffDetails
    .filter((s: any) => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical')) !== 'GP')
    .reduce((sum: number, s: any) => sum + (s.claimed_amount || 0), 0);
  const grandTotal = gpTotal + otherTotal;

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Subtotals box
  doc.setFillColor(240, 244, 248);
  doc.roundedRect(130, finalY - 5, 66, 30, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_60);
  doc.text('GP Subtotal:', 134, finalY);
  doc.text(fmt(gpTotal), 192, finalY, { align: 'right' });
  doc.text('Other Clinical Subtotal:', 134, finalY + 6);
  doc.text(fmt(otherTotal), 192, finalY + 6, { align: 'right' });

  doc.setDrawColor(...NHS_BLUE);
  doc.setLineWidth(0.4);
  doc.line(134, finalY + 10, 192, finalY + 10);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('TOTAL:', 134, finalY + 18);
  doc.text(fmt(grandTotal), 192, finalY + 18, { align: 'right' });

  // --- Bank Details (if available) ---
  let bankY = finalY + 28;
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
