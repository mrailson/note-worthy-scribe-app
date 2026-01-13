import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";

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
  loggedUserName?: string;
  classification?: string; // e.g., "OFFICIAL", "OFFICIAL - SENSITIVE"
}

interface GenerateProfessionalMeetingOptions {
  metadata: MeetingMetadata;
  content: string;
  filename?: string;
}

// Extract meeting details from content
const extractMeetingDetails = (content: string): Partial<MeetingMetadata> => {
  const details: Partial<MeetingMetadata> = {};
  
  // Extract date patterns
  const dateMatch = content.match(/Date[:\s]+([^\n]+)/i);
  if (dateMatch) details.date = dateMatch[1].trim();
  
  // Extract time patterns
  const timeMatch = content.match(/Time[:\s]+([^\n]+)/i);
  if (timeMatch) details.time = timeMatch[1].trim();
  
  // Extract location patterns
  const locationMatch = content.match(/Location[:\s]+([^\n]+)/i);
  if (locationMatch) details.location = locationMatch[1].trim();
  
  // Extract attendees patterns
  const attendeesMatch = content.match(/Attendees?[:\s]+([^\n]+)/i);
  if (attendeesMatch) details.attendees = attendeesMatch[1].trim();
  
  // Extract duration patterns
  const durationMatch = content.match(/Duration[:\s]+([^\n]+)/i);
  if (durationMatch) details.duration = durationMatch[1].trim();
  
  return details;
};

// Extract executive summary from content
const extractExecutiveSummary = (content: string): string | null => {
  // Look for Executive Summary section
  const summaryMatch = content.match(/(?:Executive\s*Summary|Overview|Summary)[:\s]*\n([\s\S]*?)(?=\n#{1,3}\s|\n\*\*[A-Z]|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().split('\n')[0]; // Get first paragraph
  }
  return null;
};

// Strip transcript sections and duplicate meeting details
const stripTranscriptAndDetails = (content: string): string => {
  let cleaned = content;
  
  // Remove transcript sections
  cleaned = cleaned.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Full Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
  
  // Remove duplicate Meeting Title lines
  cleaned = cleaned.replace(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*.*$/gim, '');
  
  // Remove Background heading
  cleaned = cleaned.replace(/^#+?\s*Background\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*Background\s*$/gim, '');
  
  // Remove duplicate inline meeting details (Date:, Time:, Location:) - these are shown in the header box
  cleaned = cleaned.replace(/^\s*Date\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Time\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Location\s*:\s*.+$/gim, '');
  
  // Remove standalone ATTENDEES section with TBC (attendees are already in the Meeting Details box)
  // Matches "# ATTENDEES" or "## ATTENDEES" followed by "- TBC", "TBC", or empty on subsequent lines
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*To be confirmed\s*\n*/gi, '\n\n');
  
  // Clean up any resulting empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

// Deduplicate action items in content - critical to prevent repeated sections
const deduplicateActionItems = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  
  // Track unique action items by normalised text
  const seenActionItems = new Set<string>();
  // Track if we've seen "Completed" section header
  let seenCompletedHeader = false;
  // Track if we're in an action items section
  let inActionSection = false;
  
  // Helper to normalise action text for deduplication
  const normaliseAction = (text: string): string => {
    return text
      .replace(/^[-•*]\s*/, '')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\s*—\s*@\w+/g, '')
      .replace(/\s*\([^)]+\)/g, '')
      .replace(/\s*\[\w+\]/g, '')
      .replace(/\s*\{[^}]+\}/g, '')
      .toLowerCase()
      .trim();
  };
  
  // Helper to check if line is an action item
  const isActionItem = (line: string): boolean => {
    const trimmed = line.trim();
    return (
      (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) &&
      (trimmed.includes('@') || trimmed.includes('[') || trimmed.includes('~~'))
    );
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect Action Items section
    if (/^#{1,3}\s*action\s+items?\s*:?\s*$/i.test(trimmed)) {
      inActionSection = true;
      result.push(line);
      continue;
    }
    
    // Detect end of action section (new main heading)
    if (inActionSection && /^#{1,2}\s+\S/.test(trimmed) && !/action|completed/i.test(trimmed)) {
      inActionSection = false;
    }
    
    // Handle "Completed" or "Completed Items" headers - only keep first
    if (/^\*\*completed\s*items?\*\*\s*:?\s*$/i.test(trimmed) || 
        /^#{1,3}\s*completed\s*(items?)?\s*:?\s*$/i.test(trimmed)) {
      if (seenCompletedHeader) {
        // Skip duplicate completed headers and all following action items until next section
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (!nextLine || isActionItem(nextLine)) {
            i++;
          } else if (/^\*\*completed/i.test(nextLine) || /^#{1,3}\s*completed/i.test(nextLine)) {
            i++;
          } else {
            break;
          }
        }
        continue;
      }
      seenCompletedHeader = true;
      result.push(line);
      continue;
    }
    
    // Deduplicate action items
    if (isActionItem(line)) {
      const normalised = normaliseAction(line);
      if (normalised && seenActionItems.has(normalised)) {
        continue; // Skip duplicate
      }
      if (normalised) {
        seenActionItems.add(normalised);
      }
    }
    
    result.push(line);
  }
  
  // Clean up excessive blank lines
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Replace Facilitator/Unidentified with user name
const replaceFacilitatorWithUserName = (content: string, userName?: string): string => {
  if (!userName) return content;
  
  let cleaned = content;
  cleaned = cleaned.replace(/\[Unidentified\]\s*\(Facilitator\)/gi, userName);
  cleaned = cleaned.replace(/Unidentified\s*\(Facilitator\)/gi, userName);
  cleaned = cleaned.replace(/\[Facilitator\]/gi, userName);
  cleaned = cleaned.replace(/\(Facilitator\)/gi, `(${userName})`);
  cleaned = cleaned.replace(/Facilitator(?=\s*[,\.\-\:])/gi, userName);
  cleaned = cleaned.replace(/\[Unidentified\]/gi, userName);
  cleaned = cleaned.replace(/Unidentified(?=\s*[,\.\-\:])/gi, userName);
  
  return cleaned;
};

