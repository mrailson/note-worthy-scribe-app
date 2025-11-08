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
}

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
      { label: "Status", value: complaint.status.toUpperCase() },
      { label: "Report Date", value: reportDate },
      { label: "Classification", value: "NHS OFFICIAL-SENSITIVE" },
    ])
  );

  sections.push(new Paragraph({ text: "", spacing: { after: 480 } }));

  // ========== EXECUTIVE SUMMARY ==========
  sections.push(createHeading("Executive Summary", HeadingLevel.HEADING_1));

  if (data.audioOverview) {
    sections.push(createNormalText(data.audioOverview));
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
      { label: "Subcategory", value: complaint.subcategory || "Not specified" },
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
        { label: "Outcome Type", value: data.outcome.outcome_type },
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

  // ========== APPENDICES ==========
  sections.push(createHeading("Appendices", HeadingLevel.HEADING_1));

  if (data.acknowledgementLetter) {
    sections.push(createHeading("Appendix A: Acknowledgement Letter", HeadingLevel.HEADING_2));
    sections.push(createNormalText(data.acknowledgementLetter));
    sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
  }

  if (data.outcomeLetter) {
    sections.push(createHeading("Appendix B: Outcome Letter", HeadingLevel.HEADING_2));
    sections.push(createNormalText(data.outcomeLetter));
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
