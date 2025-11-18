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
  BorderStyle,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { saveAs } from "file-saver";
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from "./wordTheme";
import type { Risk } from "./dpiaRiskMatrix";
import {
  calculateRiskScores,
  getRiskLevel,
  formatLikelihood,
  formatSeverity,
} from "./dpiaRiskMatrix";

export interface DPIAData {
  metadata: {
    version: string;
    date: string;
    organisation: string;
    classification: string;
    nextReview: string;
  };
  executiveSummary: {
    purpose: string;
    scope: string[];
    necessity: string;
  };
  services: Array<{
    name: string;
    description: string;
    dataProcessed: string[];
    legalBasis: string;
    retention: string;
  }>;
  risks: Risk[];
  processors: Array<{
    name: string;
    purpose: string;
    location: string;
    safeguards: string[];
  }>;
  internationalTransfers: Array<{
    recipient: string;
    country: string;
    mechanism: string;
    additionalSafeguards: string[];
  }>;
  dataSubjectRights: {
    accessProcedure: string;
    rectificationProcedure: string;
    erasureProcedure: string;
    responseTime: string;
  };
  approval: {
    dpoRecommendation: string;
    dpoName: string;
    dpoDate: string;
    approver: string;
    approvalDate: string;
  };
}

// Helper to create table header cell with NHS styling
function createHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: NHS_COLORS.white,
            font: FONTS.default,
            size: FONTS.size.small,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      fill: NHS_COLORS.tableHeaderBg,
    },
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1),
    },
  });
}

// Helper to create standard table cell
function createCell(text: string, options?: { shading?: string }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONTS.default,
            size: FONTS.size.small,
            color: NHS_COLORS.textGrey,
          }),
        ],
      }),
    ],
    shading: options?.shading ? { fill: options.shading } : undefined,
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1),
    },
  });
}

// Get risk colour for table cells
function getRiskColour(level: string): string {
  switch (level) {
    case "critical":
      return "DC2626"; // red-600
    case "high":
      return "F59E0B"; // amber-500
    case "medium":
      return "3B82F6"; // blue-500
    case "low":
      return "10B981"; // green-500
    default:
      return "E5E7EB"; // grey-200
  }
}

// Generate cover page
function generateCoverPage(metadata: DPIAData["metadata"]): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "DATA PROTECTION IMPACT ASSESSMENT",
          font: FONTS.default,
          size: FONTS.size.title,
          bold: true,
          color: NHS_COLORS.headingBlue,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2), after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${metadata.organisation}`,
          font: FONTS.default,
          size: FONTS.size.heading2,
          color: NHS_COLORS.textGrey,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Integrated Care Management Platform",
          font: FONTS.default,
          size: FONTS.size.heading3,
          color: NHS_COLORS.textLightGrey,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Version: ${metadata.version}     `,
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }),
        new TextRun({
          text: `Date: ${metadata.date}`,
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Classification: ${metadata.classification}`,
          font: FONTS.default,
          size: FONTS.size.body,
          bold: true,
          color: NHS_COLORS.nhsBlue,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Next Review: ${metadata.nextReview}`,
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textLightGrey,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      text: "",
      pageBreakBefore: true,
    }),
  ];
}

// Generate executive summary section
function generateExecutiveSummary(summary: DPIAData["executiveSummary"]): Paragraph[] {
  return [
    new Paragraph({
      text: "1. Executive Summary",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: "1.1 Purpose",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: summary.purpose,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "1.2 Scope",
      heading: HeadingLevel.HEADING_2,
    }),
    ...summary.scope.map(
      (item) =>
        new Paragraph({
          text: item,
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
        })
    ),
    new Paragraph({
      text: "",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "1.3 Necessity and Proportionality",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: summary.necessity,
      spacing: { after: 400 },
    }),
  ];
}