// Parse inline formatting (bold, italic)
const parseInlineFormatting = (text: string, TextRun: any) => {
  const runs: any[] = [];
  let currentIndex = 0;
  
  const decodedText = decodeHtmlEntities(text);
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  
  while ((match = markdownRegex.exec(decodedText)) !== null) {
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
    
    if (match[2]) {
      runs.push(new TextRun({ 
        text: match[2], 
        size: FONTS.size.body, 
        bold: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    } else if (match[3]) {
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

// Create professional header block with title and accent bar (no generated date)
const createHeaderBlock = async (title: string, _generatedDate?: string) => {
  const { Paragraph, TextRun, BorderStyle, AlignmentType } = await import("docx");
  
  const cleanTitle = title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim().toUpperCase();
  
  return [
    // Main title - large, centred, blue
    new Paragraph({
      children: [new TextRun({
        text: cleanTitle,
        bold: true,
        size: FONTS.size.documentTitle,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
    }),
    // Blue accent bar (using bottom border)
    new Paragraph({
      children: [new TextRun({ text: "", size: 4 })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue },
      },
      spacing: { after: 360 },
    }),
  ];
};

// Create meeting details info box
const createMeetingDetailsBox = async (metadata: MeetingMetadata) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");
  
  const rows: any[] = [];
  
  // Helper to create a detail row
  const createDetailRow = (label: string, value: string) => {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ 
              text: label, 
              bold: true, 
              size: FONTS.size.body,
              color: NHS_COLORS.headingBlue,
              font: FONTS.default,
            })],
          })],
          width: { size: 20, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 120, right: 60 },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue },
            right: { style: BorderStyle.NONE },
          },
          shading: { fill: NHS_COLORS.infoBoxBg },
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ 
              text: value, 
              size: FONTS.size.body,
              color: NHS_COLORS.textGrey,
              font: FONTS.default,
            })],
          })],
          width: { size: 80, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 60, right: 120 },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          shading: { fill: NHS_COLORS.infoBoxBg },
        }),
      ],
    });
  };
  
  // Section header
  const sectionHeader = new Paragraph({
    children: [new TextRun({
      text: "MEETING DETAILS",
      bold: true,
      size: FONTS.size.heading2,
      color: NHS_COLORS.headingBlue,
      font: FONTS.default,
    })],
    spacing: { before: 0, after: 120 },
  });
  
  // Add rows for available metadata
  if (metadata.date) rows.push(createDetailRow("Date", metadata.date));
  if (metadata.time) rows.push(createDetailRow("Time", metadata.time));
  if (metadata.duration) rows.push(createDetailRow("Duration", metadata.duration));
  if (metadata.location) rows.push(createDetailRow("Location", metadata.location));
  if (metadata.attendees) rows.push(createDetailRow("Attendees", metadata.attendees));
  
  if (rows.length === 0) return [];
  
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
  
  return [
    sectionHeader,
    table,
    new Paragraph({ children: [], spacing: { after: 360 } }),
  ];
};

