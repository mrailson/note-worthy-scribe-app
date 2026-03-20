import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel, PageNumber } from 'docx';
import { saveAs } from 'file-saver';

interface QcCategory {
  status: 'pass' | 'fail';
  findings: string;
}

interface QcResult {
  status: 'passed' | 'failed' | 'error';
  score?: number;
  failed_count?: number;
  error_message?: string;
  categories?: Record<string, QcCategory>;
  summary?: string;
  model_used?: string;
  ran_at?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  fabricated_decisions: 'Decision Accuracy',
  fabricated_actions: 'Action Traceability',
  missing_speakers: 'Speaker Attribution',
  currency_detection: 'Currency Detection',
  attendee_gaps: 'Attendee Completeness',
  prompt_leak: 'Prompt Leak Check',
  tone_escalation: 'Tone Fidelity',
};

const CATEGORY_ORDER = [
  'fabricated_decisions',
  'fabricated_actions',
  'missing_speakers',
  'currency_detection',
  'attendee_gaps',
  'prompt_leak',
  'tone_escalation',
];

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

export async function downloadQcReport(qc: QcResult, meetingTitle?: string) {
  const title = meetingTitle || 'Meeting';
  const ranAt = qc.ran_at
    ? new Date(qc.ran_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown';

  const children: any[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Quality Audit Report', bold: true, size: 36, font: 'Arial' })],
      spacing: { after: 120 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Meeting: ', bold: true, size: 24, font: 'Arial' }),
        new TextRun({ text: title, size: 24, font: 'Arial' }),
      ],
      spacing: { after: 60 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Audit date: ${ranAt}`, size: 20, font: 'Arial', color: '666666' }),
        new TextRun({ text: `  \u00b7  Model: ${qc.model_used || 'Unknown'}`, size: 20, font: 'Arial', color: '666666' }),
      ],
      spacing: { after: 200 },
    })
  );

  const statusText = qc.status === 'passed' ? 'PASSED' : qc.status === 'failed' ? 'FAILED' : 'ERROR';
  const statusColour = qc.status === 'passed' ? '16A34A' : qc.status === 'failed' ? 'DC2626' : 'D97706';

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall: ', bold: true, size: 24, font: 'Arial' }),
        new TextRun({ text: statusText, bold: true, size: 24, font: 'Arial', color: statusColour }),
        ...(qc.score != null
          ? [new TextRun({ text: `  (Score: ${qc.score}/100)`, size: 24, font: 'Arial' })]
          : []),
        ...(qc.failed_count != null
          ? [new TextRun({ text: `  \u00b7  ${qc.failed_count} ${qc.failed_count === 1 ? 'category' : 'categories'} failed`, size: 24, font: 'Arial', color: 'DC2626' })]
          : []),
      ],
      spacing: { after: 120 },
    })
  );

  if (qc.summary) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: qc.summary, size: 22, font: 'Arial', italics: true, color: '555555' })],
        spacing: { after: 240 },
      })
    );
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Category Results', bold: true, size: 28, font: 'Arial' })],
      spacing: { before: 200, after: 160 },
    })
  );

  if (qc.categories) {
    const headerRow = new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 3200, type: WidthType.DXA },
          shading: { fill: '1E3A5F', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true, size: 20, font: 'Arial', color: 'FFFFFF' })] })],
        }),
        new TableCell({
          borders: cellBorders,
          width: { size: 1200, type: WidthType.DXA },
          shading: { fill: '1E3A5F', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Status', bold: true, size: 20, font: 'Arial', color: 'FFFFFF' })] })],
        }),
        new TableCell({
          borders: cellBorders,
          width: { size: 4960, type: WidthType.DXA },
          shading: { fill: '1E3A5F', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Findings', bold: true, size: 20, font: 'Arial', color: 'FFFFFF' })] })],
        }),
      ],
    });

    const dataRows = CATEGORY_ORDER.map((key, idx) => {
      const cat = qc.categories![key as keyof typeof qc.categories];
      if (!cat) return null;
      const passed = cat.status === 'pass';
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F5F5F5';

      return new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            width: { size: 3200, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: CATEGORY_LABELS[key] || key, size: 20, font: 'Arial', bold: true })] })],
          }),
          new TableCell({
            borders: cellBorders,
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: passed ? 'PASS' : 'FAIL', bold: true, size: 20, font: 'Arial', color: passed ? '16A34A' : 'DC2626' })] })],
          }),
          new TableCell({
            borders: cellBorders,
            width: { size: 4960, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: cat.findings || 'No issues identified.', size: 18, font: 'Arial' })] })],
          }),
        ],
      });
    }).filter(Boolean) as TableRow[];

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3200, 1200, 4960],
        rows: [headerRow, ...dataRows],
      })
    );
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'This quality audit is advisory. The findings highlight potential discrepancies between the source transcript and the generated notes. Users should review flagged items and apply corrections at their discretion.', size: 18, font: 'Arial', italics: true, color: '888888' })],
      spacing: { before: 360, after: 120 },
    })
  );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 24 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: 'Notewell AI \u2014 Quality Audit Report', size: 16, font: 'Arial', color: '999999' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Page ', size: 16, font: 'Arial', color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '999999' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const safeName = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
  saveAs(buffer, `QC-Report-${safeName}.docx`);
}