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

export async function createLetterDocument(letterContent: string, letterType: string, referenceNumber: string): Promise<Document> {
  // Extract logo URL from HTML comment if present
  const logoUrlMatch = letterContent.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
  const logoUrl = logoUrlMatch ? logoUrlMatch[1] : null;
  
  // Remove the logo metadata comment from content for parsing
  const cleanContent = letterContent
    .replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown image syntax
    .replace(/```[\s\S]*?$/g, '') // Remove markdown code blocks at the end
    .replace(/```/g, '') // Remove any stray backticks
    .trim();
  
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

  // Add logo at the top center with actual image embedding
  if (logoUrl) {
    try {
      const imageResponse = await fetch(logoUrl);
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        const uint8Array = new Uint8Array(imageBuffer);

        // Compute dimensions preserving aspect ratio within bounds (40% larger)
        let targetWidth = 280;
        let targetHeight = 112;
        try {
          const tempImg = document.createElement('img');
          const objectUrl = URL.createObjectURL(imageBlob);
          await new Promise<void>((resolve, reject) => {
            tempImg.onload = () => resolve();
            tempImg.onerror = () => reject(new Error('Image load failed'));
            tempImg.src = objectUrl;
          });
          const naturalW = tempImg.naturalWidth || tempImg.width;
          const naturalH = tempImg.naturalHeight || tempImg.height;
          URL.revokeObjectURL(objectUrl);

          if (naturalW && naturalH) {
            const maxW = 336; // px (40% larger)
            const maxH = 140; // px (40% larger)
            const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
            targetWidth = Math.max(84, Math.round(naturalW * scale));
            targetHeight = Math.max(28, Math.round(naturalH * scale));
          }
        } catch (_) {
          // keep defaults
        }

        documentChildren.push(new Paragraph({
          children: [
            new ImageRun({
              data: uint8Array,
              transformation: { width: targetWidth, height: targetHeight },
              type: logoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }));
      } else {
        throw new Error('Failed to fetch logo image');
      }
    } catch (error) {
      console.error('Error embedding logo in Word document:', error);
      // Fallback to practice name only
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: "OAK LANE MEDICAL PRACTICE",
            size: 20,
            bold: true,
            color: "1f4e79",
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

  // Addressee section - compact spacing for envelope window
  addresseeSection.forEach(line => {
    documentChildren.push(new Paragraph({
      children: formatTextWithBold(line),
      spacing: { after: 0, line: 240, lineRule: "auto" } // Single line spacing, no paragraph gap
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
    creator: "Notewell AI Complaints Management System",
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