// Generate processing activities section
function generateProcessingActivities(services: DPIAData["services"]): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: "2. Processing Activities",
      heading: HeadingLevel.HEADING_1,
    }),
  ];

  services.forEach((service, index) => {
    paragraphs.push(
      new Paragraph({
        text: `2.${index + 1} ${service.name}`,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        text: service.description,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Data Processed:",
            bold: true,
            font: FONTS.default,
            size: FONTS.size.body,
          }),
        ],
      })
    );

    service.dataProcessed.forEach((data) => {
      paragraphs.push(
        new Paragraph({
          text: data,
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
        })
      );
    });

    paragraphs.push(
      new Paragraph({
        text: "",
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Legal Basis: ",
            bold: true,
          }),
          new TextRun(service.legalBasis),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Retention: ",
            bold: true,
          }),
          new TextRun(service.retention),
        ],
        spacing: { after: 300 },
      })
    );
  });

  return paragraphs;
}

// Generate risk assessment table
function createRiskTable(risks: Risk[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell("Risk Title"),
        createHeaderCell("Inherent Risk"),
        createHeaderCell("Controls Applied"),
        createHeaderCell("Residual Risk"),
        createHeaderCell("Risk Reduction"),
      ],
    }),
  ];

  risks.forEach((risk) => {
    const scores = calculateRiskScores(risk);
    const inherentLevel = scores.inherentLevel;
    const residualLevel = scores.residualLevel;

    rows.push(
      new TableRow({
        children: [
          createCell(risk.title),
          createCell(
            `${scores.inherentScore} (${inherentLevel.toUpperCase()})`,
            { shading: getRiskColour(inherentLevel) }
          ),
          createCell(risk.controls.join(", ")),
          createCell(
            `${scores.residualScore} (${residualLevel.toUpperCase()})`,
            { shading: getRiskColour(residualLevel) }
          ),
          createCell(`${scores.riskReduction} points`),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });
}

// Generate detailed risk descriptions
function generateRiskDetail(risk: Risk): Paragraph[] {
  const scores = calculateRiskScores(risk);

  return [
    new Paragraph({
      text: risk.title,
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: risk.description,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Inherent Risk: ",
          bold: true,
        }),
        new TextRun(
          `${formatLikelihood(risk.inherentLikelihood)} likelihood × ${formatSeverity(
            risk.inherentSeverity
          )} severity = Score ${scores.inherentScore} (${scores.inherentLevel.toUpperCase()})`
        ),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Residual Risk: ",
          bold: true,
        }),
        new TextRun(
          `${formatLikelihood(risk.residualLikelihood)} likelihood × ${formatSeverity(
            risk.residualSeverity
          )} severity = Score ${scores.residualScore} (${scores.residualLevel.toUpperCase()})`
        ),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Controls in Place:",
          bold: true,
        }),
      ],
    }),
    ...risk.controls.map(
      (control) =>
        new Paragraph({
          text: control,
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
        })
    ),
    new Paragraph({
      text: "",
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Additional Measures Planned:",
          bold: true,
        }),
      ],
    }),
    ...risk.additionalMeasures.map(
      (measure) =>
        new Paragraph({
          text: measure,
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
        })
    ),
    new Paragraph({
      text: "",
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Responsibility: ",
          bold: true,
        }),
        new TextRun(risk.responsibility),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Timeline: ",
          bold: true,
        }),
        new TextRun(risk.timeline),
      ],
      spacing: { after: 300 },
    }),
  ];
}

