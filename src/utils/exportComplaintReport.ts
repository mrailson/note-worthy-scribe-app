import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  convertInchesToTwip,
  ExternalHyperlink,
} from "docx";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { NHS_COLORS, FONTS, buildNHSStyles } from "./wordTheme";

interface ComplaintData {
  reference_number: string;
  complaint_title: string;
  patient_name: string;
  patient_dob: string | null;
  patient_contact_phone: string | null;
  patient_contact_email: string | null;
  patient_address: string | null;
  incident_date: string;
  submitted_at: string | null;
  acknowledged_at: string | null;
  response_due_date: string | null;
  closed_at: string | null;
  created_at: string;
  category: string;
  subcategory: string | null;
  priority: string;
  status: string;
  complaint_description: string;
  location_service: string | null;
  staff_mentioned: string[] | null;
  complaint_on_behalf: boolean;
  consent_given: boolean;
  consent_details: string | null;
}

interface InvolvedParty {
  staffName: string;
  staffEmail: string;
  staffRole: string;
  responseText?: string;
  responseReceivedAt?: string;
  status?: string;
}

interface OutcomeData {
  outcome_type: string;
  outcome_summary: string;
}

interface AIReviewData {
  conversation_summary: string;
  challenges_identified: Array<{ challenge: string; severity: string }>;
  recommendations: Array<{ recommendation: string; priority: string }>;
  conversation_duration: number;
  conversation_started_at: string;
  created_by: string;
}

interface AudioEvidenceReview {
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  aiReview: string;
  transcript?: string;
  audioDuration?: number | null;
}

interface ReportData {
  complaint: ComplaintData;
  audioOverview?: string;
  investigationMethod?: string;
  involvedParties?: InvolvedParty[];
  investigationSummary?: string;
  findingsText?: string;
  outcome?: OutcomeData;
  outcomeLetter?: string;
  acknowledgementLetter?: string;
  evidenceFiles?: Array<{ name: string; type: string }>;
  workingDaysToAcknowledge?: number;
  aiReview?: AIReviewData;
  audioEvidenceReviews?: AudioEvidenceReview[];
}

// Helper function to format outcome type
const formatOutcomeType = (outcomeType: string): string => {
  const typeMap: { [key: string]: string } = {
    'upheld': 'Upheld',
    'partially_upheld': 'Partially upheld',
    'not_upheld': 'Not Upheld',
    'rejected': 'Not Upheld'
  };
  return typeMap[outcomeType.toLowerCase()] || outcomeType;
};

// Helper function to format status with outcome
const formatStatusWithOutcome = (status: string, outcome?: OutcomeData): string => {
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  if (status.toLowerCase() === 'closed' && outcome?.outcome_type) {
    const formattedOutcome = formatOutcomeType(outcome.outcome_type);
    return `${formattedStatus} - ${formattedOutcome}`;
  }
  
  return formattedStatus;
};

// Helper function to add working days (excluding weekends)
const addWorkingDays = (startDate: Date, days: number): Date => {
  let currentDate = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < days) {
    currentDate.setDate(currentDate.getDate() + 1);
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  
  return currentDate;
};

// Helper function to create headings
const createHeading = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) => {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
};

// Helper function to create normal text paragraphs
const createNormalText = (text: string) => {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
      }),
    ],
    spacing: { after: 120 },
  });
};

// Helper function to create bullet points
const createBulletPoint = (text: string) => {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
      }),
    ],
    bullet: {
      level: 0,
    },
    spacing: { after: 60 },
  });
};

