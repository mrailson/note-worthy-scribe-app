import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";
import { generateMeetingFilename } from "./meetingFilename";

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

export interface ActionItemForExport {
  action_text: string;
  assignee_name?: string | null;
  due_date?: string | null;
  status?: string | null;
}

interface GenerateMeetingNotesOptions {
  metadata: MeetingMetadata;
  content: string;
  filename?: string;
  actionItems?: ActionItemForExport[];
  /**
   * Identifier of the LLM that actually produced the notes (post-fallback).
   * Stamped into the page footer for provenance so we can tell at a glance
   * which model emitted which document. Read from meetings.notes_model_used.
   */
  modelUsed?: string | null;
}

// Strip any existing "Action Items" section (heading + following bullet/table content)
// from the markdown so we don't duplicate it when we append the structured table.
export const stripActionItemsSection = (content: string): string => {
  // Matches a heading like "## Action Items" / "## ACTION ITEMS" / "**ACTION ITEMS**"
  // and everything until the next heading or end of document.
  const patterns = [
    /\n*#{1,6}\s*action\s*items\s*\n[\s\S]*?(?=\n#{1,6}\s|\n\*\*[A-Z][^*]*\*\*\s*\n|$)/gi,
    /\n*\*\*\s*action\s*items\s*\*\*\s*\n[\s\S]*?(?=\n#{1,6}\s|\n\*\*[A-Z][^*]*\*\*\s*\n|$)/gi,
  ];
  let cleaned = content;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '\n');
  }
  return cleaned.trim();
};

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

