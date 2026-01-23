import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Download, FileText, Mail, Loader2 } from 'lucide-react';
import { BPReading } from '@/hooks/useBPCalculator';
import { 
  BPAverages, 
  NHSCategory, 
  NICEHomeBPAverage, 
  BPTrends, 
  DataQuality, 
  DateRange, 
  QOFRelevance,
  SitStandAverages,
  getTargetBP
} from '@/utils/bpCalculations';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BPExportOptionsProps {
  readings: BPReading[];
  averages: BPAverages | null;
  category: NHSCategory | null;
  niceAverage: NICEHomeBPAverage;
  niceCategory: NHSCategory | null;
  trends: BPTrends;
  dataQuality: DataQuality;
  dateRange: DateRange;
  qofRelevance: QOFRelevance;
  originalText?: string;
  originalImages?: File[];
  sitStandAverages?: SitStandAverages;
}

export const BPExportOptions = ({ 
  readings, 
  averages, 
  category, 
  niceAverage,
  niceCategory,
  trends,
  dataQuality,
  dateRange,
  qofRelevance,
  originalText, 
  originalImages,
  sitStandAverages
}: BPExportOptionsProps) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const includedReadings = readings.filter(r => r.included);
  const excludedReadings = readings.filter(r => !r.included);
  
  // Calculate diary entry count for sit/stand mode
  const isSitStandMode = sitStandAverages && (sitStandAverages.sittingCount > 0 || sitStandAverages.standingCount > 0);
  const diaryEntryCount = sitStandAverages?.diaryEntryCount || 0;

  const copyToClipboard = async () => {
    if (!averages) return;

    const countText = isSitStandMode 
      ? `${includedReadings.length} readings (${diaryEntryCount} diary entries × 2 positions)`
      : `${includedReadings.length} readings`;

    const text = `Average BP: ${averages.systolic}/${averages.diastolic} mmHg (${countText})
Range: ${averages.systolicMin}-${averages.systolicMax} / ${averages.diastolicMin}-${averages.diastolicMax}
${averages.pulse ? `Average Pulse: ${averages.pulse} bpm` : ''}
${category ? `Category: ${category.label}` : ''}

Individual Readings:
${includedReadings.map((r, i) => `${i + 1}. ${r.systolic}/${r.diastolic}${r.pulse ? `/${r.pulse}` : ''}${r.date ? ` (${r.date})` : ''}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
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
  };

  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const summaryBoxBorder = {
    top: { style: BorderStyle.SINGLE, size: 12, color: "DBEAFE" },
    bottom: { style: BorderStyle.SINGLE, size: 12, color: "DBEAFE" },
    left: { style: BorderStyle.SINGLE, size: 12, color: "DBEAFE" },
    right: { style: BorderStyle.SINGLE, size: 12, color: "DBEAFE" },
  };

  const createWordDocument = async () => {
    if (!averages) return null;

    const targets = getTargetBP();

    // Calculate pulse range if readings have pulse data
    const pulsesWithData = includedReadings.filter(r => r.pulse);
    const pulseMin = pulsesWithData.length > 0 ? Math.min(...pulsesWithData.map(r => r.pulse!)) : null;
    const pulseMax = pulsesWithData.length > 0 ? Math.max(...pulsesWithData.map(r => r.pulse!)) : null;

    // Create readings table rows
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true, size: 22, color: "FFFFFF" })] })], borders: tableBorder, shading: { fill: "2563EB" }, width: { size: 8, type: WidthType.PERCENTAGE } }),
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

    // Create summary box table (4 columns like the screen view)
    const summaryTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "📊 Average BP", size: 18, color: "6B7280" })], spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: `${averages.systolic}/${averages.diastolic}`, bold: true, size: 36, color: "1F2937" })], spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "mmHg", size: 18, color: "6B7280" })] }),
              ],
              borders: summaryBoxBorder,
              shading: { fill: "F0F9FF" },
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "📈 Systolic Range", size: 18, color: "6B7280" })], spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: `${averages.systolicMin} – ${averages.systolicMax}`, bold: true, size: 28, color: "1F2937" })], spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "Min – Max", size: 18, color: "6B7280" })] }),
              ],
              borders: summaryBoxBorder,
              shading: { fill: "F0F9FF" },
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "📉 Diastolic Range", size: 18, color: "6B7280" })], spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: `${averages.diastolicMin} – ${averages.diastolicMax}`, bold: true, size: 28, color: "1F2937" })], spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: "Min – Max", size: 18, color: "6B7280" })] }),
              ],
              borders: summaryBoxBorder,
              shading: { fill: "F0F9FF" },
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "💓 Avg Pulse", size: 18, color: "6B7280" })], spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: averages.pulse ? String(averages.pulse) : "-", bold: true, size: 36, color: "1F2937" })], spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: pulseMin && pulseMax ? `${pulseMin} – ${pulseMax} bpm` : "bpm", size: 18, color: "6B7280" })] }),
              ],
              borders: summaryBoxBorder,
              shading: { fill: "F0F9FF" },
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    });

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

          // 📊 Average BP (All Valid Readings)
          new Paragraph({
            children: [new TextRun({ text: "📊 Average BP (All Valid Readings)", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          summaryTable,
          new Paragraph({
            children: [new TextRun({ 
              text: isSitStandMode 
                ? `Based on ${includedReadings.length} readings (${diaryEntryCount} diary entries × 2 positions)`
                : `Based on ${includedReadings.length} readings`, 
              size: 18, 
              color: "9CA3AF" 
            })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 80, after: 200 },
          }),

          // 🏠 NICE Home BP Average (NG136)
          new Paragraph({
            children: [new TextRun({ text: "🏠 NICE Home BP Average (NG136)", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: niceAverage.isValid && niceAverage.systolic && niceAverage.diastolic
              ? [new TextRun({ text: `${niceAverage.systolic}/${niceAverage.diastolic} mmHg`, bold: true, size: 28, color: "1F2937" })]
              : [new TextRun({ text: "Not available", size: 22, color: "6B7280", italics: true })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: niceAverage.message, size: 20, color: "6B7280", italics: true })],
            spacing: { after: 200 },
          }),


          // 🎯 Target Blood Pressure
          new Paragraph({
            children: [new TextRun({ text: "🎯 Target Blood Pressure", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Clinic target: ", size: 20, color: "6B7280" }),
              new TextRun({ text: targets.clinic.general, bold: true, size: 20, color: "1F2937" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Home target: ", size: 20, color: "6B7280" }),
              new TextRun({ text: targets.home.general, bold: true, size: 20, color: "1F2937" }),
            ],
            spacing: { after: 200 },
          }),

          // 📈 Trends
          new Paragraph({
            children: [new TextRun({ text: "📈 Trends", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Systolic trend: ", size: 20, color: "6B7280" }),
              new TextRun({ text: trends.systolicTrend, size: 20, color: "1F2937" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Diastolic trend: ", size: 20, color: "6B7280" }),
              new TextRun({ text: trends.diastolicTrend, size: 20, color: "1F2937" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Pulse trend: ", size: 20, color: "6B7280" }),
              new TextRun({ text: trends.pulseTrend, size: 20, color: "1F2937" }),
            ],
            spacing: { after: 150 },
          }),
          ...(trends.patternFlags.length > 0 ? [
            new Paragraph({
              children: [new TextRun({ text: "Pattern flags:", bold: true, size: 20, color: "B45309" })],
              spacing: { after: 100 },
            }),
            ...trends.patternFlags.map(flag => new Paragraph({
              children: [new TextRun({ text: `⚠️ ${flag}`, size: 20, color: "B45309" })],
              spacing: { after: 50 },
            })),
          ] : []),

          // 📋 Data Quality Score
          new Paragraph({
            children: [new TextRun({ text: `📋 Data Quality Score: ${dataQuality.score}/5`, bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: dataQuality.rating, bold: true, size: 24, color: dataQuality.rating === 'Excellent' ? "16A34A" : dataQuality.rating === 'Good' ? "2563EB" : dataQuality.rating === 'Fair' ? "CA8A04" : "DC2626" })],
            spacing: { after: 100 },
          }),
          ...dataQuality.reasons.map(reason => new Paragraph({
            children: [new TextRun({ text: `• ${reason}`, size: 20, color: "6B7280" })],
            spacing: { after: 50 },
          })),

          // QOF Relevance
          new Paragraph({
            children: [new TextRun({ text: "QOF Relevance", bold: true, size: 24, color: "1F2937" })],
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Meets monitoring requirement: ", size: 20, color: "6B7280" }),
              new TextRun({ text: qofRelevance.meetsBPMonitoring ? "Yes" : "No", bold: true, size: 20, color: qofRelevance.meetsBPMonitoring ? "16A34A" : "DC2626" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Suitable for annual review: ", size: 20, color: "6B7280" }),
              new TextRun({ text: qofRelevance.suitableForAnnualReview ? "Yes" : "No", bold: true, size: 20, color: qofRelevance.suitableForAnnualReview ? "16A34A" : "DC2626" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Monitor validation: ", size: 20, color: "6B7280" }),
              new TextRun({ text: qofRelevance.monitorValidation, size: 20, color: "6B7280" }),
            ],
            spacing: { after: 200 },
          }),

          // 📅 Reading Summary
          new Paragraph({
            children: [new TextRun({ text: "📅 Reading Summary", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total readings: ", size: 20, color: "6B7280" }),
              new TextRun({ 
                text: isSitStandMode 
                  ? `${readings.length} (${diaryEntryCount} diary entries × 2 positions)`
                  : String(readings.length), 
                bold: true, 
                size: 20, 
                color: "1F2937" 
              }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Included: ", size: 20, color: "6B7280" }),
              new TextRun({ text: String(includedReadings.length), bold: true, size: 20, color: "16A34A" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Excluded: ", size: 20, color: "6B7280" }),
              new TextRun({ text: String(excludedReadings.length), bold: true, size: 20, color: excludedReadings.length > 0 ? "DC2626" : "6B7280" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Date range: ", size: 20, color: "6B7280" }),
              new TextRun({ text: dateRange.start && dateRange.end ? `${dateRange.start} → ${dateRange.end}` : "Unknown", size: 20, color: "1F2937" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Source: ", size: 20, color: "6B7280" }),
              new TextRun({ text: "Home BP diary (extracted text/image)", size: 20, color: "1F2937" }),
            ],
            spacing: { after: 200 },
          }),

          // 📄 Individual Readings
          new Paragraph({
            children: [new TextRun({ text: "📄 Individual Readings", bold: true, size: 28, color: "2563EB" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),

          // 🚫 Excluded Readings
          ...(excludedReadings.length > 0 ? [
            new Paragraph({
              children: [new TextRun({ text: "🚫 Excluded Readings & Reasons", bold: true, size: 28, color: "DC2626" })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
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

          // ⚠️ AI Disclaimer
          new Paragraph({
            children: [new TextRun({ text: "⚠️ AI Disclaimer", bold: true, size: 22, color: "B45309" })],
            spacing: { before: 400, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "This report was generated by AI and may contain errors. All results should be checked by a clinician before use in patient care. No clinical decisions should be made without appropriate review.", size: 20, italics: true, color: "92400E" })],
            spacing: { after: 200 },
          }),

          // Footer
          new Paragraph({
            children: [new TextRun({ text: "Report generated by Notewell AI BP Average Service", size: 18, color: "999999" })],
            spacing: { before: 200 },
            alignment: AlignmentType.CENTER,
          }),
        ],
      }],
    });

    return doc;
  };

  const downloadWordReport = async () => {
    const doc = await createWordDocument();
    if (!doc) return;

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bp-report-${new Date().toISOString().split('T')[0]}.docx`);
  };

  // Helper function to convert ArrayBuffer to base64 without stack overflow
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const sendEmailReport = async (targetEmail: string) => {
    if (!averages || !targetEmail) {
      return;
    }

    setIsSendingEmail(true);

    try {
      // Create Word document and convert to base64
      const doc = await createWordDocument();
      if (!doc) {
        throw new Error('Failed to create document');
      }
      const docBlob = await Packer.toBlob(doc);
      const docArrayBuffer = await docBlob.arrayBuffer();
      const docBase64 = arrayBufferToBase64(docArrayBuffer);

      // Convert all files to base64 for attachments
      const fileAttachments: { filename: string; content: string; type: string }[] = [];
      if (originalImages && originalImages.length > 0) {
        for (const file of originalImages) {
          const fileArrayBuffer = await file.arrayBuffer();
          const fileBase64 = arrayBufferToBase64(fileArrayBuffer);
          fileAttachments.push({
            filename: file.name,
            content: fileBase64,
            type: file.type || 'application/octet-stream'
          });
        }
      }

      const targets = getTargetBP();

      // Build HTML email content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .header { background: #2563EB; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; max-width: 800px; margin: 0 auto; }
            .section { margin: 20px 0; }
            .section-title { color: #2563EB; font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #DBEAFE; padding-bottom: 5px; }
            .summary-box { background: #F0F9FF; border: 2px solid #BAE6FD; border-radius: 8px; padding: 20px; margin: 15px 0; }
            .summary-grid { display: flex; flex-wrap: wrap; gap: 20px; }
            .summary-item { flex: 1; min-width: 150px; text-align: center; }
            .summary-label { font-size: 12px; color: #6B7280; margin-bottom: 5px; }
            .summary-value { font-size: 24px; font-weight: bold; color: #1F2937; }
            .summary-sublabel { font-size: 11px; color: #9CA3AF; }
            .nice-box { background: #EFF6FF; border: 2px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 15px 0; }
            .category-badge { padding: 6px 12px; border-radius: 4px; display: inline-block; font-weight: bold; margin: 5px 0; }
            .category-green { background: #D1FAE5; color: #065F46; }
            .category-orange { background: #FED7AA; color: #C2410C; }
            .category-red { background: #FECACA; color: #DC2626; }
            .target-box { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .trend-box { background: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 8px; padding: 15px; margin: 15px 0; font-family: monospace; }
            .quality-box { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .quality-excellent { color: #065F46; }
            .quality-good { color: #2563EB; }
            .quality-fair { color: #CA8A04; }
            .quality-poor { color: #DC2626; }
            .qof-box { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .warning-flag { background: #FEF3C7; color: #B45309; padding: 4px 8px; border-radius: 4px; margin: 2px 0; display: inline-block; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #2563EB; color: white; padding: 10px; text-align: left; }
            td { border: 1px solid #E5E7EB; padding: 8px; }
            .excluded th { background: #DC2626; }
            .disclaimer { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .disclaimer-title { color: #B45309; font-weight: bold; }
            .footer { text-align: center; color: #9CA3AF; font-size: 12px; padding: 20px; border-top: 1px solid #E5E7EB; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Blood Pressure Average Report</h1>
            <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
          </div>
          
          <div class="content">
            <!-- Average BP (All Valid Readings) -->
            <div class="section">
              <div class="section-title">📊 Average BP (All Valid Readings)</div>
              <div class="summary-box">
                <div class="summary-grid">
                  <div class="summary-item">
                    <div class="summary-label">Average BP</div>
                    <div class="summary-value">${averages.systolic}/${averages.diastolic}</div>
                    <div class="summary-sublabel">mmHg</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Systolic Range</div>
                    <div class="summary-value" style="font-size: 18px;">${averages.systolicMin} – ${averages.systolicMax}</div>
                    <div class="summary-sublabel">Min – Max</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Diastolic Range</div>
                    <div class="summary-value" style="font-size: 18px;">${averages.diastolicMin} – ${averages.diastolicMax}</div>
                    <div class="summary-sublabel">Min – Max</div>
                  </div>
                  ${averages.pulse ? `
                  <div class="summary-item">
                    <div class="summary-label">Avg Pulse</div>
                    <div class="summary-value">${averages.pulse}</div>
                    <div class="summary-sublabel">bpm</div>
                  </div>
                  ` : ''}
                </div>
                <div style="text-align: right; color: #9CA3AF; font-size: 12px;">Based on ${includedReadings.length} readings${isSitStandMode ? ` (${diaryEntryCount} diary entries × 2 positions)` : ''}</div>
              </div>
            </div>

            <!-- NICE Home BP Average -->
            <div class="section">
              <div class="section-title">🏠 NICE Home BP Average (NG136)</div>
              <div class="nice-box">
                ${niceAverage.isValid && niceAverage.systolic && niceAverage.diastolic ? `
                  <div style="font-size: 28px; font-weight: bold; color: #1F2937;">${niceAverage.systolic}/${niceAverage.diastolic} mmHg</div>
                ` : `
                  <div style="color: #6B7280; font-style: italic;">Not available</div>
                `}
                <div style="color: #6B7280; font-style: italic; margin-top: 5px;">${niceAverage.message}</div>
              </div>
            </div>

            <!-- Target BP -->
            <div class="section">
              <div class="section-title">🎯 Target Blood Pressure</div>
              <div class="target-box">
                <p><strong>Clinic target:</strong> ${targets.clinic.general}</p>
                <p><strong>Home target:</strong> ${targets.home.general}</p>
              </div>
            </div>

            <!-- Trends -->
            <div class="section">
              <div class="section-title">📈 Trends</div>
              <div class="trend-box">
                <p><strong>Systolic trend:</strong> ${trends.systolicTrend}</p>
                <p><strong>Diastolic trend:</strong> ${trends.diastolicTrend}</p>
                <p><strong>Pulse trend:</strong> ${trends.pulseTrend}</p>
                ${trends.patternFlags.length > 0 ? `
                  <div style="margin-top: 10px;">
                    <strong>Pattern flags:</strong><br>
                    ${trends.patternFlags.map(f => `<span class="warning-flag">⚠️ ${f}</span>`).join('<br>')}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Data Quality Score -->
            <div class="section">
              <div class="section-title">📋 Data Quality Score: ${dataQuality.score}/5</div>
              <div class="quality-box">
                <div class="quality-${dataQuality.rating.toLowerCase()}" style="font-size: 18px; font-weight: bold;">${dataQuality.rating}</div>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  ${dataQuality.reasons.map(r => `<li style="color: #6B7280;">${r}</li>`).join('')}
                </ul>
              </div>
            </div>

            <!-- QOF Relevance -->
            <div class="section">
              <div class="section-title">QOF Relevance</div>
              <div class="qof-box">
                <p><strong>Meets monitoring requirement:</strong> <span style="color: ${qofRelevance.meetsBPMonitoring ? '#065F46' : '#DC2626'};">${qofRelevance.meetsBPMonitoring ? 'Yes' : 'No'}</span></p>
                <p><strong>Suitable for annual review:</strong> <span style="color: ${qofRelevance.suitableForAnnualReview ? '#065F46' : '#DC2626'};">${qofRelevance.suitableForAnnualReview ? 'Yes' : 'No'}</span></p>
                <p><strong>Monitor validation:</strong> ${qofRelevance.monitorValidation}</p>
              </div>
            </div>

            <!-- Reading Summary -->
            <div class="section">
              <div class="section-title">📅 Reading Summary</div>
              <div class="target-box">
                <p><strong>Total readings:</strong> ${readings.length}${isSitStandMode ? ` (${diaryEntryCount} diary entries × 2 positions)` : ''}</p>
                <p><strong>Included:</strong> <span style="color: #065F46;">${includedReadings.length}</span></p>
                ${excludedReadings.length > 0 ? `<p><strong>Excluded:</strong> <span style="color: #DC2626;">${excludedReadings.length}</span></p>` : ''}
                <p><strong>Date range:</strong> ${dateRange.start && dateRange.end ? `${dateRange.start} → ${dateRange.end}` : 'Unknown'}</p>
                <p><strong>Source:</strong> Home BP diary (extracted text/image)</p>
              </div>
            </div>

            <!-- Individual Readings -->
            <div class="section">
              <div class="section-title">📄 Individual Readings</div>
              <table>
                <tr>
                  <th>#</th>
                  <th>Systolic</th>
                  <th>Diastolic</th>
                  <th>Pulse</th>
                  <th>Date</th>
                  <th>Time</th>
                </tr>
                ${includedReadings.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${r.systolic}</td>
                    <td>${r.diastolic}</td>
                    <td>${r.pulse || '-'}</td>
                    <td>${r.date || '-'}</td>
                    <td>${r.time || '-'}</td>
                  </tr>
                `).join('')}
              </table>
            </div>

            ${excludedReadings.length > 0 ? `
            <!-- Excluded Readings -->
            <div class="section">
              <div class="section-title" style="color: #DC2626;">🚫 Excluded Readings & Reasons</div>
              <table class="excluded">
                <tr>
                  <th>#</th>
                  <th>Systolic</th>
                  <th>Diastolic</th>
                  <th>Date/Time</th>
                  <th>Reason</th>
                </tr>
                ${excludedReadings.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${r.systolic}</td>
                    <td>${r.diastolic}</td>
                    <td>${r.date || '-'} ${r.time || ''}</td>
                    <td style="color: #DC2626;">${r.excludeReason || 'Manually excluded'}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
            ` : ''}

            <div class="disclaimer">
              <p class="disclaimer-title">⚠️ AI Disclaimer</p>
              <p>This report was generated by AI and may contain errors. All results should be checked by a clinician before use in patient care. No clinical decisions should be made without appropriate review.</p>
            </div>
          </div>

          <div class="footer">
            <p>Report generated by Notewell AI BP Average Service</p>
          </div>
        </body>
        </html>
      `;

      // Build attachments array - Word doc + all original files
      const attachments = [
        {
          filename: `bp-report-${new Date().toISOString().split('T')[0]}.docx`,
          content: docBase64,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        ...fileAttachments
      ];

      // Send email - BCC admin for bp@nhs.net reports
      const bccEmail = targetEmail.toLowerCase().includes('bp@nhs.net') 
        ? 'malcolm.railson@nhs.net' 
        : undefined;
      
      const { data, error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: targetEmail,
          subject: `BP Average Report - ${averages.systolic}/${averages.diastolic} mmHg - ${new Date().toLocaleDateString('en-GB')}`,
          html_content: htmlContent,
          attachments,
          bcc_email: bccEmail
        }
      });

      if (error) throw error;
      
      toast({
        title: "Email sent",
        description: `Report sent to ${targetEmail}`,
      });
      setShowEmailDialog(false);
      setEmailAddress('');
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to send email",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEmailButtonClick = () => {
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    await sendEmailReport(emailAddress.trim());
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
          <Button onClick={handleEmailButtonClick} variant="outline" disabled={isSendingEmail}>
            {isSendingEmail ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Email Report
          </Button>
        </div>

        {/* Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send BP Report</DialogTitle>
              <DialogDescription>
                Enter the email address to send the report to
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                {isSendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};