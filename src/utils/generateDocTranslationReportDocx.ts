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
  BorderStyle,
  ImageRun,
  HeadingLevel,
  convertInchesToTwip,
  PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';
import { NHS_COLORS, FONTS, buildNHSStyles, buildNumbering } from './wordTheme';

interface DocumentForReport {
  id: string;
  fileName: string;
  thumbnail?: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  clinicalVerification?: {
    hasIssues: boolean;
    issues: Array<{
      severity: string;
      type: string;
      message: string;
      originalValue: string;
      suggestedCorrection?: string;
    }>;
  };
}

interface GenerateDocTranslationReportOptions {
  documents: DocumentForReport[];
  patientLanguage: string;
  patientLanguageName: string;
  patientLanguageFlag: string;
  practiceInfo?: {
    name?: string;
    address?: string;
    logoUrl?: string;
  };
}

// Convert base64 data URL to Uint8Array
function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Create a styled table row for metadata
function createMetadataRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: 'F1F5F9' },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                font: FONTS.default,
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
              }),
            ],
            spacing: { before: 60, after: 60 },
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                font: FONTS.default,
                size: FONTS.size.body,
                color: NHS_COLORS.textGrey,
              }),
            ],
            spacing: { before: 60, after: 60 },
          }),
        ],
      }),
    ],
  });
}

// Create document section header
function createDocumentHeader(index: number, fileName: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `Document ${index + 1}: `,
        bold: true,
        font: FONTS.default,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
      }),
      new TextRun({
        text: fileName,
        font: FONTS.default,
        size: FONTS.size.heading2,
        color: NHS_COLORS.headingBlue,
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    border: {
      bottom: {
        color: NHS_COLORS.headingBlue,
        space: 1,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
  });
}

// Create text section with label and content
function createTextSection(
  label: string,
  content: string,
  backgroundFill: string
): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: label,
          bold: true,
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.headingBlue,
        }),
      ],
      spacing: { before: 160, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: content || 'No text extracted',
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        }),
      ],
      shading: { fill: backgroundFill },
      spacing: { before: 40, after: 160 },
      indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    }),
  ];
}

// Create clinical verification warnings section
function createClinicalWarnings(
  verification: DocumentForReport['clinicalVerification']
): Paragraph[] {
  if (!verification?.hasIssues || !verification.issues?.length) {
    return [];
  }

  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: '⚠️ CLINICAL VERIFICATION WARNINGS',
          bold: true,
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.priorityHigh,
        }),
      ],
      spacing: { before: 160, after: 80 },
    }),
  ];

  for (const issue of verification.issues) {
    const issueText = issue.suggestedCorrection
      ? `• ${issue.message} (Original: ${issue.originalValue} → Suggested: ${issue.suggestedCorrection})`
      : `• ${issue.message}`;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: issueText,
            font: FONTS.default,
            size: FONTS.size.small,
            color: NHS_COLORS.priorityHigh,
          }),
        ],
        shading: { fill: NHS_COLORS.priorityHighBg },
        spacing: { before: 40, after: 40 },
        indent: { left: convertInchesToTwip(0.15) },
      })
    );
  }

  return paragraphs;
}

export async function generateDocTranslationReportDocx(
  options: GenerateDocTranslationReportOptions
): Promise<void> {
  const { documents, patientLanguageName, patientLanguageFlag, practiceInfo } = options;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Document Translation Report',
          bold: true,
          font: FONTS.default,
          size: FONTS.size.documentTitle,
          color: NHS_COLORS.headingBlue,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Notewell AI - Clinical Document Translation',
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textLightGrey,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Summary metadata table
  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'E2E8F0',
  };

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: tableBorder,
      bottom: tableBorder,
      left: tableBorder,
      right: tableBorder,
      insideHorizontal: tableBorder,
      insideVertical: tableBorder,
    },
    rows: [
      createMetadataRow('Practice Name', practiceInfo?.name || 'Not specified'),
      createMetadataRow('Date', dateStr),
      createMetadataRow('Time', timeStr),
      createMetadataRow('Source Language', `${patientLanguageFlag} ${patientLanguageName}`),
      createMetadataRow('Target Language', '🇬🇧 English'),
      createMetadataRow('Documents Translated', `${documents.length}`),
    ],
  });

  children.push(summaryTable);

  children.push(
    new Paragraph({
      children: [],
      spacing: { before: 300, after: 100 },
    })
  );

  // Process each document
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    // Add page break before each document (except first)
    if (i > 0) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // Document header
    children.push(createDocumentHeader(i, doc.fileName));

    // Document image (if available)
    if (doc.thumbnail) {
      try {
        const imageData = base64ToUint8Array(doc.thumbnail);
        
        // Calculate dimensions (max width 500px, preserve aspect ratio assumed 4:3)
        const maxWidth = 400;
        const aspectRatio = 0.75; // Default aspect ratio
        const width = maxWidth;
        const height = Math.round(maxWidth * aspectRatio);

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Original Document:',
                bold: true,
                font: FONTS.default,
                size: FONTS.size.body,
                color: NHS_COLORS.headingBlue,
              }),
            ],
            spacing: { before: 120, after: 80 },
          })
        );

        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageData,
                transformation: { width, height },
                type: 'jpg',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 160 },
          })
        );
      } catch (error) {
        console.warn('Failed to embed document image:', error);
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Image could not be embedded]',
                font: FONTS.default,
                size: FONTS.size.small,
                color: NHS_COLORS.textLightGrey,
                italics: true,
              }),
            ],
            spacing: { before: 80, after: 80 },
          })
        );
      }
    }

    // Original text section
    const detectedLang = doc.detectedLanguage || patientLanguageName;
    children.push(
      ...createTextSection(
        `ORIGINAL TEXT (${detectedLang}):`,
        doc.originalText,
        'F8FAFC' // Slate-50
      )
    );

    // English translation section
    children.push(
      ...createTextSection(
        'ENGLISH TRANSLATION:',
        doc.translatedText,
        'EFF6FF' // Blue-50
      )
    );

    // Clinical verification warnings
    children.push(...createClinicalWarnings(doc.clinicalVerification));
  }

  // Footer disclaimer
  children.push(
    new Paragraph({
      children: [],
      spacing: { before: 400 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '─'.repeat(60),
          font: FONTS.default,
          size: FONTS.size.small,
          color: NHS_COLORS.sectionDivider,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${dateStr} at ${timeStr} | Notewell AI`,
          font: FONTS.default,
          size: FONTS.size.footer,
          color: NHS_COLORS.footerText,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'This document was created using AI translation. Please verify critical medical information with a qualified interpreter.',
          font: FONTS.default,
          size: FONTS.size.footer,
          color: NHS_COLORS.footerText,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 100 },
    })
  );

  // Create document
  const doc = new Document({
    styles: buildNHSStyles(),
    numbering: buildNumbering(),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const filename = `document-translation-report-${now.toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
}
