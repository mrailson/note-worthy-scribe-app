import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  BorderStyle,
  UnderlineType,
  Packer
} from 'docx';
import { format } from 'date-fns';
import { Medication, ClinicalAction } from '@/components/meeting/ClinicalActionsPanel';

interface SoapNote {
  S: string;
  O: string;
  A: string;
  P: string;
}

interface ConsultationData {
  shorthand?: SoapNote;
  standard?: SoapNote;
  summaryLine?: string;
  patientCopy?: string;
  referral?: string;
  review?: string;
  clinicalActions?: ClinicalAction;
  consultationType?: string;
  consultationDate?: Date;
}

const SECTION_ICONS = {
  S: '💬',
  O: '🩺',
  A: '🔎',
  P: '✅'
};

const SECTION_TITLES = {
  S: 'S – Subjective',
  O: 'O – Objective',
  A: 'A – Assessment',
  P: 'P – Plan'
};

// Helper to parse markdown-style bold and create TextRuns
function parseTextWithFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold text
      const content = part.slice(2, -2);
      runs.push(new TextRun({
        text: content,
        bold: true
      }));
    } else if (part) {
      // Regular text
      runs.push(new TextRun({ text: part }));
    }
  });
  
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

// Helper to create a section heading with underline
function createSectionHeading(icon: string, title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${icon} ${title}`,
        bold: true,
        size: 28,
        color: '005EB8',
        underline: {
          type: UnderlineType.SINGLE,
          color: '005EB8'
        }
      })
    ],
    spacing: {
      before: 400,
      after: 200
    },
    border: {
      bottom: {
        color: '005EB8',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6
      }
    }
  });
}

// Helper to create body paragraphs from text
function createBodyParagraphs(text: string): Paragraph[] {
  if (!text) {
    return [new Paragraph({
      children: [new TextRun({ text: 'No information recorded', italics: true })],
      spacing: { after: 200 }
    })];
  }
  
  const lines = text.split('\n');
  return lines.map(line => new Paragraph({
    children: parseTextWithFormatting(line || ' '),
    spacing: { after: 150 }
  }));
}

// Helper to create paragraphs for clinical actions
function createClinicalActionsParagraphs(actions: ClinicalAction): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Medications
  if (actions.medications && actions.medications.length > 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: 'Prescriptions:', bold: true })],
      spacing: { before: 200, after: 100 }
    }));
    actions.medications.forEach(med => {
      // Handle both string and object formats
      const medText = typeof med === 'string' 
        ? med 
        : med.name 
          ? `${med.name}${med.dose ? ` ${med.dose}` : ''}${med.instructions ? ` - ${med.instructions}` : ''}`
          : JSON.stringify(med);
      
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `• ${medText}` })],
        spacing: { after: 100 }
      }));
    });
  }
  
  // Investigations
  if (actions.investigations && actions.investigations.length > 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: 'Investigations Ordered:', bold: true })],
      spacing: { before: 200, after: 100 }
    }));
    actions.investigations.forEach(inv => {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `• ${inv}` })],
        spacing: { after: 100 }
      }));
    });
  }
  
  // Follow-up
  if (actions.followUp && actions.followUp.length > 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: 'Follow-up:', bold: true })],
      spacing: { before: 200, after: 100 }
    }));
    actions.followUp.forEach(fu => {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `• ${fu}` })],
        spacing: { after: 100 }
      }));
    });
  }
  
  // Other actions
  if (actions.other && actions.other.length > 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: 'Other Actions:', bold: true })],
      spacing: { before: 200, after: 100 }
    }));
    actions.other.forEach(action => {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `• ${action}` })],
        spacing: { after: 100 }
      }));
    });
  }
  
  return paragraphs;
}

export async function exportConsultationToWord(data: ConsultationData): Promise<void> {
  const sections: Paragraph[] = [];
  
  // Document title
  sections.push(new Paragraph({
    children: [
      new TextRun({
        text: 'GP Consultation Notes',
        bold: true,
        size: 36,
        color: '005EB8'
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 }
  }));
  
  // Consultation details
  const consultDate = data.consultationDate || new Date();
  const formattedDate = format(consultDate, 'do MMMM yyyy, HH:mm');
  
  sections.push(new Paragraph({
    children: [
      new TextRun({ text: 'Date: ', bold: true }),
      new TextRun({ text: formattedDate })
    ],
    spacing: { after: 100 }
  }));
  
  if (data.consultationType) {
    sections.push(new Paragraph({
      children: [
        new TextRun({ text: 'Consultation Type: ', bold: true }),
        new TextRun({ text: data.consultationType })
      ],
      spacing: { after: 300 }
    }));
  }
  
  // Quick Summary Section
  if (data.summaryLine) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '📋 Quick Summary',
          bold: true,
          size: 28,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 400, after: 200 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    sections.push(new Paragraph({
      children: parseTextWithFormatting(data.summaryLine),
      spacing: { after: 300 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 10, color: '2563eb' },
        bottom: { style: BorderStyle.SINGLE, size: 10, color: '2563eb' },
        left: { style: BorderStyle.SINGLE, size: 10, color: '2563eb' },
        right: { style: BorderStyle.SINGLE, size: 10, color: '2563eb' }
      },
      shading: {
        fill: 'EFF6FF'
      }
    }));
  }
  
  // SOAP Notes - Detailed version
  if (data.standard) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '📝 Clinical Notes (SOAP Format)',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    const soapKeys: Array<keyof SoapNote> = ['S', 'O', 'A', 'P'];
    soapKeys.forEach(key => {
      sections.push(createSectionHeading(SECTION_ICONS[key], SECTION_TITLES[key]));
      sections.push(...createBodyParagraphs(data.standard![key]));
    });
  }
  
  // SOAP Notes - Shorthand version
  if (data.shorthand) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '⚡ Quick Reference (Shorthand)',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    const soapKeys: Array<keyof SoapNote> = ['S', 'O', 'A', 'P'];
    soapKeys.forEach(key => {
      sections.push(createSectionHeading(SECTION_ICONS[key], SECTION_TITLES[key]));
      sections.push(...createBodyParagraphs(data.shorthand![key]));
    });
  }
  
  // Clinical Actions
  if (data.clinicalActions) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '🎯 Clinical Actions',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    sections.push(...createClinicalActionsParagraphs(data.clinicalActions));
  }
  
  // Safety Netting / Review
  if (data.review) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '🛡️ Safety Netting & Follow-Up',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    sections.push(...createBodyParagraphs(data.review));
  }
  
  // Patient Copy
  if (data.patientCopy) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '👤 Patient-Friendly Summary',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    sections.push(...createBodyParagraphs(data.patientCopy));
  }
  
  // Referral
  if (data.referral) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: '📤 Referral Details',
          bold: true,
          size: 32,
          color: '005EB8',
          underline: {
            type: UnderlineType.SINGLE,
            color: '005EB8'
          }
        })
      ],
      spacing: { before: 600, after: 300 },
      border: {
        bottom: {
          color: '005EB8',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      }
    }));
    
    sections.push(...createBodyParagraphs(data.referral));
  }
  
  // Footer disclaimer
  sections.push(new Paragraph({
    text: '',
    spacing: { before: 600 }
  }));
  
  sections.push(new Paragraph({
    text: '─────────────────────────────────────────────',
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 }
  }));
  
  sections.push(new Paragraph({
    children: [
      new TextRun({
        text: 'This document is auto-generated from consultation recording',
        italics: true,
        size: 18
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }));
  
  sections.push(new Paragraph({
    children: [
      new TextRun({
        text: `Generated: ${format(new Date(), 'do MMMM yyyy, HH:mm')}`,
        italics: true,
        size: 18
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }));
  
  sections.push(new Paragraph({
    children: [
      new TextRun({
        text: 'CONFIDENTIAL MEDICAL RECORD',
        bold: true,
        size: 18
      })
    ],
    alignment: AlignmentType.CENTER
  }));
  
  // Create the document
  const doc = new Document({
    sections: [{
      properties: {},
      children: sections
    }]
  });
  
  // Generate filename
  const dateStr = format(consultDate, 'yyyy-MM-dd-HHmm');
  const consultTypeStr = data.consultationType 
    ? data.consultationType.replace(/\s+/g, '-')
    : 'Consultation';
  const filename = `GP-Consultation-${consultTypeStr}-${dateStr}.docx`;
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
