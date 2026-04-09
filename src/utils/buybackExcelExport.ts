import * as XLSX from 'xlsx';
import { getPracticeName, getOdsCode } from '@/data/nresPractices';
import { format } from 'date-fns';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';

function claimMonthLabel(claimMonth: string): string {
  try {
    return format(new Date(claimMonth), 'MMM yyyy');
  } catch {
    return claimMonth;
  }
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/**
 * Export 1: Claims Detail — one row per staff line per claim.
 */
export function exportClaimsDetail(claims: BuyBackClaim[], filterPractice?: string, filterStatus?: string) {
  const filtered = claims.filter(c => {
    if (filterPractice && filterPractice !== 'all' && c.practice_key !== filterPractice) return false;
    if (filterStatus && filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const rows: any[][] = [[
    'Practice Name', 'ODS Code', 'Claim Month', 'Staff Name', 'Role', 'Category',
    'GL Category', 'Allocation Type', 'Allocation Value', 'Claimed Amount (£)',
    'Claim Status', 'Invoice Number', 'Submitted By', 'Submitted Date',
    'Verified By', 'Verified Date', 'Approved By', 'Approved Date',
  ]];

  filtered.forEach(claim => {
    const staffDetails = (claim.staff_details as any[]) || [];
    staffDetails.forEach(s => {
      rows.push([
        getPracticeName(claim.practice_key),
        getOdsCode(claim.practice_key),
        claimMonthLabel(claim.claim_month),
        s.staff_name || '—',
        s.staff_role || '—',
        s.staff_category === 'new_sda' ? 'New SDA' : 'Buy-Back',
        s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical'),
        s.allocation_type || '—',
        s.allocation_value || 0,
        s.claimed_amount || 0,
        claim.status,
        claim.invoice_number || '—',
        claim.submitted_by_email || '—',
        claim.submitted_at ? format(new Date(claim.submitted_at), 'dd/MM/yyyy') : '—',
        claim.verified_by || '—',
        claim.verified_at ? format(new Date(claim.verified_at), 'dd/MM/yyyy') : '—',
        claim.approved_by_email || '—',
        claim.reviewed_at ? format(new Date(claim.reviewed_at), 'dd/MM/yyyy') : '—',
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 28 }, { wch: 28 }, { wch: 14 },
    { wch: 28 }, { wch: 14 }, { wch: 28 }, { wch: 14 },
  ];
  ws['!autofilter'] = { ref: `A1:R${rows.length}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Claims Detail');
  downloadWorkbook(wb, `NRES_Claims_Detail_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

/**
 * Export 2: Monthly Summary — one row per practice per month.
 */
export function exportMonthlySummary(claims: BuyBackClaim[], filterPractice?: string) {
  const filtered = claims.filter(c => {
    if (filterPractice && filterPractice !== 'all' && c.practice_key !== filterPractice) return false;
    return true;
  });

  const groups = new Map<string, { practiceName: string; odsCode: string; claimMonth: string; gpTotal: number; otherTotal: number; grandTotal: number; status: string; invoiceNumber: string }>();

  filtered.forEach(claim => {
    const key = `${claim.practice_key}|${claim.claim_month}`;
    const staffDetails = (claim.staff_details as any[]) || [];
    const gpTotal = staffDetails
      .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other')) === 'GP')
      .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);
    const otherTotal = staffDetails
      .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other')) !== 'GP')
      .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);

    groups.set(key, {
      practiceName: getPracticeName(claim.practice_key),
      odsCode: getOdsCode(claim.practice_key),
      claimMonth: claimMonthLabel(claim.claim_month),
      gpTotal, otherTotal, grandTotal: gpTotal + otherTotal,
      status: claim.status,
      invoiceNumber: claim.invoice_number || '—',
    });
  });

  const rows: any[][] = [['Practice Name', 'ODS Code', 'Claim Month', 'GP Total (£)', 'Other Clinical Total (£)', 'Grand Total (£)', 'Status', 'Invoice Number']];
  let totalGP = 0, totalOther = 0, totalGrand = 0;
  groups.forEach(g => {
    rows.push([g.practiceName, g.odsCode, g.claimMonth, g.gpTotal, g.otherTotal, g.grandTotal, g.status, g.invoiceNumber]);
    totalGP += g.gpTotal; totalOther += g.otherTotal; totalGrand += g.grandTotal;
  });
  rows.push(['TOTAL', '', '', totalGP, totalOther, totalGrand, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  ws['!autofilter'] = { ref: `A1:H${rows.length - 1}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
  downloadWorkbook(wb, `NRES_Monthly_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

/**
 * Export 3: YTD Running Totals — one row per practice, columns for each month Apr–Mar.
 */
export function exportYTDRunningTotals(claims: BuyBackClaim[]) {
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const header: string[] = ['Practice Name', 'ODS Code'];
  months.forEach(m => { header.push(`${m} GP (£)`, `${m} Other (£)`); });
  header.push('YTD GP Total (£)', 'YTD Other Total (£)', 'YTD Grand Total (£)');

  const practiceMap = new Map<string, Map<number, { gp: number; other: number }>>();

  claims.forEach(claim => {
    if (!claim.practice_key) return;
    const claimDate = new Date(claim.claim_month);
    const claimFYStart = claimDate.getMonth() >= 3 ? claimDate.getFullYear() : claimDate.getFullYear() - 1;
    if (claimFYStart !== fyStart) return;

    const fyMonthIndex = claimDate.getMonth() >= 3 ? claimDate.getMonth() - 3 : claimDate.getMonth() + 9;

    if (!practiceMap.has(claim.practice_key)) practiceMap.set(claim.practice_key, new Map());
    const monthMap = practiceMap.get(claim.practice_key)!;

    const staffDetails = (claim.staff_details as any[]) || [];
    const gpAmount = staffDetails
      .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other')) === 'GP')
      .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);
    const otherAmount = staffDetails
      .filter(s => (s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other')) !== 'GP')
      .reduce((sum, s) => sum + (s.claimed_amount || 0), 0);

    const existing = monthMap.get(fyMonthIndex) || { gp: 0, other: 0 };
    monthMap.set(fyMonthIndex, { gp: existing.gp + gpAmount, other: existing.other + otherAmount });
  });

  const rows: any[][] = [header];
  let grandTotalGP = 0, grandTotalOther = 0;

  practiceMap.forEach((monthMap, practiceKey) => {
    const row: any[] = [getPracticeName(practiceKey), getOdsCode(practiceKey)];
    let ytdGP = 0, ytdOther = 0;
    for (let i = 0; i < 12; i++) {
      const data = monthMap.get(i) || { gp: 0, other: 0 };
      row.push(data.gp || '', data.other || '');
      ytdGP += data.gp; ytdOther += data.other;
    }
    row.push(ytdGP, ytdOther, ytdGP + ytdOther);
    rows.push(row);
    grandTotalGP += ytdGP; grandTotalOther += ytdOther;
  });

  const totalsRow: any[] = ['TOTAL', ''];
  for (let i = 0; i < 12; i++) {
    let mGP = 0, mOther = 0;
    practiceMap.forEach(monthMap => { const d = monthMap.get(i) || { gp: 0, other: 0 }; mGP += d.gp; mOther += d.other; });
    totalsRow.push(mGP || '', mOther || '');
  }
  totalsRow.push(grandTotalGP, grandTotalOther, grandTotalGP + grandTotalOther);
  rows.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'YTD Running Totals');
  downloadWorkbook(wb, `NRES_YTD_Running_Totals_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
