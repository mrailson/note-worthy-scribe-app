import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";
import { generateMeetingFilename } from "./meetingFilename";
import { normaliseMeetingNotesFormatting } from "@/utils/meeting/cleanMeetingContent";
import { normaliseGovernanceLayout } from "@/utils/meeting/normaliseGovernanceLayout";

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

const formatLocationForDisplay = (location: string): string => {
  const normalised = location.trim().toLowerCase();

  const platformMap: Record<string, string> = {
    teams: "Microsoft Teams",
    "ms teams": "Microsoft Teams",
    "microsoft teams": "Microsoft Teams",
    zoom: "Zoom",
    "google meet": "Google Meet",
    gmeet: "Google Meet",
    meet: "Google Meet",
    webex: "Webex",
  };

  return platformMap[normalised] || location.replace(/\b\w/g, char => char.toUpperCase());
};

interface MeetingMetadata {
  title: string;
  date?: string;
  time?: string;
  duration?: string;
  /** Meeting format, e.g. "Teams", "Hybrid", "Face to face" */
  location?: string;
  /** Physical venue (only relevant for face-to-face / hybrid) */
  venue?: string;
  attendees?: string;
  loggedUserName?: string;
  classification?: string; // e.g., "OFFICIAL", "OFFICIAL - SENSITIVE"
  /**
   * The LLM that produced the saved notes (mirrors meetings.notes_model_used).
   * Rendered into the page footer as a subtle italic provenance stamp so every
   * download — including re-downloads of older notes — carries an audit trail.
   * Falls back to "unknown" inside createFooter when undefined/empty.
   */
  notesModelUsed?: string | null;
}

interface GenerateProfessionalMeetingOptions {
  metadata: MeetingMetadata;
  content: string;
  filename?: string;
  logoUrl?: string;
  logoScale?: number;
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

  // Extract location/format patterns
  const locationMatch = content.match(/Location[:\s]+([^\n]+)/i);
  if (locationMatch) details.location = locationMatch[1].trim();

  // Extract venue patterns
  const venueMatch = content.match(/Venue[:\s]+([^\n]+)/i);
  if (venueMatch) details.venue = venueMatch[1].trim();

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
  
  // Remove duplicate inline meeting details (Date:, Time:, Location:, Venue:) - these are shown in the header box
  cleaned = cleaned.replace(/^\s*Date\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Time\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Location\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Venue\s*:\s*.+$/gim, '');
  
  // Remove standalone ATTENDEES section with TBC (attendees are already in the Meeting Details box)
  // Matches "# ATTENDEES" or "## ATTENDEES" followed by "- TBC", "TBC", or empty on subsequent lines
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*To be confirmed\s*\n*/gi, '\n\n');
  
  // Clean up any resulting empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Clean markdown artifacts that cause formatting issues in Word
  cleaned = cleaned
    .replace(/\\\*/g, '')                    // Remove all escaped asterisks
    .replace(/\*\\\*/g, '')                  // Remove *\* patterns
    .replace(/\n\s*═+\s*\n/g, '\n')         // Remove ═══ divider lines
    .replace(/\n\s*---+\s*\n/g, '\n')       // Remove --- divider lines
    .replace(/\n{4,}/g, '\n\n\n')           // Collapse excessive blank lines to max 3
    .trim();
  
  return cleaned;
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
  
  // Clean markdown artifacts that don't belong in Word output
  const cleanedText = decodedText
    .replace(/\\\*/g, '')           // Remove escaped asterisks \*
    .replace(/\*\\\*/g, '')         // Remove *\* patterns
    .replace(/\\\*\*/g, '')         // Remove \** patterns
    .replace(/\*{3,}/g, '**')      // Collapse 3+ asterisks to bold marker
    .replace(/^\s*[-–—]\s*$/, '')   // Remove standalone dashes
    .trim();
  
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  
  while ((match = markdownRegex.exec(cleanedText)) !== null) {
    if (match.index > currentIndex) {
      const normalText = cleanedText.substring(currentIndex, match.index).replace(/\*{1,2}/g, '');
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
        text: match[2].replace(/\*{1,2}/g, ''), 
        size: FONTS.size.body, 
        bold: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    } else if (match[3]) {
      runs.push(new TextRun({ 
        text: match[3].replace(/\*{1,2}/g, ''), 
        size: FONTS.size.body, 
        italics: true,
        color: NHS_COLORS.textGrey,
        font: FONTS.default,
      }));
    }
    
    currentIndex = match.index + match[0].length;
  }
  
  if (currentIndex < cleanedText.length) {
    const remainingText = cleanedText.substring(currentIndex).replace(/\*{1,2}/g, '');
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
      text: cleanedText, 
      size: FONTS.size.body,
      color: NHS_COLORS.textGrey,
      font: FONTS.default,
    }));
  }
  
  return runs;
};