// Create executive summary highlight box
const createExecutiveSummaryBox = async (summaryText: string) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");
  
  if (!summaryText) return [];
  
  const sectionHeader = new Paragraph({
    children: [new TextRun({
      text: "EXECUTIVE SUMMARY",
      bold: true,
      size: FONTS.size.heading2,
      color: NHS_COLORS.headingBlue,
      font: FONTS.default,
    })],
    spacing: { before: 0, after: 120 },
  });
  
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: summaryText, 
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
                font: FONTS.default,
                italics: true,
              })],
            })],
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue },
              right: { style: BorderStyle.NONE },
            },
            shading: { fill: NHS_COLORS.executiveSummaryBg },
          }),
        ],
      }),
    ],
  });
  
  return [
    sectionHeader,
    summaryTable,
    new Paragraph({ children: [], spacing: { after: 360 } }),
  ];
};

// Create section divider
const createSectionDivider = async () => {
  const { Paragraph, BorderStyle } = await import("docx");
  
  return new Paragraph({
    children: [],
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: NHS_COLORS.sectionDivider },
    },
    spacing: { before: 240, after: 240 },
  });
};

// Parse action items from content and create professional table
interface ParsedActionItem {
  action: string;
  owner: string;
  deadline: string;
  priority: string;
  status: string;
  isCompleted: boolean;
}

const parseActionItems = (content: string): ParsedActionItem[] => {
  const items: ParsedActionItem[] = [];
  const seenActions = new Set<string>();
  
  // Find all action item lines in the content
  const lines = content.split('\n');
  let inActionSection = false;
  let inCompletedSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect sections
    if (/^#{1,3}\s*action\s+items?\s*:?\s*$/i.test(trimmed)) {
      inActionSection = true;
      inCompletedSection = false;
      continue;
    }
    if (/^\*\*completed\s*items?\*\*\s*:?\s*$/i.test(trimmed) || 
        /^#{1,3}\s*completed\s*(items?)?\s*:?\s*$/i.test(trimmed)) {
      inCompletedSection = true;
      continue;
    }
    if (/^#{1,2}\s+\S/.test(trimmed) && !/action|completed/i.test(trimmed)) {
      inActionSection = false;
      inCompletedSection = false;
      continue;
    }
    
    if (!inActionSection && !inCompletedSection) continue;
    if (!trimmed.startsWith('-') && !trimmed.startsWith('•') && !trimmed.startsWith('*')) continue;
    
    // Parse action item line
    let actionText = trimmed.replace(/^[-•*]\s*/, '');
    const isCompleted = actionText.startsWith('~~') || inCompletedSection;
    
    // Remove strikethrough markers
    actionText = actionText.replace(/~~(.+?)~~/g, '$1');
    
    // Extract components using regex
    // Pattern: Action text — @Owner (Deadline) [Priority] {Status}
    let owner = 'TBC';
    let deadline = 'TBC';
    let priority = 'Medium';
    let status = isCompleted ? 'Done' : 'Open';
    
    // Extract owner (@Name)
    const ownerMatch = actionText.match(/\s*(?:—|–|-)\s*@(\w+)/);
    if (ownerMatch) {
      owner = ownerMatch[1];
      actionText = actionText.replace(ownerMatch[0], '');
    }
    
    // Extract deadline (date in parentheses)
    const deadlineMatch = actionText.match(/\s*\(([^)]+)\)/);
    if (deadlineMatch) {
      deadline = deadlineMatch[1];
      actionText = actionText.replace(deadlineMatch[0], '');
    }
    
    // Extract priority [High/Medium/Low]
    const priorityMatch = actionText.match(/\s*\[(High|Medium|Low|Urgent)\]/i);
    if (priorityMatch) {
      priority = priorityMatch[1];
      actionText = actionText.replace(priorityMatch[0], '');
    }
    
    // Extract status {Open/Done/In Progress}
    const statusMatch = actionText.match(/\s*\{([^}]+)\}/);
    if (statusMatch) {
      status = statusMatch[1];
      actionText = actionText.replace(statusMatch[0], '');
    }
    
    // Normalise for deduplication
    const normalised = actionText.toLowerCase().trim();
    if (seenActions.has(normalised)) continue;
    seenActions.add(normalised);
    
    items.push({
      action: actionText.trim(),
      owner,
      deadline,
      priority: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase(),
      status,
      isCompleted,
    });
  }
  
  // Sort: open items first, then completed
  return items.sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return 0;
  });
};

