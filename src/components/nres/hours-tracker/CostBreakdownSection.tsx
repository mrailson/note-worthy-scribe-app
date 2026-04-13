import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, FileDown, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { RoleConfig } from '@/hooks/useNRESBuyBackRateSettings';

function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CostRow {
  label: string;
  allocationNote: string;
  baseAnnual: number;
  staffHourlyRate: number;
  niAmt: number;
  pensionAmt: number;
  totalOnCosts: number;
  totalAnnual: number;
  hourlyEquiv: number;
  maxMonthly: number;
  glCode: string;
  includesOnCosts: boolean;
  isDailyRate: boolean;
  dailyRate: number;
}

type SortKey = keyof CostRow;
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right'; dynamic?: boolean; suffix?: string }[] = [
  { key: 'label', label: 'Role', align: 'left' },
  { key: 'glCode', label: 'GL Code', align: 'left' },
  { key: 'baseAnnual', label: 'Base Annual', align: 'right' },
  { key: 'staffHourlyRate', label: 'Staff Pay Rate (Hourly)', align: 'right', suffix: '/hr' },
  { key: 'niAmt', label: 'Employer NI', align: 'right', dynamic: true },
  { key: 'pensionAmt', label: 'Employer Pension', align: 'right', dynamic: true },
  { key: 'totalOnCosts', label: 'Total On-Costs', align: 'right' },
  { key: 'totalAnnual', label: 'Total Annual', align: 'right' },
  { key: 'hourlyEquiv', label: 'Equiv. Hourly (incl. On-Costs)', align: 'right', suffix: '/hr' },
  { key: 'maxMonthly', label: 'Max Monthly Claim', align: 'right', suffix: '/mo' },
];