// Fetch a logo URL and return as Uint8Array for docx ImageRun, with natural dimensions
const fetchLogoForDocx = async (logoUrl: string): Promise<{ data: Uint8Array; type: 'png' | 'jpg'; naturalWidth: number; naturalHeight: number } | null> => {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const type = logoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';

    // Detect natural image dimensions via an offscreen bitmap
    let naturalWidth = 200;
    let naturalHeight = 80;
    try {
      const imgBlob = new Blob([arrayBuffer], { type: blob.type || 'image/png' });
      const bitmap = await createImageBitmap(imgBlob);
      naturalWidth = bitmap.width;
      naturalHeight = bitmap.height;
      bitmap.close();
    } catch {
      // Fallback to defaults if bitmap detection fails
    }

    return { data: new Uint8Array(arrayBuffer), type, naturalWidth, naturalHeight };
  } catch (error) {
    console.warn('Failed to fetch logo for Word export:', error);
    return null;
  }
};

// Create professional header block with title and accent bar (no generated date)
const createHeaderBlock = async (title: string, _generatedDate?: string, logoUrl?: string, logoScale: number = 1.0) => {
  const { Paragraph, TextRun, BorderStyle, AlignmentType, ImageRun } = await import("docx");
  
  const cleanTitle = title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim().toUpperCase();
  const elements: any[] = [];

  // Practice logo (if available) — preserves aspect ratio, scales with user preference
  if (logoUrl) {
    const logoData = await fetchLogoForDocx(logoUrl);
    if (logoData) {
      const BASE_HEIGHT = 70; // base height in points
      const scaledHeight = Math.round(BASE_HEIGHT * logoScale);
      const aspectRatio = logoData.naturalWidth / logoData.naturalHeight;
      const scaledWidth = Math.round(scaledHeight * aspectRatio);

      elements.push(new Paragraph({
        children: [
          new ImageRun({
            data: logoData.data,
            transformation: { width: scaledWidth, height: scaledHeight },
            type: logoData.type,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }));
    }
  }

  // Main title - large, centred, blue
  elements.push(new Paragraph({
    children: [new TextRun({
      text: cleanTitle,
      bold: true,
      size: FONTS.size.documentTitle,
      color: NHS_COLORS.headingBlue,
      font: FONTS.default,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
  }));

  // Blue accent bar (using bottom border)
  elements.push(new Paragraph({
    children: [new TextRun({ text: "", size: 4 })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue },
    },
    spacing: { after: 360 },
  }));

  return elements;
};

// Create meeting details info box
const createMeetingDetailsBox = async (metadata: MeetingMetadata) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");
  
  const rows: any[] = [];
  
  // Helper to create a detail row
  // Meeting Details table — explicit DXA widths to prevent iOS Word collapse
  const TABLE_WIDTH_DXA = 9026; // A4 content width in DXA (11906 - 2×1440 margins)
  const LABEL_COL_DXA = 2400;  // ~1.67 inches — enough for "Location" with padding
  const VALUE_COL_DXA = TABLE_WIDTH_DXA - LABEL_COL_DXA;

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
          width: { size: LABEL_COL_DXA, type: WidthType.DXA },
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
          width: { size: VALUE_COL_DXA, type: WidthType.DXA },
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
  if (metadata.location) rows.push(createDetailRow("Location", formatLocationForDisplay(metadata.location)));
  if (metadata.venue) rows.push(createDetailRow("Venue", metadata.venue));
  if (metadata.attendees) rows.push(createDetailRow("Attendees", metadata.attendees));
  
  if (rows.length === 0) return [];
  
  const table = new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [LABEL_COL_DXA, VALUE_COL_DXA],
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
const createActionItemsTable = async (items: ParsedActionItem[], priorityColumnOn: boolean = false) => {
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
  
  // Column widths - adjust based on whether priority is shown
  const columnWidths = priorityColumnOn 
    ? [38, 14, 16, 12, 20] // Action, Owner, Deadline, Priority, Status
    : [46, 18, 18, 18]; // Action, Owner, Deadline, Status
  
  const headerCells = priorityColumnOn 
    ? ['Action', 'Owner', 'Deadline', 'Priority', 'Status']
    : ['Action', 'Owner', 'Deadline', 'Status'];
  
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
        
        const cells = [
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
                  text: item.owner,
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
        ];

        // Priority column (conditionally included)
        if (priorityColumnOn) {
          cells.push(
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
          );
        }

        // Status column
        cells.push(
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
        );

        return new TableRow({ children: cells });
      }),
    ],
  });
  
  return [
    table,
    new Paragraph({ children: [], spacing: { after: 240 } }),
  ];
};

