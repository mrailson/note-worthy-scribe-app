import { Document, Paragraph, TextRun, AlignmentType } from 'docx';

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
  const formattedContent = parseLetterContent(letterContent);
  const paragraphs: Paragraph[] = [];

  let currentParagraphRuns: TextRun[] = [];

  formattedContent.forEach((item) => {
    if (item.type === 'text' && item.content === '\n') {
      // End current paragraph and start new one
      if (currentParagraphRuns.length > 0) {
        paragraphs.push(new Paragraph({
          children: currentParagraphRuns,
          spacing: { after: 120 }
        }));
        currentParagraphRuns = [];
      } else {
        // Empty line for spacing
        paragraphs.push(new Paragraph({
          children: [new TextRun("")],
          spacing: { after: 120 }
        }));
      }
    } else if (item.type === 'bold') {
      currentParagraphRuns.push(new TextRun({
        text: item.content,
        bold: true,
        font: "Arial"
      }));
    } else if (item.type === 'text') {
      const text = item.content.replace('\n', '');
      if (text) {
        currentParagraphRuns.push(new TextRun({
          text: text,
          font: "Arial"
        }));
      }
    }
  });

  // Add any remaining runs as final paragraph
  if (currentParagraphRuns.length > 0) {
    paragraphs.push(new Paragraph({
      children: currentParagraphRuns
    }));
  }

  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} Letter - ${referenceNumber}`,
              bold: true,
              size: 28,
              font: "Arial"
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        ...paragraphs
      ]
    }],
    creator: "NHS Complaints System",
    title: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} Letter - ${referenceNumber}`,
    description: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} letter for complaint ${referenceNumber}`
  });
}