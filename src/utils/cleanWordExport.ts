/**
 * Clean Word Export Utility
 * Produces professional, well-formatted Word documents from AI responses
 * without excessive italics or indentation issues.
 */

import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, convertInchesToTwip, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, ShadingType } from "docx";
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
  
  // Headings (most specific first)
  if (trimmed.startsWith('#### ')) {
    return { type: 'heading3', content: cleanText(trimmed.slice(5)) };
  }
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
 * Parse markdown table lines into a proper Word Table
 */
function buildWordTable(tableLines: string[]): Table | null {
  // Parse cells from a pipe-delimited line
  const parseCells = (line: string): string[] => {
    const raw = line.split('|').map(c => c.trim());
    return raw.slice(1, -1); // remove empty first/last from pipe borders
  };

  // First line = headers
  const headers = parseCells(tableLines[0]);
  if (headers.length === 0) return null;

  // Find separator row (contains :--- or --- patterns)
  let dataStartIndex = 1;
  if (tableLines.length > 1 && /^[\s|:\-]+$/.test(tableLines[1])) {
    dataStartIndex = 2;
  }

  // Data rows
  const dataRows = tableLines.slice(dataStartIndex).map(parseCells);

  const colCount = headers.length;
  const colWidth = Math.floor(9000 / colCount); // distribute width evenly

  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
  const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h =>
      new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        borders,
        shading: { type: ShadingType.SOLID, color: COLORS.headingBlue, fill: COLORS.headingBlue },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cleanText(h),
                bold: true,
                font: FONTS.default,
                size: FONTS.size.body,
                color: "FFFFFF",
              }),
            ],
            spacing: { before: 60, after: 60 },
          }),
        ],
      })
    ),
  });

  // Data rows
  const rows = dataRows.map((cells, rowIndex) => {
    const bgColor = rowIndex % 2 === 0 ? "FFFFFF" : "F8FAFC";
    return new TableRow({
      children: Array.from({ length: colCount }, (_, ci) =>
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          borders,
          shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: createTextRuns(cleanText(cells[ci] || '')),
              spacing: { before: 40, after: 40 },
            }),
          ],
        })
      ),
    });
  });

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...rows],
  });
}


export async function generateCleanAIResponseDocument(
  content: string,
  title: string = "AI Assistant Response",
  options?: { footerNote?: string; logoUrl?: string; logoPosition?: 'left' | 'center' | 'right' }
): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Insert practice logo if provided
  if (options?.logoUrl) {
    try {
      const response = await fetch(options.logoUrl);
      if (response.ok) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const logoAlign = options?.logoPosition || 'left';
        const alignMap = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT };
        children.push(new Paragraph({
          children: [
            new ImageRun({
              data: uint8Array,
              transformation: { width: 160, height: 60 },
              type: 'png',
            } as any),
          ],
          alignment: alignMap[logoAlign],
          spacing: { after: 200 },
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch logo for Word document:', e);
    }
  }
  
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
  let i = 0;
  
  while (i < lines.length) {
    const trimmedLine = lines[i].trim();
    
    // Skip horizontal rules / separators (match preview behaviour)
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      i++;
      continue;
    }
    
    // Detect markdown table (line starts with |)
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      
      if (tableLines.length >= 2) {
        const wordTable = buildWordTable(tableLines);
        if (wordTable) {
          children.push(wordTable);
          lastType = 'table';
          continue;
        }
      }
      // If table parsing failed, fall through and re-process
      i -= tableLines.length;
    }
    
    const line = lines[i];
    i++;
    
    if (!trimmedLine) {
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
  
  // Add footer note if provided
  if (options?.footerNote) {
    children.push(new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { after: 200 },
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: options.footerNote,
          font: FONTS.default,
          size: FONTS.size.body,
          color: COLORS.dateGrey,
          italics: true,
        }),
      ],
      spacing: { before: 300, after: 60 },
      alignment: AlignmentType.LEFT,
    }));
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
