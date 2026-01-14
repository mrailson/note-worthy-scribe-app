/**
 * NHS Letter Export Utility
 * Generates professional NHS-standard Word documents for GP letters
 */

import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun
} from 'docx';
import { saveAs } from 'file-saver';
import { parseLetter, cleanMarkdownText, isLetterFormat } from './letterParser';
import { format } from 'date-fns';

export interface NHSLetterExportOptions {
  content: string;
  filename?: string;
  practiceName?: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  practiceLogoUrl?: string;
  clinicianName?: string;
  clinicianTitle?: string;
  clinicianQualifications?: string;
}

// Professional letter styling constants
const LETTER_STYLES = {
  font: 'Calibri',
  fontSize: {
    body: 22,           // 11pt
    heading: 24,        // 12pt
    letterhead: 20,     // 10pt
    footer: 18,         // 9pt
    practiceName: 26,   // 13pt
  },
  colors: {
    primary: '005EB8',      // NHS Blue
    text: '212B32',         // NHS Dark grey
    muted: '768692',        // NHS Grey
    border: 'AEB7BD',       // NHS Light grey
  },
  spacing: {
    paragraph: 200,         // 10pt after
    section: 360,           // 18pt after
    line: 276,              // 1.15 line spacing
  }
};

/**
 * Fetches and processes the practice logo
 */
const fetchLogoAsUint8Array = async (logoUrl: string): Promise<{ data: Uint8Array; type: 'png' | 'jpg' } | null> => {
  if (!logoUrl) return null;
  
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const type = logoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
    
    return {
      data: new Uint8Array(arrayBuffer),
      type
    };
  } catch (error) {
    console.warn('Failed to fetch logo:', error);
    return null;
  }
};

/**
 * Creates a formatted paragraph with proper NHS styling
 */
const createBodyParagraph = (text: string, options?: { bold?: boolean; italic?: boolean; spacing?: number }): Paragraph => {
  const cleanText = cleanMarkdownText(text);
  
  return new Paragraph({
    children: [
      new TextRun({
        text: cleanText,
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        color: LETTER_STYLES.colors.text,
        bold: options?.bold,
        italics: options?.italic,
      })
    ],
    spacing: {
      after: options?.spacing ?? LETTER_STYLES.spacing.paragraph,
      line: LETTER_STYLES.spacing.line,
    },
    alignment: AlignmentType.JUSTIFIED,
  });
};

/**
 * Creates the letterhead section with practice details
 */
const createLetterhead = async (options: NHSLetterExportOptions): Promise<Paragraph[]> => {
  const elements: Paragraph[] = [];
  
  // Add logo if available
  if (options.practiceLogoUrl) {
    const logoData = await fetchLogoAsUint8Array(options.practiceLogoUrl);
    if (logoData) {
      elements.push(new Paragraph({
        children: [
          new ImageRun({
            data: logoData.data,
            transformation: { width: 140, height: 70 },
            type: logoData.type,
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 }
      }));
    }
  }
  
  // Practice name
  if (options.practiceName) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: options.practiceName,
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.practiceName,
          bold: true,
          color: LETTER_STYLES.colors.primary,
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 }
    }));
  }
  
  // Practice address
  if (options.practiceAddress) {
    const addressLines = options.practiceAddress.split(',').map(s => s.trim());
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: addressLines.join(' • '),
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.letterhead,
          color: LETTER_STYLES.colors.muted,
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 }
    }));
  }
  
  // Contact details
  const contactParts: string[] = [];
  if (options.practicePhone) contactParts.push(`Tel: ${options.practicePhone}`);
  if (options.practiceEmail) contactParts.push(`Email: ${options.practiceEmail}`);
  
  if (contactParts.length > 0) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: contactParts.join(' | '),
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.letterhead,
          color: LETTER_STYLES.colors.muted,
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 }
    }));
  }
  
  // Divider line
  elements.push(new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 8,
        color: LETTER_STYLES.colors.primary,
      }
    },
    spacing: { after: 360 }
  }));
  
  return elements;
};

/**
 * Creates the date section (right-aligned)
 */
const createDateSection = (dateString?: string): Paragraph => {
  const displayDate = dateString || format(new Date(), "d MMMM yyyy");
  
  return new Paragraph({
    children: [
      new TextRun({
        text: displayDate,
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        color: LETTER_STYLES.colors.text,
      })
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { after: LETTER_STYLES.spacing.section }
  });
};

/**
 * Creates the recipient address block
 */
const createRecipientBlock = (toLines?: string[]): Paragraph[] => {
  if (!toLines || toLines.length === 0) return [];
  
  return toLines.map((line, index) => new Paragraph({
    children: [
      new TextRun({
        text: cleanMarkdownText(line),
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        color: LETTER_STYLES.colors.text,
        bold: index === 0, // First line (name) is bold
      })
    ],
    spacing: { after: index === toLines.length - 1 ? LETTER_STYLES.spacing.section : 40 }
  }));
};

/**
 * Creates the subject line
 */
const createSubjectLine = (subject: string): Paragraph => {
  return new Paragraph({
    children: [
      new TextRun({
        text: 'Re: ',
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        bold: true,
        color: LETTER_STYLES.colors.text,
      }),
      new TextRun({
        text: cleanMarkdownText(subject),
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        bold: true,
        color: LETTER_STYLES.colors.text,
      })
    ],
    spacing: { after: LETTER_STYLES.spacing.section }
  });
};

/**
 * Creates the salutation
 */
const createSalutation = (salutation: string): Paragraph => {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${cleanMarkdownText(salutation)},`,
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        color: LETTER_STYLES.colors.text,
      })
    ],
    spacing: { after: LETTER_STYLES.spacing.paragraph }
  });
};

/**
 * Creates the closing phrase
 */
const createClosing = (closing: string): Paragraph => {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${cleanMarkdownText(closing)},`,
        font: LETTER_STYLES.font,
        size: LETTER_STYLES.fontSize.body,
        color: LETTER_STYLES.colors.text,
      })
    ],
    spacing: { before: LETTER_STYLES.spacing.section, after: 480 } // Extra space for signature
  });
};

