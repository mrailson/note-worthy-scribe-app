import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface AIReportData {
  complaintOverview: string;
  timelineCompliance: {
    acknowledged: {
      date: string;
      status: 'on-time' | 'late' | 'pending';
      daysFromReceived: number;
    };
    outcome: {
      date: string;
      status: 'on-time' | 'late' | 'pending';
      daysFromReceived: number;
    };
  };
  keyLearnings: Array<{
    learning: string;
    category: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  practiceStrengths: string[];
  improvementSuggestions: Array<{
    suggestion: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  outcomeRationale: string;
}

export async function downloadComplaintReport(
  reportData: AIReportData,
  complaint: any
): Promise<void> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: 'Complaint Review Report',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 },
          alignment: AlignmentType.CENTER,
        }),
        
        // Reference
        new Paragraph({
          children: [
            new TextRun({
              text: `Reference: ${complaint.reference_number}`,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 200 },
          alignment: AlignmentType.CENTER,
        }),

        // Generated date
        new Paragraph({
          text: `Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}`,
          spacing: { after: 400 },
          alignment: AlignmentType.CENTER,
        }),

        // Overview Section
        new Paragraph({
          text: 'Complaint Overview',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: reportData.complaintOverview,
          spacing: { after: 400 },
        }),

        // Timeline Compliance
        new Paragraph({
          text: 'Timeline & Compliance',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),

        // Timeline table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Milestone', bold: true })] })],
                  shading: { fill: 'E5E7EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })],
                  shading: { fill: 'E5E7EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Days from Receipt', bold: true })] })],
                  shading: { fill: 'E5E7EB' },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
                  shading: { fill: 'E5E7EB' },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Acknowledgement')] }),
                new TableCell({ 
                  children: [new Paragraph(
                    reportData.timelineCompliance.acknowledged.date 
                      ? format(new Date(reportData.timelineCompliance.acknowledged.date), 'dd MMM yyyy')
                      : 'Not yet acknowledged'
                  )] 
                }),
                new TableCell({ 
                  children: [new Paragraph(String(reportData.timelineCompliance.acknowledged.daysFromReceived))] 
                }),
                new TableCell({ 
                  children: [new Paragraph(
                    reportData.timelineCompliance.acknowledged.status === 'on-time' 
                      ? '✓ On time' 
                      : '⚠ Late'
                  )] 
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Outcome Letter')] }),
                new TableCell({ 
                  children: [new Paragraph(
                    reportData.timelineCompliance.outcome.date 
                      ? format(new Date(reportData.timelineCompliance.outcome.date), 'dd MMM yyyy')
                      : 'Not yet completed'
                  )] 
                }),
                new TableCell({ 
                  children: [new Paragraph(String(reportData.timelineCompliance.outcome.daysFromReceived))] 
                }),
                new TableCell({ 
                  children: [new Paragraph(
                    reportData.timelineCompliance.outcome.status === 'on-time' 
                      ? '✓ On time' 
                      : reportData.timelineCompliance.outcome.status === 'late'
                      ? '⚠ Late'
                      : '⏳ In progress'
                  )] 
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '', spacing: { after: 400 } }),

        // Key Learnings
        new Paragraph({
          text: 'Key Learnings Identified',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...reportData.keyLearnings.flatMap((learning, index) => [
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. `,
                bold: true,
              }),
              new TextRun({
                text: learning.learning,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `   Category: ${learning.category} | Impact: ${learning.impact}`,
                italics: true,
              }),
            ],
            spacing: { after: 200 },
          }),
        ]),

        // Practice Strengths
        new Paragraph({
          text: 'What the Practice Did Well',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...reportData.practiceStrengths.map(strength => 
          new Paragraph({
            children: [new TextRun({ text: `✓ ${strength}` })],
            spacing: { after: 150 },
            bullet: { level: 0 },
          })
        ),

        // Improvement Suggestions
        new Paragraph({
          text: 'Supportive Quality Improvement Suggestions',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...reportData.improvementSuggestions.flatMap((suggestion, index) => [
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. `,
                bold: true,
              }),
              new TextRun({
                text: suggestion.suggestion,
                bold: true,
              }),
              new TextRun({
                text: ` [${suggestion.priority} priority]`,
                italics: true,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `   ${suggestion.rationale}`,
            spacing: { after: 300 },
          }),
        ]),

        // Outcome Rationale
        new Paragraph({
          text: 'Outcome Decision Rationale',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: reportData.outcomeRationale,
          spacing: { after: 400 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Complaint_Report_${complaint.reference_number}_${format(new Date(), 'yyyy-MM-dd')}.docx`);
}
