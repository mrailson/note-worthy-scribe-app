import { Document, Paragraph, TextRun, AlignmentType, Header, Footer, ImageRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType } from 'docx';

export interface FormattedContent {
  type: 'text' | 'bold' | 'heading';
  content: string;
}

export function parseLetterContent(content: string): FormattedContent[] {
  const lines = content.split('\n');
  const formatted: FormattedContent[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      formatted.push({ type: 'text', content: '\n' });
      continue;
    }

    // Check for bold text patterns (**text**)
    if (trimmedLine.includes('**')) {
      const parts = trimmedLine.split(/(\*\*.*?\*\*)/);
      parts.forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          formatted.push({ 
            type: 'bold', 
            content: part.slice(2, -2) 
          });
        } else if (part.trim()) {
          formatted.push({ 
            type: 'text', 
            content: part 
          });
        }
      });
      formatted.push({ type: 'text', content: '\n' });
    } else {
      // Regular text
      formatted.push({ 
        type: 'text', 
        content: trimmedLine + '\n'
      });
    }
  }

  return formatted;
}

export function createLetterDocument(letterContent: string, letterType: string, referenceNumber: string): Document {
  // Extract logo URL from HTML comment if present
  const logoUrlMatch = letterContent.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
  const logoUrl = logoUrlMatch ? logoUrlMatch[1] : null;
  
  // Remove the logo metadata comment from content for parsing
  const cleanContent = letterContent.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
  
  // Parse content into sections
  const lines = cleanContent.split('\n').filter(line => line.trim());
  
  // Extract different sections
  let headerLines: string[] = [];
  let dateSection = '';
  let addresseeSection: string[] = [];
  let bodyLines: string[] = [];
  let signatureSection: string[] = [];
  
  let currentSection = 'header';
  let bodyStarted = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Detect date (starts with day number and contains month/year)
    if (/^\*?\*?\d{1,2}[\s]*([A-Z][a-z]+|\w+)[\s]*\d{4}\*?\*?/.test(line)) {
      dateSection = line.replace(/\*\*/g, '');
      currentSection = 'addressee';
      continue;
    }
    
    // Detect private/confidential
    if (line.toLowerCase().includes('private') && line.toLowerCase().includes('confidential')) {
      currentSection = 'addressee';
      continue;
    }
    
    // Detect addressee (patient name, address)
    if (currentSection === 'addressee' && !bodyStarted) {
      if (line.toLowerCase().includes('dear ') || line.includes('Re:')) {
        bodyStarted = true;
        currentSection = 'body';
        bodyLines.push(line);
      } else {
        addresseeSection.push(line);
      }
      continue;
    }
    
    // Detect signature section (starts with "Yours sincerely" or similar)
    if (line.toLowerCase().includes('yours sincerely') || 
        line.toLowerCase().includes('yours faithfully') ||
        line.toLowerCase().includes('kind regards')) {
      currentSection = 'signature';
      signatureSection.push(line);
      continue;
    }
    
    // Assign to appropriate section
    if (currentSection === 'header' && !bodyStarted) {
      headerLines.push(line);
    } else if (currentSection === 'body') {
      bodyLines.push(line);
    } else if (currentSection === 'signature') {
      signatureSection.push(line);
    }
  }

  const formatTextWithBold = (text: string): TextRun[] => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    const runs: TextRun[] = [];
    
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Calibri"
        }));
      } else if (part.trim()) {
        runs.push(new TextRun({
          text: part,
          font: "Calibri"
        }));
      }
    });
    
    return runs;
  };

  // Build document sections
  const documentChildren: Paragraph[] = [];

  // Add logo at the top center with proper image embedding
  if (logoUrl) {
    try {
      // For Word documents, we'll use ImageRun to embed the actual logo
      // First add a note that the logo should be manually added
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: `[INSERT PRACTICE LOGO: ${logoUrl}]`,
            size: 14,
            bold: true,
            color: "0066CC",
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }));
      
      // Add a line break for spacing
      documentChildren.push(new Paragraph({
        children: [new TextRun({ text: "", size: 12 })],
        spacing: { after: 200 }
      }));
    } catch (error) {
      console.error('Error adding logo to document:', error);
      // Fallback to placeholder
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: "[PRACTICE LOGO - Oak Lane Medical Practice]",
            size: 16,
            italics: true,
            bold: true,
            color: "0066CC",
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }));
    }
  }

  // Date (right aligned)
  if (dateSection) {
    documentChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: dateSection,
          size: 22,
          font: "Calibri"
        })
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 300 }
    }));
  }

  // Private & Confidential (centered)
  documentChildren.push(new Paragraph({
    children: [
      new TextRun({
        text: "PRIVATE & CONFIDENTIAL",
        bold: true,
        size: 20,
        color: "c5504b",
        font: "Calibri"
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 }
  }));

  // Addressee section
  addresseeSection.forEach(line => {
    documentChildren.push(new Paragraph({
      children: formatTextWithBold(line),
      spacing: { after: 100 }
    }));
  });

  // Add spacing after addressee
  if (addresseeSection.length > 0) {
    documentChildren.push(new Paragraph({
      children: [new TextRun("")],
      spacing: { after: 200 }
    }));
  }

  // Body content
  bodyLines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Handle "Dear" line specially
    if (trimmedLine.toLowerCase().startsWith('dear ')) {
      documentChildren.push(new Paragraph({
        children: formatTextWithBold(trimmedLine),
        spacing: { after: 300 }
      }));
      return;
    }
    
    // Handle "Re:" line specially
    if (trimmedLine.toLowerCase().startsWith('re:')) {
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmedLine.replace(/\*\*/g, ''),
            bold: true,
            size: 22,
            font: "Calibri"
          })
        ],
        spacing: { after: 300 }
      }));
      return;
    }
    
    // Regular paragraph
    documentChildren.push(new Paragraph({
      children: formatTextWithBold(trimmedLine),
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED
    }));
  });

  // Signature section
  if (signatureSection.length > 0) {
    // Add spacing before signature
    documentChildren.push(new Paragraph({
      children: [new TextRun("")],
      spacing: { after: 400 }
    }));

    signatureSection.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Handle closing line
      if (trimmedLine.toLowerCase().includes('yours sincerely') || 
          trimmedLine.toLowerCase().includes('yours faithfully') ||
          trimmedLine.toLowerCase().includes('kind regards')) {
        documentChildren.push(new Paragraph({
          children: formatTextWithBold(trimmedLine),
          spacing: { after: 600 }
        }));
        return;
      }
      
      // Handle signature name (usually bold)
      if (trimmedLine.includes('*') || index === 1) {
        documentChildren.push(new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine.replace(/\*/g, ''),
              bold: true,
              size: 24,
              color: "1f4e79",
              font: "Calibri"
            })
          ],
          spacing: { after: 100 }
        }));
        return;
      }
      
      // Handle title, qualifications, practice name, etc.
      documentChildren.push(new Paragraph({
        children: formatTextWithBold(trimmedLine),
        spacing: { after: 100 }
      }));
    });
  }

  // Practice information as footer
  documentChildren.push(new Paragraph({
    children: [new TextRun("")],
    spacing: { after: 400 }
  }));

  // Add horizontal separator line
  documentChildren.push(new Paragraph({
    children: [
      new TextRun({
        text: "____________________________________________________",
        size: 16,
        color: "cccccc",
        font: "Calibri"
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));

  // Practice information footer
  if (headerLines.length > 0) {
    // Practice name (first header line)
    documentChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: headerLines[0].replace(/\*\*/g, ''),
          bold: true,
          size: 20,
          color: "1f4e79",
          font: "Calibri"
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }));

    // Practice details (remaining header lines)
    headerLines.slice(1).forEach(line => {
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: line.replace(/\*\*/g, ''),
            size: 16,
            color: "666666",
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 }
      }));
    });
  }

  // System generated message
  documentChildren.push(new Paragraph({
    children: [
      new TextRun({
        text: "This letter was generated by the NHS Complaints Management System",
        size: 14,
        italics: true,
        color: "999999",
        font: "Calibri"
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }));

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,  // 1 inch
            bottom: 1440, // 1 inch
            left: 1440,   // 1 inch
          },
        },
      },
      children: documentChildren
    }],
    creator: "NHS Complaints Management System",
    title: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} Letter - ${referenceNumber}`,
    description: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} letter for complaint ${referenceNumber}`,
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22
          },
          paragraph: {
            spacing: {
              line: 360,
              lineRule: "auto"
            }
          }
        }
      }
    }
  });
}