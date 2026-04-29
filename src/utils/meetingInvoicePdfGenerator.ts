import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPracticeName, getOdsCode } from '@/data/nresPractices';
import { NRES_PRACTICE_ADDRESSES, NRES_PRACTICE_CONTACTS, NRES_PRACTICE_BANK_DETAILS } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { MeetingLogEntry } from '@/hooks/useNRESMeetingLog';
import { getGLInvoiceLabel, getMeetingAttendanceGLCode } from '@/utils/glCodes';

interface MeetingInvoiceData {
  entries: MeetingLogEntry[];
  practiceKey: string;
  invoiceNumber: string;
  claimMonth: string;
  neighbourhoodName: string;
}

const fmt = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NHS_DARK_BLUE: [number, number, number] = [0, 48, 135];
const NHS_BLUE: [number, number, number] = [0, 94, 184];
const GREY_60: number = 60;
const GREY_100: number = 100;

export function generateMeetingInvoicePdf(data: MeetingInvoiceData): jsPDF {
  const { entries, practiceKey, invoiceNumber, claimMonth, neighbourhoodName } = data;
  const doc = new jsPDF();
  const practiceName = getPracticeName(practiceKey);
  const odsCode = getOdsCode(practiceKey);
  const claimDate = new Date(claimMonth);
  const claimMonthLabel = claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const pKey = practiceKey as NRESPracticeKey;
  const practiceAddress = NRES_PRACTICE_ADDRESSES[pKey] || '';
  const practiceContact = NRES_PRACTICE_CONTACTS[pKey];
  const bankDetails = NRES_PRACTICE_BANK_DETAILS[pKey];

  // --- Header band ---
  doc.setFillColor(...NHS_DARK_BLUE);
  doc.rect(0, 0, 210, 8, 'F');

  // --- INVOICE title ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('INVOICE', 14, 22);

  // Claim type badge
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(3, 105, 161);
  doc.text('Meeting Attendance', 50, 22);

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

  if (practiceAddress) {
    const addressParts = practiceAddress.split(',').map(s => s.trim()).filter(Boolean);
    let addrY = 47;
    addressParts.forEach(part => {
      doc.text(part, 14, addrY);
      addrY += 4.5;
    });
  }

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

  // --- Invoice meta ---
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
  doc.text(`${neighbourhoodName} Neighbourhood Access Service — Meeting Attendance`, 14, metaY + 22);

  // --- Separator ---
  doc.setDrawColor(...NHS_BLUE);
  doc.setLineWidth(0.6);
  doc.line(14, metaY + 26, 196, metaY + 26);

  // --- Meeting Lines Table ---
  const tableStartY = metaY + 30;
  const tableData = entries.map((e, i) => [
    i + 1,
    e.person_name || '—',
    e.management_role_key?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Meeting Attendance',
    getGLInvoiceLabel(getMeetingAttendanceGLCode(e.management_role_key, e.hourly_rate)),
    new Date(e.work_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    `${e.hours} hrs @ ${fmt(e.hourly_rate)}/hr`,
    e.description || '—',
    fmt(e.total_amount),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Attendee', 'Role', 'GL Category', 'Date', 'Hours & Rate', 'Description', 'Amount']],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [0, 94, 184], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20 },
      7: { halign: 'right', cellWidth: 18 },
    },
    alternateRowStyles: { fillColor: [240, 244, 245] },
  });

  // --- Total ---
  const grandTotal = entries.reduce((sum, e) => sum + e.total_amount, 0);
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const glGroups = entries.reduce((summary: Record<string, number>, e) => {
    const gl = getMeetingAttendanceGLCode(e.management_role_key, e.hourly_rate);
    summary[gl] = (summary[gl] || 0) + e.total_amount;
    return summary;
  }, {});
  const glEntries = Object.entries(glGroups).sort(([a], [b]) => a.localeCompare(b));

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalBoxHeight = Math.max(30, 18 + glEntries.length * 5.5);

  doc.setFillColor(240, 244, 248);
  doc.roundedRect(120, finalY - 5, 76, totalBoxHeight, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY_60);
  doc.text(`${entries.length} meeting${entries.length !== 1 ? 's' : ''}:`, 124, finalY);
  doc.text(`${totalHours} hrs`, 192, finalY, { align: 'right' });

  let subtotalY = finalY + 6;
  glEntries.forEach(([gl, amount]) => {
    doc.text(`GL ${getGLInvoiceLabel(gl)}:`, 124, subtotalY);
    doc.text(fmt(amount), 192, subtotalY, { align: 'right' });
    subtotalY += 5.5;
  });

  doc.setDrawColor(...NHS_BLUE);
  doc.setLineWidth(0.4);
  doc.line(124, subtotalY, 192, subtotalY);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NHS_DARK_BLUE);
  doc.text('TOTAL:', 124, subtotalY + 8);
  doc.text(fmt(grandTotal), 192, subtotalY + 8, { align: 'right' });

  // --- Bank Details ---
  let bankY = finalY + totalBoxHeight + 4;
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
  doc.text(`Meeting Attendance Invoice · ${practiceName}`, 14, 289);
  doc.text(`Generated by Notewell AI — ${neighbourhoodName} SDA Programme`, 14, 293);
  doc.text(new Date().toLocaleDateString('en-GB'), 196, 289, { align: 'right' });

  return doc;
}
