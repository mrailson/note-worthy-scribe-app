import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  BorderStyle,
  Packer
} from 'docx';
import { format } from 'date-fns';

interface PatientLetterData {
  patientCopy: string;
  summaryLine?: string;
  consultationType?: string;
  consultationDate?: Date;
}

function parsePatientText(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split('\n\n');
  
  lines.forEach(block => {
    if (!block.trim()) return;
    
    // Check if it's a heading (starts with ** or is in title case)
    const isHeading = block.startsWith('**') || 
                     (block.split(' ').length <= 5 && block === block.toUpperCase());
    
    if (isHeading) {
      const cleanText = block.replace(/\*\*/g, '');
      paragraphs.push(new Paragraph({
        children: [new TextRun({ 
          text: cleanText,
          bold: true,
          size: 28,
          color: '1e40af'
        })],
        spacing: { before: 300, after: 150 },
        heading: HeadingLevel.HEADING_2
      }));
    } else {
      // Split into sentences for better readability
      const sentences = block.split(/\.\s+/);
      sentences.forEach((sentence, idx) => {
        if (sentence.trim()) {
          const fullSentence = idx < sentences.length - 1 ? sentence + '.' : sentence;
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: fullSentence.trim(),
              size: 24
            })],
            spacing: { after: 180 },
            alignment: AlignmentType.JUSTIFIED
          }));
        }
      });
      
      // Add extra space after block
      paragraphs.push(new Paragraph({
        text: '',
        spacing: { after: 100 }
      }));
    }
  });
  
  return paragraphs;
}

export async function exportPatientLetterToWord(data: PatientLetterData): Promise<void> {
  const sections: Paragraph[] = [];
  
  // Header with decorative line
  sections.push(new Paragraph({
    text: '',
    border: {
      top: { style: BorderStyle.THICK_THIN_LARGE_GAP, size: 30, color: '2563eb' }
    },
    spacing: { after: 400 }
  }));
  
  // Letter heading
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Your Consultation Summary',
      bold: true,
      size: 40,
      color: '1e40af'
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));
  
  // Date and consultation type
  const consultDate = data.consultationDate || new Date();
  const formattedDate = format(consultDate, 'EEEE, do MMMM yyyy');
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: formattedDate,
      size: 24,
      italics: true,
      color: '6b7280'
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 150 }
  }));
  
  if (data.consultationType) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: `Consultation Type: ${data.consultationType}`,
        size: 22,
        color: '6b7280'
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));
  } else {
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }));
  }
  
  // Decorative separator
  sections.push(new Paragraph({
    text: '• • •',
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 300 }
  }));
  
  // Greeting
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Dear Patient,',
      size: 26,
      bold: true
    })],
    spacing: { after: 250 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Thank you for attending your consultation. This letter provides a summary of our discussion and the care plan we have agreed upon together.',
      size: 24
    })],
    spacing: { after: 300 },
    alignment: AlignmentType.JUSTIFIED
  }));
  
  // Quick summary in a highlighted box (if available)
  if (data.summaryLine) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Quick Overview',
        bold: true,
        size: 26,
        color: '1e40af'
      })],
      spacing: { before: 300, after: 150 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: data.summaryLine,
        size: 24
      })],
      spacing: { after: 300 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: 'bfdbfe' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'bfdbfe' },
        left: { style: BorderStyle.SINGLE, size: 6, color: 'bfdbfe' },
        right: { style: BorderStyle.SINGLE, size: 6, color: 'bfdbfe' }
      },
      shading: {
        fill: 'eff6ff'
      },
      alignment: AlignmentType.JUSTIFIED
    }));
  }
  
  // Detailed patient-friendly explanation
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Detailed Summary',
      bold: true,
      size: 28,
      color: '1e40af'
    })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 250 }
  }));
  
  // Parse and format the patient copy text
  sections.push(...parsePatientText(data.patientCopy));
  
  // Closing section
  sections.push(new Paragraph({
    text: '• • •',
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 300 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Important Reminders',
      bold: true,
      size: 26,
      color: '1e40af'
    })],
    spacing: { before: 300, after: 200 }
  }));
  
  const reminders = [
    'Please take your medications as prescribed and discuss any concerns with your pharmacist or GP.',
    'If your symptoms worsen or you develop new concerns, please contact the surgery or seek appropriate medical attention.',
    'Keep this letter for your records and bring it to future appointments.',
    'If you have any questions about this letter, please do not hesitate to contact the practice.'
  ];
  
  reminders.forEach(reminder => {
    sections.push(new Paragraph({
      children: [
        new TextRun({ text: '• ', size: 24, color: '2563eb', bold: true }),
        new TextRun({ text: reminder, size: 22 })
      ],
      spacing: { after: 150 },
      alignment: AlignmentType.JUSTIFIED
    }));
  });
  
  // Closing
  sections.push(new Paragraph({
    text: '',
    spacing: { before: 400 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'With best wishes for your continued health,',
      size: 24,
      italics: true
    })],
    spacing: { after: 150 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Your GP Practice Team',
      size: 24,
      bold: true
    })],
    spacing: { after: 400 }
  }));
  
  // Footer with decorative line
  sections.push(new Paragraph({
    text: '',
    border: {
      bottom: { style: BorderStyle.THICK_THIN_LARGE_GAP, size: 30, color: '2563eb' }
    },
    spacing: { before: 400, after: 300 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'This letter is for your personal records',
      size: 18,
      italics: true,
      color: '9ca3af'
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: `Generated: ${format(new Date(), 'do MMMM yyyy, HH:mm')}`,
      size: 18,
      italics: true,
      color: '9ca3af'
    })],
    alignment: AlignmentType.CENTER
  }));
  
  // Create the document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      children: sections
    }]
  });
  
  // Generate filename
  const dateStr = format(consultDate, 'yyyy-MM-dd');
  const filename = `Patient-Consultation-Letter-${dateStr}.docx`;
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
