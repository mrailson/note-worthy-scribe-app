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

interface ClinicalAction {
  medications?: string[];
  investigations?: string[];
  followUp?: string[];
  other?: string[];
}

interface PatientLetterData {
  patientCopy: string;
  summaryLine?: string;
  consultationType?: string;
  consultationDate?: Date;
  clinicalActions?: ClinicalAction;
  review?: string;
  referral?: string;
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
      text: 'Thank you for attending your consultation. This letter provides a detailed summary of our discussion, the care plan we have agreed upon together, and important information about your ongoing care.',
      size: 24
    })],
    spacing: { after: 300 },
    alignment: AlignmentType.JUSTIFIED
  }));
  
  // What We Discussed
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'What We Discussed Today',
      bold: true,
      size: 28,
      color: '1e40af'
    })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 250 }
  }));
  
  // Parse and format the patient copy text
  sections.push(...parsePatientText(data.patientCopy));
  
  // Medications Section
  if (data.clinicalActions?.medications && data.clinicalActions.medications.length > 0) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Your Medications',
        bold: true,
        size: 28,
        color: '1e40af'
      })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'We have made the following changes to your medications:',
        size: 24,
        bold: true
      })],
      spacing: { after: 200 }
    }));
    
    data.clinicalActions.medications.forEach(med => {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: '• ', size: 24, color: '2563eb', bold: true }),
          new TextRun({ text: med, size: 24 })
        ],
        spacing: { after: 150 },
        indent: { left: 360 },
        alignment: AlignmentType.JUSTIFIED
      }));
    });
    
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Why these changes? ',
        size: 24,
        bold: true,
        color: '1e40af'
      })],
      spacing: { after: 150 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'These medication changes have been made to help improve your health based on our discussion today. Each medication has been carefully chosen to address your specific needs. Please take them exactly as prescribed and contact us if you experience any unexpected side effects.',
        size: 24
      })],
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: '💊 Important: ',
        size: 24,
        bold: true
      }), new TextRun({
        text: 'If you have any questions about your medications, please speak to your pharmacist or contact the surgery. Never stop taking prescribed medications without consulting your doctor first.',
        size: 24,
        italics: true
      })],
      spacing: { after: 300 },
      alignment: AlignmentType.JUSTIFIED,
      border: {
        left: { style: BorderStyle.SINGLE, size: 15, color: 'fbbf24' }
      },
      shading: {
        fill: 'fef3c7'
      }
    }));
  }
  
  // Tests and Investigations
  if (data.clinicalActions?.investigations && data.clinicalActions.investigations.length > 0) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Tests and Investigations',
        bold: true,
        size: 28,
        color: '1e40af'
      })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'We have arranged the following tests to help monitor your condition:',
        size: 24
      })],
      spacing: { after: 200 }
    }));
    
    data.clinicalActions.investigations.forEach(inv => {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: '🔬 ', size: 24 }),
          new TextRun({ text: inv, size: 24, bold: true })
        ],
        spacing: { after: 150 },
        indent: { left: 360 }
      }));
    });
    
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'You will be contacted with the results once they are available. If any action is needed, we will discuss this with you.',
        size: 24
      })],
      spacing: { after: 300 },
      alignment: AlignmentType.JUSTIFIED
    }));
  }
  
  // Follow-up Appointments
  if (data.clinicalActions?.followUp && data.clinicalActions.followUp.length > 0) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Your Follow-Up Plan',
        bold: true,
        size: 28,
        color: '1e40af'
      })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'To ensure your ongoing care, we have arranged the following:',
        size: 24
      })],
      spacing: { after: 200 }
    }));
    
    data.clinicalActions.followUp.forEach(fu => {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: '📅 ', size: 24 }),
          new TextRun({ text: fu, size: 24 })
        ],
        spacing: { after: 150 },
        indent: { left: 360 },
        alignment: AlignmentType.JUSTIFIED
      }));
    });
    
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 200 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Please mark these dates in your calendar. If you need to change any appointments, please contact the surgery as soon as possible.',
        size: 24,
        italics: true
      })],
      spacing: { after: 300 },
      alignment: AlignmentType.JUSTIFIED
    }));
  }
  
  // Safety Netting
  if (data.review) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'When to Seek Further Help',
        bold: true,
        size: 28,
        color: 'dc2626'
      })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: '🚨 Important Safety Information',
        size: 26,
        bold: true,
        color: 'dc2626'
      })],
      spacing: { after: 200 }
    }));
    
    sections.push(...parsePatientText(data.review));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'If you experience any of the above symptoms or are concerned about your condition worsening, please:',
        size: 24,
        bold: true
      })],
      spacing: { before: 200, after: 150 }
    }));
    
    const urgentActions = [
      'Contact the surgery during working hours (Monday-Friday, 08:00-18:30)',
      'Call NHS 111 for urgent advice outside of surgery hours',
      'Call 999 or go to A&E if you have a medical emergency'
    ];
    
    urgentActions.forEach(action => {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: '⚠️ ', size: 24 }),
          new TextRun({ text: action, size: 24 })
        ],
        spacing: { after: 150 },
        indent: { left: 360 }
      }));
    });
    
    sections.push(new Paragraph({
      text: '',
      spacing: { after: 300 }
    }));
  }
  
  // Referral Information
  if (data.referral) {
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'Specialist Referral',
        bold: true,
        size: 28,
        color: '1e40af'
      })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 500, after: 250 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'We have referred you to a specialist for further assessment and treatment. Here are the details:',
        size: 24
      })],
      spacing: { after: 200 }
    }));
    
    sections.push(...parsePatientText(data.referral));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: 'You should receive an appointment letter within the next few weeks. If you do not hear anything within 4 weeks, please contact the surgery.',
        size: 24,
        italics: true
      })],
      spacing: { after: 300 },
      alignment: AlignmentType.JUSTIFIED
    }));
  }
  
  // Useful Resources
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'Helpful Information and Resources',
      bold: true,
      size: 28,
      color: '1e40af'
    })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 500, after: 250 }
  }));
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: 'The following websites provide reliable, NHS-approved information about your condition:',
      size: 24
    })],
    spacing: { after: 200 }
  }));
  
  const resources = [
    {
      name: 'NHS Website',
      url: 'www.nhs.uk',
      description: 'Comprehensive health information and advice'
    },
    {
      name: 'Patient.info',
      url: 'www.patient.info',
      description: 'Detailed leaflets about conditions and treatments'
    },
    {
      name: 'British Heart Foundation',
      url: 'www.bhf.org.uk',
      description: 'If you have heart or circulation concerns'
    },
    {
      name: 'Diabetes UK',
      url: 'www.diabetes.org.uk',
      description: 'Support and information for diabetes management'
    },
    {
      name: 'NHS 111 Online',
      url: 'www.111.nhs.uk',
      description: 'Get urgent medical advice online'
    }
  ];
  
  resources.forEach(resource => {
    sections.push(new Paragraph({
      children: [
        new TextRun({ text: '🌐 ', size: 24 }),
        new TextRun({ text: `${resource.name}: `, size: 24, bold: true, color: '2563eb' }),
        new TextRun({ text: resource.url, size: 22, italics: true, color: '4b5563' })
      ],
      spacing: { after: 100 },
      indent: { left: 360 }
    }));
    
    sections.push(new Paragraph({
      children: [new TextRun({
        text: resource.description,
        size: 22,
        color: '6b7280'
      })],
      spacing: { after: 200 },
      indent: { left: 720 }
    }));
  });
  
  sections.push(new Paragraph({
    children: [new TextRun({
      text: '💡 Tip: ',
      size: 24,
      bold: true
    }), new TextRun({
      text: 'Always check that health websites are NHS-approved or from reputable medical organisations. Be cautious of unofficial sources.',
      size: 24,
      italics: true
    })],
    spacing: { before: 200, after: 300 },
    alignment: AlignmentType.JUSTIFIED
  }));
  
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
    'Keep this letter for your personal records and bring it to future appointments.',
    'Make sure you understand your care plan - if anything is unclear, please contact the surgery.',
    'Attend all scheduled follow-up appointments and tests.',
    'Take your medications exactly as prescribed.',
    'Monitor your symptoms and seek help if they worsen.',
    'Use the NHS resources provided to learn more about your condition.',
    'If you have any questions or concerns, we are here to help - please do not hesitate to contact us.'
  ];
  
  reminders.forEach(reminder => {
    sections.push(new Paragraph({
      children: [
        new TextRun({ text: '• ', size: 24, color: '2563eb', bold: true }),
        new TextRun({ text: reminder, size: 22 })
      ],
      spacing: { after: 150 },
      indent: { left: 360 },
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
