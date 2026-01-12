import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";

// Decode HTML entities to plain characters for Word output
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

interface MeetingMetadata {
  title: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  attendees?: string;
  loggedUserName?: string; // The logged-in user who ran the meeting
}

interface GenerateMeetingNotesOptions {
  metadata: MeetingMetadata;
  content: string;
  filename?: string;
}

// Replace "Facilitator" or "Unidentified" references with the actual user name
export const replaceFacilitatorWithUserName = (content: string, userName?: string): string => {
  if (!userName) return content;
  
  let cleaned = content;
  
  // Replace various patterns of Facilitator/Unidentified with the actual user name
  cleaned = cleaned.replace(/\[Unidentified\]\s*\(Facilitator\)/gi, userName);
  cleaned = cleaned.replace(/Unidentified\s*\(Facilitator\)/gi, userName);
  cleaned = cleaned.replace(/\[Facilitator\]/gi, userName);
  cleaned = cleaned.replace(/\(Facilitator\)/gi, `(${userName})`);
  cleaned = cleaned.replace(/Facilitator(?=\s*[,\.\-\:])/gi, userName);
  cleaned = cleaned.replace(/\[Unidentified\]/gi, userName);
  cleaned = cleaned.replace(/Unidentified(?=\s*[,\.\-\:])/gi, userName);
  
  return cleaned;
};

