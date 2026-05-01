/**
 * Deno port of src/utils/generateProfessionalMeetingDocx.ts (generateProfessionalWordBlob)
 * Produces a professional NHS-branded Word document for meeting notes.
 * Uses npm:docx@8.5.0 for Deno compatibility.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Footer,
  PageNumber,
  // @ts-ignore — Deno npm specifier
} from "npm:docx@8.5.0";

// ── Theme constants (mirror src/utils/wordTheme.ts) ──

const NHS_COLORS = {
  nhsBlue: "005EB8",
  headingBlue: "2563EB",
  textGrey: "374151",
  textLightGrey: "6B7280",
  tableHeaderBg: "2563EB",
  tableHeaderText: "FFFFFF",
  white: "FFFFFF",
  priorityHigh: "DC2626",
  priorityMedium: "F59E0B",
  priorityLow: "22C55E",
  priorityHighBg: "FEE2E2",
  priorityMediumBg: "FEF3C7",
  priorityLowBg: "DCFCE7",
  infoBoxBg: "EFF6FF",
  infoBoxBorder: "2563EB",
  executiveSummaryBg: "F0F9FF",
  sectionDivider: "CBD5E1",
  footerBg: "F8FAFC",
  footerText: "64748B",
  accentGold: "D97706",
};

const FONTS = {
  default: "Calibri",
  size: {
    documentTitle: 40,
    heading1: 28,
    heading2: 24,
    heading3: 22,
    body: 22,
    small: 20,
    footer: 18,
    classification: 16,
  },
};

const convertInchesToTwip = (inches: number) => Math.round(inches * 1440);

// ── Styles & numbering ──

const buildNHSStyles = () => ({
  default: {
    document: {
      run: { font: FONTS.default, size: FONTS.size.body, color: NHS_COLORS.textGrey },
      paragraph: { spacing: { line: 276, after: 120 } },
    },
  },
  paragraphStyles: [],
});

const buildNumbering = () => ({
  config: [
    {
      reference: "bullet-numbering",
      levels: [{
        level: 0, format: "bullet" as const, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.18) } } },
      }],
    },
    {
      reference: "numbered-numbering",
      levels: [{
        level: 0, format: "decimal" as const, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.18) } } },
      }],
    },
  ],
});

// ── Content helpers ──

const decodeHtmlEntities = (text: string): string =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

const stripTranscriptAndDetails = (content: string): string => {
  let c = content;
  c = c.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  c = c.replace(/\n*Transcript:[\s\S]*$/i, '');
  c = c.replace(/\n*Full Transcript:[\s\S]*$/i, '');
  c = c.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
  c = c.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
  c = c.replace(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*.*$/gim, '');
  c = c.replace(/^#+?\s*Background\s*$/gim, '');
  c = c.replace(/^\s*Background\s*$/gim, '');
  c = c.replace(/^\s*Date\s*:\s*.+$/gim, '');
  c = c.replace(/^\s*Time\s*:\s*.+$/gim, '');
  c = c.replace(/^\s*Location\s*:\s*.+$/gim, '');
  c = c.replace(/^\s*Venue\s*:\s*.+$/gim, '');
  c = c.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*TBC\s*\n*/gi, '\n\n');
  c = c.replace(/\n*#+ ATTENDEES\s*\n+TBC\s*\n*/gi, '\n\n');
  c = c.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*To be confirmed\s*\n*/gi, '\n\n');
  c = c.replace(/\n{3,}/g, '\n\n');
  c = c.replace(/\\\*/g, '').replace(/\*\\\*/g, '').replace(/\n\s*═+\s*\n/g, '\n').replace(/\n\s*---+\s*\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  return c;
};