// Create action items table
const createActionItemsTable = async (items: ParsedActionItem[]) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");
  
  if (items.length === 0) {
    return [new Paragraph({
      children: [new TextRun({
        text: "No action items recorded for this meeting.",
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
        italics: true,
      })],
      spacing: { after: 240 },
    })];
  }
  
  // Priority colour helper
  const getPriorityStyle = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === 'high' || p === 'urgent') return { color: NHS_COLORS.priorityHigh, bg: NHS_COLORS.priorityHighBg };
    if (p === 'low') return { color: NHS_COLORS.priorityLow, bg: NHS_COLORS.priorityLowBg };
    return { color: NHS_COLORS.priorityMedium, bg: NHS_COLORS.priorityMediumBg }; // Default medium
  };
  
  // Status symbol helper
  const getStatusDisplay = (status: string, isCompleted: boolean) => {
    const lower = status.toLowerCase();
    if (isCompleted || lower.includes('done') || lower.includes('complete')) {
      return { text: '✓ Done', color: NHS_COLORS.priorityLow };
    }
    if (lower.includes('progress') || lower.includes('ongoing') || lower.includes('active')) {
      return { text: '◐ In Progress', color: NHS_COLORS.priorityMedium };
    }
    return { text: '○ Open', color: NHS_COLORS.textGrey };
  };
  
  // Column widths
  const columnWidths = [38, 14, 16, 12, 20]; // Action, Owner, Deadline, Priority, Status
  
  const headerCells = ['Action', 'Owner', 'Deadline', 'Priority', 'Status'];
  
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columnWidths.map(w => Math.round((w / 100) * 9638)),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
      left: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
      right: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    },
    rows: [
      // Header row
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
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
          })
        ),
      }),
      // Data rows
      ...items.map((item, rowIndex) => {
        const priorityStyle = getPriorityStyle(item.priority);
        const statusDisplay = getStatusDisplay(item.status, item.isCompleted);
        const rowBg = rowIndex % 2 === 0 ? undefined : "F8FAFC";
        
        return new TableRow({
          children: [
            // Action column
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ 
                  text: item.action,
                  size: FONTS.size.body,
                  color: item.isCompleted ? NHS_COLORS.textLightGrey : NHS_COLORS.textGrey,
                  font: FONTS.default,
                  strike: item.isCompleted,
                })],
                spacing: { before: 60, after: 60 },
              })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            // Owner column
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ 
                  text: `@${item.owner}`,
                  size: FONTS.size.body,
                  color: NHS_COLORS.headingBlue,
                  font: FONTS.default,
                  bold: true,
                })],
                spacing: { before: 60, after: 60 },
              })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            // Deadline column
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ 
                  text: item.deadline,
                  size: FONTS.size.body,
                  color: NHS_COLORS.textGrey,
                  font: FONTS.default,
                })],
                spacing: { before: 60, after: 60 },
              })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            // Priority column
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ 
                  text: item.priority.toUpperCase(),
                  size: FONTS.size.small,
                  color: priorityStyle.color,
                  font: FONTS.default,
                  bold: true,
                })],
                spacing: { before: 60, after: 60 },
              })],
              shading: { fill: priorityStyle.bg },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            // Status column
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ 
                  text: statusDisplay.text,
                  size: FONTS.size.body,
                  color: statusDisplay.color,
                  font: FONTS.default,
                  bold: item.isCompleted,
                })],
                spacing: { before: 60, after: 60 },
              })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
          ],
        });
      }),
    ],
  });
  
  return [
    table,
    new Paragraph({ children: [], spacing: { after: 240 } }),
  ];
};

