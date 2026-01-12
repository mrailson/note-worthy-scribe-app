import { AlignmentType, convertInchesToTwip } from "docx";

// NHS and UI color scheme
export const NHS_COLORS = {
  nhsBlue: "005EB8",
  headingBlue: "2563EB", // Tailwind blue-600
  textGrey: "374151",
  textLightGrey: "6B7280",
  tableHeaderBg: "2563EB",
  tableHeaderText: "FFFFFF",
  white: "FFFFFF",
  // Priority colours
  priorityHigh: "DC2626",    // Red-600
  priorityMedium: "F59E0B",  // Amber-500
  priorityLow: "22C55E",     // Green-500
  priorityHighBg: "FEE2E2", // Red-100
  priorityMediumBg: "FEF3C7", // Amber-100
  priorityLowBg: "DCFCE7",   // Green-100
  // Professional document colours
  infoBoxBg: "EFF6FF",       // Blue-50 - light blue background
  infoBoxBorder: "2563EB",   // Blue-600 - border accent
  executiveSummaryBg: "F0F9FF", // Sky-50 - very light blue
  sectionDivider: "CBD5E1",  // Slate-300 - subtle divider
  footerBg: "F8FAFC",        // Slate-50 - footer background
  footerText: "64748B",      // Slate-500 - footer text
  accentGold: "D97706",      // Amber-600 - accent for classification
};

// Font configuration
export const FONTS = {
  default: "Calibri",
  fallback: "Arial",
  size: {
    documentTitle: 40,
    title: 32,
    heading1: 28,
    heading2: 24,
    heading3: 22,
    body: 22,
    small: 20,
    footer: 18,
    classification: 16,
  },
};

// Build NHS-styled document styles
export const buildNHSStyles = () => {
  return {
    default: {
      document: {
        run: {
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        },
        paragraph: {
          spacing: {
            line: 276, // 1.15 line spacing
            after: 120, // 6pt after
          },
        },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.heading1,
          bold: true,
          color: NHS_COLORS.headingBlue,
        },
        paragraph: {
          spacing: {
            before: 240,
            after: 120,
          },
        },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.heading2,
          bold: true,
          color: NHS_COLORS.headingBlue,
        },
        paragraph: {
          spacing: {
            before: 200,
            after: 100,
          },
        },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.heading3,
          bold: true,
          color: NHS_COLORS.headingBlue,
        },
        paragraph: {
          spacing: {
            before: 160,
            after: 80,
          },
        },
      },
      {
        id: "ListParagraph",
        name: "List Paragraph",
        basedOn: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.body,
          color: NHS_COLORS.textGrey,
        },
        paragraph: {
          spacing: {
            after: 60,
          },
          indent: {
            left: convertInchesToTwip(0.25),
          },
        },
      },
      {
        id: "ExecutiveSummary",
        name: "Executive Summary",
        basedOn: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.body,
          italics: true,
          color: NHS_COLORS.textGrey,
        },
        paragraph: {
          spacing: {
            before: 120,
            after: 120,
          },
        },
      },
      {
        id: "Footer",
        name: "Footer",
        basedOn: "Normal",
        run: {
          font: FONTS.default,
          size: FONTS.size.footer,
          color: NHS_COLORS.footerText,
        },
        paragraph: {
          spacing: {
            before: 60,
            after: 60,
          },
        },
      },
    ],
  };
};

// Numbering definitions for bullets and numbered lists
export const buildNumbering = () => {
  return {
    config: [
      {
        reference: "bullet-numbering",
        levels: [
          {
            level: 0,
            format: "bullet" as const,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.18) },
              },
            },
          },
          {
            level: 1,
            format: "bullet" as const,
            text: "○",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.18) },
              },
            },
          },
        ],
      },
      {
        reference: "numbered-numbering",
        levels: [
          {
            level: 0,
            format: "decimal" as const,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.18) },
              },
            },
          },
          {
            level: 1,
            format: "decimal" as const,
            text: "%1.%2.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.18) },
              },
            },
          },
        ],
      },
    ],
  };
};