const deduplicateActionItems = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  const seenActionItems = new Set<string>();
  let seenCompletedHeader = false;

  const normaliseAction = (text: string): string =>
    text.replace(/^[-•*]\s*/, '').replace(/~~(.+?)~~/g, '$1').replace(/\s*—\s*@\w+/g, '').replace(/\s*\([^)]+\)/g, '').replace(/\s*\[\w+\]/g, '').replace(/\s*\{[^}]+\}/g, '').toLowerCase().trim();

  const isActionItem = (line: string): boolean => {
    const t = line.trim();
    return (t.startsWith('-') || t.startsWith('•') || t.startsWith('*')) && (t.includes('@') || t.includes('[') || t.includes('~~'));
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (/^\*\*completed\s*items?\*\*\s*:?\s*$/i.test(trimmed) || /^#{1,3}\s*completed\s*(items?)?\s*:?\s*$/i.test(trimmed)) {
      if (seenCompletedHeader) {
        while (idx + 1 < lines.length) {
          const next = lines[idx + 1].trim();
          if (!next || isActionItem(next) || /^\*\*completed/i.test(next) || /^#{1,3}\s*completed/i.test(next)) idx++;
          else break;
        }
        continue;
      }
      seenCompletedHeader = true;
      result.push(line);
      continue;
    }

    if (isActionItem(line)) {
      const normalised = normaliseAction(line);
      if (normalised && seenActionItems.has(normalised)) continue;
      if (normalised) seenActionItems.add(normalised);
    }

    result.push(line);
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Section removal helpers
const detectHeading = (line: string): { text: string; level: number } | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const mdMatch = trimmed.match(/^(#{1,6})\s*\**\s*(.+?)\s*\**\s*$/);
  if (mdMatch) return { text: mdMatch[2].replace(/\*+/g, '').replace(/:\s*$/, '').trim().toLowerCase(), level: mdMatch[1].length };
  const boldMatch = trimmed.match(/^\*{2,}\s*(.+?)\s*\*{2,}\s*:?\s*$/);
  if (boldMatch && trimmed.length < 80) return { text: boldMatch[1].replace(/:\s*$/, '').trim().toLowerCase(), level: 2 };
  if (/^[A-Z][A-Z\s&:,]{2,}$/.test(trimmed) && trimmed.length < 60) return { text: trimmed.replace(/:\s*$/, '').trim().toLowerCase(), level: 2 };
  return null;
};

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
          if (pattern.test(heading.text)) { inSection = true; sectionLevel = heading.level; continue; }
          result.push(line); continue;
        }
        continue;
      }
      if (pattern.test(heading.text)) { inSection = true; sectionLevel = heading.level; continue; }
    }
    if (!inSection) result.push(line);
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

const removeActionItemsSection = (c: string) => removeSectionByPattern(c, /^(action\s*(items?|log|list)|completed\s*items?)$/);
const removeExecutiveSummarySection = (c: string) => removeSectionByPattern(c, /^(executive\s*summary|overview|summary)$/);

// ── Inline formatting parser ──

const parseInlineFormatting = (text: string): any[] => {
  const runs: any[] = [];
  let currentIndex = 0;
  const cleanedText = decodeHtmlEntities(text).replace(/\\\*/g, '').replace(/\*\\\*/g, '').replace(/\\\*\*/g, '').replace(/\*{3,}/g, '**').replace(/^\s*[-–—]\s*$/, '').trim();
  const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let match;
  while ((match = markdownRegex.exec(cleanedText)) !== null) {
    if (match.index > currentIndex) {
      const normal = cleanedText.substring(currentIndex, match.index).replace(/\*{1,2}/g, '');
      if (normal) runs.push(new TextRun({ text: normal, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default }));
    }
    if (match[2]) runs.push(new TextRun({ text: match[2].replace(/\*{1,2}/g, ''), size: FONTS.size.body, bold: true, color: NHS_COLORS.textGrey, font: FONTS.default }));
    else if (match[3]) runs.push(new TextRun({ text: match[3].replace(/\*{1,2}/g, ''), size: FONTS.size.body, italics: true, color: NHS_COLORS.textGrey, font: FONTS.default }));
    currentIndex = match.index + match[0].length;
  }
  if (currentIndex < cleanedText.length) {
    const rem = cleanedText.substring(currentIndex).replace(/\*{1,2}/g, '');
    if (rem) runs.push(new TextRun({ text: rem, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text: cleanedText, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default }));
  return runs;
};

// ── Document building blocks ──

const createHeaderBlock = (title: string): any[] => {
  const cleanTitle = title.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim().toUpperCase();
  return [
    new Paragraph({
      children: [new TextRun({ text: cleanTitle, bold: true, size: FONTS.size.documentTitle, color: NHS_COLORS.headingBlue, font: FONTS.default })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "", size: 4 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue } },
      spacing: { after: 360 },
    }),
  ];
};

