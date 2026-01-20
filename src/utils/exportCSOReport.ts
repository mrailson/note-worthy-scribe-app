import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";
import {
  services,
  ai4gpRisks,
  meetingNotesRisks,
  complaintsRisks,
  gdprCompliance,
  securityControls,
  thirdPartyRisks,
  preDeploymentChecklist,
  recommendations,
} from "@/data/csoReportData";

const createHeading = (text: string, level?: typeof HeadingLevel[keyof typeof HeadingLevel]) => {
  return new Paragraph({
    text,
    heading: level || HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
};

const createBulletPoint = (text: string) => {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { before: 100, after: 100 },
  });
};

const createNormalText = (text: string) => {
  return new Paragraph({
    text,
    spacing: { before: 200, after: 200 },
  });
};

const createTableFromData = (headers: string[], rows: string[][]) => {
  const headerCells = headers.map(
    (header) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: header,
                bold: true,
                size: 20,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { fill: "2B6CB0" },
        margins: {
          top: convertInchesToTwip(0.05),
          bottom: convertInchesToTwip(0.05),
          left: convertInchesToTwip(0.05),
          right: convertInchesToTwip(0.05),
        },
      })
  );

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  text: cell,
                  spacing: { before: 100, after: 100 },
                }),
              ],
              margins: {
                top: convertInchesToTwip(0.05),
                bottom: convertInchesToTwip(0.05),
                left: convertInchesToTwip(0.05),
                right: convertInchesToTwip(0.05),
              },
            })
        ),
      })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });
};