// Parse content and convert to docx elements
const parseContentToDocxElements = async (content: string) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle } = await import("docx");
  
  const elements: any[] = [];
  const lines = content.split('\n');
  let i = 0;
  let previousWasHeading = false;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines with minimal spacing
    if (!line) {
      if (!previousWasHeading) {
        elements.push(new Paragraph({
          children: [new TextRun({ text: "", size: FONTS.size.body })],
          spacing: { after: 60 },
        }));
      }
      previousWasHeading = false;
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
            .map(cell => decodeHtmlEntities(cell.replace(/\*\*/g, '').replace(/\*/g, '')));
        };
        
        const headerCells = parseCells(tableLines[0]);
        const bodyRows = tableLines.slice(1).map(parseCells);
        
        // Check if this is an action items table
        const priorityColIndex = headerCells.findIndex(h => h.toLowerCase().includes('priority'));
        const statusColIndex = headerCells.findIndex(h => h.toLowerCase().includes('status'));
        
        // Helper to get priority colour
        const getPriorityStyle = (priority: string) => {
          const p = priority.toLowerCase().trim();
          if (p === 'high' || p === 'urgent') return { color: NHS_COLORS.priorityHigh, bg: NHS_COLORS.priorityHighBg };
          if (p === 'medium' || p === 'normal') return { color: NHS_COLORS.priorityMedium, bg: NHS_COLORS.priorityMediumBg };
          if (p === 'low') return { color: NHS_COLORS.priorityLow, bg: NHS_COLORS.priorityLowBg };
          return null;
        };
        
        // Calculate column widths
        const columnCount = headerCells.length;
        const getColumnWidths = (headers: string[]): number[] => {
          const defaultWidth = Math.floor(100 / headers.length);
          const widths = headers.map(() => defaultWidth);
          
          headers.forEach((h, i) => {
            const lower = h.toLowerCase();
            if (lower.includes('action') || lower.includes('description') || lower.includes('item') || lower.includes('task')) {
              widths[i] = 40;
            } else if (lower.includes('owner') || lower.includes('assigned') || lower.includes('responsible')) {
              widths[i] = 20;
            } else if (lower.includes('deadline') || lower.includes('due') || lower.includes('date')) {
              widths[i] = 18;
            } else if (lower.includes('priority') || lower.includes('status')) {
              widths[i] = 12;
            }
          });
          
          const total = widths.reduce((a, b) => a + b, 0);
          return widths.map(w => Math.round((w / total) * 100));
        };
        
        const columnWidths = getColumnWidths(headerCells);
        
        // Create professional table
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: columnWidths.map(w => Math.round((w / 100) * 9638)),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            left: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            right: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
          },
          rows: [
            // Header row
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
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                })
              ),
            }),
            // Body rows
            ...bodyRows.map((row, rowIndex) => 
              new TableRow({
                children: row.map((cell, colIndex) => {
                  let displayText = cell;
                  let cellColor = NHS_COLORS.textGrey;
                  let cellBg: string | undefined = rowIndex % 2 === 0 ? undefined : "F8FAFC";
                  let isBold = false;
                  
                  // Priority styling
                  if (colIndex === priorityColIndex && priorityColIndex >= 0) {
                    const style = getPriorityStyle(cell);
                    if (style) {
                      cellColor = style.color;
                      cellBg = style.bg;
                      isBold = true;
                    }
                  }
                  
                  // Status styling with symbols
                  if (colIndex === statusColIndex && statusColIndex >= 0) {
                    const lower = cell.toLowerCase();
                    if (lower.includes('complete') || lower.includes('done') || lower.includes('✓')) {
                      displayText = "✓ " + cell;
                      cellColor = NHS_COLORS.priorityLow;
                    } else if (lower.includes('progress') || lower.includes('ongoing')) {
                      displayText = "◐ " + cell;
                      cellColor = NHS_COLORS.priorityMedium;
                    } else if (lower.includes('pending') || lower.includes('open')) {
                      displayText = "○ " + cell;
                    }
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
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  });
                }),
              })
            ),
          ],
        });
        
        elements.push(table);
        elements.push(new Paragraph({ text: "", spacing: { after: 240 } }));
      }
      previousWasHeading = false;
      continue;
    }
    
    // Check for headings (# ## ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = decodeHtmlEntities(headingMatch[2]).toUpperCase();
      
      // Skip if this is Meeting Details or Executive Summary (handled separately)
      if (headingText.includes('MEETING DETAILS') || headingText.includes('EXECUTIVE SUMMARY')) {
        i++;
        continue;
      }
      
      // Add section divider before major headings
      if (level === 1 || level === 2) {
        elements.push(await createSectionDivider());
      }
      
      elements.push(new Paragraph({
        children: [new TextRun({ 
          text: headingText,
          bold: true,
          size: level === 1 ? FONTS.size.heading1 : level === 2 ? FONTS.size.heading2 : FONTS.size.heading3,
          color: NHS_COLORS.headingBlue,
          font: FONTS.default,
        })],
        spacing: { 
          before: 0, 
          after: level === 1 ? 180 : level === 2 ? 140 : 100,
        },
      }));
      previousWasHeading = true;
      i++;
      continue;
    }
    
    // Check for bullet points
    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      const bulletText = line.replace(/^[-•*]\s*/, '');
      const runs = parseInlineFormatting(bulletText, TextRun);
      
      elements.push(new Paragraph({
        children: runs,
        numbering: {
          reference: "bullet-numbering",
          level: 0,
        },
        spacing: { after: 80 },
      }));
      previousWasHeading = false;
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
        spacing: { after: 80 },
      }));
      previousWasHeading = false;
      i++;
      continue;
    }
    
    // Regular paragraph
    const runs = parseInlineFormatting(line, TextRun);
    elements.push(new Paragraph({
      children: runs,
      spacing: { after: 100 },
    }));
    previousWasHeading = false;
    i++;
  }
  
  return elements;
};