interface MeetingMeta {
  title: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  venue?: string;
  attendees?: string;
}

const TABLE_WIDTH_DXA = 9026;
const LABEL_COL_DXA = 2400;
const VALUE_COL_DXA = TABLE_WIDTH_DXA - LABEL_COL_DXA;

const createMeetingDetailsBox = (metadata: MeetingMeta): any[] => {
  const rows: any[] = [];
  const createDetailRow = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: FONTS.size.body, color: NHS_COLORS.headingBlue, font: FONTS.default })] })],
          width: { size: LABEL_COL_DXA, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 60 },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.SINGLE, size: 24, color: NHS_COLORS.headingBlue }, right: { style: BorderStyle.NONE } },
          shading: { fill: NHS_COLORS.infoBoxBg },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default })] })],
          width: { size: VALUE_COL_DXA, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 60, right: 120 },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          shading: { fill: NHS_COLORS.infoBoxBg },
        }),
      ],
    });

  if (metadata.date) rows.push(createDetailRow("Date", metadata.date));
  if (metadata.time) rows.push(createDetailRow("Time", metadata.time));
  if (metadata.duration) rows.push(createDetailRow("Duration", metadata.duration));
  if (metadata.location) rows.push(createDetailRow("Location", metadata.location));
  if (metadata.venue) rows.push(createDetailRow("Venue", metadata.venue));
  if (metadata.attendees) rows.push(createDetailRow("Attendees", metadata.attendees));

  if (rows.length === 0) return [];

  return [
    new Paragraph({ children: [new TextRun({ text: "MEETING DETAILS", bold: true, size: FONTS.size.heading2, color: NHS_COLORS.headingBlue, font: FONTS.default })], spacing: { before: 0, after: 120 } }),
    new Table({
      width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [LABEL_COL_DXA, VALUE_COL_DXA],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows,
    }),
    new Paragraph({ children: [], spacing: { after: 360 } }),
  ];
};

const createSectionDivider = (): any =>
  new Paragraph({ children: [], border: { top: { style: BorderStyle.SINGLE, size: 6, color: NHS_COLORS.sectionDivider } }, spacing: { before: 240, after: 240 } });

// ── Action items ──

interface ParsedActionItem {
  action: string;
  owner: string;
  deadline: string;
  priority: string;
  status: string;
  isCompleted: boolean;
}

const createActionItemsTable = (items: ParsedActionItem[]): any[] => {
  if (items.length === 0) {
    return [new Paragraph({ children: [new TextRun({ text: "No action items recorded for this meeting.", size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default, italics: true })], spacing: { after: 240 } })];
  }

  const columnWidths = [55, 22, 23];
  const headerCells = ['Action', 'Owner', 'Deadline'];

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
      new TableRow({
        tableHeader: true,
        children: headerCells.map((cell, colIndex) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true, size: FONTS.size.body, color: NHS_COLORS.tableHeaderText, font: FONTS.default })], spacing: { before: 80, after: 80 } })],
            shading: { fill: NHS_COLORS.tableHeaderBg },
            width: { size: columnWidths[colIndex], type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
          })
        ),
      }),
      ...items.map((item, rowIndex) => {
        const rowBg = rowIndex % 2 === 0 ? undefined : "F8FAFC";
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.action, size: FONTS.size.body, color: item.isCompleted ? NHS_COLORS.textLightGrey : NHS_COLORS.textGrey, font: FONTS.default, strike: item.isCompleted })], spacing: { before: 60, after: 60 } })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.owner, size: FONTS.size.body, color: NHS_COLORS.headingBlue, font: FONTS.default, bold: true })], spacing: { before: 60, after: 60 } })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.deadline, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default })], spacing: { before: 60, after: 60 } })],
              shading: rowBg ? { fill: rowBg } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
          ],
        });
      }),
    ],
  });

  return [table, new Paragraph({ children: [], spacing: { after: 240 } })];
};

// ── Content parser ──