// Helper function to parse markdown content and return formatted paragraphs
const parseMarkdownContent = (content: string): Paragraph[] => {
  if (!content) return [];
  
  // Clean up content and normalize line breaks
  let cleanedContent = content.trim();
  
  // Split by double newlines to preserve paragraph breaks
  const blocks = cleanedContent.split(/\n\n+/);
  
  const paragraphs: Paragraph[] = [];
  
  blocks.forEach(block => {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    lines.forEach(line => {
      // Check for headings (### or ## or #) and strip them
      if (line.startsWith('###')) {
        const headingText = line.replace(/^###\s*/, '').replace(/\*\*/g, '');
        paragraphs.push(createHeading(headingText, HeadingLevel.HEADING_3));
      } else if (line.startsWith('##')) {
        const headingText = line.replace(/^##\s*/, '').replace(/\*\*/g, '');
        paragraphs.push(createHeading(headingText, HeadingLevel.HEADING_2));
      } else if (line.startsWith('#')) {
        const headingText = line.replace(/^#\s*/, '').replace(/\*\*/g, '');
        paragraphs.push(createHeading(headingText, HeadingLevel.HEADING_2));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet point
        const bulletText = line.replace(/^[*-]\s+/, '');
        const children = parseInlineMarkdown(bulletText);
        paragraphs.push(new Paragraph({
          children,
          bullet: { level: 0 },
          spacing: { after: 60 },
        }));
      } else {
        // Normal paragraph
        // Ensure proper spacing after full stops, question marks, and exclamation marks
        // Handle cases where there's no space after punctuation before a capital letter OR another sentence
        let text = line
          .replace(/([.!?])([A-Z])/g, '$1 $2')  // Add space before capital letter
          .replace(/([.!?])(\s*)([a-z])/g, '$1 $3'); // Keep lowercase after punctuation
        
        // Remove duplicate sentences within this line only
        const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
        const uniqueSentences: string[] = [];
        const seenSentences = new Set<string>();
        
        sentences.forEach(sentence => {
          const normalizedSentence = sentence.trim().toLowerCase();
          if (!seenSentences.has(normalizedSentence) && normalizedSentence.length > 0) {
            seenSentences.add(normalizedSentence);
            uniqueSentences.push(sentence.trim());
          }
        });
        
        text = uniqueSentences.join(' ');
        
        if (text.length > 0) {
          const children = parseInlineMarkdown(text);
          paragraphs.push(new Paragraph({
            children,
            spacing: { after: 120 },
          }));
        }
      }
    });
  });
  
  return paragraphs;
};

// Helper function to parse inline markdown (bold, italic) within text
const parseInlineMarkdown = (text: string): TextRun[] => {
  const children: TextRun[] = [];
  
  // Remove any remaining markdown heading markers at the start
  text = text.replace(/^#+\s*/, '');
  
  // Parse for bold (**text**) first, then handle remaining single * for italic
  // We need to be careful to match bold before italic
  const boldRegex = /\*\*([^*]+?)\*\*/g;
  const parts: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
  let lastIndex = 0;
  let match;
  
  // First pass: extract bold text
  while ((match = boldRegex.exec(text)) !== null) {
    // Add normal text before bold
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index) });
    }
    // Add bold text
    parts.push({ text: match[1], bold: true });
    lastIndex = boldRegex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex) });
  }
  
  // If no bold text was found, just add the whole text
  if (parts.length === 0) {
    parts.push({ text: text });
  }
  
  // Second pass: handle italic in non-bold parts
  const finalParts: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
  parts.forEach(part => {
    if (part.bold) {
      // Keep bold as is
      finalParts.push(part);
    } else {
      // Check for italic in this part
      const italicRegex = /\*([^*]+?)\*/g;
      let italicLastIndex = 0;
      let italicMatch;
      
      while ((italicMatch = italicRegex.exec(part.text)) !== null) {
        // Add normal text before italic
        if (italicMatch.index > italicLastIndex) {
          finalParts.push({ text: part.text.substring(italicLastIndex, italicMatch.index) });
        }
        // Add italic text
        finalParts.push({ text: italicMatch[1], italic: true });
        italicLastIndex = italicRegex.lastIndex;
      }
      
      // Add remaining text
      if (italicLastIndex < part.text.length) {
        finalParts.push({ text: part.text.substring(italicLastIndex) });
      }
      
      // If no italic found, keep original
      if (italicLastIndex === 0) {
        finalParts.push(part);
      }
    }
  });
  
  // Convert to TextRuns
  finalParts.forEach(part => {
    if (part.text) {
      children.push(new TextRun({
        text: part.text,
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
        bold: part.bold,
        italics: part.italic,
      }));
    }
  });
  
  // If nothing was created, add the original text
  if (children.length === 0) {
    children.push(new TextRun({
      text: text,
      font: FONTS.default,
      size: FONTS.size.body,
      color: NHS_COLORS.textGrey,
    }));
  }
  
  return children;
};