// Create professional footer
const createFooter = async (classification?: string, meetingDate?: string, meetingTime?: string) => {
  const { Paragraph, TextRun, BorderStyle, AlignmentType, Footer, PageNumber } = await import("docx");
  
  // Use meeting date/time if provided, otherwise don't show date
  let dateTimeText = '';
  if (meetingDate && meetingTime) {
    dateTimeText = `Meeting: ${meetingDate} at ${meetingTime}`;
  } else if (meetingDate) {
    dateTimeText = `Meeting: ${meetingDate}`;
  }
  
  return new Footer({
    children: [
      // Divider line
      new Paragraph({
        children: [],
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: NHS_COLORS.sectionDivider },
        },
        spacing: { after: 120 },
      }),
      // Footer content
      new Paragraph({
        children: [
          new TextRun({
            text: classification || "OFFICIAL",
            size: FONTS.size.classification,
            color: NHS_COLORS.accentGold,
            font: FONTS.default,
            bold: true,
          }),
          ...(dateTimeText ? [
            new TextRun({
              text: "    |    ",
              size: FONTS.size.classification,
              color: NHS_COLORS.textLightGrey,
            }),
            new TextRun({
              text: dateTimeText,
              size: FONTS.size.classification,
              color: NHS_COLORS.footerText,
              font: FONTS.default,
            }),
          ] : []),
          new TextRun({
            text: "    |    Page ",
            size: FONTS.size.classification,
            color: NHS_COLORS.textLightGrey,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: FONTS.size.classification,
            color: NHS_COLORS.footerText,
          }),
          new TextRun({
            text: " of ",
            size: FONTS.size.classification,
            color: NHS_COLORS.textLightGrey,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: FONTS.size.classification,
            color: NHS_COLORS.footerText,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
};

// Main export function
export const generateProfessionalMeetingDocx = async (options: GenerateProfessionalMeetingOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  
  // Clean and deduplicate content
  let cleanedContent = stripTranscriptAndDetails(options.content);
  cleanedContent = deduplicateActionItems(cleanedContent);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, options.metadata.loggedUserName);
  
  // Extract details from content if not provided
  const extractedDetails = extractMeetingDetails(options.content);
  const metadata: MeetingMetadata = {
    ...extractedDetails,
    ...options.metadata,
    attendees: options.metadata.attendees || extractedDetails.attendees,
  };
  
  // Extract executive summary
  const executiveSummary = extractExecutiveSummary(options.content);
  
  // Parse action items from original content (before any stripping)
  const actionItems = parseActionItems(options.content);
  
// Remove action items section from content (we'll render it as a table)
  let contentWithoutActionItems = removeActionItemsSection(cleanedContent);
  
  // Remove executive summary section from content (we're rendering it separately in the box)
  if (executiveSummary) {
    contentWithoutActionItems = removeExecutiveSummarySection(contentWithoutActionItems);
  }
  
  // Build document
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + 
    ' at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const children: any[] = [];
  
  // Header block
  const headerElements = await createHeaderBlock(metadata.title, generatedDate);
  children.push(...headerElements);
  
  // Meeting details box
  const detailsElements = await createMeetingDetailsBox(metadata);
  children.push(...detailsElements);
  
  // Executive summary box
  if (executiveSummary) {
    const summaryElements = await createExecutiveSummaryBox(executiveSummary);
    children.push(...summaryElements);
  }
  
  // Main content (without action items)
  const contentElements = await parseContentToDocxElements(contentWithoutActionItems);
  children.push(...contentElements);
  
  // Action Items section as professional table
  if (actionItems.length > 0) {
    // Add section divider and heading
    children.push(await createSectionDivider());
    children.push(new Paragraph({
      children: [new TextRun({ 
        text: "ACTION ITEMS",
        bold: true,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 0, after: 180 },
    }));
    
    // Add the action items table
    const actionTableElements = await createActionItemsTable(actionItems);
    children.push(...actionTableElements);
  }
  
  // Create footer with meeting date/time
  const footer = await createFooter(metadata.classification, metadata.date, metadata.time);
  
  // Build document with NHS theme
  const styles = buildNHSStyles();
  const numbering = buildNumbering();
  
  const doc = new Document({
    styles: styles,
    numbering: numbering,
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
      footers: {
        default: footer,
      },
    }],
  });
  
  // Generate and save
  const blob = await Packer.toBlob(doc);
  const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const filename = options.filename || `${metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${dateStr}.docx`;
  saveAs(blob, filename);
};

// Helper to remove executive summary section from content (since we render it in a separate box)
const removeExecutiveSummarySection = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSummarySection = false;
  let summaryParagraphFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect Executive Summary / Overview heading
    if (/^#{1,3}\s*(executive\s*summary|overview|summary)\s*$/i.test(trimmed)) {
      inSummarySection = true;
      summaryParagraphFound = false;
      continue; // Skip the heading
    }
    
    // If we're in summary section, skip the first paragraph (the summary text)
    if (inSummarySection && !summaryParagraphFound) {
      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        // This is the summary paragraph - skip it
        summaryParagraphFound = true;
        continue;
      } else if (trimmed.startsWith('#')) {
        // Hit another heading without finding paragraph
        inSummarySection = false;
        result.push(line);
        continue;
      }
    }
    
    // Once we've skipped the summary paragraph, exit summary section
    if (inSummarySection && summaryParagraphFound) {
      inSummarySection = false;
    }
    
    result.push(line);
  }
  
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Helper to remove action items section from content
const removeActionItemsSection = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inActionSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect Action Items section
    if (/^#{1,3}\s*action\s+items?\s*:?\s*$/i.test(trimmed)) {
      inActionSection = true;
      continue;
    }
    
    // Detect end of action section (new main heading that's not action-related)
    if (inActionSection && /^#{1,2}\s+\S/.test(trimmed) && !/action|completed/i.test(trimmed)) {
      inActionSection = false;
    }
    
    // Skip lines in action section
    if (inActionSection) {
      continue;
    }
    
    result.push(line);
  }
  
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Pre-parsed action item for Word export
export interface ParsedActionItemInput {
  action: string;
  owner: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Completed';
  isCompleted: boolean;
}

// Pre-parsed meeting details for Word export
export interface ParsedMeetingDetailsInput {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  attendees?: string;
}

// Wrapper for SafeModeNotesModal - accepts pre-parsed data to match modal view
export const generateProfessionalWordFromContent = async (
  content: string, 
  title: string,
  parsedDetails?: ParsedMeetingDetailsInput,
  parsedActionItems?: ParsedActionItemInput[]
): Promise<void> => {
  // If pre-parsed data is provided, use it directly
  if (parsedDetails || parsedActionItems) {
    await generateProfessionalMeetingDocxWithParsedData({
      metadata: { 
        title,
        date: parsedDetails?.date,
        time: parsedDetails?.time,
        location: parsedDetails?.location,
        attendees: parsedDetails?.attendees,
      },
      content,
      actionItems: parsedActionItems || [],
    });
  } else {
    // Fallback to auto-parsing
    await generateProfessionalMeetingDocx({
      metadata: { title },
      content,
    });
  }
};

// Generate professional Word document and return as Blob (for email attachments)
export const generateProfessionalWordBlob = async (
  content: string, 
  title: string,
  parsedDetails?: ParsedMeetingDetailsInput,
  parsedActionItems?: ParsedActionItemInput[]
): Promise<Blob> => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  
  // Use provided metadata
  const metadata: MeetingMetadata = {
    title,
    date: parsedDetails?.date,
    time: parsedDetails?.time,
    location: parsedDetails?.location,
    attendees: parsedDetails?.attendees,
  };
  
  // Clean content
  let cleanedContent = stripTranscriptAndDetails(content);
  cleanedContent = deduplicateActionItems(cleanedContent);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, metadata.loggedUserName);
  
  // Convert provided action items to internal format
  const actionItems: ParsedActionItem[] = (parsedActionItems || []).map(item => ({
    action: item.action,
    owner: item.owner.replace(/^@/, ''),
    deadline: item.deadline,
    priority: item.priority,
    status: item.status === 'Completed' ? 'Done' : item.status === 'In Progress' ? 'In Progress' : 'Open',
    isCompleted: item.isCompleted,
  }));
  
  // Remove action items section from content (we'll render it as a table)
  let contentWithoutActionItems = removeActionItemsSection(cleanedContent);
  contentWithoutActionItems = removeExecutiveSummarySection(contentWithoutActionItems);
  
  // Build document
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + 
    ' at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const children: any[] = [];
  
  // Header block
  const headerElements = await createHeaderBlock(metadata.title, generatedDate);
  children.push(...headerElements);
  
  // Meeting details box - only if we have valid details
  if (metadata.date || metadata.time || metadata.location || metadata.attendees) {
    const detailsElements = await createMeetingDetailsBox(metadata);
    children.push(...detailsElements);
  }
  
  // Main content (without action items)
  const contentElements = await parseContentToDocxElements(contentWithoutActionItems);
  children.push(...contentElements);
  
  // Action Items section as professional table (ACTION LOG)
  if (actionItems.length > 0) {
    const divider = await createSectionDivider();
    children.push(divider);
    
    children.push(new Paragraph({
      children: [new TextRun({
        text: "ACTION LOG",
        bold: true,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 0, after: 180 },
    }));
    
    const actionTableElements = await createActionItemsTable(actionItems);
    children.push(...actionTableElements);
  }
  
  // Create footer with meeting date/time
  const footer = await createFooter(metadata.classification, metadata.date, metadata.time);
  
  // Build document
  const doc = new Document({
    styles: buildNHSStyles(),
    numbering: buildNumbering(),
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      footers: {
        default: footer,
      },
      children,
    }],
  });
  
  return await Packer.toBlob(doc);
};