/**
 * Creates the signature block
 */
const createSignatureBlock = (
  signature: { name?: string; title?: string; qualifications?: string; organisation?: string },
  options: NHSLetterExportOptions
): Paragraph[] => {
  const elements: Paragraph[] = [];
  
  // Use provided clinician name or extracted signature name
  const name = options.clinicianName || signature.name;
  const title = options.clinicianTitle || signature.title;
  const qualifications = options.clinicianQualifications || signature.qualifications;
  const organisation = signature.organisation || options.practiceName;
  
  if (name) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: name,
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.body,
          bold: true,
          color: LETTER_STYLES.colors.text,
        })
      ],
      spacing: { after: 40 }
    }));
  }
  
  if (qualifications) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: qualifications,
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.body,
          color: LETTER_STYLES.colors.muted,
        })
      ],
      spacing: { after: 40 }
    }));
  }
  
  if (title) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: title,
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.body,
          color: LETTER_STYLES.colors.text,
        })
      ],
      spacing: { after: 40 }
    }));
  }
  
  if (organisation) {
    elements.push(new Paragraph({
      children: [
        new TextRun({
          text: organisation,
          font: LETTER_STYLES.font,
          size: LETTER_STYLES.fontSize.body,
          color: LETTER_STYLES.colors.muted,
        })
      ],
      spacing: { after: 40 }
    }));
  }
  
  return elements;
};

/**
 * Creates a footer with practice details
 */
const createFooter = (options: NHSLetterExportOptions): Footer => {
  const footerParts: string[] = [];
  if (options.practiceName) footerParts.push(options.practiceName);
  if (options.practicePhone) footerParts.push(options.practicePhone);
  if (options.practiceEmail) footerParts.push(options.practiceEmail);
  
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: LETTER_STYLES.colors.border,
          }
        },
        spacing: { before: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: footerParts.join(' | '),
            font: LETTER_STYLES.font,
            size: LETTER_STYLES.fontSize.footer,
            color: LETTER_STYLES.colors.muted,
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 }
      })
    ]
  });
};

/**
 * Generates a professional NHS letter Word document
 */
export const generateNHSLetterDocument = async (options: NHSLetterExportOptions): Promise<void> => {
  const { content, filename = 'Letter' } = options;
  
  // Parse the letter content
  const parsed = parseLetter(content);
  
  // Build document elements
  const documentElements: Paragraph[] = [];
  
  // Add letterhead
  const letterhead = await createLetterhead(options);
  documentElements.push(...letterhead);
  
  // Add date (right-aligned)
  documentElements.push(createDateSection(parsed.date));
  
  // Add recipient address block
  if (parsed.headerSection.toLines && parsed.headerSection.toLines.length > 0) {
    documentElements.push(...createRecipientBlock(parsed.headerSection.toLines));
  }
  
  // Add subject line
  if (parsed.subject) {
    documentElements.push(createSubjectLine(parsed.subject));
  }
  
  // Add salutation
  if (parsed.salutation) {
    documentElements.push(createSalutation(parsed.salutation));
  }
  
  // Add body paragraphs
  for (const paragraph of parsed.bodyParagraphs) {
    if (paragraph.trim()) {
      documentElements.push(createBodyParagraph(paragraph));
    }
  }
  
  // Add closing
  if (parsed.closing) {
    documentElements.push(createClosing(parsed.closing));
  } else {
    // Default closing
    documentElements.push(createClosing('Yours sincerely'));
  }
  
  // Add signature block
  const signatureElements = createSignatureBlock(parsed.signature, options);
  documentElements.push(...signatureElements);
  
  // Create the document
  const doc = new Document({
    creator: 'GP Practice Management System',
    title: filename,
    description: 'NHS GP Letter',
    styles: {
      default: {
        document: {
          run: {
            font: LETTER_STYLES.font,
            size: LETTER_STYLES.fontSize.body,
          }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(1),
          }
        }
      },
      footers: {
        default: createFooter(options),
      },
      children: documentElements
    }]
  });
  
  // Generate and save the document
  const blob = await Packer.toBlob(doc);
  const safeFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  saveAs(blob, `${safeFilename}.docx`);
};

/**
 * Determines if content should use NHS letter export or standard export
 */
export const shouldUseNHSLetterExport = (content: string): boolean => {
  return isLetterFormat(content);
};
