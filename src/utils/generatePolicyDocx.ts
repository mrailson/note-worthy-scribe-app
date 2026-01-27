import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, convertInchesToTwip, Footer, PageNumber, NumberFormat, Header, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

interface PolicyMetadata {
  title: string;
  version: string;
  effective_date: string;
  review_date: string;
  references: string[];
}

export interface PolicyDocxOptions {
  showLogo?: boolean;
  showFooter?: boolean;
  showPageNumbers?: boolean;
  practiceDetails?: {
    name?: string;
    address?: string;
    postcode?: string;
  };
  logoUrl?: string;
}

// Professional colour scheme matching NHS/Notewell branding
const COLORS = {
  nhsBlue: "005EB8",
  headingBlue: "1E3A8A",
  subHeadingBlue: "2563EB",
  textGrey: "374151",
  lightGrey: "6B7280",
  tableBorder: "D1D5DB",
  tableHeaderBg: "EFF6FF",
  white: "FFFFFF",
};

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    // Get image dimensions
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          data: arrayBuffer,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export const generatePolicyDocx = async (
  content: string,
  metadata: PolicyMetadata,
  policyName: string,
  options: PolicyDocxOptions = {}
): Promise<void> => {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const {
    showLogo = true,
    showFooter = true,
    showPageNumbers = true,
    practiceDetails,
    logoUrl,
  } = options;

  // Parse markdown content into sections
  const sections = parseMarkdownToSections(content);

  // Fetch logo if enabled and URL provided
  let logoImage: { data: ArrayBuffer; width: number; height: number } | null = null;
  if (showLogo && logoUrl) {
    logoImage = await fetchImageAsBase64(logoUrl);
  }

  // Build header children (logo)
  const headerChildren: Paragraph[] = [];
  if (showLogo && logoImage) {
    // Calculate dimensions - max height 60px, maintain aspect ratio
    const maxHeight = 60;
    const aspectRatio = logoImage.width / logoImage.height;
    const displayHeight = Math.min(logoImage.height, maxHeight);
    const displayWidth = displayHeight * aspectRatio;

    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoImage.data,
            transformation: {
              width: displayWidth,
              height: displayHeight,
            },
            type: 'png',
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
      })
    );
  }

  // Build footer children
  const footerChildren: Paragraph[] = [];
  
  if (showFooter && practiceDetails?.name) {
    const footerParts: string[] = [practiceDetails.name];
    if (practiceDetails.address) footerParts.push(practiceDetails.address);
    if (practiceDetails.postcode) footerParts.push(practiceDetails.postcode);
    
    footerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: footerParts.join(' • '),
            size: 16,
            color: COLORS.lightGrey,
            font: "Calibri",
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );
  }
  
  if (showPageNumbers) {
    footerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Page ",
            size: 16,
            color: COLORS.lightGrey,
            font: "Calibri",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: COLORS.lightGrey,
            font: "Calibri",
          }),
          new TextRun({
            text: " of ",
            size: 16,
            color: COLORS.lightGrey,
            font: "Calibri",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: COLORS.lightGrey,
            font: "Calibri",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
      })
    );
  }

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Calibri",
            size: 22, // 11pt
            color: COLORS.textGrey,
          },
          paragraph: {
            spacing: {
              after: 120, // 6pt
              line: 276, // 1.15 line spacing
            },
          },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Calibri",
            size: 28, // 14pt
            bold: true,
            color: COLORS.headingBlue,
          },
          paragraph: {
            spacing: {
              before: 280,
              after: 120,
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Calibri",
            size: 24, // 12pt
            bold: true,
            color: COLORS.subHeadingBlue,
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 100,
            },
          },
        },
      ],
    },
    sections: [
      {
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
        headers: headerChildren.length > 0 ? {
          default: new Header({
            children: headerChildren,
          }),
        } : undefined,
        footers: footerChildren.length > 0 ? {
          default: new Footer({
            children: footerChildren,
          }),
        } : undefined,
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: metadata.title,
                bold: true,
                size: 48, // 24pt
                color: COLORS.nhsBlue,
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Document Control Table
          createDocumentControlTable(metadata, today),

          // Spacing after table
          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Content sections
          ...sections,

          // References section
          new Paragraph({
            children: [
              new TextRun({
                text: "References & Legislation",
                bold: true,
                size: 28,
                color: COLORS.headingBlue,
                font: "Calibri",
              }),
            ],
            spacing: { before: 280, after: 120 },
          }),
          ...metadata.references.map(ref =>
            new Paragraph({
              children: [
                new TextRun({ text: "• ", bold: true, font: "Calibri", size: 22 }),
                new TextRun({ text: ref, font: "Calibri", size: 22, color: COLORS.textGrey }),
              ],
              spacing: { after: 60 },
              indent: { left: convertInchesToTwip(0.25) },
            })
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${policyName.replace(/[^a-zA-Z0-9]/g, '_')}_v${metadata.version}.docx`;
  saveAs(blob, filename);
};

function createDocumentControlTable(metadata: PolicyMetadata, generatedDate: string): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
  };

  const headerCellStyle = {
    borders: cellBorder,
    shading: { fill: COLORS.tableHeaderBg },
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1),
    },
  };

  const valueCellStyle = {
    borders: cellBorder,
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1),
    },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Version", bold: true, font: "Calibri", size: 22 })] 
            })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            ...headerCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: metadata.version, font: "Calibri", size: 22 })] 
            })],
            width: { size: 30, type: WidthType.PERCENTAGE },
            ...valueCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Effective Date", bold: true, font: "Calibri", size: 22 })] 
            })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            ...headerCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: metadata.effective_date, font: "Calibri", size: 22 })] 
            })],
            width: { size: 30, type: WidthType.PERCENTAGE },
            ...valueCellStyle,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Review Date", bold: true, font: "Calibri", size: 22 })] 
            })],
            ...headerCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: metadata.review_date, font: "Calibri", size: 22 })] 
            })],
            ...valueCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Generated", bold: true, font: "Calibri", size: 22 })] 
            })],
            ...headerCellStyle,
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: generatedDate, font: "Calibri", size: 22 })] 
            })],
            ...valueCellStyle,
          }),
        ],
      }),
    ],
  });
}

/**
 * Create a proper table from markdown pipe table syntax
 */
function createMarkdownTable(lines: string[]): Table {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
  };

  const rows: TableRow[] = [];
  let isHeader = true;

  for (const line of lines) {
    // Skip separator lines (---|---|---)
    if (/^[\s|:-]+$/.test(line.replace(/\|/g, '').trim()) && line.includes('-')) {
      isHeader = false;
      continue;
    }

    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    if (cells.length === 0) continue;

    const tableCells = cells.map(cellText => 
      new TableCell({
        children: [
          new Paragraph({
            children: parseInlineFormatting(cellText),
          }),
        ],
        borders: cellBorder,
        shading: isHeader ? { fill: COLORS.tableHeaderBg } : undefined,
        margins: {
          top: convertInchesToTwip(0.05),
          bottom: convertInchesToTwip(0.05),
          left: convertInchesToTwip(0.1),
          right: convertInchesToTwip(0.1),
        },
      })
    );

    rows.push(new TableRow({ children: tableCells }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function parseMarkdownToSections(markdown: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = markdown.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      elements.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      i++;
      continue;
    }

    // Clean up malformed HTML tags that might appear
    const cleanedLine = trimmed
      .replace(/<\/h\d+>/gi, '')
      .replace(/<h\d+>/gi, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x26;/g, '&');

    // Check for markdown table (starts with |)
    if (cleanedLine.startsWith('|') || (cleanedLine.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---'))) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].includes('|') || lines[i].trim().includes('---'))) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        elements.push(createMarkdownTable(tableLines));
        elements.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      }
      continue;
    }

    // Heading 1: # Title
    if (cleanedLine.startsWith('# ') && !cleanedLine.startsWith('## ')) {
      const headingText = stripAllMarkdown(cleanedLine.substring(2));
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: headingText,
            bold: true,
            size: 28,
            color: COLORS.headingBlue,
            font: "Calibri",
          }),
        ],
        spacing: { before: 280, after: 120 },
      }));
      i++;
      continue;
    }

    // Heading 2: ## Subtitle
    if (cleanedLine.startsWith('## ')) {
      const headingText = stripAllMarkdown(cleanedLine.substring(3));
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: headingText,
            bold: true,
            size: 24,
            color: COLORS.subHeadingBlue,
            font: "Calibri",
          }),
        ],
        spacing: { before: 200, after: 100 },
      }));
      i++;
      continue;
    }

    // Heading 3: ### Subheading
    if (cleanedLine.startsWith('### ')) {
      const headingText = stripAllMarkdown(cleanedLine.substring(4));
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: headingText,
            bold: true,
            size: 22,
            color: COLORS.textGrey,
            font: "Calibri",
          }),
        ],
        spacing: { before: 160, after: 80 },
      }));
      i++;
      continue;
    }

    // Bullet point: - item or * item
    if (cleanedLine.startsWith('- ') || cleanedLine.startsWith('* ')) {
      const bulletText = cleanedLine.substring(2);
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: "• ", font: "Calibri", size: 22 }),
          ...parseInlineFormatting(bulletText),
        ],
        indent: { left: convertInchesToTwip(0.25) },
        spacing: { after: 60 },
      }));
      i++;
      continue;
    }

    // Numbered list: 1. item
    const numberedMatch = cleanedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: `${numberedMatch[1]}. `, font: "Calibri", size: 22, bold: true }),
          ...parseInlineFormatting(numberedMatch[2]),
        ],
        indent: { left: convertInchesToTwip(0.25) },
        spacing: { after: 60 },
      }));
      i++;
      continue;
    }

    // Regular paragraph
    const runs = parseInlineFormatting(cleanedLine);
    elements.push(new Paragraph({
      children: runs,
      spacing: { after: 120 },
    }));
    i++;
  }

  return elements;
}

/**
 * Strip all markdown formatting and return plain text
 */
function stripAllMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // Remove *italic*
    .replace(/`([^`]+)`/g, '$1')          // Remove `code`
    .replace(/\*\*/g, '')                  // Remove any stray **
    .replace(/\*/g, '')                    // Remove any stray *
    .trim();
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  
  // Clean up any stray markdown/HTML artifacts
  let cleanText = text
    .replace(/<\/h\d+>/gi, '')
    .replace(/<h\d+>/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&');

  // Use a simple state machine approach for robust bold parsing
  let result: TextRun[] = [];
  let currentPos = 0;
  
  while (currentPos < cleanText.length) {
    // Look for **
    const boldStart = cleanText.indexOf('**', currentPos);
    
    if (boldStart === -1) {
      // No more bold markers, add rest as regular text
      const remaining = cleanText.substring(currentPos);
      if (remaining) {
        result.push(new TextRun({ 
          text: remaining, 
          font: "Calibri", 
          size: 22, 
          color: COLORS.textGrey 
        }));
      }
      break;
    }
    
    // Add text before the bold marker
    if (boldStart > currentPos) {
      const beforeText = cleanText.substring(currentPos, boldStart);
      result.push(new TextRun({ 
        text: beforeText, 
        font: "Calibri", 
        size: 22, 
        color: COLORS.textGrey 
      }));
    }
    
    // Find the closing **
    const boldEnd = cleanText.indexOf('**', boldStart + 2);
    
    if (boldEnd === -1) {
      // No closing **, treat remaining as regular text (skip the **)
      const remaining = cleanText.substring(boldStart + 2);
      if (remaining) {
        result.push(new TextRun({ 
          text: remaining, 
          font: "Calibri", 
          size: 22, 
          color: COLORS.textGrey 
        }));
      }
      break;
    }
    
    // Extract and add the bold text
    const boldText = cleanText.substring(boldStart + 2, boldEnd);
    if (boldText) {
      result.push(new TextRun({ 
        text: boldText, 
        bold: true, 
        font: "Calibri", 
        size: 22, 
        color: COLORS.textGrey 
      }));
    }
    
    currentPos = boldEnd + 2;
  }

  // If no runs were created, return the full text as-is
  if (result.length === 0) {
    result.push(new TextRun({ 
      text: cleanText || ' ', 
      font: "Calibri", 
      size: 22, 
      color: COLORS.textGrey 
    }));
  }

  return result;
}