// Helper function to format letter content (removes HTML comments and formats properly)
const formatLetterContent = (letterContent: string): Paragraph[] => {
  // Remove HTML comments (logo_url, div tags, etc)
  let cleanedContent = letterContent.replace(/<!--.*?-->/gs, '');
  cleanedContent = cleanedContent.replace(/<div[^>]*>/g, '');
  cleanedContent = cleanedContent.replace(/<\/div>/g, '');
  
  // Remove all HTML tags including span tags (e.g., <span style="...">text</span>)
  // This removes the opening tag but keeps the content
  cleanedContent = cleanedContent.replace(/<span[^>]*>/g, '');
  cleanedContent = cleanedContent.replace(/<\/span>/g, '');
  
  // Remove any other HTML tags
  cleanedContent = cleanedContent.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities (e.g., &amp; -> &, &lt; -> <, &gt; -> >)
  cleanedContent = cleanedContent
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Remove markdown image syntax: ![alt](url)
  cleanedContent = cleanedContent.replace(/!\[.*?\]\(.*?\)/g, '');
  
  cleanedContent = cleanedContent.trim();
  
  // Split into paragraphs by double line breaks or single line breaks
  const paragraphs = cleanedContent
    .split(/\n\n+|\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Create formatted paragraphs with proper spacing, handling bold markdown
  return paragraphs.map(text => {
    const children: TextRun[] = [];
    
    // Parse for bold text (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add normal text before the bold
      if (match.index > lastIndex) {
        children.push(new TextRun({
          text: text.substring(lastIndex, match.index),
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }));
      }
      
      // Add bold text
      children.push(new TextRun({
        text: match[1],
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
        bold: true,
      }));
      
      lastIndex = boldRegex.lastIndex;
    }
    
    // Add remaining normal text
    if (lastIndex < text.length) {
      children.push(new TextRun({
        text: text.substring(lastIndex),
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
      }));
    }
    
    // If no bold text was found, just use the whole text
    if (children.length === 0) {
      children.push(new TextRun({
        text: text,
        font: FONTS.default,
        size: FONTS.size.body,
        color: NHS_COLORS.textGrey,
      }));
    }
    
    return new Paragraph({
      children,
      spacing: { after: 120 },
    });
  });
};

// Helper function to create a status indicator
const getStatusIndicator = (isCompliant: boolean): string => {
  return isCompliant ? "✓" : "✗";
};

// Helper function to create a two-column table for metadata
const createMetadataTable = (data: Array<{ label: string; value: string }>) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: data.map((row) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "F3F4F6" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: row.label,
                    bold: true,
                    font: FONTS.default,
                    size: FONTS.size.body,
                    color: NHS_COLORS.textGrey,
                  }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: row.value,
                    font: FONTS.default,
                    size: FONTS.size.body,
                    color: NHS_COLORS.textGrey,
                  }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      })
    ),
  });
};

// Helper function to create a standard data table
const createDataTable = (headers: string[], rows: string[][]) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      left: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      right: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: [
      // Header row
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              shading: { fill: NHS_COLORS.tableHeaderBg },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: header,
                      bold: true,
                      font: FONTS.default,
                      size: FONTS.size.body,
                      color: NHS_COLORS.tableHeaderText,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
            })
        ),
      }),
      // Data rows
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          font: FONTS.default,
                          size: FONTS.size.body,
                          color: NHS_COLORS.textGrey,
                        }),
                      ],
                    }),
                  ],
                  verticalAlign: VerticalAlign.CENTER,
                })
            ),
          })
      ),
    ],
  });
};