export const exportCSOReportToWord = async () => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title Page
          new Paragraph({
            children: [
              new TextRun({
                text: "Clinical Safety Officer & Data Protection Officer Assessment Report",
                bold: true,
                size: 32,
                color: "1E40AF",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Notewell Healthcare Management System Services",
                size: 28,
                color: "64748B",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "AI4GP, Meeting Notes, and Complaints Management",
                size: 24,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // Document Metadata
          new Paragraph({
            text: `Version: 1.0`,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: `Date: ${new Date().toLocaleDateString("en-GB")}`,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Status: MHRA CERTIFIED",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Classification: MHRA Class I Medical Device (UK MDR 2002) - Certified December 2025",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Classification: NHS OFFICIAL-SENSITIVE",
            spacing: { after: 600 },
          }),

          // Executive Summary
          createHeading("Executive Summary", HeadingLevel.HEADING_1),
          new Paragraph({
            children: [
              new TextRun({
                text: "Overall Safety Rating: ",
                bold: true,
              }),
              new TextRun({
                text: "AMBER - Conditionally Acceptable",
                color: "D97706",
              }),
            ],
            spacing: { after: 200 },
          }),
          createNormalText(
            "This report provides a comprehensive clinical safety and data protection assessment of three core Notewell services deployed within NHS primary care settings: AI4GP Service, Meeting Notes System, and Complaints Management System. The assessment is conducted in accordance with DCB0129 (Clinical Risk Management), DCB0160 (Clinical Safety), and GDPR/Data Protection Act 2018 requirements."
          ),

          createHeading("Key Strengths", HeadingLevel.HEADING_2),
          createBulletPoint("Robust technical architecture with strong authentication and encryption"),
          createBulletPoint("Comprehensive audit trails for accountability"),
          createBulletPoint("Patient data masking and role-based access controls"),
          createBulletPoint("Multiple AI models with cross-validation capabilities"),
          createBulletPoint("Clear user disclaimers and safety warnings"),
          createBulletPoint("Scalable cloud infrastructure with automatic backups"),
          createBulletPoint("Data Processing Agreements in place with OpenAI and Supabase (signed 10/11/2025)"),

          createHeading("Areas Requiring Attention", HeadingLevel.HEADING_2),
          createBulletPoint("Formal DCB0129 Clinical Risk Management documentation"),
          createBulletPoint("Resolution of security warnings and penetration testing"),
          createBulletPoint("Formal Data Protection Impact Assessment"),
          createBulletPoint("Clinical validation workflows implementation"),
          createBulletPoint("Mandatory user training programme"),

          // Service Descriptions
          createHeading("1. Service Descriptions", HeadingLevel.HEADING_1),
          ...services.flatMap((service) => [
            createHeading(service.name, HeadingLevel.HEADING_2),
            new Paragraph({
              children: [
                new TextRun({ text: "Purpose: ", bold: true }),
                new TextRun({ text: service.purpose }),
              ],
              spacing: { after: 200 },
            }),
            createHeading("Key Capabilities:", HeadingLevel.HEADING_3),
            ...service.capabilities.map((cap) => createBulletPoint(cap)),
            new Paragraph({
              children: [
                new TextRun({ text: "User Base: ", bold: true }),
                new TextRun({ text: service.userBase }),
              ],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Data Processed: ", bold: true }),
                new TextRun({ text: service.dataProcessed.join(", ") }),
              ],
              spacing: { after: 300 },
            }),
          ]),

          // Risk Assessment Tables
          createHeading("2. Detailed Risk Assessment", HeadingLevel.HEADING_1),
          
          createHeading("2.1 AI4GP Service Risks", HeadingLevel.HEADING_2),
          createTableFromData(
            ["Risk ID", "Hazard", "Severity", "Likelihood", "Risk Rating", "Residual Risk"],
            ai4gpRisks.map((risk) => [
              risk.id,
              risk.hazard,
              risk.severity,
              risk.likelihood,
              risk.riskRating,
              risk.residualRisk,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          createHeading("2.2 Meeting Notes System Risks", HeadingLevel.HEADING_2),
          createTableFromData(
            ["Risk ID", "Hazard", "Severity", "Likelihood", "Risk Rating", "Residual Risk"],
            meetingNotesRisks.map((risk) => [
              risk.id,
              risk.hazard,
              risk.severity,
              risk.likelihood,
              risk.riskRating,
              risk.residualRisk,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          createHeading("2.3 Complaints Management System Risks", HeadingLevel.HEADING_2),
          createTableFromData(
            ["Risk ID", "Hazard", "Severity", "Likelihood", "Risk Rating", "Residual Risk"],
            complaintsRisks.map((risk) => [
              risk.id,
              risk.hazard,
              risk.severity,
              risk.likelihood,
              risk.riskRating,
              risk.residualRisk,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          // GDPR Compliance
          createHeading("3. GDPR & Data Protection Compliance", HeadingLevel.HEADING_1),
          createTableFromData(
            ["Requirement", "AI4GP", "Meeting Notes", "Complaints", "Status"],
            gdprCompliance.map((item) => [
              item.requirement,
              item.ai4gp,
              item.meetingNotes,
              item.complaints,
              item.status,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          // Security Controls
          createHeading("4. Technical Security Assessment", HeadingLevel.HEADING_1),
          createTableFromData(
            ["Control Category", "Implementation", "Effectiveness", "Gaps/Actions"],
            securityControls.map((control) => [
              control.category,
              control.implementation,
              control.effectiveness,
              control.gaps,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          // Third-Party Risks
          createHeading("5. Third-Party Dependencies & Integration Safety", HeadingLevel.HEADING_1),
          createTableFromData(
            ["Service", "Purpose", "Data Shared", "Assurance Level", "Risk"],
            thirdPartyRisks.map((provider) => [
              provider.service,
              provider.purpose,
              provider.dataShared,
              provider.assuranceLevel,
              provider.risk,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          // Pre-Deployment Checklist
          createHeading("6. Pre-Deployment Readiness Checklist", HeadingLevel.HEADING_1),
          createTableFromData(
            ["Item", "Status", "Owner", "Target Date"],
            preDeploymentChecklist.map((item) => [
              item.item,
              item.status,
              item.owner,
              item.targetDate,
            ])
          ),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          // Recommendations
          createHeading("7. Recommendations", HeadingLevel.HEADING_1),
          
          createHeading("7.1 Immediate Actions (Before Deployment)", HeadingLevel.HEADING_2),
          ...recommendations.immediate.map((rec) => createBulletPoint(rec)),

          createHeading("7.2 Short-Term Actions (Within 3 Months)", HeadingLevel.HEADING_2),
          ...recommendations.shortTerm.map((rec) => createBulletPoint(rec)),

          createHeading("7.3 Long-Term Actions (Within 12 Months)", HeadingLevel.HEADING_2),
          ...recommendations.longTerm.map((rec) => createBulletPoint(rec)),

          new Paragraph({ text: "", spacing: { after: 600 } }),

          // Sign-Off Sections
          createHeading("8. Clinical Safety Officer Sign-Off", HeadingLevel.HEADING_1),
          new Paragraph({
            children: [
              new TextRun({ text: "System Safety Classification: ", bold: true }),
              new TextRun({ text: "Class I Medical Device Software (under UK MDR 2002) - Applied for 9th November 2025" }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Overall Safety Rating: ", bold: true }),
              new TextRun({ text: "AMBER - Conditionally Acceptable for NHS Deployment", color: "D97706" }),
            ],
            spacing: { after: 400 },
          }),
          createNormalText("CSO Name: _____________________________________"),
          createNormalText("Signature: _____________________________________"),
          createNormalText("Date: _____________________________________"),
          createNormalText("Next Review Date: _____________________________________"),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          createHeading("9. Data Protection Officer Sign-Off", HeadingLevel.HEADING_1),
          new Paragraph({
            children: [
              new TextRun({ text: "GDPR Compliance Status: ", bold: true }),
              new TextRun({ text: "Conditionally Compliant - Subject to DPIA Completion", color: "D97706" }),
            ],
            spacing: { after: 400 },
          }),
          createNormalText("DPO Name: _____________________________________"),
          createNormalText("Signature: _____________________________________"),
          createNormalText("Date: _____________________________________"),

          new Paragraph({ text: "", spacing: { after: 600 } }),

          // Footer
          new Paragraph({
            text: "NHS OFFICIAL-SENSITIVE",
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 200 },
          }),
          new Paragraph({
            text: "This document contains sensitive information and should be handled in accordance with NHS Information Governance policies.",
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `© ${new Date().getFullYear()} Notewell Healthcare Management System. All rights reserved.`,
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `CSO_Report_${new Date().toISOString().split("T")[0]}.docx`);
};
