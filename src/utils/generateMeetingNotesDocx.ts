import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";

interface MeetingMetadata {
  title: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  attendees?: string;
}

interface GenerateMeetingNotesOptions {
  metadata: MeetingMetadata;
  content: string;
  filename?: string;
}

// Strip transcript sections from content
const stripTranscriptSection = (content: string): string => {
  let cleaned = content;
  
  // Remove various transcript section patterns
  cleaned = cleaned.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Full Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
  
  return cleaned.trim();
};

// Parse content and convert to docx elements
const parseContentToDocxElements = async (content: string) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle } = await import("docx");
  
  const elements: any[] = [];
  const lines = content.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines with minimal spacing
    if (!line) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: "", size: FONTS.size.body })],
        spacing: { after: 60 },
      }));
      i++;
      continue;
    }
    
    // Check for markdown tables
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const trimmedLine = lines[i].trim();
        // Skip separator lines
        if (!/^\|[\s\-:]+\|/.test(trimmedLine)) {
          tableLines.push(trimmedLine);
        }
        i++;
      }
      
      if (tableLines.length > 0) {
        const parseCells = (line: string): string[] => {
          return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
            .map(cell => cell.replace(/\*\*/g, '').replace(/\*/g, '')); // Remove markdown
        };
        
        const headerCells = parseCells(tableLines[0]);
        const bodyRows = tableLines.slice(1).map(parseCells);
        
        // Create table with NHS blue header
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.headingBlue },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.headingBlue },
            left: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.headingBlue },
            right: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.headingBlue },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          rows: [
            // Header row with blue background
            new TableRow({
              children: headerCells.map(cell => 
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ 
                      text: cell, 
                      bold: true, 
                      size: FONTS.size.body,
                      color: NHS_COLORS.tableHeaderText,
                      font: FONTS.default,
                    })],
                    spacing: { before: 80, after: 80 },
                  })],
                  shading: { fill: NHS_COLORS.tableHeaderBg },
                  margins: {
                    top: 80,
                    bottom: 80,
                    left: 100,
                    right: 100,
                  },
                })
              ),
            }),
            // Body rows
            ...bodyRows.map(row => 
              new TableRow({
                children: row.map(cell => 
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ 
                        text: cell, 
                        size: FONTS.size.body,
                        color: NHS_COLORS.textGrey,
                        font: FONTS.default,
                      })],
                    })],
                    margins: {
                      top: 80,
                      bottom: 80,
                      left: 100,
                      right: 100,
                    },
                  })
                ),
              })
            ),
          ],
        });
        
        elements.push(table);
        elements.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      }
      continue;
    }
    
    // Check for headings (# ## ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      
      const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      
      elements.push(new Paragraph({
        children: [new TextRun({ 
          text: headingText,
          bold: true,
          size: level === 1 ? FONTS.size.heading1 : level === 2 ? FONTS.size.heading2 : FONTS.size.heading3,
          color: NHS_COLORS.headingBlue,
          font: FONTS.default,
        })],
        heading: headingLevels[level - 1],
        spacing: { 
          before: level === 1 ? 240 : level === 2 ? 200 : 160, 
          after: level === 1 ? 120 : level === 2 ? 100 : 80,
        },
      }));
      i++;
      continue;
    }
    
    // Check for bullet points (-, •, or *)
    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      const bulletText = line.replace(/^[-•*]\s*/, '');
      const runs = parseInlineFormatting(bulletText, TextRun);
      
      elements.push(new Paragraph({
        children: runs,
        numbering: {
          reference: "bullet-numbering",
          level: 0,
        },
        spacing: { after: 60 },
      }));
      i++;
      continue;
    }
    
    // Check for numbered lists
    const numberMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      const listText = numberMatch[2];
      const runs = parseInlineFormatting(listText, TextRun);
      
      elements.push(new Paragraph({
        children: runs,
        numbering: {
          reference: "numbered-numbering",
          level: 0,
        },
        spacing: { after: 60 },
      }));
      i++;
      continue;
    }
    
    // Regular paragraph with inline formatting
    const runs = parseInlineFormatting(line, TextRun);
    elements.push(new Paragraph({
      children: runs,
      spacing: { after: 80 },
    }));
    i++;
  }
  
  return elements;
};

