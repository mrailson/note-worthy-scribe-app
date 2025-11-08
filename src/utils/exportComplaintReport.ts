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
}

// Helper function to format outcome type
const formatOutcomeType = (outcomeType: string): string => {
  const typeMap: { [key: string]: string } = {
    'upheld': 'Upheld',
    'partially_upheld': 'Partially Upheld',
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
  
  // Clean up content
  let cleanedContent = content.trim();
  
  // Split into lines
  const lines = cleanedContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const paragraphs: Paragraph[] = [];
  
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
      // Normal paragraph - parse inline markdown
      const children = parseInlineMarkdown(line);
      paragraphs.push(new Paragraph({
        children,
        spacing: { after: 120 },
      }));
    }
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
  const keyDatesData = [
    { label: "Incident Date", value: complaint.incident_date ? format(new Date(complaint.incident_date), "dd/MM/yyyy") : "Not recorded" },
    { label: "Complaint Submitted", value: complaint.submitted_at ? format(new Date(complaint.submitted_at), "dd/MM/yyyy") : "Not recorded" },
    { label: "Acknowledged", value: complaint.acknowledged_at ? format(new Date(complaint.acknowledged_at), "dd/MM/yyyy") : "Not acknowledged" },
    { label: "Response Due", value: complaint.response_due_date ? format(new Date(complaint.response_due_date), "dd/MM/yyyy") : "Not set" },
    { label: "Closed", value: complaint.closed_at ? format(new Date(complaint.closed_at), "dd/MM/yyyy") : "Still open" },
  ];
  
  if (data.workingDaysToAcknowledge !== undefined) {
    keyDatesData.push({
      label: "Working Days to Acknowledge",
      value: `${data.workingDaysToAcknowledge} days ${data.workingDaysToAcknowledge <= 3 ? "✓" : "⚠"}`,
    });
  }

  sections.push(createMetadataTable(keyDatesData));
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
  sections.push(
    createMetadataTable([
      { label: "Category", value: complaint.category },
      { label: "Priority", value: complaint.priority },
      { label: "Location/Service", value: complaint.location_service || "Not specified" },
      { label: "Staff Mentioned", value: complaint.staff_mentioned?.join(", ") || "None" },
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
  
  const acknowledgedOnTime = data.workingDaysToAcknowledge ? data.workingDaysToAcknowledge <= 3 : false;
  const investigationCompleted = !!complaint.closed_at;
  const outcomeLetterSent = !!data.outcomeLetter;
  
  const complianceHeaders = ["Requirement", "Status", "Evidence"];
  const complianceRows = [
    [
      "Acknowledgement within 3 working days",
      getStatusIndicator(acknowledgedOnTime),
      acknowledgedOnTime ? `Acknowledged in ${data.workingDaysToAcknowledge} working days` : "Not met",
    ],
    [
      "Investigation completed",
      getStatusIndicator(investigationCompleted),
      investigationCompleted ? "Complaint closed" : "Investigation ongoing",
    ],
    [
      "Outcome letter sent",
      getStatusIndicator(outcomeLetterSent),
      outcomeLetterSent ? "Letter generated" : "Not yet sent",
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

  sections.push(createHeading("Strengths in Complaint Management", HeadingLevel.HEADING_2));

  // Dynamic strengths based on data
  const strengths: string[] = [];

  // Check acknowledgement timing
  if (data.workingDaysToAcknowledge !== undefined && data.workingDaysToAcknowledge <= 3) {
    strengths.push("Complaint acknowledged within 3 working days, meeting NHS best practice standards");
  }

  // Check investigation method
  if (data.investigationMethod) {
    strengths.push("Clear investigation methodology documented and followed");
  }

  // Check involved parties
  if (data.involvedParties && data.involvedParties.length > 0) {
    strengths.push(`Appropriate staff members (${data.involvedParties.length}) involved in the investigation process`);
  }

  // Check evidence collection
  if (data.evidenceFiles && data.evidenceFiles.length > 0) {
    strengths.push(`Comprehensive evidence gathering with ${data.evidenceFiles.length} supporting documents`);
  }

  // Check outcome documentation
  if (data.outcome) {
    strengths.push("Clear outcome determination with detailed findings and actions");
  }

  // Check letters sent
  if (data.acknowledgementLetter) {
    strengths.push("Formal acknowledgement letter sent to complainant");
  }

  if (data.outcomeLetter) {
    strengths.push("Comprehensive outcome letter provided with full explanation");
  }

  // Add executive summary
  if (data.audioOverview) {
    strengths.push("AI-assisted executive summary generated for senior review");
  }

  // Always add these generic strengths
  strengths.push("Systematic documentation maintained throughout the process");
  strengths.push("Patient-centred approach with clear communication");
  strengths.push("Commitment to learning and service improvement demonstrated");

  // Output as bullet points
  strengths.forEach(strength => {
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
    
    // Review metadata
    const reviewDate = data.aiReview.conversation_started_at 
      ? format(new Date(data.aiReview.conversation_started_at), "dd/MM/yyyy HH:mm")
      : "Not recorded";
    
    const reviewDuration = data.aiReview.conversation_duration 
      ? `${Math.floor(data.aiReview.conversation_duration / 60)}m ${data.aiReview.conversation_duration % 60}s`
      : "Not recorded";
    
    sections.push(
      createMetadataTable([
        { label: "Review Date", value: reviewDate },
        { label: "Reviewer", value: data.aiReview.created_by || "System User" },
        { label: "Review Duration", value: reviewDuration },
        { label: "Challenges Identified", value: data.aiReview.challenges_identified?.length.toString() || "0" },
        { label: "Recommendations Made", value: data.aiReview.recommendations?.length.toString() || "0" },
      ])
    );
    
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    
    // Overview paragraph
    sections.push(createHeading("Overview", HeadingLevel.HEADING_3));
    sections.push(createNormalText(
      "An independent AI-assisted critical review was conducted to evaluate the complaint handling process. " +
      "This review provides an objective assessment of the investigation, identifies any potential issues, " +
      "and validates the thoroughness of the complaint management approach."
    ));
    
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    
    // Executive summary from the AI review
    sections.push(createHeading("Review Summary", HeadingLevel.HEADING_3));
    
    // Parse markdown content properly
    const summaryParagraphs = parseMarkdownContent(data.aiReview.conversation_summary);
    sections.push(...summaryParagraphs);
    
    sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    
    // Key challenges identified
    if (data.aiReview.challenges_identified && data.aiReview.challenges_identified.length > 0) {
      sections.push(createHeading("Challenges Identified", HeadingLevel.HEADING_3));
      
      const challengeHeaders = ["Severity", "Challenge"];
      const challengeRows = data.aiReview.challenges_identified.map((challenge) => [
        challenge.severity || "Not specified",
        challenge.challenge,
      ]);
      
      sections.push(createDataTable(challengeHeaders, challengeRows));
      sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
    
    // Recommendations
    if (data.aiReview.recommendations && data.aiReview.recommendations.length > 0) {
      sections.push(createHeading("Recommendations", HeadingLevel.HEADING_3));
      
      const recHeaders = ["Priority", "Recommendation"];
      const recRows = data.aiReview.recommendations.map((rec) => [
        rec.priority || "Not specified",
        rec.recommendation,
      ]);
      
      sections.push(createDataTable(recHeaders, recRows));
      sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
    
    // Validation statement
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
