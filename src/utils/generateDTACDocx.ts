import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles } from "./wordTheme";
import type { DTACAssessment } from "@/types/dtac";

export async function generateDTACDocx(assessment: DTACAssessment) {
  const sections = [
    // Cover page
    new Paragraph({
      text: "NHS Digital Technology Assessment Criteria (DTAC)",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2), after: convertInchesToTwip(0.5) },
    }),
    new Paragraph({
      text: assessment.companyInfo?.a2_productName || "Product Name",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(0.2), after: convertInchesToTwip(0.3) },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Version: ${assessment.version || '1.0'}`,
          font: FONTS.default,
          size: FONTS.size.body,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertInchesToTwip(0.1) },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          font: FONTS.default,
          size: FONTS.size.body,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertInchesToTwip(1) },
    }),

    // Section A: Company Information
    new Paragraph({
      text: "Section A: Company Information",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    createQuestionAnswer("A1. Company Name", assessment.companyInfo?.a1_companyName),
    createQuestionAnswer("A2. Product/Service Name", assessment.companyInfo?.a2_productName),
    createQuestionAnswer("A3. Product Type", assessment.companyInfo?.a3_productType),
    createQuestionAnswer("A4. Primary Contact Name", assessment.companyInfo?.a4_contactName),
    createQuestionAnswer("A5. Contact Email", assessment.companyInfo?.a5_contactEmail),
    createQuestionAnswer("A6. Contact Phone", assessment.companyInfo?.a6_contactPhone),
    createQuestionAnswer("A7. Company Registration Number", assessment.companyInfo?.a7_companyRegistrationNumber),
    createQuestionAnswer("A8. Registered Address", assessment.companyInfo?.a8_registeredAddress),
    createQuestionAnswer("A9. Website URL", assessment.companyInfo?.a9_websiteUrl),
    createQuestionAnswer("A10. Years Trading", assessment.companyInfo?.a10_yearsTrading),

    // Section B: Value Proposition
    new Paragraph({
      text: "Section B: Value Proposition",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    createQuestionAnswer("B1. Target Users", assessment.valueProposition?.b1_targetUsers),
    createQuestionAnswer("B2. Problem Solved", assessment.valueProposition?.b2_problemSolved),
    createQuestionAnswer("B3. Benefits", assessment.valueProposition?.b3_benefits),
    createQuestionAnswer("B4. Evidence Base", assessment.valueProposition?.b4_evidenceBase),

    // Section C1: Clinical Safety
    new Paragraph({
      text: "Section C1: Clinical Safety",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: "C1.1 Clinical Safety Officer Details",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("CSO Name", assessment.clinicalSafety?.c1_1_csoName),
    createQuestionAnswer("CSO Qualifications", assessment.clinicalSafety?.c1_1_csoQualifications),
    createQuestionAnswer("CSO Contact", assessment.clinicalSafety?.c1_1_csoContact),
    new Paragraph({
      text: "C1.2 DCB0129 Compliance",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Compliant", assessment.clinicalSafety?.c1_2_dcb0129Compliant ? "Yes" : "No"),
    createQuestionAnswer("Evidence", assessment.clinicalSafety?.c1_2_dcb0129Evidence),
    new Paragraph({
      text: "C1.3 MHRA Registration",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Registered", assessment.clinicalSafety?.c1_3_mhraRegistered ? "Yes" : "No"),
    createQuestionAnswer("Details", assessment.clinicalSafety?.c1_3_mhraDetails),
    new Paragraph({
      text: "C1.4 Hazard Log",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Maintained", assessment.clinicalSafety?.c1_4_hazardLog ? "Yes" : "No"),
    createQuestionAnswer("Summary", assessment.clinicalSafety?.c1_4_hazardLogSummary),

    // Section C2: Data Protection
    new Paragraph({
      text: "Section C2: Data Protection",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: "C2.1 ICO Registration",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Registered", assessment.dataProtection?.c2_1_icoRegistered ? "Yes" : "No"),
    createQuestionAnswer("ICO Number", assessment.dataProtection?.c2_1_icoNumber),
    new Paragraph({
      text: "C2.2 Data Protection Officer",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("DPO Name", assessment.dataProtection?.c2_2_dpoName),
    createQuestionAnswer("DPO Contact", assessment.dataProtection?.c2_2_dpoContact),
    new Paragraph({
      text: "C2.3 DSPT Status",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Status", assessment.dataProtection?.c2_3_dsptStatus),
    createQuestionAnswer("Evidence", assessment.dataProtection?.c2_3_dsptEvidence),
    new Paragraph({
      text: "C2.3.2 Data Protection Impact Assessment",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("DPIA Completed", assessment.dataProtection?.c2_3_2_dpiaCompleted ? "Yes" : "No"),
    createQuestionAnswer("DPIA Date", assessment.dataProtection?.c2_3_2_dpiaDate),
    createQuestionAnswer("DPIA Summary", assessment.dataProtection?.c2_3_2_dpiaSummary),
    new Paragraph({
      text: "C2.4 Data Minimisation",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.dataProtection?.c2_4_dataMinimisation),
    new Paragraph({
      text: "C2.5 Data Location",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Location", assessment.dataProtection?.c2_5_dataLocation),
    createQuestionAnswer("Details", assessment.dataProtection?.c2_5_dataLocationDetails),

    // Section C3: Technical Security
    new Paragraph({
      text: "Section C3: Technical Security",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: "C3.1 Cyber Essentials",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Cyber Essentials", assessment.technicalSecurity?.c3_1_cyberEssentials ? "Yes" : "No"),
    createQuestionAnswer("Cyber Essentials Plus", assessment.technicalSecurity?.c3_1_cyberEssentialsPlus ? "Yes" : "No"),
    createQuestionAnswer("Certificate Number", assessment.technicalSecurity?.c3_1_certificateNumber),
    new Paragraph({
      text: "C3.2 Penetration Testing",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Testing Conducted", assessment.technicalSecurity?.c3_2_penetrationTesting ? "Yes" : "No"),
    createQuestionAnswer("Frequency", assessment.technicalSecurity?.c3_2_testingFrequency),
    createQuestionAnswer("Last Test Date", assessment.technicalSecurity?.c3_2_lastTestDate),
    new Paragraph({
      text: "C3.3 Vulnerability Management",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.technicalSecurity?.c3_3_vulnerabilityManagement),
    new Paragraph({
      text: "C3.4 Incident Response",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.technicalSecurity?.c3_4_incidentResponse),

    // Section C4: Interoperability
    new Paragraph({
      text: "Section C4: Interoperability",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: "C4.1 Standards Compliance",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Standards", assessment.interoperability?.c4_1_standardsCompliance?.join(", ")),
    createQuestionAnswer("Details", assessment.interoperability?.c4_1_standardsDetails),
    new Paragraph({
      text: "C4.2 API Availability",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Available", assessment.interoperability?.c4_2_apiAvailable ? "Yes" : "No"),
    createQuestionAnswer("Documentation", assessment.interoperability?.c4_2_apiDocumentation),
    new Paragraph({
      text: "C4.3 Integration Support",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.interoperability?.c4_3_integrationSupport),

    // Section D: Usability & Accessibility
    new Paragraph({
      text: "Section D: Usability & Accessibility",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: "D1.1 User Testing",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Conducted", assessment.usabilityAccessibility?.d1_1_userTesting ? "Yes" : "No"),
    createQuestionAnswer("Details", assessment.usabilityAccessibility?.d1_1_userTestingDetails),
    new Paragraph({
      text: "D1.2 Accessibility Standards",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Standard", assessment.usabilityAccessibility?.d1_2_accessibilityStandard),
    createQuestionAnswer("WCAG Level", assessment.usabilityAccessibility?.d1_2_wcagLevel),
    new Paragraph({
      text: "D1.3 Accessibility Testing",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.usabilityAccessibility?.d1_3_accessibilityTesting),
    new Paragraph({
      text: "D1.4 User Support",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Details", assessment.usabilityAccessibility?.d1_4_userSupport),
    new Paragraph({
      text: "D1.5 Training",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.3), after: convertInchesToTwip(0.1) },
    }),
    createQuestionAnswer("Provided", assessment.usabilityAccessibility?.d1_5_trainingProvided ? "Yes" : "No"),
    createQuestionAnswer("Details", assessment.usabilityAccessibility?.d1_5_trainingDetails),
  ];

  const doc = new Document({
    styles: buildNHSStyles(),
    sections: [{
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
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `DTAC_Assessment_${assessment.companyInfo?.a2_productName?.replace(/\s+/g, '_') || 'Product'}.docx`);
}

function createQuestionAnswer(question: string, answer?: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${question}: `,
        bold: true,
        font: FONTS.default,
        size: FONTS.size.body,
      }),
      new TextRun({
        text: answer || "[Not provided]",
        font: FONTS.default,
        size: FONTS.size.body,
        color: answer ? "000000" : "999999",
      }),
    ],
    spacing: { before: convertInchesToTwip(0.1), after: convertInchesToTwip(0.1) },
  });
}