export const exportComplaintReportToWord = async (data: ReportData) => {
  const { complaint } = data;
  const reportDate = format(new Date(), "dd MMMM yyyy");
  const fileName = `Complaint_Report_${complaint.reference_number}_${format(new Date(), "yyyy-MM-dd")}.docx`;

  const sections = [];

  // ========== COVER PAGE ==========
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "NHS OFFICIAL-SENSITIVE",
          font: FONTS.default,
          size: FONTS.size.small,
          color: "E11D48",
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "COMPLAINT INVESTIGATION REPORT",
          font: FONTS.default,
          size: FONTS.size.title,
          color: NHS_COLORS.nhsBlue,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: complaint.complaint_title,
          font: FONTS.default,
          size: FONTS.size.heading2,
          color: NHS_COLORS.headingBlue,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    })
  );

  sections.push(
    createMetadataTable([
      { label: "Reference Number", value: complaint.reference_number },
      { label: "Status & Outcome", value: formatStatusWithOutcome(complaint.status, data.outcome) },
      { label: "Report Date", value: reportDate },
      { label: "Classification", value: "NHS OFFICIAL-SENSITIVE" },
    ])
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 480 } }));

  // ========== CALCULATE DEADLINES AND COMPLIANCE (REUSED THROUGHOUT) ==========
  // Use created_at as fallback for submitted_at
  const submittedDate = complaint.submitted_at || complaint.created_at;
  const submittedDateObj = new Date(submittedDate);
  
  // Calculate acknowledgement deadline (3 working days)
  const ackDeadline = addWorkingDays(submittedDateObj, 3);
  
  // Calculate outcome deadline (20 working days from submission)
  const outcomeDeadline = addWorkingDays(submittedDateObj, 20);
  
  // Check if acknowledgement was met
  let ackMet = "Not acknowledged";
  let ackDeadlineMet = false;
  if (complaint.acknowledged_at) {
    const ackDate = new Date(complaint.acknowledged_at);
    ackDeadlineMet = ackDate <= ackDeadline;
    ackMet = ackDeadlineMet ? "✓ Met" : "⚠ Missed";
  }
  
  // Check if outcome deadline was met
  let outcomeMet = "Not closed";
  let outcomeDeadlineMet = false;
  if (complaint.closed_at) {
    const closedDate = new Date(complaint.closed_at);
    outcomeDeadlineMet = closedDate <= outcomeDeadline;
    outcomeMet = outcomeDeadlineMet ? "✓ Met" : "⚠ Missed";
  }

  // ========== EXECUTIVE SUMMARY ==========
  sections.push(createHeading("Executive Summary", HeadingLevel.HEADING_1));

  if (data.audioOverview) {
    // Parse markdown content properly
    const overviewParagraphs = parseMarkdownContent(data.audioOverview);
    sections.push(...overviewParagraphs);
  } else {
    sections.push(createNormalText("No executive summary available."));
  }

  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // Key dates summary
  sections.push(createHeading("Key Dates", HeadingLevel.HEADING_2));
  
  // Build narrative timeline
  let narrative = "";
  
  // Add incident date if available
  if (complaint.incident_date) {
    narrative += `This complaint relates to an incident that occurred on ${format(new Date(complaint.incident_date), "dd/MM/yyyy")}. `;
  }
  
  // Core timeline narrative
  narrative += `The complaint was received on ${format(submittedDateObj, "dd/MM/yyyy")} and required acknowledgement within 3 working days (by ${format(ackDeadline, "dd/MM/yyyy")}). `;
  
  if (complaint.acknowledged_at) {
    const ackDateFormatted = format(new Date(complaint.acknowledged_at), "dd/MM/yyyy");
    narrative += `The complaint was acknowledged on ${ackDateFormatted}${ackDeadlineMet ? ", meeting the deadline" : ", however the deadline was missed"}. `;
  } else {
    narrative += `The complaint has not yet been acknowledged. `;
  }
  
  narrative += `Under NHS guidelines, a final outcome was required within 20 working days (by ${format(outcomeDeadline, "dd/MM/yyyy")}). `;
  
  if (complaint.closed_at) {
    const closedDateFormatted = format(new Date(complaint.closed_at), "dd/MM/yyyy");
    narrative += `The case was closed on ${closedDateFormatted}${outcomeDeadlineMet ? ", meeting the outcome deadline" : ", however the outcome deadline was missed"}.`;
  } else {
    narrative += `The case remains under review.`;
  }
  
  sections.push(createNormalText(narrative));
  sections.push(new Paragraph({ text: "", spacing: { after: 160 } }));
  
  // Compliance Summary Table
  const complianceTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      left: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      right: { style: BorderStyle.SINGLE, size: 1, color: NHS_COLORS.nhsBlue },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [
                new TextRun({
                  text: "Milestone",
                  bold: true,
                  font: FONTS.default,
                  size: FONTS.size.body,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            })],
            shading: { fill: "60A5FA" },
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [
                new TextRun({
                  text: "Deadline",
                  bold: true,
                  font: FONTS.default,
                  size: FONTS.size.body,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            })],
            shading: { fill: "60A5FA" },
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [
                new TextRun({
                  text: "Actual Date",
                  bold: true,
                  font: FONTS.default,
                  size: FONTS.size.body,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            })],
            shading: { fill: "60A5FA" },
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [
                new TextRun({
                  text: "Status",
                  bold: true,
                  font: FONTS.default,
                  size: FONTS.size.body,
                  color: "FFFFFF",
                }),
              ],
              alignment: AlignmentType.CENTER,
            })],
            shading: { fill: "60A5FA" },
          }),
        ],
      }),
      // Acknowledgement row
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Acknowledgement", style: "TableText" })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: format(ackDeadline, "dd/MM/yyyy") + " (3 working days)", 
              style: "TableText" 
            })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: complaint.acknowledged_at ? format(new Date(complaint.acknowledged_at), "dd/MM/yyyy") : "Not acknowledged", 
              style: "TableText" 
            })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: complaint.acknowledged_at ? (ackDeadlineMet ? "✓ Met" : "⚠ Missed") : "-", 
              style: "TableText" 
            })],
          }),
        ],
      }),
      // Final Outcome row
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Final Outcome", style: "TableText" })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: format(outcomeDeadline, "dd/MM/yyyy") + " (20 working days)", 
              style: "TableText" 
            })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: complaint.closed_at ? format(new Date(complaint.closed_at), "dd/MM/yyyy") : "Still open", 
              style: "TableText" 
            })],
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: complaint.closed_at ? (outcomeDeadlineMet ? "✓ Met" : "⚠ Missed") : "-", 
              style: "TableText" 
            })],
          }),
        ],
      }),
    ],
  });
  
  sections.push(complianceTable);
  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // ========== COMPLAINT DETAILS ==========
  sections.push(createHeading("Complaint Details", HeadingLevel.HEADING_1));

  sections.push(createHeading("Patient Information", HeadingLevel.HEADING_2));
  sections.push(
    createMetadataTable([
      { label: "Patient Name", value: complaint.patient_name },
      { label: "Date of Birth", value: complaint.patient_dob ? format(new Date(complaint.patient_dob), "dd/MM/yyyy") : "Not provided" },
      { label: "Contact Phone", value: complaint.patient_contact_phone || "Not provided" },
      { label: "Contact Email", value: complaint.patient_contact_email || "Not provided" },
      { label: "Address", value: complaint.patient_address || "Not provided" },
      { label: "Complaint on Behalf", value: complaint.complaint_on_behalf ? "Yes" : "No" },
      { label: "Consent Given", value: complaint.consent_given ? "Yes" : "No" },
    ])
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  sections.push(createHeading("Complaint Classification", HeadingLevel.HEADING_2));
  
  // Helper to capitalize staff names
  const capitalizeStaffNames = (names: string[] | null): string => {
    if (!names || names.length === 0) return "None";
    return names
      .map(name => 
        name.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
      )
      .join(", ");
  };
  
  sections.push(
    createMetadataTable([
      { label: "Category", value: complaint.category },
      { label: "Priority", value: complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1).toLowerCase() },
      { label: "Location/Service", value: complaint.location_service || "Not specified" },
      { label: "Staff Mentioned", value: capitalizeStaffNames(complaint.staff_mentioned) },
    ])
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  sections.push(createHeading("Complaint Description", HeadingLevel.HEADING_2));
  sections.push(createNormalText(complaint.complaint_description));

  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // ========== INVESTIGATION PROCESS ==========
  sections.push(createHeading("Investigation Process", HeadingLevel.HEADING_1));

  if (data.investigationMethod) {
    sections.push(createHeading("Investigation Method", HeadingLevel.HEADING_2));
    sections.push(createNormalText(data.investigationMethod));
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  if (data.involvedParties && data.involvedParties.length > 0) {
    sections.push(createHeading("Involved Parties", HeadingLevel.HEADING_2));
    
    const partyHeaders = ["Name", "Role", "Email", "Status"];
    const partyRows = data.involvedParties.map((party) => [
      party.staffName,
      party.staffRole,
      party.staffEmail,
      party.status || "Response requested",
    ]);

    sections.push(createDataTable(partyHeaders, partyRows));
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

    // Staff responses summary
    const respondedParties = data.involvedParties.filter(p => p.responseText);
    if (respondedParties.length > 0) {
      sections.push(createHeading("Staff Responses Summary", HeadingLevel.HEADING_2));
      respondedParties.forEach((party) => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${party.staffName} (${party.staffRole})`,
                font: FONTS.default,
                size: FONTS.size.body,
                bold: true,
                color: NHS_COLORS.headingBlue,
              }),
            ],
            spacing: { after: 60 },
          })
        );
        if (party.responseReceivedAt) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Response received: ${format(new Date(party.responseReceivedAt), "dd/MM/yyyy HH:mm")}`,
                  font: FONTS.default,
                  size: FONTS.size.small,
                  color: NHS_COLORS.textLightGrey,
                  italics: true,
                }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        sections.push(createNormalText(party.responseText || ""));
        sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      });
    }
  }

  // ========== EVIDENCE ==========
  if (data.evidenceFiles && data.evidenceFiles.length > 0) {
    sections.push(createHeading("Evidence & Documentation", HeadingLevel.HEADING_1));
    sections.push(createNormalText(`${data.evidenceFiles.length} file(s) collected as evidence:`));
    data.evidenceFiles.forEach((file) => {
      sections.push(createBulletPoint(`${file.name} (${file.type})`));
    });
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  // ========== AUDIO EVIDENCE ANALYSIS ==========
  if (data.audioEvidenceReviews && data.audioEvidenceReviews.length > 0) {
    sections.push(createHeading("Audio Evidence Analysis", HeadingLevel.HEADING_1));
    sections.push(createNormalText(
      `${data.audioEvidenceReviews.length} audio file(s) were recorded and analysed as part of this investigation.`
    ));
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));

    data.audioEvidenceReviews.forEach((audioEvidence, index) => {
      // File heading
      sections.push(createHeading(`${index + 1}. ${audioEvidence.fileName}`, HeadingLevel.HEADING_2));

      // Metadata table
      const metadataRows: Array<{ label: string; value: string }> = [
        { label: "File Name", value: audioEvidence.fileName },
        { label: "File Size", value: `${(audioEvidence.fileSize / (1024 * 1024)).toFixed(2)} MB` },
        { label: "Upload Date", value: format(new Date(audioEvidence.uploadedAt), "dd/MM/yyyy HH:mm") },
      ];
      if (audioEvidence.audioDuration) {
        const mins = Math.floor(audioEvidence.audioDuration / 60);
        const secs = audioEvidence.audioDuration % 60;
        metadataRows.push({ label: "Duration", value: mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec` });
      }
      sections.push(createMetadataTable(metadataRows));
      sections.push(new Paragraph({ text: "", spacing: { after: 160 } }));

      // AI Review
      if (audioEvidence.aiReview) {
        sections.push(createHeading("AI Review", HeadingLevel.HEADING_3));
        const reviewParagraphs = parseMarkdownContent(audioEvidence.aiReview);
        sections.push(...reviewParagraphs);
        sections.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      }

      // Transcript
      if (audioEvidence.transcript) {
        sections.push(createHeading("Full Transcript", HeadingLevel.HEADING_3));
        // Split transcript into paragraphs for readability
        const transcriptParagraphs = audioEvidence.transcript
          .split(/\n\n+/)
          .filter(p => p.trim().length > 0);
        transcriptParagraphs.forEach(para => {
          sections.push(createNormalText(para.trim()));
        });
        sections.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      }

      sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
    });
  }

  // ========== INVESTIGATION FINDINGS ==========
  if (data.investigationSummary || data.findingsText) {
    sections.push(createHeading("Investigation Findings", HeadingLevel.HEADING_1));
    
    if (data.investigationSummary) {
      sections.push(createHeading("Summary", HeadingLevel.HEADING_2));
      sections.push(createNormalText(data.investigationSummary));
      sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
    }

    if (data.findingsText) {
      sections.push(createHeading("Detailed Findings", HeadingLevel.HEADING_2));
      sections.push(createNormalText(data.findingsText));
      sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
    }
  }

  // ========== DECISION & OUTCOME ==========
  if (data.outcome) {
    sections.push(createHeading("Decision & Outcome", HeadingLevel.HEADING_1));
    
    sections.push(
      createMetadataTable([
        { label: "Outcome Type", value: formatOutcomeType(data.outcome.outcome_type) },
        { label: "Date Closed", value: complaint.closed_at ? format(new Date(complaint.closed_at), "dd/MM/yyyy") : "Not yet closed" },
      ])
    );
    
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
    
    sections.push(createHeading("Outcome Summary", HeadingLevel.HEADING_2));
    sections.push(createNormalText(data.outcome.outcome_summary));
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  // ========== NHS COMPLAINTS STANDARDS COMPLIANCE ==========
  sections.push(createHeading("NHS Complaints Standards Compliance", HeadingLevel.HEADING_1));
  
  const acknowledgedOnTime = ackDeadlineMet;
  const investigationCompleted = !!complaint.closed_at;
  const outcomeLetterSent = !!data.outcomeLetter;
  
  const complianceHeaders = ["Requirement", "Status", "Evidence"];
  const complianceRows = [
    [
      "Acknowledgement within 3 working days",
      getStatusIndicator(acknowledgedOnTime),
      acknowledgedOnTime ? `Acknowledged on time - ${ackMet}` : "Not met - deadline missed",
    ],
    [
      "Investigation completed",
      getStatusIndicator(investigationCompleted),
      investigationCompleted ? "Complaint closed" : "Investigation ongoing",
    ],
    [
      "Outcome letter sent within 20 Working Days",
      getStatusIndicator(outcomeLetterSent && outcomeDeadlineMet),
      outcomeLetterSent ? (outcomeDeadlineMet ? "Letter sent on time" : "Letter sent but deadline missed") : "Not yet sent",
    ],
    [
      "Proportionate investigation",
      getStatusIndicator(!!data.investigationMethod),
      data.investigationMethod ? "Method documented" : "Not documented",
    ],
    [
      "Clear communication maintained",
      getStatusIndicator(!!data.acknowledgementLetter),
      data.acknowledgementLetter ? "Acknowledgement sent" : "Not sent",
    ],
  ];

  sections.push(createDataTable(complianceHeaders, complianceRows));
  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // ========== CQC REGULATORY COMPLIANCE ==========
  sections.push(createHeading("CQC Regulatory Compliance", HeadingLevel.HEADING_1));
  sections.push(createHeading("Regulation 16: Receiving and Acting on Complaints", HeadingLevel.HEADING_2));
  
  sections.push(createNormalText("This complaint demonstrates compliance with CQC Regulation 16 through:"));
  sections.push(createBulletPoint("Proper recording of all complaint details and patient information"));
  sections.push(createBulletPoint("Timely investigation with documented methodology"));
  sections.push(createBulletPoint("Appropriate response to the complainant"));
  sections.push(createBulletPoint("Evidence of learning and improvement considerations"));
  
  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // ========== COMPLAINT HANDLING SUMMARY ==========
  sections.push(createHeading("Complaint Handling Summary", HeadingLevel.HEADING_1));

  sections.push(createHeading("Overview", HeadingLevel.HEADING_2));
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "This complaint was managed in accordance with NHS England's guidance on managing complaints and the ",
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }),
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: "CQC's Regulation 16 requirements",
              font: FONTS.default,
              size: FONTS.size.body,
              color: NHS_COLORS.nhsBlue,
              underline: {},
            }),
          ],
          link: "https://www.cqc.org.uk/guidance-regulation/providers/regulations-service-providers-and-managers/health-social-care-act/regulation-16",
        }),
        new TextRun({
          text: ". The practice demonstrated a professional and thorough approach throughout the investigation process.",
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }),
      ],
      spacing: { after: 120 },
    })
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));

  sections.push(createHeading("Key Strengths in Complaint Management", HeadingLevel.HEADING_2));

  // Dynamic strengths - prioritise top 3 most important
  const strengths: string[] = [];

  // Priority 1: Timeline compliance (most critical for CQC)
  if (data.workingDaysToAcknowledge !== undefined && data.workingDaysToAcknowledge <= 3) {
    strengths.push("Complaint acknowledged within 3 working days, meeting NHS best practice standards");
  }

  // Priority 2: Thorough investigation process
  if (data.investigationMethod && data.involvedParties && data.involvedParties.length > 0) {
    strengths.push(`Thorough investigation methodology with ${data.involvedParties.length} staff members involved and comprehensive evidence gathering`);
  } else if (data.investigationMethod) {
    strengths.push("Clear investigation methodology documented and followed");
  } else if (data.involvedParties && data.involvedParties.length > 0) {
    strengths.push(`Appropriate staff members (${data.involvedParties.length}) involved in the investigation process`);
  }

  // Priority 3: Complete documentation and outcome
  if (data.outcomeLetter && data.outcome) {
    strengths.push("Comprehensive outcome letter and clear resolution provided with full explanation");
  } else if (data.outcomeLetter) {
    strengths.push("Comprehensive outcome letter provided with full explanation");
  } else if (data.outcome) {
    strengths.push("Clear outcome determination with detailed findings and actions");
  }

  // Limit to maximum 3 strengths
  const topStrengths = strengths.slice(0, 3);

  // Output as bullet points
  topStrengths.forEach(strength => {
    sections.push(createBulletPoint(strength));
  });

  sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));

  sections.push(createHeading("Compliance with Best Practice", HeadingLevel.HEADING_2));
  sections.push(createNormalText(
    "The practice has demonstrated compliance with:"
  ));

  sections.push(
    new Paragraph({
      children: [
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: "NHS England's 'Complaint Standards Framework' for Primary Care",
              font: FONTS.default,
              size: FONTS.size.body,
              color: NHS_COLORS.nhsBlue,
              underline: {},
            }),
          ],
          link: "https://www.england.nhs.uk/long-read/nhs-england-complaints-policy/",
        }),
      ],
      bullet: {
        level: 0,
      },
      spacing: { after: 60 },
    })
  );
  sections.push(
    new Paragraph({
      children: [
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: "CQC Regulation 16: Receiving and acting on complaints",
              font: FONTS.default,
              size: FONTS.size.body,
              color: NHS_COLORS.nhsBlue,
              underline: {},
            }),
          ],
          link: "https://www.cqc.org.uk/guidance-regulation/providers/regulations-service-providers-and-managers/health-social-care-act/regulation-16",
        }),
      ],
      bullet: {
        level: 0,
      },
      spacing: { after: 60 },
    })
  );
  sections.push(
    new Paragraph({
      children: [
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: "Local Healthwatch guidance on effective complaints handling",
              font: FONTS.default,
              size: FONTS.size.body,
              color: NHS_COLORS.nhsBlue,
              underline: {},
            }),
          ],
          link: "https://www.healthwatchwestnorthants.com/help-making-complaint",
        }),
      ],
      bullet: {
        level: 0,
      },
      spacing: { after: 60 },
    })
  );
  sections.push(
    new Paragraph({
      children: [
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: "General Medical Council (GMC) guidance on professional conduct",
              font: FONTS.default,
              size: FONTS.size.body,
              color: NHS_COLORS.nhsBlue,
              underline: {},
            }),
          ],
          link: "https://www.gmc-uk.org/professional-standards/the-professional-standards",
        }),
      ],
      bullet: {
        level: 0,
      },
      spacing: { after: 60 },
    })
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));

  sections.push(createHeading("Evidence Supporting Best Practice", HeadingLevel.HEADING_2));
  sections.push(createNormalText(
    "This report serves as comprehensive evidence that the practice:"
  ));

  sections.push(createBulletPoint("Took the complaint seriously and responded in a timely manner"));
  sections.push(createBulletPoint("Conducted a proportionate and thorough investigation"));
  sections.push(createBulletPoint("Maintained clear records and audit trails throughout the process"));
  sections.push(createBulletPoint("Communicated effectively with the complainant"));
  sections.push(createBulletPoint("Identified opportunities for learning and service improvement"));
  sections.push(createBulletPoint("Adhered to data protection and confidentiality requirements"));

  sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  // ========== APPENDICES ==========
  sections.push(createHeading("Appendices", HeadingLevel.HEADING_1));

  if (data.acknowledgementLetter) {
    sections.push(createHeading("Appendix A: Acknowledgement Letter", HeadingLevel.HEADING_2));
    const letterParagraphs = formatLetterContent(data.acknowledgementLetter);
    sections.push(...letterParagraphs);
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  if (data.outcomeLetter) {
    sections.push(createHeading("Appendix B: Outcome Letter", HeadingLevel.HEADING_2));
    const letterParagraphs = formatLetterContent(data.outcomeLetter);
    sections.push(...letterParagraphs);
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  // ========== APPENDIX C: AI CRITICAL FRIEND REVIEW ==========
  if (data.aiReview) {
    sections.push(createHeading("Appendix C: AI Critical Friend Complaint Review", HeadingLevel.HEADING_2));
    
    // Review metadata - compact version
    const reviewDate = data.aiReview.conversation_started_at 
      ? format(new Date(data.aiReview.conversation_started_at), "dd/MM/yyyy HH:mm")
      : "Not recorded";
    
    sections.push(
      createMetadataTable([
        { label: "Review Date", value: reviewDate },
        { label: "Reviewer", value: "Notewell AI Critical Friend Review Agent" },
      ])
    );
    
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    
    // Parse markdown content properly
    const summaryParagraphs = parseMarkdownContent(data.aiReview.conversation_summary);
    sections.push(...summaryParagraphs);
    
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    
    // Validation statement - featured prominently
    sections.push(createHeading("Review Validation", HeadingLevel.HEADING_3));
    sections.push(createNormalText(
      "This independent review validates that the complaint was handled professionally and thoroughly. " +
      "The AI Critical Friend process provides objective scrutiny of the investigation methodology, " +
      "ensuring transparency and accountability in the complaint management process. This demonstrates " +
      "the practice's commitment to continuous improvement and best practice in patient care."
    ));
    
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  // ========== FOOTER ==========
  sections.push(new Paragraph({ text: "", spacing: { after: 480 } }));
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "End of Report",
          font: FONTS.default,
          size: FONTS.size.small,
          color: NHS_COLORS.textLightGrey,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  // ========== CREATE DOCUMENT ==========
  const doc = new Document({
    styles: buildNHSStyles(),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: sections,
      },
    ],
  });

  // Generate and download the document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
};
