/**
 * Clean Word Export Utility
 * Produces professional, well-formatted Word documents from AI responses
 * without excessive italics or indentation issues.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from "docx";
import { saveAs } from "file-saver";

// Professional colour scheme
const COLORS = {
  headingBlue: "2563EB",
  textGrey: "374151",
  dateGrey: "6B7280",
};

// Font configuration
const FONTS = {
  default: "Calibri",
  size: {
    title: 32,      // 16pt
    heading1: 26,   // 13pt
    heading2: 24,   // 12pt
    body: 22,       // 11pt
    small: 18,      // 9pt
  },
};

interface ParsedLine {
  type: 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'paragraph';
  content: string;
  number?: number;
}

/**
 * Strip markdown formatting from text, keeping structure info
 */
function parseMarkdownLine(line: string): ParsedLine {
  const trimmed = line.trim();
  
  // Headings
  if (trimmed.startsWith('### ')) {
    return { type: 'heading3', content: cleanText(trimmed.slice(4)) };
  }
  if (trimmed.startsWith('## ')) {
    return { type: 'heading2', content: cleanText(trimmed.slice(3)) };
  }
  if (trimmed.startsWith('# ')) {
    return { type: 'heading1', content: cleanText(trimmed.slice(2)) };
  }
  
  // Bullet points (- or *)
  if (/^[-*]\s+/.test(trimmed)) {
    return { type: 'bullet', content: cleanText(trimmed.replace(/^[-*]\s+/, '')) };
  }
  
  // Numbered lists
  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    return { 
      type: 'numbered', 
      content: cleanText(numberedMatch[2]),
      number: parseInt(numberedMatch[1], 10)
    };
  }
  
  // Regular paragraph
  return { type: 'paragraph', content: cleanText(trimmed) };
}

/**
 * Clean text: remove markdown syntax, NO italics for single asterisks
 */
function cleanText(text: string): string {
  return text
    // Remove bold markers but keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove single asterisks entirely (no italics)
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove inline code markers
    .replace(/`([^`]+)`/g, '$1')
    // Clean up any stray asterisks
    .replace(/\*/g, '')
    // Normalise whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create text runs with bold detection
 */
function createTextRuns(text: string, baseSize: number = FONTS.size.body): TextRun[] {
  const runs: TextRun[] = [];
  
  // Split by bold markers **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  for (const part of parts) {
    if (!part) continue;
    
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold text
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: FONTS.default,
        size: baseSize,
        color: COLORS.textGrey,
      }));
    } else {
      // Regular text (no italics applied for single asterisks)
      const cleanedPart = part
        .replace(/\*([^*]+)\*/g, '$1') // Remove single asterisks
        .replace(/\*/g, ''); // Remove any strays
      
      if (cleanedPart) {
        runs.push(new TextRun({
          text: cleanedPart,
          font: FONTS.default,
          size: baseSize,
          color: COLORS.textGrey,
        }));
      }
    }
  }
  
  return runs.length > 0 ? runs : [new TextRun({ text: ' ', font: FONTS.default, size: baseSize })];
}

/**
 * Generate a clean, professional Word document from AI response content
 */
export async function generateCleanAIResponseDocument(
  content: string,
  title: string = "AI Assistant Response"
): Promise<void> {
  const children: Paragraph[] = [];
  
  // Document title
  children.push(new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        font: FONTS.default,
        size: FONTS.size.title,
        color: COLORS.headingBlue,
      }),
    ],
    spacing: { after: 80 },
  }));
  
  // Date line
  const now = new Date();
  const dateString = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeString = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  children.push(new Paragraph({
    children: [
      new TextRun({
        text: `Generated: ${dateString} at ${timeString}`,
        font: FONTS.default,
        size: FONTS.size.small,
        color: COLORS.dateGrey,
        italics: true,
      }),
    ],
    spacing: { after: 300 },
  }));
  
  // Clean the content - remove HTML tags and code fences
  const cleanedContent = content
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^html\s*/i, '')
    .replace(/\s*```[a-z]*\s*$/gi, '')
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim();
  
  // Split into lines and process
  const lines = cleanedContent.split('\n');
  let lastType: string = '';
  
  for (const line of lines) {
    if (!line.trim()) {
      // Empty line - add small spacing paragraph
      if (lastType !== 'empty') {
        children.push(new Paragraph({
          children: [new TextRun({ text: '' })],
          spacing: { after: 60 },
        }));
      }
      lastType = 'empty';
      continue;
    }
    
    const parsed = parseMarkdownLine(line);
    lastType = parsed.type;
    
    switch (parsed.type) {
      case 'heading1':
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: parsed.content,
              bold: true,
              font: FONTS.default,
              size: FONTS.size.heading1,
              color: COLORS.headingBlue,
            }),
          ],
          spacing: { before: 240, after: 120 },
        }));
        break;
        
      case 'heading2':
      case 'heading3':
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: parsed.content,
              bold: true,
              font: FONTS.default,
              size: FONTS.size.heading2,
              color: COLORS.headingBlue,
            }),
          ],
          spacing: { before: 200, after: 100 },
        }));
        break;
        
      case 'bullet':
        children.push(new Paragraph({
          children: createTextRuns(parsed.content),
          bullet: { level: 0 },
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.25) },
        }));
        break;
        
      case 'numbered':
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: `${parsed.number}. `,
              bold: true,
              font: FONTS.default,
              size: FONTS.size.body,
              color: COLORS.textGrey,
            }),
            ...createTextRuns(parsed.content),
          ],
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.25) },
        }));
        break;
        
      case 'paragraph':
      default:
        if (parsed.content) {
          children.push(new Paragraph({
            children: createTextRuns(parsed.content),
            spacing: { after: 120 },
            alignment: AlignmentType.LEFT,
          }));
        }
        break;
    }
  }
  
  // Create document with clean styling
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONTS.default,
            size: FONTS.size.body,
            color: COLORS.textGrey,
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              after: 120,
            },
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      children,
    }],
  });
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.docx`;
  saveAs(blob, filename);
}
