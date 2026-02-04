import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

interface InspectionElement {
  id: string;
  session_id: string;
  domain: string;
  element_key: string;
  element_name: string;
  evidence_guidance: string;
  status: string;
  evidence_notes: string | null;
  improvement_comments: string | null;
  evidence_files: unknown;
  assessed_at: string | null;
}

interface ReportStats {
  total: number;
  met: number;
  partiallyMet: number;
  notMet: number;
  notApplicable: number;
  notAssessed: number;
}

interface ReportData {
  practiceName: string;
  inspectionDate: string;
  elements: InspectionElement[];
  stats: ReportStats;
}

const DOMAIN_LABELS: Record<string, string> = {
  safe: 'Safe',
  well_led: 'Well-led',
  effective: 'Effective',
  caring: 'Caring',
  responsive: 'Responsive'
};

const STATUS_LABELS: Record<string, string> = {
  met: 'Met',
  partially_met: 'Partially Met',
  not_met: 'Not Met',
  not_applicable: 'Not Applicable',
  not_assessed: 'Not Assessed'
};

const getOverallRating = (stats: ReportStats): string => {
  const assessed = stats.total - stats.notAssessed - stats.notApplicable;
  if (assessed === 0) return 'Incomplete';
  
  const metPercent = (stats.met / assessed) * 100;
  const notMetPercent = (stats.notMet / assessed) * 100;
  
  if (notMetPercent > 20) return 'Requires Improvement';
  if (notMetPercent > 10 || stats.partiallyMet > stats.met * 0.5) return 'Requires Improvement';
  if (metPercent > 90) return 'Good';
  return 'Requires Improvement';
};

export const generateMockInspectionReport = async (data: ReportData): Promise<void> => {
  const { practiceName, inspectionDate, elements, stats } = data;
  
  const formattedDate = new Date(inspectionDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const overallRating = getOverallRating(stats);

  // Priority items (not met and partially met)
  const priorityItems = elements
    .filter(e => e.status === 'not_met' || e.status === 'partially_met')
    .sort((a, b) => {
      if (a.status === 'not_met' && b.status !== 'not_met') return -1;
      if (a.status !== 'not_met' && b.status === 'not_met') return 1;
      const priorityDomains = ['safe', 'well_led'];
      const aIsPriority = priorityDomains.includes(a.domain);
      const bIsPriority = priorityDomains.includes(b.domain);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });

  // Group elements by domain
  const elementsByDomain: Record<string, InspectionElement[]> = {};
  elements.forEach(el => {
    if (!elementsByDomain[el.domain]) {
      elementsByDomain[el.domain] = [];
    }
    elementsByDomain[el.domain].push(el);
  });

  // Build document sections
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Mock CQC Inspection Report',
          bold: true,
          size: 48,
          color: '1a365d'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Practice Name
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: practiceName,
          bold: true,
          size: 36
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: formattedDate,
          size: 24,
          color: '666666'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // Overall Rating
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Overall Assessment: ',
          bold: true,
          size: 28
        }),
        new TextRun({
          text: overallRating,
          bold: true,
          size: 28,
          color: overallRating === 'Good' ? '16a34a' : 'd97706'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // Summary Statistics
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: 'Summary Statistics',
          bold: true,
          size: 28
        })
      ],
      spacing: { before: 400, after: 200 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Total Elements: ${stats.total}`, size: 22 })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Met: ${stats.met}`, size: 22, color: '16a34a' })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Partially Met: ${stats.partiallyMet}`, size: 22, color: 'd97706' })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Not Met: ${stats.notMet}`, size: 22, color: 'dc2626' })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Not Applicable: ${stats.notApplicable}`, size: 22, color: '666666' })
      ],
      spacing: { after: 400 }
    })
  );

  // Priority Actions Section
  if (priorityItems.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: `Priority Actions (${priorityItems.length})`,
            bold: true,
            size: 28,
            color: 'dc2626'
          })
        ],
        spacing: { before: 400, after: 200 }
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'These areas require attention to improve CQC compliance:',
            size: 22,
            italics: true
          })
        ],
        spacing: { after: 200 }
      })
    );

    priorityItems.forEach((item, index) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. [${STATUS_LABELS[item.status]}] `,
              bold: true,
              size: 22,
              color: item.status === 'not_met' ? 'dc2626' : 'd97706'
            }),
            new TextRun({
              text: `${item.element_key}: ${item.element_name}`,
              bold: true,
              size: 22
            }),
            new TextRun({
              text: ` (${DOMAIN_LABELS[item.domain]})`,
              size: 22,
              color: '666666'
            })
          ],
          spacing: { before: 150, after: 50 }
        })
      );

      if (item.improvement_comments) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '   Suggested improvement: ',
                bold: true,
                size: 20
              }),
              new TextRun({
                text: item.improvement_comments,
                size: 20,
                italics: true
              })
            ],
            spacing: { after: 150 }
          })
        );
      }
    });
  }

  // Domain-by-Domain Breakdown
  const domainOrder = ['safe', 'well_led', 'effective', 'caring', 'responsive'];
  
  domainOrder.forEach(domain => {
    const domainElements = elementsByDomain[domain];
    if (!domainElements || domainElements.length === 0) return;

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: `Domain: ${DOMAIN_LABELS[domain]}`,
            bold: true,
            size: 28
          })
        ],
        spacing: { before: 400, after: 200 }
      })
    );

    domainElements.forEach(el => {
      const statusColor = el.status === 'met' ? '16a34a' 
        : el.status === 'partially_met' ? 'd97706'
        : el.status === 'not_met' ? 'dc2626'
        : '666666';

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${el.element_key}: ${el.element_name}`,
              bold: true,
              size: 22
            })
          ],
          spacing: { before: 200, after: 50 }
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Status: ${STATUS_LABELS[el.status]}`,
              size: 20,
              color: statusColor,
              bold: true
            })
          ],
          spacing: { after: 50 }
        })
      );

      if (el.evidence_notes) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Evidence: ',
                bold: true,
                size: 20
              }),
              new TextRun({
                text: el.evidence_notes,
                size: 20
              })
            ],
            spacing: { after: 50 }
          })
        );
      }

      if (el.improvement_comments) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Improvement notes: ',
                bold: true,
                size: 20
              }),
              new TextRun({
                text: el.improvement_comments,
                size: 20,
                italics: true
              })
            ],
            spacing: { after: 100 }
          })
        );
      }
    });
  });

  // Footer - Encouragement
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '\n\nNote: This mock inspection is a supportive learning tool designed to help identify areas for improvement. Use this report to guide your action planning and prioritise your compliance efforts.',
          size: 20,
          italics: true,
          color: '666666'
        })
      ],
      spacing: { before: 600 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated by Meeting Magic on ${new Date().toLocaleDateString('en-GB')}`,
          size: 18,
          color: '999999'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  // Generate and save
  const blob = await Packer.toBlob(doc);
  const filename = `mock-cqc-inspection-${practiceName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
};