// Strip transcript sections, duplicate meeting title, and standalone ATTENDEES section from content
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
  
  // Remove standalone ATTENDEES section with TBC (since attendees are already in the Meeting Details table)
  // This matches "# ATTENDEES" or "## ATTENDEES" followed by "- TBC" or just "TBC" on the next line(s)
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+TBC\s*\n*/gi, '\n\n');
  
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
        
        // Helper to convert relative deadlines (Today, Tomorrow, etc.) to actual dates
        const suggestDeadline = (deadline: string) => {
          const lower = deadline.toLowerCase().trim();
          const today = new Date();
          
          // Handle TBC/To be confirmed
          if (lower === 'tbc' || lower === 'to be confirmed') {
            const twoWeeks = new Date(today);
            twoWeeks.setDate(twoWeeks.getDate() + 14);
            return twoWeeks.toLocaleDateString('en-GB');
          }
          
          // Handle relative date terms
          if (lower === 'today') {
            return today.toLocaleDateString('en-GB');
          }
          if (lower === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toLocaleDateString('en-GB');
          }
          if (lower === 'this week' || lower === 'end of week') {
            // Set to Friday of current week
            const dayOfWeek = today.getDay();
            const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
            const friday = new Date(today);
            friday.setDate(friday.getDate() + daysUntilFriday);
            return friday.toLocaleDateString('en-GB');
          }
          if (lower === 'next week') {
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            return nextWeek.toLocaleDateString('en-GB');
          }
          if (lower === 'asap' || lower === 'urgent') {
            return today.toLocaleDateString('en-GB') + ' (ASAP)';
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
      // Strip bold markers and stray asterisks from heading text
      const headingText = decodeHtmlEntities(headingMatch[2])
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
      
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

// Strip stray asterisks from a text fragment (after bold/italic has been extracted)
const cleanStrayAsterisks = (text: string): string => {
  return text
    .replace(/\*{2,}/g, '')   // Remove runs of 2+ asterisks
    .replace(/(?<!\S)\*|\*(?!\S)/g, '') // Remove lone asterisks at word boundaries
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Parse inline bold/italic formatting
const parseInlineFormatting = (text: string, TextRun: any) => {
  const runs: any[] = [];
  let currentIndex = 0;
  
  // Decode HTML entities first
  let decodedText = decodeHtmlEntities(text);
  
  // Pre-clean: fix malformed bold markers like "Gap** –" (orphaned closing **)
  // Convert orphaned ** that don't have a matching pair into nothing
  // First, process valid bold/italic, then strip leftovers
  decodedText = decodedText.replace(/\*{3,}/g, '**'); // Normalize 3+ asterisks to 2
  
  // Match **bold** and *italic*
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  
  while ((match = markdownRegex.exec(decodedText)) !== null) {
    // Add text before match (clean stray asterisks)
    if (match.index > currentIndex) {
      const normalText = cleanStrayAsterisks(decodedText.substring(currentIndex, match.index));
      if (normalText) {
        runs.push(new TextRun({ 
          text: normalText, 
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
          font: FONTS.default,
        }));
      }
    }
    
    // Add formatted text (also clean any nested stray asterisks)
    if (match[2]) {
      // Bold
      runs.push(new TextRun({ 
        text: cleanStrayAsterisks(match[2]), 
        size: FONTS.size.body, 
        bold: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    } else if (match[3]) {
      // Italic
      runs.push(new TextRun({ 
        text: cleanStrayAsterisks(match[3]), 
        size: FONTS.size.body, 
        italics: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    }
    
    currentIndex = match.index + match[0].length;
  }
  
  // Add remaining text (clean stray asterisks)
  if (currentIndex < decodedText.length) {
    const remainingText = cleanStrayAsterisks(decodedText.substring(currentIndex));
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
      text: cleanStrayAsterisks(decodedText), 
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

// Build a native Word "Action Items" section: H1 heading + 4-column table.
export const buildActionItemsSection = async (
  items: ActionItemForExport[]
): Promise<any[]> => {
  const {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    HeadingLevel,
    ShadingType,
  } = await import("docx");

  const elements: any[] = [];

  // Spacing before the heading
  elements.push(new Paragraph({ children: [new TextRun("")], spacing: { before: 240 } }));

  // Heading 1: "Action Items"
  elements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({
        text: "Action Items",
        bold: true,
        size: FONTS.size.heading1,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 240, after: 160 },
    })
  );

  if (!items || items.length === 0) {
    elements.push(
      new Paragraph({
        children: [new TextRun({
          text: "No action items recorded.",
          italics: true,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
          font: FONTS.default,
        })],
      })
    );
    return elements;
  }

  const headers = ["Action", "Owner", "Deadline", "Status"];
  // Total ~9360 twips of usable width with 1" margins on US Letter / similar
  const totalWidth = 9360;
  const colPercents = [45, 20, 20, 15];
  const columnWidths = colPercents.map(p => Math.round((p / 100) * totalWidth));

  const cellMargins = { top: 100, bottom: 100, left: 120, right: 120 };
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
  const tableBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((label, idx) => new TableCell({
      width: { size: columnWidths[idx], type: WidthType.DXA },
      shading: { fill: "E5E7EB", type: ShadingType.CLEAR, color: "auto" },
      margins: cellMargins,
      children: [new Paragraph({
        children: [new TextRun({
          text: label,
          bold: true,
          size: FONTS.size.body,
          color: "111111",
          font: FONTS.default,
        })],
      })],
    })),
  });

  const dataRows = items.map((item) => {
    const action = (item.action_text ?? "").toString().trim() || "—";
    const owner = (item.assignee_name ?? "").toString().trim() || "TBC";
    const deadlineRaw = (item.due_date ?? "").toString().trim();
    const deadline = deadlineRaw || "TBC";
    const status = (item.status ?? "").toString().trim() || "Open";

    const cells = [action, owner, deadline, status].map((text, idx) => new TableCell({
      width: { size: columnWidths[idx], type: WidthType.DXA },
      margins: cellMargins,
      children: [new Paragraph({
        children: [new TextRun({
          text,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
          font: FONTS.default,
        })],
      })],
    }));

    return new TableRow({ children: cells });
  });

  elements.push(new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    borders: tableBorders,
    rows: [headerRow, ...dataRows],
  }));

  return elements;
};

// Main export function
export const generateMeetingNotesDocx = async (options: GenerateMeetingNotesOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
  
  // Strip transcript sections and replace Facilitator/Unidentified with logged user's name
  let cleanedContent = stripTranscriptSection(options.content);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, options.metadata.loggedUserName);
  cleanedContent = sanitiseMeetingNotes(cleanedContent);

  // Strip any existing Action Items section so we can append a structured table from data.
  if (options.actionItems !== undefined) {
    cleanedContent = stripActionItemsSection(cleanedContent);
  }
  
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

  // Append structured Action Items section from data (if provided)
  if (options.actionItems !== undefined) {
    const actionElements = await buildActionItemsSection(options.actionItems);
    children.push(...actionElements);
  }
  
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
  const filename = options.filename || generateMeetingFilename(options.metadata.title || 'Meeting Notes', new Date(), 'docx');
  saveAs(blob, filename);
};