// Parse content and convert to docx elements
const parseContentToDocxElements = async (content: string, cleanTitle?: string) => {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle } = await import("docx");
  
  const elements: any[] = [];
  const lines = content.split('\n');
  let i = 0;
  let previousWasHeading = false;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines with minimal spacing
    if (!line) {
      const isListItemLine = (value: string) => {
        const trimmed = value.trim();
        return trimmed.startsWith('- ') || trimmed.startsWith('• ') ||
          (trimmed.startsWith('* ') && !trimmed.startsWith('**')) ||
          /^\d+\.\s+/.test(trimmed);
      };

      const previousNonEmptyLine = (() => {
        for (let j = i - 1; j >= 0; j--) {
          const candidate = lines[j].trim();
          if (candidate) return candidate;
        }
        return '';
      })();

      const nextNonEmptyLine = (() => {
        for (let j = i + 1; j < lines.length; j++) {
          const candidate = lines[j].trim();
          if (candidate) return candidate;
        }
        return '';
      })();

      if (isListItemLine(previousNonEmptyLine) && isListItemLine(nextNonEmptyLine)) {
        i++;
        continue;
      }

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
        
        let headerCells = parseCells(tableLines[0]);
        let bodyRows = tableLines.slice(1).map(parseCells);
        
        // Remove Priority and Status columns from action item tables
        const excludeIndices = new Set<number>();
        headerCells.forEach((h, idx) => {
          const lower = h.toLowerCase().trim();
          if (lower === 'priority' || lower === 'status') {
            excludeIndices.add(idx);
          }
        });
        if (excludeIndices.size > 0) {
          headerCells = headerCells.filter((_, idx) => !excludeIndices.has(idx));
          bodyRows = bodyRows.map(row => row.filter((_, idx) => !excludeIndices.has(idx)));
        }
        
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
      const headingText = decodeHtmlEntities(headingMatch[2])
        .replace(/\*+/g, '')
        .replace(/^\s+|\s+$/g, '')
        .toUpperCase();
      
      // Skip Meeting Details, Executive Summary, and the meeting title itself —
      // all three are rendered separately (createHeaderBlock / details table)
      const cleanTitleUpper = (cleanTitle || '').toUpperCase().trim();
      if (
        headingText.includes('MEETING DETAILS') ||
        headingText.includes('EXECUTIVE SUMMARY') ||
        (cleanTitleUpper && headingText === cleanTitleUpper)
      ) {
        i++;
        continue;
      }
      
      // Give Decisions Register a distinctive look
      if (headingText.includes('DECISIONS REGISTER') || headingText.includes('DECISIONS')) {
        elements.push(await createSectionDivider());
        elements.push(new Paragraph({
          children: [new TextRun({
            text: headingText,
            bold: true,
            size: FONTS.size.heading2,
            color: NHS_COLORS.headingBlue,
            font: FONTS.default,
          })],
          spacing: { before: 0, after: 140 },
          keepNext: true,
          keepLines: true,
        }));
        previousWasHeading = true;
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
    
    // Handle **Label:** text patterns (Context, Discussion, Agreed, Implication sub-headings)
    const subHeadingMatch = line.match(/^\s*[-•]?\s*\*{1,2}(Context|Discussion|Agreed|Implication|Meeting Purpose)[:\s]*\*{0,2}\\?\*?\s*(.*)$/i);
    if (subHeadingMatch) {
      const label = subHeadingMatch[1].trim();
      let bodyText = subHeadingMatch[2]
        .replace(/^\*{1,2}\s*/, '')
        .replace(/\*{1,2}\\?\*?\s*$/, '')
        .replace(/\\\*/g, '')
        .trim();
      
      const isAgreed = false;
      
      const runs: any[] = [
        new TextRun({
          text: `${label}: `,
          bold: true,
          size: FONTS.size.body,
          color: NHS_COLORS.headingBlue,
          font: FONTS.default,
        }),
      ];
      
      if (bodyText) {
        bodyText = bodyText.replace(/\*\*/g, '').replace(/\\\*/g, '').trim();
        runs.push(new TextRun({
          text: bodyText,
          bold: false,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
          font: FONTS.default,
        }));
      }
      
      elements.push(new Paragraph({
        children: runs,
        indent: { left: 360 },
        spacing: { 
          before: label.toLowerCase() === 'context' ? 120 : 40,
          after: label.toLowerCase() === 'implication' ? 200 : 80,
        },
      }));
      previousWasHeading = false;
      i++;
      continue;
    }
    
    // Check for bullet points — not italic/bold markdown markers
    const isBulletPoint = (
      line.startsWith('- ') || 
      line.startsWith('• ') || 
      (line.startsWith('* ') && !line.startsWith('** ') && !line.startsWith('*Context') && !line.startsWith('*Discussion') && !line.startsWith('*Agreed') && !line.startsWith('*Implication') && !line.startsWith('*Meeting'))
    );
    if (isBulletPoint) {
      const bulletText = line
        .replace(/^[-•*]\s*/, '')
        .replace(/\\\*/g, '')
        .replace(/^\*{1,2}\s*/, '')
        .replace(/\*{1,2}\s*$/, '')
        .trim();
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
      let listText = numberMatch[2];
      
      // Check if this is a bold topic heading (e.g., "**Learning Disability (LD) Health Check Performance**")
      const topicHeadingMatch = listText.match(/^\*\*(.+?)\*\*\s*$/);
      if (topicHeadingMatch) {
        const topicTitle = topicHeadingMatch[1].replace(/\\\*/g, '').trim();
        elements.push(new Paragraph({
          children: [
            new TextRun({
              text: `${numberMatch[1]}. `,
              bold: true,
              size: FONTS.size.heading3,
              color: NHS_COLORS.headingBlue,
              font: FONTS.default,
            }),
            new TextRun({
              text: topicTitle,
              bold: true,
              size: FONTS.size.heading3,
              color: NHS_COLORS.headingBlue,
              font: FONTS.default,
            }),
          ],
          spacing: { before: 280, after: 80 },
        }));
        previousWasHeading = true;
        i++;
        continue;
      }
      
      listText = listText.replace(/\\\*/g, '').trim();
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
    
    // Governance decision line: plain "LABEL — text" — no bold colour, no bullet.
    const governanceLineMatch = line.match(/^\s*(RESOLVED|AGREED|NOTED)\s+—\s+(.*)$/);
    if (governanceLineMatch) {
      const label = governanceLineMatch[1].toUpperCase();
      const body = governanceLineMatch[2].replace(/\\\*/g, '').replace(/\*\*/g, '').trim();
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: `${label} — `,
            bold: false,
            size: FONTS.size.body,
            color: NHS_COLORS.textGrey,
            font: FONTS.default,
          }),
          ...parseInlineFormatting(body, TextRun),
        ],
        indent: { left: 360 },
        spacing: { before: 40, after: 120 },
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

// Create professional footer.
// `modelUsed` is the LLM that produced the saved notes (read from
// meetings.notes_model_used). It is appended in italic light grey so the
// provenance stamp reads as a subtle annotation; falls back to "unknown"
// when not yet recorded so older notes still render the segment.
const createFooter = async (
  classification?: string,
  meetingDate?: string,
  meetingTime?: string,
  modelUsed?: string | null,
) => {
  const { Paragraph, TextRun, BorderStyle, AlignmentType, Footer, PageNumber } = await import("docx");
  
  // Use meeting date/time if provided, otherwise don't show date
  let dateTimeText = '';
  if (meetingDate && meetingTime) {
    dateTimeText = `Meeting: ${meetingDate} at ${meetingTime}`;
  } else if (meetingDate) {
    dateTimeText = `Meeting: ${meetingDate}`;
  }
  
  const footerModelId = (modelUsed && modelUsed.trim()) || 'unknown';
  
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
          // Model provenance stamp
          new TextRun({
            text: `    |    ${footerModelId}`,
            size: FONTS.size.classification,
            color: "9CA3AF",
            italics: true,
            font: FONTS.default,
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
  let cleanedContent = normaliseGovernanceLayout(normaliseMeetingNotesFormatting(stripTranscriptAndDetails(options.content)));
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
  const headerElements = await createHeaderBlock(metadata.title, generatedDate, options.logoUrl, options.logoScale);
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
  const contentElements = await parseContentToDocxElements(contentWithoutActionItems, metadata.title);
  children.push(...contentElements);
  
  if (actionItems.length > 0) {
    children.push(await createSectionDivider());
    children.push(new Paragraph({
      children: [new TextRun({ text: "ACTION ITEMS", bold: true, size: FONTS.size.heading2, color: NHS_COLORS.headingBlue, font: FONTS.default })],
      spacing: { before: 0, after: 180 },
    }));
    children.push(...await createActionItemsTable(actionItems));
  }
  
  // Create footer with meeting date/time
  const footer = await createFooter(metadata.classification, metadata.date, metadata.time, metadata.notesModelUsed);
  
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
  const filename = options.filename || generateMeetingFilename(metadata.title, now, 'docx');
  saveAs(blob, filename);
};

/**
 * Detects whether a line is a section heading (markdown #, **bold**, ALL CAPS, or numbered).
 * Returns the normalised lowercase heading text and level, or null if not a heading.
 */
const detectHeading = (line: string): { text: string; level: number } | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown headings: ## **Executive Summary** or ### Executive Summary
  const mdMatch = trimmed.match(/^(#{1,6})\s*\**\s*(.+?)\s*\**\s*$/);
  if (mdMatch) {
    return { text: mdMatch[2].replace(/\*+/g, '').replace(/:\s*$/, '').trim().toLowerCase(), level: mdMatch[1].length };
  }

  // Bold-only headings: **Executive Summary**
  const boldMatch = trimmed.match(/^\*{2,}\s*(.+?)\s*\*{2,}\s*:?\s*$/);
  if (boldMatch && trimmed.length < 80) {
    return { text: boldMatch[1].replace(/:\s*$/, '').trim().toLowerCase(), level: 2 };
  }

  // Numbered headings: 1. Executive Summary or 1) Executive Summary
  const numberedMatch = trimmed.match(/^\d+[.)]\s*\**\s*(.+?)\s*\**\s*:?\s*$/);
  if (numberedMatch && trimmed.length < 80) {
    return { text: numberedMatch[1].replace(/\*+/g, '').replace(/:\s*$/, '').trim().toLowerCase(), level: 2 };
  }

  // ALL CAPS headings (at least 3 chars, no lowercase)
  if (/^[A-Z][A-Z\s&:,]{2,}$/.test(trimmed) && trimmed.length < 60) {
    return { text: trimmed.replace(/:\s*$/, '').trim().toLowerCase(), level: 2 };
  }

  return null;
};

/**
 * Generic section remover. Removes everything from the matching heading
 * until the next heading of equal or higher level (or end of content).
 */
const removeSectionByPattern = (content: string, pattern: RegExp): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;
  let sectionLevel = 0;

  for (const line of lines) {
    const heading = detectHeading(line);

    if (heading) {
      if (inSection) {
        if (heading.level <= sectionLevel) {
          inSection = false;
          if (pattern.test(heading.text)) {
            inSection = true;
            sectionLevel = heading.level;
            continue;
          }
          result.push(line);
          continue;
        }
        continue; // sub-heading inside hidden section
      }

      if (pattern.test(heading.text)) {
        inSection = true;
        sectionLevel = heading.level;
        continue;
      }
    }

    if (!inSection) {
      result.push(line);
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

const removeExecutiveSummarySection = (content: string): string =>
  removeSectionByPattern(content, /^(executive\s*summary|overview|summary)$/);

const removeActionItemsSection = (content: string): string =>
  removeSectionByPattern(content, /^(action\s*(items?|log|list)|completed\s*items?)$/);

const removeKeyPointsSection = (content: string): string =>
  removeSectionByPattern(content, /^(key\s*(points?|discussion|discussion\s*points?|highlights?|takeaways?)|discussion\s*summary)$/);

const removeOpenItemsSection = (content: string): string =>
  removeSectionByPattern(content, /^(open\s*(items?|issues?)(\s*[&,]\s*risks?)?|risks?\s*[&,]\s*open\s*items?)$/);

const removeAttendeesSection = (content: string): string =>
  removeSectionByPattern(content, /^(attendees?|participants?)$/);

const removeDiscussionSummarySection = (content: string): string =>
  removeSectionByPattern(content, /^(discussion\s*summary|key\s*(points?|discussion|discussion\s*points?|highlights?|takeaways?))$/);

const removeDecisionsRegisterSection = (content: string): string =>
  removeSectionByPattern(content, /^(decisions?\s*(register|log)?|resolutions?)$/);

const removeNextMeetingSection = (content: string): string =>
  removeSectionByPattern(content, /^(next\s*meeting|upcoming\s*meeting|future\s*meeting)$/);

// Section visibility settings for Word export (matches NotesViewSettings from notesSettings.ts)
export interface VisibleSectionsInput {
  executiveSummary?: boolean;
  keyPoints?: boolean;
  actionList?: boolean;
  openItems?: boolean;
  attendees?: boolean;
  discussionSummary?: boolean;
  decisionsRegister?: boolean;
  nextMeeting?: boolean;
}


// Filter content based on section visibility settings
export const filterContentByVisibility = (content: string, visibleSections?: VisibleSectionsInput): string => {
  if (!visibleSections) return content;
  
  let filtered = content;
  
  // Remove hidden sections
  if (visibleSections.executiveSummary === false) {
    filtered = removeExecutiveSummarySection(filtered);
  }
  if (visibleSections.keyPoints === false) {
    filtered = removeKeyPointsSection(filtered);
  }
  if (visibleSections.openItems === false) {
    filtered = removeOpenItemsSection(filtered);
  }
  // Note: actionList is handled separately via the parsedActionItems parameter
  // but we also remove it from inline content if hidden
  if (visibleSections.actionList === false) {
    filtered = removeActionItemsSection(filtered);
  }
  if (visibleSections.attendees === false) {
    filtered = removeAttendeesSection(filtered);
  }
  if (visibleSections.discussionSummary === false) {
    filtered = removeDiscussionSummarySection(filtered);
  }
  if (visibleSections.decisionsRegister === false) {
    filtered = removeDecisionsRegisterSection(filtered);
  }
  if (visibleSections.nextMeeting === false) {
    filtered = removeNextMeetingSection(filtered);
  }
  
  return filtered;
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
  /** Meeting format, e.g. "Teams", "Hybrid", "Face to face" */
  location?: string;
  /** Physical venue (only relevant for face-to-face / hybrid) */
  venue?: string;
  attendees?: string;
}

// Wrapper for SafeModeNotesModal - accepts pre-parsed data to match modal view
export const generateProfessionalWordFromContent = async (
  content: string, 
  title: string,
  parsedDetails?: ParsedMeetingDetailsInput,
  parsedActionItems?: ParsedActionItemInput[],
  visibleSections?: VisibleSectionsInput,
  logoUrl?: string,
  logoScale?: number,
  footerOn?: boolean,
  meetingDetailsOn?: boolean,
  attendeesOn?: boolean,
  priorityColumnOn?: boolean,
  /**
   * The model that produced the saved notes (mirrors meetings.notes_model_used).
   * Optional — when omitted the footer renders "unknown" so older notes still
   * carry a provenance segment.
   */
  notesModelUsed?: string | null,
): Promise<void> => {
  // Filter content based on visibility settings before processing
  const filteredContent = filterContentByVisibility(content, visibleSections);
  
  // If action list is hidden, don't pass action items
  const actionItemsToUse = visibleSections?.actionList === false ? [] : (parsedActionItems || []);
  
  // If pre-parsed data is provided, use it directly
  if (parsedDetails || parsedActionItems) {
    await generateProfessionalMeetingDocxWithParsedData({
      metadata: { 
        title,
        date: parsedDetails?.date,
        time: parsedDetails?.time,
        location: parsedDetails?.location,
        venue: parsedDetails?.venue,
        attendees: parsedDetails?.attendees,
        notesModelUsed,
      },
      content: filteredContent,
      actionItems: actionItemsToUse,
      logoUrl,
      logoScale,
      footerOn,
      meetingDetailsOn,
      attendeesOn,
      priorityColumnOn,
    });
  } else {
    // Fallback to auto-parsing
    await generateProfessionalMeetingDocx({
      metadata: { title, notesModelUsed },
      content: filteredContent,
      logoUrl,
    });
  }
};

// Generate professional Word document and return as Blob (for email attachments)
export const generateProfessionalWordBlob = async (
  content: string, 
  title: string,
  parsedDetails?: ParsedMeetingDetailsInput,
  parsedActionItems?: ParsedActionItemInput[],
  /** Mirrors meetings.notes_model_used so emailed Word attachments also carry the provenance stamp. */
  notesModelUsed?: string | null,
): Promise<Blob> => {
  const __startTime = performance.now();
  console.log('📊 [docx] Starting generation', {
    contentLength: content?.length || 0,
    contentLines: content ? content.split('\n').length : 0,
    title: title?.substring(0, 80),
    hasDetails: !!parsedDetails,
    actionItemCount: parsedActionItems?.length || 0,
    timestamp: new Date().toISOString(),
  });

  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  
  // Use provided metadata
  const metadata: MeetingMetadata = {
    title,
    date: parsedDetails?.date,
    time: parsedDetails?.time,
    location: parsedDetails?.location,
    venue: parsedDetails?.venue,
    attendees: parsedDetails?.attendees,
    notesModelUsed,
  };
  
  // (1) Clean content
  let cleanedContent: string;
  try {
    cleanedContent = normaliseGovernanceLayout(normaliseMeetingNotesFormatting(stripTranscriptAndDetails(content)));
    cleanedContent = deduplicateActionItems(cleanedContent);
    cleanedContent = replaceFacilitatorWithUserName(cleanedContent, metadata.loggedUserName);
  } catch (err) {
    console.error('❌ [docx] Failed at content cleaning', {
      error: err instanceof Error ? err.message : String(err),
      contentLength: content?.length || 0,
    });
    throw new Error(`docx content cleaning failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  // Convert provided action items to internal format
  const actionItems: ParsedActionItem[] = (parsedActionItems || []).map(item => ({
    action: item.action || 'Action not specified',
    owner: (item.owner || 'Unassigned').replace(/^@/, ''),
    deadline: item.deadline || 'TBC',
    priority: item.priority || 'Medium',
    status: item.status === 'Completed' ? 'Done' : item.status === 'In Progress' ? 'In Progress' : 'Open',
    isCompleted: item.isCompleted,
  }));
  
  let contentWithoutActionItems = parsedActionItems?.length ? removeActionItemsSection(cleanedContent) : cleanedContent;
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
  
  // (2) Main content parser walk (without action items)
  let contentElements: any[];
  try {
    contentElements = await parseContentToDocxElements(contentWithoutActionItems, metadata.title);
  } catch (err) {
    console.error('❌ [docx] Failed at content parser walk', {
      error: err instanceof Error ? err.message : String(err),
      contentLength: contentWithoutActionItems?.length || 0,
      contentLines: contentWithoutActionItems ? contentWithoutActionItems.split('\n').length : 0,
    });
    throw new Error(`docx content parser failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  children.push(...contentElements);
  
  if (actionItems.length > 0) {
    children.push(await createSectionDivider());
    children.push(new Paragraph({
      children: [new TextRun({ text: "ACTION ITEMS", bold: true, size: FONTS.size.heading2, color: NHS_COLORS.headingBlue, font: FONTS.default })],
      spacing: { before: 0, after: 180 },
    }));
    children.push(...await createActionItemsTable(actionItems));
  }
  
  // Create footer with meeting date/time
  const footer = await createFooter(metadata.classification, metadata.date, metadata.time, metadata.notesModelUsed);
  
  // (4) Build document + serialise to blob
  let doc: any;
  try {
    doc = new Document({
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
  } catch (err) {
    console.error('❌ [docx] Failed at Document construction', {
      error: err instanceof Error ? err.message : String(err),
      childCount: children.length,
    });
    throw new Error(`docx Document construction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  let blob: Blob;
  try {
    blob = await Packer.toBlob(doc);
  } catch (err) {
    console.error('❌ [docx] Failed at Packer.toBlob serialisation', {
      error: err instanceof Error ? err.message : String(err),
      childCount: children.length,
    });
    throw new Error(`docx blob serialisation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  const __duration = Math.round(performance.now() - __startTime);
  console.log('✅ [docx] Generation complete', {
    durationMs: __duration,
    blobSize: blob.size,
    contentLength: content?.length || 0,
  });
  
  return blob;
};

// New function that accepts pre-parsed action items and details
interface GenerateWithParsedDataOptions {
  metadata: MeetingMetadata;
  content: string;
  actionItems: ParsedActionItemInput[];
  filename?: string;
  logoUrl?: string;
  logoScale?: number;
  footerOn?: boolean;
  meetingDetailsOn?: boolean;
  attendeesOn?: boolean;
  priorityColumnOn?: boolean;
}

export const generateProfessionalMeetingDocxWithParsedData = async (options: GenerateWithParsedDataOptions): Promise<void> => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  
  // Clean content
  let cleanedContent = normaliseGovernanceLayout(normaliseMeetingNotesFormatting(stripTranscriptAndDetails(options.content)));
  cleanedContent = deduplicateActionItems(cleanedContent);
  cleanedContent = replaceFacilitatorWithUserName(cleanedContent, options.metadata.loggedUserName);
  
  // Use provided metadata directly
  const metadata: MeetingMetadata = options.metadata;
  
  // Executive summary removed from Word export per user request
  
  // Convert provided action items to internal format
  const actionItems: ParsedActionItem[] = options.actionItems.map(item => ({
    action: item.action || 'Action not specified',
    owner: (item.owner || 'Unassigned').replace(/^@/, ''), // Remove leading @ if present
    deadline: item.deadline || 'TBC',
    priority: item.priority || 'Medium',
    status: item.status === 'Completed' ? 'Done' : item.status === 'In Progress' ? 'In Progress' : 'Open',
    isCompleted: item.isCompleted,
  }));
  
  let contentWithoutActionItems = options.actionItems.length ? removeActionItemsSection(cleanedContent) : cleanedContent;

  // Also remove executive summary section from content (user requested to strip it)
  contentWithoutActionItems = removeExecutiveSummarySection(contentWithoutActionItems);
  
  // Build document
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + 
    ' at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const children: any[] = [];
  
  // Header block
  const headerElements = await createHeaderBlock(metadata.title, generatedDate, options.logoUrl, options.logoScale);
  children.push(...headerElements);
  
  // Meeting details box - only if enabled and we have valid details
  if (options.meetingDetailsOn !== false && (metadata.date || metadata.time || metadata.location || (options.attendeesOn !== false && metadata.attendees))) {
    // If attendees are disabled, strip them from metadata for the details box
    const detailsMetadata = options.attendeesOn === false ? { ...metadata, attendees: undefined } : metadata;
    const detailsElements = await createMeetingDetailsBox(detailsMetadata);
    children.push(...detailsElements);
  }
  
  // Executive summary box removed per user request
  
  // Main content (without action items)
  const contentElements = await parseContentToDocxElements(contentWithoutActionItems, metadata.title);
  children.push(...contentElements);
  
  if (actionItems.length > 0) {
    children.push(await createSectionDivider());
    children.push(new Paragraph({
      children: [new TextRun({ text: "ACTION ITEMS", bold: true, size: FONTS.size.heading2, color: NHS_COLORS.headingBlue, font: FONTS.default })],
      spacing: { before: 0, after: 180 },
    }));
    children.push(...await createActionItemsTable(actionItems, options.priorityColumnOn));
  }
  
  // Create footer with meeting date/time (only if footerOn is not explicitly false)
  const includeFooter = options.footerOn !== false;
  const footer = includeFooter ? await createFooter(metadata.classification, metadata.date, metadata.time, metadata.notesModelUsed) : undefined;
  
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
      ...(footer ? { footers: { default: footer } } : {}),
      children,
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  
  // Generate filename
  const filename = options.filename || generateMeetingFilename(metadata.title, now, 'docx');
  
  saveAs(blob, filename);
};