const parseContentToDocxElements = (content: string): any[] => {
  const elements: any[] = [];
  const lines = content.split('\n');
  let i = 0;
  let previousWasHeading = false;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      if (!previousWasHeading) elements.push(new Paragraph({ children: [new TextRun({ text: "", size: FONTS.size.body })], spacing: { after: 60 } }));
      previousWasHeading = false;
      i++; continue;
    }

    // Markdown tables
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      const isSeparatorRow = (row: string) => { const cells = row.split('|').map(c => c.trim()).filter(Boolean); return cells.length > 0 && cells.every(c => /^:?-{3,}:?$/.test(c)); };
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (!tl) { i++; continue; }
        if (!tl.startsWith('|')) break;
        if (!isSeparatorRow(tl)) tableLines.push(tl);
        i++;
      }
      if (tableLines.length > 0) {
        const parseCells = (l: string) => l.split('|').map(c => c.trim()).filter(c => c.length > 0).map(c => decodeHtmlEntities(c.replace(/\*\*/g, '').replace(/\*/g, '')));
        let headerCells = parseCells(tableLines[0]);
        let bodyRows = tableLines.slice(1).map(parseCells);
        const excludeIndices = new Set<number>();
        headerCells.forEach((h, idx) => { const lower = h.toLowerCase().trim(); if (lower === 'priority' || lower === 'status') excludeIndices.add(idx); });
        if (excludeIndices.size > 0) { headerCells = headerCells.filter((_, idx) => !excludeIndices.has(idx)); bodyRows = bodyRows.map(row => row.filter((_, idx) => !excludeIndices.has(idx))); }
        const colCount = headerCells.length;
        const colW = headerCells.map(() => Math.round(100 / colCount));

        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: colW.map(w => Math.round((w / 100) * 9638)),
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue }, bottom: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue }, left: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue }, right: { style: BorderStyle.SINGLE, size: 8, color: NHS_COLORS.headingBlue }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } },
          rows: [
            new TableRow({ tableHeader: true, children: headerCells.map((cell, ci) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true, size: FONTS.size.body, color: NHS_COLORS.tableHeaderText, font: FONTS.default })], spacing: { before: 80, after: 80 } })], shading: { fill: NHS_COLORS.tableHeaderBg }, width: { size: colW[ci], type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 } })) }),
            ...bodyRows.map((row, ri) => new TableRow({ children: row.map((cell, ci) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default })], spacing: { before: 60, after: 60 } })], shading: ri % 2 === 0 ? undefined : { fill: "F8FAFC" }, width: { size: colW[ci], type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 } })) })),
          ],
        });
        elements.push(table);
        elements.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 240 } }));
      }
      previousWasHeading = false;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = decodeHtmlEntities(headingMatch[2]).toUpperCase();
      if (headingText.includes('MEETING DETAILS') || headingText.includes('EXECUTIVE SUMMARY')) { i++; continue; }
      if (level === 1 || level === 2) elements.push(createSectionDivider());
      elements.push(new Paragraph({ children: [new TextRun({ text: headingText, bold: true, size: level === 1 ? FONTS.size.heading1 : level === 2 ? FONTS.size.heading2 : FONTS.size.heading3, color: NHS_COLORS.headingBlue, font: FONTS.default })], spacing: { before: 0, after: level === 1 ? 180 : level === 2 ? 140 : 100 } }));
      previousWasHeading = true;
      i++; continue;
    }

    // Sub-headings
    const subMatch = line.match(/^\s*[-•]?\s*\*{1,2}(Context|Discussion|Agreed|Implication|Meeting Purpose)[:\s]*\*{0,2}\\?\*?\s*(.*)$/i);
    if (subMatch) {
      const label = subMatch[1].trim();
      let bodyText = subMatch[2].replace(/^\*{1,2}\s*/, '').replace(/\*{1,2}\\?\*?\s*$/, '').replace(/\\\*/g, '').trim();
      const isAgreed = label.toLowerCase() === 'agreed';
      const runs: any[] = [new TextRun({ text: `${label}: `, bold: true, size: FONTS.size.body, color: isAgreed ? NHS_COLORS.priorityHigh : NHS_COLORS.headingBlue, font: FONTS.default })];
      if (bodyText) { bodyText = bodyText.replace(/\*\*/g, '').replace(/\\\*/g, '').trim(); runs.push(new TextRun({ text: bodyText, bold: isAgreed, size: FONTS.size.body, color: NHS_COLORS.textGrey, font: FONTS.default })); }
      elements.push(new Paragraph({ children: runs, indent: { left: 360 }, spacing: { before: label.toLowerCase() === 'context' ? 120 : 40, after: label.toLowerCase() === 'implication' ? 200 : 80 } }));
      previousWasHeading = false; i++; continue;
    }

    // Bullets
    const isBulletPoint = line.startsWith('- ') || line.startsWith('• ') || (line.startsWith('* ') && !line.startsWith('** ') && !line.startsWith('*Context') && !line.startsWith('*Discussion') && !line.startsWith('*Agreed') && !line.startsWith('*Implication') && !line.startsWith('*Meeting'));
    if (isBulletPoint) {
      const bulletText = line.replace(/^[-•*]\s*/, '').replace(/\\\*/g, '').replace(/^\*{1,2}\s*/, '').replace(/\*{1,2}\s*$/, '').trim();
      elements.push(new Paragraph({ children: parseInlineFormatting(bulletText), numbering: { reference: "bullet-numbering", level: 0 }, spacing: { after: 80 } }));
      previousWasHeading = false; i++; continue;
    }

    // Numbered lists
    const numberMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      const listText = numberMatch[2].replace(/\\\*/g, '').trim();
      const topicHeadingMatch = listText.match(/^\*\*(.+?)\*\*\s*$/);
      if (topicHeadingMatch) {
        const topicTitle = topicHeadingMatch[1].replace(/\\\*/g, '').trim();
        elements.push(new Paragraph({ children: [new TextRun({ text: `${numberMatch[1]}. `, bold: true, size: FONTS.size.heading3, color: NHS_COLORS.headingBlue, font: FONTS.default }), new TextRun({ text: topicTitle, bold: true, size: FONTS.size.heading3, color: NHS_COLORS.headingBlue, font: FONTS.default })], spacing: { before: 280, after: 80 } }));
        previousWasHeading = true; i++; continue;
      }
      elements.push(new Paragraph({ children: parseInlineFormatting(listText), numbering: { reference: "numbered-numbering", level: 0 }, spacing: { after: 80 } }));
      previousWasHeading = false; i++; continue;
    }

    // Regular paragraph
    elements.push(new Paragraph({ children: parseInlineFormatting(line), spacing: { after: 100 } }));
    previousWasHeading = false; i++;
  }

  return elements;
};

