import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { BPReading } from '@/hooks/useBPCalculator';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface BPAverages {
  systolic: number;
  diastolic: number;
  pulse?: number;
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
}

interface NHSCategory {
  label: string;
  color: string;
  description: string;
}

interface BPExportOptionsProps {
  readings: BPReading[];
  averages: BPAverages | null;
  category: NHSCategory | null;
}

export const BPExportOptions = ({ readings, averages, category }: BPExportOptionsProps) => {
  const includedReadings = readings.filter(r => r.included);
  const excludedReadings = readings.filter(r => !r.included);

  const copyToClipboard = async () => {
    if (!averages) return;

    const text = `Average BP: ${averages.systolic}/${averages.diastolic} mmHg (${includedReadings.length} readings)
Range: ${averages.systolicMin}-${averages.systolicMax} / ${averages.diastolicMin}-${averages.diastolicMax}
${averages.pulse ? `Average Pulse: ${averages.pulse} bpm` : ''}
${category ? `Category: ${category.label}` : ''}

Individual Readings:
${includedReadings.map((r, i) => `${i + 1}. ${r.systolic}/${r.diastolic}${r.pulse ? `/${r.pulse}` : ''}${r.date ? ` (${r.date})` : ''}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const downloadCSV = () => {
    const headers = ['Reading #', 'Date', 'Time', 'Systolic', 'Diastolic', 'Pulse', 'Source'];
    const rows = includedReadings.map((r, i) => [
      i + 1,
      r.date || '',
      r.time || '',
      r.systolic,
      r.diastolic,
      r.pulse || '',
      `"${(r.sourceText || '').replace(/"/g, '""')}"`
    ]);

    // Add summary row
    if (averages) {
      rows.push([]);
      rows.push(['AVERAGE', '', '', averages.systolic, averages.diastolic, averages.pulse || '', '']);
      rows.push(['RANGE', '', '', `${averages.systolicMin}-${averages.systolicMax}`, `${averages.diastolicMin}-${averages.diastolicMax}`, '', '']);
      if (category) {
        rows.push(['CATEGORY', category.label, '', '', '', '', '']);
      }
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bp-readings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const downloadWordReport = async () => {
    if (!averages) return;

    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };

    const tableBorder = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    };

    // Create readings table rows
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 22 })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 8, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Systolic", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 18, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Diastolic", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 18, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pulse", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 14, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Time", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 14, type: WidthType.PERCENTAGE } }),
        ],
      }),
      ...includedReadings.map((r, i) => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 22 })] })], borders: tableBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.systolic), size: 22 })] })], borders: tableBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.diastolic), size: 22 })] })], borders: tableBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.pulse ? String(r.pulse) : "-", size: 22 })] })], borders: tableBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.date || "-", size: 22 })] })], borders: tableBorder }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.time || "-", size: 22 })] })], borders: tableBorder }),
          ],
        })
      ),
    ];

    const doc = new Document({
      sections: [{
        children: [
          // Title
          new Paragraph({
            children: [new TextRun({ text: "Blood Pressure Average Report", bold: true, size: 36, color: "2563EB" })],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          }),
          
          // Generated date
          new Paragraph({
            children: [new TextRun({ text: `Generated: ${new Date().toLocaleString('en-GB')}`, size: 20, color: "666666" })],
            spacing: { after: 400 },
          }),

          // Summary section
          new Paragraph({
            children: [new TextRun({ text: "Summary", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),

          // Average BP - prominent
          new Paragraph({
            children: [
              new TextRun({ text: "Average Blood Pressure: ", size: 24 }),
              new TextRun({ text: `${averages.systolic}/${averages.diastolic} mmHg`, bold: true, size: 28 }),
            ],
            spacing: { after: 100 },
          }),

          // Number of readings
          new Paragraph({
            children: [
              new TextRun({ text: "Number of Readings: ", size: 22 }),
              new TextRun({ text: String(includedReadings.length), bold: true, size: 22 }),
            ],
            spacing: { after: 100 },
          }),

          // Category if present
          ...(category ? [
            new Paragraph({
              children: [
                new TextRun({ text: "NHS Category: ", size: 22 }),
                new TextRun({ text: category.label, bold: true, size: 22 }),
              ],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [new TextRun({ text: category.description, size: 20, italics: true, color: "666666" })],
              spacing: { after: 100 },
            }),
          ] : []),

          // Ranges
          new Paragraph({
            children: [
              new TextRun({ text: "Systolic Range: ", size: 22 }),
              new TextRun({ text: `${averages.systolicMin} – ${averages.systolicMax} mmHg`, size: 22 }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Diastolic Range: ", size: 22 }),
              new TextRun({ text: `${averages.diastolicMin} – ${averages.diastolicMax} mmHg`, size: 22 }),
            ],
            spacing: { after: 50 },
          }),

          // Pulse if present
          ...(averages.pulse ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Average Pulse: ", size: 22 }),
                new TextRun({ text: `${averages.pulse} bpm`, size: 22 }),
              ],
              spacing: { after: 100 },
            }),
          ] : []),

          // Readings section
          new Paragraph({
            children: [new TextRun({ text: "Individual Readings", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),

          // Readings table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),

          // Excluded readings section (if any)
          ...(excludedReadings.length > 0 ? [
            new Paragraph({
              children: [new TextRun({ text: "Excluded Readings", bold: true, size: 28, color: "DC2626" })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "The following readings were excluded from the average calculation:", size: 20, italics: true, color: "666666" })],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "DC2626" }, width: { size: 8, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Systolic", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "DC2626" }, width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Diastolic", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "DC2626" }, width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date/Time", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "DC2626" }, width: { size: 22, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Reason Excluded", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "DC2626" }, width: { size: 40, type: WidthType.PERCENTAGE } }),
                  ],
                }),
                ...excludedReadings.map((r, i) => 
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 22 })] })], borders: tableBorder }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.systolic), size: 22 })] })], borders: tableBorder }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.diastolic), size: 22 })] })], borders: tableBorder }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${r.date || "-"} ${r.time || ""}`.trim(), size: 22 })] })], borders: tableBorder }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.excludeReason || "Manually excluded", size: 22, color: "DC2626" })] })], borders: tableBorder }),
                    ],
                  })
                ),
              ],
            }),
          ] : []),

          // Footer
          new Paragraph({
            children: [new TextRun({ text: "Report generated by Notewell AI BP Average Service", size: 18, color: "999999" })],
            spacing: { before: 400 },
            alignment: AlignmentType.CENTER,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bp-report-${new Date().toISOString().split('T')[0]}.docx`);
    toast.success('Word report downloaded');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Export Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button onClick={copyToClipboard} variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy to Clipboard
          </Button>
          <Button onClick={downloadCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button onClick={downloadWordReport} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Download Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};