// New function that accepts pre-parsed action items and details
interface GenerateWithParsedDataOptions {
  metadata: MeetingMetadata;
  content: string;
  actionItems: ParsedActionItemInput[];
  filename?: string;
}

export const generateProfessionalMeetingDocxWithParsedData = async (options: GenerateWithParsedDataOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  
  // Clean content
  let cleanedContent = stripTranscriptAndDetails(options.content);
  cleanedContent = deduplicateActionItems(cleanedContent);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, options.metadata.loggedUserName);
  
  // Use provided metadata directly
  const metadata: MeetingMetadata = options.metadata;
  
  // Executive summary removed from Word export per user request
  
  // Convert provided action items to internal format
  const actionItems: ParsedActionItem[] = options.actionItems.map(item => ({
    action: item.action,
    owner: item.owner.replace(/^@/, ''), // Remove leading @ if present
    deadline: item.deadline,
    priority: item.priority,
    status: item.status === 'Completed' ? 'Done' : item.status === 'In Progress' ? 'In Progress' : 'Open',
    isCompleted: item.isCompleted,
  }));
  
// Remove action items section from content (we'll render it as a table)
  let contentWithoutActionItems = removeActionItemsSection(cleanedContent);
  
  // Also remove executive summary section from content (user requested to strip it)
  contentWithoutActionItems = removeExecutiveSummarySection(contentWithoutActionItems);
  
  // Build document
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + 
    ' at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const children: any[] = [];
  
  // Header block
  const headerElements = await createHeaderBlock(metadata.title, generatedDate);
  children.push(...headerElements);
  
  // Meeting details box - only if we have valid details
  if (metadata.date || metadata.time || metadata.location || metadata.attendees) {
    const detailsElements = await createMeetingDetailsBox(metadata);
    children.push(...detailsElements);
  }
  
  // Executive summary box removed per user request
  
  // Main content (without action items)
  const contentElements = await parseContentToDocxElements(contentWithoutActionItems);
  children.push(...contentElements);
  
  // Action Items section as professional table (ACTION LOG)
  if (actionItems.length > 0) {
    // Add section divider and heading
    const divider = await createSectionDivider();
    children.push(divider);
    
    children.push(new Paragraph({
      children: [new TextRun({
        text: "ACTION LOG",
        bold: true,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
        font: FONTS.default,
      })],
      spacing: { before: 0, after: 180 },
    }));
    
    const actionTableElements = await createActionItemsTable(actionItems);
    children.push(...actionTableElements);
  }
  
  // Create footer with meeting date/time
  const footer = await createFooter(metadata.classification, metadata.date, metadata.time);
  
  // Build and save document
  const doc = new Document({
    styles: buildNHSStyles(),
    numbering: buildNumbering(),
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      footers: {
        default: footer,
      },
      children,
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  
  // Generate filename
  const safeTitle = metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const dateStamp = now.toISOString().split('T')[0];
  const filename = options.filename || `${safeTitle}_${dateStamp}.docx`;
  
  saveAs(blob, filename);
};