const createFooter = (classification?: string, meetingDate?: string, meetingTime?: string, modelUsed?: string): any => {
  let dateTimeText = '';
  if (meetingDate && meetingTime) dateTimeText = `Meeting: ${meetingDate} at ${meetingTime}`;
  else if (meetingDate) dateTimeText = `Meeting: ${meetingDate}`;

  return new Footer({
    children: [
      new Paragraph({ children: [], border: { top: { style: BorderStyle.SINGLE, size: 6, color: NHS_COLORS.sectionDivider } }, spacing: { after: 120 } }),
      new Paragraph({
        children: [
          new TextRun({ text: classification || "OFFICIAL", size: FONTS.size.classification, color: NHS_COLORS.accentGold, font: FONTS.default, bold: true }),
          ...(dateTimeText ? [new TextRun({ text: "    |    ", size: FONTS.size.classification, color: NHS_COLORS.textLightGrey }), new TextRun({ text: dateTimeText, size: FONTS.size.classification, color: NHS_COLORS.footerText, font: FONTS.default })] : []),
          new TextRun({ text: "    |    Page ", size: FONTS.size.classification, color: NHS_COLORS.textLightGrey }),
          new TextRun({ children: [PageNumber.CURRENT], size: FONTS.size.classification, color: NHS_COLORS.footerText }),
          new TextRun({ text: " of ", size: FONTS.size.classification, color: NHS_COLORS.textLightGrey }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: FONTS.size.classification, color: NHS_COLORS.footerText }),
          // Model provenance stamp — italic light grey, smaller than surrounding footer text
          ...(modelUsed ? [
            new TextRun({ text: "    |    ", size: FONTS.size.classification, color: NHS_COLORS.textLightGrey }),
            new TextRun({ text: modelUsed, size: 14, color: "9CA3AF", font: FONTS.default, italics: true }),
          ] : []),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
};

// ── Filename generator (mirror src/utils/meetingFilename.ts) ──

export function generateMeetingFilename(title: string, date: Date | string, extension = 'docx'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const dateStr = `${day} ${month} ${year}`;

  let cleanTitle = title
    .replace(/^(?:primary care network|pcn|blue pcn|meeting notes?|notes for|minutes of|minutes from)\s*[-:–]?\s*/gi, '')
    .replace(/\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*$/gi, '')
    .replace(/\s*[-–]\s*\d{4}[-/]\d{2}[-/]\d{2}\s*$/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim();

  cleanTitle = cleanTitle.split(' ').map((word, i) => {
    const lower = word.toLowerCase();
    if (i > 0 && ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(lower)) return lower;
    if (word === word.toUpperCase() && word.length >= 2 && word.length <= 5) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');

  if (!cleanTitle || cleanTitle.length < 3) cleanTitle = 'Meeting Notes';

  return `${dateStr} - ${cleanTitle}.${extension}`;
}

// ── Main export ──

export interface GenerateMeetingDocxOpts {
  summaryContent: string;
  title: string;
  details?: {
    date?: string;
    time?: string;
    location?: string;
    attendees?: string;
  };
  actionItems?: Array<{
    action: string;
    owner: string;
    deadline?: string;
    priority?: string;
    status?: string;
    isCompleted?: boolean;
  }>;
}

/**
 * Generate a professional meeting notes Word document and return as base64 string.
 * Safe for large documents — chunks the base64 conversion.
 */
export async function generateMeetingDocxBase64(opts: GenerateMeetingDocxOpts): Promise<string> {
  const { summaryContent, title, details, actionItems } = opts;

  const metadata: MeetingMeta = {
    title,
    date: details?.date,
    time: details?.time,
    location: details?.location,
    attendees: details?.attendees,
  };

  // Clean content
  let cleanedContent = stripTranscriptAndDetails(summaryContent);
  cleanedContent = deduplicateActionItems(cleanedContent);

  // Convert action items
  const parsedActions: ParsedActionItem[] = (actionItems || []).map(item => ({
    action: item.action,
    owner: (item.owner || 'Unassigned').replace(/^@/, ''),
    deadline: item.deadline || 'TBC',
    priority: item.priority || 'Medium',
    status: item.isCompleted ? 'Done' : (item.status === 'completed' ? 'Done' : item.status === 'in_progress' ? 'In Progress' : 'Open'),
    isCompleted: item.isCompleted || false,
  }));

  // Remove action items & executive summary from content (rendered separately)
  let contentWithoutActions = removeActionItemsSection(cleanedContent);
  contentWithoutActions = removeExecutiveSummarySection(contentWithoutActions);

  const children: any[] = [];

  // Header
  children.push(...createHeaderBlock(metadata.title));

  // Meeting details box
  if (metadata.date || metadata.time || metadata.location || metadata.attendees) {
    children.push(...createMeetingDetailsBox(metadata));
  }

  // Main content
  children.push(...parseContentToDocxElements(contentWithoutActions));

  // Action items table
  if (parsedActions.length > 0) {
    children.push(createSectionDivider());
    children.push(new Paragraph({
      children: [new TextRun({ text: "ACTION LOG", bold: true, size: FONTS.size.heading2, color: NHS_COLORS.headingBlue, font: FONTS.default })],
      spacing: { before: 0, after: 180 },
    }));
    children.push(...createActionItemsTable(parsedActions));
  }

  const footer = createFooter(undefined, metadata.date, metadata.time);

  const doc = new Document({
    styles: buildNHSStyles(),
    numbering: buildNumbering(),
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      footers: { default: footer },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(buffer);

  // Chunk-safe base64 conversion to avoid stack overflow on large docs
  const CHUNK_SIZE = 32768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