// Parse inline bold/italic formatting
const parseInlineFormatting = (text: string, TextRun: any) => {
  const runs: any[] = [];
  let currentIndex = 0;
  
  // Match **bold** and *italic*
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  
  while ((match = markdownRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > currentIndex) {
      const normalText = text.substring(currentIndex, match.index);
      if (normalText) {
        runs.push(new TextRun({ 
          text: normalText, 
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
          font: FONTS.default,
        }));
      }
    }
    
    // Add formatted text
    if (match[2]) {
      // Bold
      runs.push(new TextRun({ 
        text: match[2], 
        size: FONTS.size.body, 
        bold: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    } else if (match[3]) {
      // Italic
      runs.push(new TextRun({ 
        text: match[3], 
        size: FONTS.size.body, 
        italics: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    }
    
    currentIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText) {
      runs.push(new TextRun({ 
        text: remainingText, 
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    }
  }
  
  // If no formatting found, return plain text
  if (runs.length === 0) {
    runs.push(new TextRun({ 
      text: text, 
      size: FONTS.size.body,
      color: NHS_COLORS.textGrey,
      font: FONTS.default,
    }));
  }
  
  return runs;
};

// Generate metadata table
const createMetadataTable = async (metadata: MeetingMetadata) => {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle } = await import("docx");
  
  const rows: any[] = [];
  
  if (metadata.date) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: "Date:", 
                bold: true, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
            width: { size: 25, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: metadata.date, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
            width: { size: 75, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );
  }
  
  if (metadata.time || metadata.duration) {
    const timeText = metadata.time && metadata.duration 
      ? `${metadata.time} (${metadata.duration})`
      : metadata.time || metadata.duration || '';
    
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: "Time:", 
                bold: true, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: timeText, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
          }),
        ],
      })
    );
  }
  
  if (metadata.location) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: "Location:", 
                bold: true, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: metadata.location, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
              })],
            })],
          }),
        ],
      })
    );
  }
  
  if (rows.length === 0) return null;
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
};

// Main export function
export const generateMeetingNotesDocx = async (options: GenerateMeetingNotesOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
  
  // Strip transcript sections
  const cleanedContent = stripTranscriptSection(options.content);
  
  // Build document children
  const children: any[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: options.metadata.title,
        bold: true,
        size: FONTS.size.title,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );
  
  // Metadata table
  const metadataTable = await createMetadataTable(options.metadata);
  if (metadataTable) {
    children.push(metadataTable);
    children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  }
  
  // Attendees
  if (options.metadata.attendees) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Attendees: ",
            bold: true,
            size: FONTS.size.body,
            color: NHS_COLORS.textGrey,
            font: FONTS.default,
          }),
          new TextRun({
            text: options.metadata.attendees,
            size: FONTS.size.body,
            color: NHS_COLORS.textGrey,
            font: FONTS.default,
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }
  
  // Parse and add content
  const contentElements = await parseContentToDocxElements(cleanedContent);
  children.push(...contentElements);
  
  // Footer
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `Generated on ${dateStr} ${timeStr}`,
        italics: true,
        size: FONTS.size.footer,
        color: NHS_COLORS.textLightGrey,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
    })
  );
  
  // Create document with NHS theme
  const styles = buildNHSStyles();
  const numbering = buildNumbering();
  
  const doc = new Document({
    styles: styles,
    numbering: numbering,
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    }],
  });
  
  // Generate and save
  const blob = await Packer.toBlob(doc);
  const filename = options.filename || `meeting-notes-${dateStr.replace(/\//g, '-')}.docx`;
  saveAs(blob, filename);
};