// Strip transcript sections and duplicate meeting title from content
export const stripTranscriptSection = (content: string): string => {
  let cleaned = content;
  
  // Remove various transcript section patterns
  cleaned = cleaned.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Full Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
  
  // Remove duplicate "Meeting Title:" lines (with or without bullet points)
  cleaned = cleaned.replace(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*.*$/gim, '');
  
  // Remove "Background" heading (with or without markdown formatting)
  cleaned = cleaned.replace(/^#+?\s*Background\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*Background\s*$/gim, '');
  
  return cleaned.trim();
};

// Parse content and convert to docx elements
export const parseContentToDocxElements = async (content: string) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, TableLayoutType } = await import("docx");
  
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

      const isSeparatorRow = (row: string) => {
        const cells = row
          .split('|')
          .map(c => c.trim())
          .filter(Boolean);
        return cells.length > 0 && cells.every(c => /^:?-{3,}:?$/.test(c));
      };

      // NOTE: meeting notes often contain blank lines between table rows.
      // We treat blank lines as part of the same table block so Word output stays as one table.
      while (i < lines.length) {
        const trimmedLine = lines[i].trim();

        if (!trimmedLine) {
          i++;
          continue;
        }

        if (!trimmedLine.startsWith('|')) break;

        if (!isSeparatorRow(trimmedLine)) {
          tableLines.push(trimmedLine);
        }

        i++;
      }
      
      if (tableLines.length > 0) {
        const parseCells = (line: string): string[] => {
          return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
            .map(cell => decodeHtmlEntities(cell.replace(/\*\*/g, '').replace(/\*/g, ''))); // Remove markdown and decode entities
        };
        
        const headerCells = parseCells(tableLines[0]);
        const bodyRows = tableLines.slice(1).map(parseCells);
        
        // Check if this is an action items table (has Priority column)
        const priorityColIndex = headerCells.findIndex(h => h.toLowerCase().includes('priority'));
        const deadlineColIndex = headerCells.findIndex(h => h.toLowerCase().includes('deadline') || h.toLowerCase().includes('due'));
        
        // Helper to get priority colour
        const getPriorityStyle = (priority: string) => {
          const p = priority.toLowerCase().trim();
          if (p === 'high' || p === 'urgent') return { color: NHS_COLORS.priorityHigh, bg: NHS_COLORS.priorityHighBg };
          if (p === 'medium' || p === 'normal') return { color: NHS_COLORS.priorityMedium, bg: NHS_COLORS.priorityMediumBg };
          if (p === 'low') return { color: NHS_COLORS.priorityLow, bg: NHS_COLORS.priorityLowBg };
          return null;
        };
        
        // Helper to suggest deadline if TBC
        const suggestDeadline = (deadline: string) => {
          if (deadline.toLowerCase() === 'tbc' || deadline.toLowerCase() === 'to be confirmed') {
            const twoWeeks = new Date();
            twoWeeks.setDate(twoWeeks.getDate() + 14);
            return twoWeeks.toLocaleDateString('en-GB');
          }
          return deadline;
        };
        
        // Calculate column widths based on typical action table layout
        // Action(40%), Owner(20%), Deadline(20%), Priority(20%)
        const columnCount = headerCells.length;
        const getColumnWidths = (headers: string[]): number[] => {
          // Default to equal distribution
          const defaultWidth = Math.floor(100 / headers.length);
          const widths = headers.map(() => defaultWidth);
          
          // Adjust based on typical column names for action tables
          headers.forEach((h, i) => {
            const lower = h.toLowerCase();
            if (lower.includes('action') || lower.includes('description') || lower.includes('item') || lower.includes('task')) {
              widths[i] = 40; // Give more space to action/description columns
            } else if (lower.includes('owner') || lower.includes('assigned') || lower.includes('responsible')) {
              widths[i] = 20;
            } else if (lower.includes('deadline') || lower.includes('due') || lower.includes('date')) {
              widths[i] = 20;
            } else if (lower.includes('priority') || lower.includes('status')) {
              widths[i] = 15;
            }
          });
          
          // Normalize to 100%
          const total = widths.reduce((a, b) => a + b, 0);
          return widths.map(w => Math.round((w / total) * 100));
        };
        
        const columnWidths = getColumnWidths(headerCells);
        
        // Create table with NHS blue header and proper column widths
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: columnWidths.map(w => Math.round((w / 100) * 9638)), // Convert % to twips (9638 twips = 6.69 inches page width)
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            left: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            right: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
          },
          rows: [
            // Header row with blue background
            new TableRow({
              tableHeader: true,
              children: headerCells.map((cell, colIndex) => 
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
                  width: { size: columnWidths[colIndex], type: WidthType.PERCENTAGE },
                  margins: {
                    top: 100,
                    bottom: 100,
                    left: 120,
                    right: 120,
                  },
                })
              ),
            }),
            // Body rows with priority colouring and deadline suggestions
            ...bodyRows.map((row, rowIndex) => 
              new TableRow({
                children: row.map((cell, colIndex) => {
                  let displayText = cell;
                  let cellColor = NHS_COLORS.textGrey;
                  let cellBg: string | undefined = rowIndex % 2 === 0 ? undefined : "F9FAFB"; // Alternate row shading
                  let isBold = false;
                  
                  // Apply priority colouring
                  if (colIndex === priorityColIndex && priorityColIndex >= 0) {
                    const style = getPriorityStyle(cell);
                    if (style) {
                      cellColor = style.color;
                      cellBg = style.bg;
                      isBold = true;
                    }
                  }
                  
                  // Suggest deadline if TBC
                  if (colIndex === deadlineColIndex && deadlineColIndex >= 0) {
                    displayText = suggestDeadline(cell);
                  }
                  
                  return new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ 
                        text: displayText, 
                        size: FONTS.size.body,
                        color: cellColor,
                        font: FONTS.default,
                        bold: isBold,
                      })],
                      spacing: { before: 60, after: 60 },
                    })],
                    shading: cellBg ? { fill: cellBg } : undefined,
                    width: { size: columnWidths[colIndex], type: WidthType.PERCENTAGE },
                    margins: {
                      top: 80,
                      bottom: 80,
                      left: 120,
                      right: 120,
                    },
                  });
                }),
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
      const headingText = decodeHtmlEntities(headingMatch[2]);
      
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
  
  // Decode HTML entities first
  const decodedText = decodeHtmlEntities(text);
  
  // Match **bold** and *italic*
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  
  while ((match = markdownRegex.exec(decodedText)) !== null) {
    // Add text before match
    if (match.index > currentIndex) {
      const normalText = decodedText.substring(currentIndex, match.index);
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
  if (currentIndex < decodedText.length) {
    const remainingText = decodedText.substring(currentIndex);
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
      text: decodedText, 
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
  
  // Strip transcript sections and replace Facilitator/Unidentified with logged user's name
  let cleanedContent = stripTranscriptSection(options.content);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, options.metadata.loggedUserName);
  cleanedContent = sanitiseMeetingNotes(cleanedContent);
  
  // Also clean the attendees field
  const cleanedAttendees = options.metadata.attendees 
    ? replaceFacilitatorWithUserName(options.metadata.attendees, options.metadata.loggedUserName)
    : options.metadata.attendees;
  
  // Clean the title by removing leading asterisks and markdown formatting
  const cleanTitle = options.metadata.title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
  
  // Build document children
  const children: any[] = [];
  
  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: cleanTitle,
        bold: true,
        size: FONTS.size.title,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );
  
  // Metadata table removed - details are shown in the Meeting Details section of the content
  
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
            text: cleanedAttendees || '',
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