export function CostBreakdownSection({ roles, niPctNum, pensionPctNum, onCostsPctNum }: {
  roles: RoleConfig[];
  niPctNum: number;
  pensionPctNum: number;
  onCostsPctNum: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filter out daily-rate roles (e.g. GP Locum) — they don't fit the salary-based breakdown
  // but remain available for selection and claims elsewhere
  const salariedRoles = useMemo(() => roles.filter(r => r.allocation_default !== 'daily'), [roles]);
  const dailyRateRoles = useMemo(() => roles.filter(r => r.allocation_default === 'daily'), [roles]);

  const rows = useMemo<CostRow[]>(() => salariedRoles.map(role => {
    const includesOnCosts = role.includes_on_costs !== false;
    const isDailyRate = false;
    const workingHrs = role.working_hours_per_year || 1950;
    const fullAnnualBase = role.allocation_default === 'sessions' ? role.annual_rate * 9 : role.annual_rate;
    const staffHourlyRate = workingHrs > 0 ? fullAnnualBase / workingHrs : 0;
    const niAmt = includesOnCosts ? role.annual_rate * (niPctNum / 100) : 0;
    const pensionAmt = includesOnCosts ? role.annual_rate * (pensionPctNum / 100) : 0;
    const totalOnCosts = niAmt + pensionAmt;
    const totalAnnual = role.annual_rate + totalOnCosts;
    const fullAnnualWithOnCosts = role.allocation_default === 'sessions' ? totalAnnual * 9 : totalAnnual;
    const hourlyEquiv = workingHrs > 0 ? fullAnnualWithOnCosts / workingHrs : 0;
    
    let maxMonthly: number;
    const maxAlloc = role.allocation_default === 'sessions' ? 9 : role.allocation_default === 'hours' ? 37.5 : 1;
    maxMonthly = role.allocation_default === 'sessions'
      ? (maxAlloc * totalAnnual) / 12
      : role.allocation_default === 'hours'
      ? ((maxAlloc / 37.5) * totalAnnual) / 12
      : (maxAlloc * totalAnnual) / 12;

    return {
      label: role.label,
      allocationNote: role.allocation_default === 'sessions' ? '(per session/yr)' : '',
      baseAnnual: role.annual_rate,
      staffHourlyRate,
      niAmt,
      pensionAmt,
      totalOnCosts,
      totalAnnual,
      hourlyEquiv,
      maxMonthly,
      glCode: role.gl_code || '',
      includesOnCosts,
      isDailyRate,
      dailyRate: role.daily_rate ?? 0,
    };
  }), [salariedRoles, niPctNum, pensionPctNum]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleDownloadWord = useCallback(async () => {
    try {
      const docx = await import('docx');
      const { saveAs } = await import('file-saver');
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel } = docx;

      const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
      const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
      const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

      const headerLabels = ['Role', 'GL Code', 'Base Annual', 'Hourly Rate', `NI (${niPctNum}%)`, `Pension (${pensionPctNum}%)`, 'On-Costs', 'Total Annual', 'Hourly (incl.)', 'Max Monthly'];
      const colWidths = [1600, 900, 1000, 900, 900, 900, 900, 1000, 1000, 1000];

      const headerRow = new TableRow({
        children: headerLabels.map((h, i) => new TableCell({
          borders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: '005EB8', type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({ alignment: i < 2 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text: h, bold: true, font: 'Arial', size: 16, color: 'FFFFFF' })] })],
        })),
      });

      const dataRows = sortedRows.map(r => {
        const vals = [
          r.label + (r.allocationNote ? ' ' + r.allocationNote : ''),
          r.glCode || '—',
          fmtGBP(r.baseAnnual),
          fmtGBP(r.staffHourlyRate) + '/hr',
          fmtGBP(r.niAmt),
          fmtGBP(r.pensionAmt),
          fmtGBP(r.totalOnCosts),
          fmtGBP(r.totalAnnual),
          fmtGBP(r.hourlyEquiv) + '/hr',
          fmtGBP(r.maxMonthly) + '/mo',
        ];
        return new TableRow({
          children: vals.map((v, i) => new TableCell({
            borders,
            width: { size: colWidths[i], type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ alignment: i < 2 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text: v, font: 'Arial', size: 16 })] })],
          })),
        });
      });

      const doc = new Document({
        styles: {
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: '005EB8' }, paragraph: { spacing: { after: 200 } } },
          ],
        },
        sections: [{
          properties: { page: { size: { width: 16838, height: 11906, orientation: docx.PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'NRES Cost Breakdown', bold: true, font: 'Arial', size: 32, color: '005EB8' })] }),
            new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `On-costs: Employer NI ${niPctNum}% + Pension ${pensionPctNum}% = ${onCostsPctNum.toFixed(2)}%`, font: 'Arial', size: 18, color: '666666' })] }),
            new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, font: 'Arial', size: 18, color: '666666' })] }),
            new Table({ width: { size: 10100, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] }),
          ],
        }],
      });

      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `NRES_Cost_Breakdown_${new Date().toISOString().slice(0, 10)}.docx`);
      toast.success('Cost breakdown downloaded');
    } catch (err) {
      console.error('Error generating Word document:', err);
      toast.error('Failed to generate document');
    }
  }, [sortedRows, niPctNum, pensionPctNum, onCostsPctNum]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold">Cost Breakdown</h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleDownloadWord}>
          <FileDown className="w-3.5 h-3.5" />
          Download Word
        </Button>
      </div>
      <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`${col.align === 'left' ? 'text-left' : 'text-right'} px-3 py-2.5 font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center">
                    {col.dynamic ? col.label + ` (${col.key === 'niAmt' ? niPctNum : pensionPctNum}%)` : col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2.5">
                  {r.label}
                  {r.allocationNote && <span className="text-muted-foreground ml-1">{r.allocationNote}</span>}
                  {!r.includesOnCosts && <span className="ml-1.5 text-[10px] text-amber-600 font-medium">(excl. on-costs)</span>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.glCode || '—'}</td>
                <td className="px-3 py-2.5 text-right">{r.isDailyRate ? `${fmtGBP(r.dailyRate)}/day` : fmtGBP(r.baseAnnual)}</td>
                <td className="px-3 py-2.5 text-right">{r.isDailyRate ? '—' : `${fmtGBP(r.staffHourlyRate)}/hr`}</td>
                <td className="px-3 py-2.5 text-right">{r.includesOnCosts ? fmtGBP(r.niAmt) : <span className="text-muted-foreground italic">N/A</span>}</td>
                <td className="px-3 py-2.5 text-right">{r.includesOnCosts ? fmtGBP(r.pensionAmt) : <span className="text-muted-foreground italic">N/A</span>}</td>
                <td className="px-3 py-2.5 text-right">{r.includesOnCosts ? fmtGBP(r.totalOnCosts) : <span className="text-muted-foreground italic">N/A</span>}</td>
                <td className="px-3 py-2.5 text-right font-medium">{r.isDailyRate ? `${fmtGBP(r.dailyRate)}/day` : fmtGBP(r.totalAnnual)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{r.isDailyRate ? '—' : `${fmtGBP(r.hourlyEquiv)}/hr`}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-primary">{fmtGBP(r.maxMonthly)}/mo</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dailyRateRoles.length > 0 && (
        <div className="flex items-start gap-2 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold">Daily-rate roles not shown above:</span>{' '}
            {dailyRateRoles.map(r => `${r.label} (${fmtGBP(r.daily_rate ?? 0)}/day)`).join(', ')}.
            These roles use fixed daily rates without on-costs and are available for selection when submitting claims.
          </p>
        </div>
      )}
      <div className="flex items-start gap-2 mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-muted-foreground">
          On-costs = Employer NI ({niPctNum}%) + Employer Pension ({pensionPctNum}%) = {onCostsPctNum.toFixed(2)}% total. Staff Pay Rate = Base Annual ÷ {roles[0]?.working_hours_per_year || 1950} hrs/yr. GP rates shown per session — hourly equivalents based on 9 sessions/wk. Max Monthly = full allocation at maximum capacity.
        </p>
      </div>
    </div>
  );
}

export default CostBreakdownSection;
