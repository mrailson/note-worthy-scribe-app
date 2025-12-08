import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, FileText, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BPReading } from '@/hooks/useBPCalculator';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';

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
  originalText?: string;
  originalImage?: File | null;
  userEmail?: string;
}

export const BPExportOptions = ({ readings, averages, category, originalText, originalImage, userEmail }: BPExportOptionsProps) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
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

    // Calculate pulse range if readings have pulse data
    const pulsesWithData = includedReadings.filter(r => r.pulse);
    const pulseMin = pulsesWithData.length > 0 ? Math.min(...pulsesWithData.map(r => r.pulse!)) : null;
    const pulseMax = pulsesWithData.length > 0 ? Math.max(...pulsesWithData.map(r => r.pulse!)) : null;

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

    // Create summary box table (4 columns like the screen view)
    const summaryTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            // Average BP column
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
            // Systolic Range column
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
            // Diastolic Range column
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
            // Average Pulse column
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

    // Category row table
    const categoryTable = category ? new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: category.label, bold: true, size: 22, color: category.color === 'green' ? "16A34A" : category.color === 'yellow' ? "CA8A04" : category.color === 'orange' ? "EA580C" : "DC2626" }),
                    new TextRun({ text: `   ${category.description}`, size: 20, color: "6B7280" }),
                  ],
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Based on ${includedReadings.length} readings`, size: 18, color: "9CA3AF" })],
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 80 },
                }),
              ],
              borders: summaryBoxBorder,
              shading: { fill: "F9FAFB" },
            }),
          ],
        }),
      ],
    }) : null;

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

          // Summary box table
          summaryTable,

          // Category row (if present)
          ...(categoryTable ? [
            new Paragraph({ children: [], spacing: { after: 100 } }),
            categoryTable,
          ] : []),

          new Paragraph({ children: [], spacing: { after: 300 } }),

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

          // Disclaimer
          new Paragraph({
            children: [new TextRun({ text: "⚠️ AI Disclaimer", bold: true, size: 22, color: "B45309" })],
            spacing: { before: 400, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "This report was produced by AI which can make mistakes. Verification and audit of the results is advised before clinical use.", size: 20, italics: true, color: "92400E" })],
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
    toast.success('Word report downloaded');
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

  const sendEmailReport = async () => {
    if (!averages || !userEmail) {
      toast.error('Unable to send email - missing data or email address');
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

      // Convert image to base64 if present
      let imageBase64 = '';
      let imageName = '';
      if (originalImage) {
        const imageArrayBuffer = await originalImage.arrayBuffer();
        imageBase64 = arrayBufferToBase64(imageArrayBuffer);
        imageName = originalImage.name;
      }

      // Build HTML email content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #2563EB; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .summary-box { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .average { font-size: 24px; font-weight: bold; color: #2563EB; }
            .category { background: #DBEAFE; padding: 8px 12px; border-radius: 4px; display: inline-block; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #2563EB; color: white; padding: 10px; text-align: left; }
            td { border: 1px solid #E5E7EB; padding: 8px; }
            .excluded th { background: #DC2626; }
            .original-input { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 15px; margin: 15px 0; }
            .disclaimer { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .disclaimer-title { color: #B45309; font-weight: bold; }
            .footer { text-align: center; color: #9CA3AF; font-size: 12px; padding: 20px; border-top: 1px solid #E5E7EB; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Blood Pressure Average Report</h1>
            <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
          </div>
          
          <div class="content">
            <div class="summary-box">
              <p class="average">Average: ${averages.systolic}/${averages.diastolic} mmHg</p>
              <p><strong>Readings:</strong> ${includedReadings.length} included${excludedReadings.length > 0 ? `, ${excludedReadings.length} excluded` : ''}</p>
              ${category ? `<div class="category"><strong>NHS Category:</strong> ${category.label}</div><p>${category.description}</p>` : ''}
              <p><strong>Systolic Range:</strong> ${averages.systolicMin} – ${averages.systolicMax} mmHg</p>
              <p><strong>Diastolic Range:</strong> ${averages.diastolicMin} – ${averages.diastolicMax} mmHg</p>
              ${averages.pulse ? `<p><strong>Average Pulse:</strong> ${averages.pulse} bpm</p>` : ''}
            </div>

            <h2>Included Readings</h2>
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

            ${excludedReadings.length > 0 ? `
              <h2 style="color: #DC2626;">Excluded Readings</h2>
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
            ` : ''}

            ${originalText ? `
              <div class="original-input">
                <h3>Original Input Text</h3>
                <pre style="white-space: pre-wrap; font-family: inherit;">${originalText}</pre>
              </div>
            ` : ''}

            ${originalImage ? `
              <div class="original-input">
                <h3>Original Image</h3>
                <p><em>Image attached: ${originalImage.name}</em></p>
              </div>
            ` : ''}

            <div class="disclaimer">
              <p class="disclaimer-title">⚠️ AI Disclaimer</p>
              <p>This report was produced by AI which can make mistakes. Verification and audit of the results is advised before clinical use.</p>
            </div>
          </div>

          <div class="footer">
            <p>Report generated by Notewell AI BP Average Service</p>
          </div>
        </body>
        </html>
      `;

      // Build attachments array
      const attachments = [
        {
          filename: `bp-report-${new Date().toISOString().split('T')[0]}.docx`,
          content: docBase64,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      ];

      if (imageBase64 && imageName) {
        attachments.push({
          filename: imageName,
          content: imageBase64,
          type: originalImage?.type || 'image/png'
        });
      }

      // Send email
      const { data, error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: userEmail,
          subject: `BP Average Report - ${averages.systolic}/${averages.diastolic} mmHg - ${new Date().toLocaleDateString('en-GB')}`,
          html_content: htmlContent,
          attachments
        }
      });

      if (error) throw error;

      toast.success('Email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
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
          <Button onClick={sendEmailReport} variant="outline" disabled={isSendingEmail || !userEmail}>
            {isSendingEmail ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Email Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};