// Generate risk assessment section
function generateRiskAssessment(risks: Risk[]): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: "3. Risk Assessment & Treatment",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: "The following risks have been identified and assessed using a 5×5 risk matrix:",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Total Risks Identified: ${risks.length}`,
      numbering: {
        reference: "bullet-numbering",
        level: 0,
      },
    }),
    new Paragraph({
      text: "",
      spacing: { after: 200 },
    }),
  ];

  // Add risk summary table
  paragraphs.push(
    new Paragraph({
      text: "3.1 Risk Matrix Summary",
      heading: HeadingLevel.HEADING_2,
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [createRiskTable(risks)],
      spacing: { after: 400 },
    })
  );

  // Add detailed risk descriptions
  paragraphs.push(
    new Paragraph({
      text: "3.2 Detailed Risk Analysis",
      heading: HeadingLevel.HEADING_2,
    })
  );

  risks.forEach((risk) => {
    paragraphs.push(...generateRiskDetail(risk));
  });

  return paragraphs;
}

// Generate processors table
function createProcessorsTable(processors: DPIAData["processors"]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell("Processor Name"),
        createHeaderCell("Purpose"),
        createHeaderCell("Location"),
        createHeaderCell("Safeguards"),
      ],
    }),
  ];

  processors.forEach((processor) => {
    rows.push(
      new TableRow({
        children: [
          createCell(processor.name),
          createCell(processor.purpose),
          createCell(processor.location),
          createCell(processor.safeguards.join(", ")),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });
}

// Generate processors section
function generateProcessorsSection(processors: DPIAData["processors"]): Paragraph[] {
  return [
    new Paragraph({
      text: "4. Third-Party Processors",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: "The following third-party processors have access to patient data:",
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [createProcessorsTable(processors)],
      spacing: { after: 300 },
    }),
  ];
}

// Generate transfers section
function generateTransfersSection(
  transfers: DPIAData["internationalTransfers"]
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: "5. International Data Transfers",
      heading: HeadingLevel.HEADING_1,
    }),
  ];

  transfers.forEach((transfer, index) => {
    paragraphs.push(
      new Paragraph({
        text: `5.${index + 1} ${transfer.recipient} (${transfer.country})`,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Transfer Mechanism: ",
            bold: true,
          }),
          new TextRun(transfer.mechanism),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Additional Safeguards:",
            bold: true,
          }),
        ],
      })
    );

    transfer.additionalSafeguards.forEach((safeguard) => {
      paragraphs.push(
        new Paragraph({
          text: safeguard,
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
        })
      );
    });

    paragraphs.push(
      new Paragraph({
        text: "",
        spacing: { after: 300 },
      })
    );
  });

  return paragraphs;
}

// Generate data subject rights section
function generateRightsSection(rights: DPIAData["dataSubjectRights"]): Paragraph[] {
  return [
    new Paragraph({
      text: "6. Data Subject Rights",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: "6.1 Right of Access",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: rights.accessProcedure,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "6.2 Right to Rectification",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: rights.rectificationProcedure,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "6.3 Right to Erasure",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: rights.erasureProcedure,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "6.4 Response Timeframe",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: rights.responseTime,
      spacing: { after: 400 },
    }),
  ];
}

// Generate approval section
function generateApprovalSection(approval: DPIAData["approval"]): Paragraph[] {
  return [
    new Paragraph({
      text: "7. DPO Recommendation & Approval",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: "7.1 DPO Recommendation",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: approval.dpoRecommendation,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "DPO Name: ",
          bold: true,
        }),
        new TextRun(approval.dpoName),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Date: ",
          bold: true,
        }),
        new TextRun(approval.dpoDate),
      ],
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: "7.2 Final Approval",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Approved By: ",
          bold: true,
        }),
        new TextRun(approval.approver),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Approval Date: ",
          bold: true,
        }),
        new TextRun(approval.approvalDate),
      ],
      spacing: { after: 400 },
    }),
  ];
}

// Main export function
export async function generateDPIADocx(data: DPIAData, filename: string): Promise<void> {
  const doc = new Document({
    creator: data.metadata.organisation,
    title: "Data Protection Impact Assessment",
    description: "DPIA for Integrated Care Management Platform",
    styles: buildNHSStyles(),
    numbering: buildNumbering(),

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
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "DPIA | PCN Services Ltd",
                    font: FONTS.default,
                    size: FONTS.size.footer,
                    color: NHS_COLORS.textLightGrey,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Official - Sensitive | Page ",
                    font: FONTS.default,
                    size: FONTS.size.footer,
                    color: NHS_COLORS.textLightGrey,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONTS.default,
                    size: FONTS.size.footer,
                    color: NHS_COLORS.textLightGrey,
                  }),
                  new TextRun({
                    text: " of ",
                    font: FONTS.default,
                    size: FONTS.size.footer,
                    color: NHS_COLORS.textLightGrey,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONTS.default,
                    size: FONTS.size.footer,
                    color: NHS_COLORS.textLightGrey,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          ...generateCoverPage(data.metadata),
          ...generateExecutiveSummary(data.executiveSummary),
          ...generateProcessingActivities(data.services),
          ...generateRiskAssessment(data.risks),
          ...generateProcessorsSection(data.processors),
          ...generateTransfersSection(data.internationalTransfers),
          ...generateRightsSection(data.dataSubjectRights),
          ...generateApprovalSection(data.approval),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
