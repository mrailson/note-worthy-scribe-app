/**
 * Shared meeting email HTML builder utilities.
 * Used by both desktop PostMeetingActionsModal and mobile NoteWellRecorderMobile
 * to produce consistent, professional NHS-branded email output.
 */

import { normaliseMeetingNotesFormatting } from "@/utils/meeting/cleanMeetingContent";
import { normaliseGovernanceLayout } from "@/utils/meeting/normaliseGovernanceLayout";

export interface MeetingEmailMeta {
  date?: string;
  time?: string;
  duration?: number;
  format?: string;
  location?: string;
  overview?: string;
  wordCount?: number;
  attendees?: string[];
  hasAttachment?: boolean;
}

/** Strip duplicate/redundant heading blocks from notes content */
export const stripDuplicateBlocks = (text: string): string => {
  let cleaned = text;
  cleaned = cleaned.replace(/^#{0,2}\s*\*{0,2}\s*MEETING\s*NOTES\s*\*{0,2}\s*$/gim, '');
  cleaned = cleaned.replace(/^#{0,2}\s*\*{0,2}\s*MEETING\s*DETAILS\s*\*{0,2}\s*$/gim, '');
  cleaned = cleaned.replace(/^#{0,2}\s*\*{0,2}\s*MEETING\s+DETAILS\s*\*{0,2}\s+(?:DATE|TIME|LOCATION|ATTENDEES|DURATION)[\s\S]*$/gim, '');
  cleaned = cleaned.replace(/^[\s•*-]*\*?\*?Meeting\s*Title:\*?\*?.*$/gim, '');
  cleaned = cleaned.replace(/^[\s•*-]*\*?\*?Date:\*?\*?.*$/gim, '');
  cleaned = cleaned.replace(/^[\s•*-]*\*?\*?Time:\*?\*?.*$/gim, '');
  cleaned = cleaned.replace(/^[\s•*-]*\*?\*?Location:\*?\*?.*$/gim, '');
  cleaned = cleaned.replace(/(?:^|\n)\s*#{0,6}\s*ATTENDEES\s*\n+\s*(?:[-•*]\s*)?(?:TBC|To be confirmed)\s*(?=\n|$)/gim, '\n');
  cleaned = cleaned.replace(/^[\s•*-]*\*?\*?Attendees?:\*?\*?\s*(?:TBC|To be confirmed)\s*$/gim, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
};

/** Convert markdown notes content to styled HTML for email body */
export const convertToStyledHTML = (text: string): string => {
  const cleanedText = normaliseGovernanceLayout(normaliseMeetingNotesFormatting(stripDuplicateBlocks(text)));
  let processedText = cleanedText
    .replace(/\\\*/g, '')
    .replace(/\*{3,}/g, '**')
    .replace(/═+/g, '')
    .replace(/---+/g, '');
  // Strip bare-punctuation placeholder lines that the AI sometimes emits as empty decision/action slots
  processedText = processedText.replace(/^[\s]*[-*•][\s]*$/gm, '');

  const transcriptIndex = processedText.indexOf('MEETING TRANSCRIPT FOR REFERENCE:');
  if (transcriptIndex !== -1) {
    processedText = processedText.substring(0, transcriptIndex).trim();
  }
  processedText = processedText.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  processedText = processedText.replace(/\n*Transcript:[\s\S]*$/i, '');
  processedText = processedText.replace(/\n*Full Transcript:[\s\S]*$/i, '');

  const stripInlineMarkdown = (input: string): string =>
    input
      .replace(/\\\*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

  const lines = processedText.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Handle well-formed markdown tables only; loose pipe rows are normalised earlier.
    if (line.startsWith('|')) {
      const tableRows: string[][] = [];
      let inTable = true;
      while (i < lines.length && inTable) {
        const currentLine = lines[i].trim();
        if (/^[|:\s-]+$/.test(currentLine)) { i++; continue; }
        if (currentLine.startsWith('|')) {
          const cells = currentLine.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
          if (cells.length > 0) tableRows.push(cells);
          i++;
        } else {
          inTable = false;
        }
      }
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const excludeIndices = new Set<number>();
        headerRow.forEach((cell, idx) => {
          const clean = stripInlineMarkdown(cell).toLowerCase();
          if (clean === 'priority' || clean === 'status') excludeIndices.add(idx);
        });
        const headerLower = headerRow.map(c => stripInlineMarkdown(c).toLowerCase());
        const filteredHeaderLower = headerLower.filter((_, idx) => !excludeIndices.has(idx));
        const isActionTable = filteredHeaderLower.some(h => /^action(\s|$|s)/.test(h)) &&
                              filteredHeaderLower.some(h => h === 'owner' || h === 'responsible' || h === 'assignee');
        let colWidths: string[];
        if (isActionTable) {
          colWidths = filteredHeaderLower.map(h => {
            if (/^action/.test(h)) return '52%';
            if (h === 'owner' || h === 'responsible' || h === 'assignee') return '20%';
            if (/^(deadline|due|due date|by)$/.test(h)) return '16%';
            return '12%';
          });
          const totalParsed = colWidths.reduce((sum, w) => sum + parseInt(w, 10), 0);
          if (totalParsed < 90 || totalParsed > 110) {
            colWidths = filteredHeaderLower.map(() => `${Math.floor(100 / filteredHeaderLower.length)}%`);
          }
        } else {
          colWidths = filteredHeaderLower.map(() => `${Math.floor(100 / filteredHeaderLower.length)}%`);
        }
        let tableHTML = '<table style="border-collapse: collapse; width: 100%; table-layout: fixed; margin: 16px 0; font-family: Arial, sans-serif; word-wrap: break-word;">\n';
        tableHTML += '  <colgroup>\n';
        colWidths.forEach(w => {
          tableHTML += `    <col style="width: ${w};" />\n`;
        });
        tableHTML += '  </colgroup>\n';
        tableRows.forEach((cells, rowIdx) => {
          const filteredCells = cells.filter((_, idx) => !excludeIndices.has(idx));
          tableHTML += '  <tr>\n';
          filteredCells.forEach(cell => {
            const cleanCell = stripInlineMarkdown(cell);
            if (rowIdx === 0) {
              tableHTML += `    <th style="border: 1px solid #ddd; padding: 10px; background-color: #f5f5f5; text-align: left; font-weight: 600; word-wrap: break-word; vertical-align: top;">${cleanCell}</th>\n`;
            } else {
              tableHTML += `    <td style="border: 1px solid #ddd; padding: 10px; text-align: left; word-wrap: break-word; vertical-align: top;">${cleanCell}</td>\n`;
            }
          });
          tableHTML += '  </tr>\n';
        });
        tableHTML += '</table>\n';
        html += tableHTML;
      }
      continue;
    }

    // Markdown headers
    if (line.match(/^#{1,6}\s/)) {
      const headerText = stripInlineMarkdown(line.replace(/^#{1,6}\s*/, ''));
      html += `<h2 style="color: #2563EB; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${headerText}</h2>\n`;
      i++; continue;
    }

    // ALL CAPS section headers — require at least one A–Z letter so bare punctuation lines like "-" are not misclassified
    if (line.length > 0 && line === line.toUpperCase() && line.length < 100 && !line.match(/^\d/) && /[A-Z]/.test(line) && !/^MEETING\s+DETAILS\b/.test(line)) {
      html += `<h2 style="color: #2563EB; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${stripInlineMarkdown(line)}</h2>\n`;
      i++; continue;
    }

    // Sub-headings (Context, Discussion, Agreed, etc.)
    const subHeadingMatch = line.match(/^\s*[-•]?\s*\*{0,2}(Context|Discussion|Agreed|Implication|Meeting Purpose)[:\s]*\*{0,2}\s*(.*)$/i);
    if (subHeadingMatch) {
      const label = subHeadingMatch[1].trim();
      const bodyText = stripInlineMarkdown(subHeadingMatch[2] || '');
      html += `<p style="margin: 4px 0 4px 24px; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px;">`;
      html += `<strong style="color: #2563EB;">${label}: </strong>`;
      if (bodyText) html += `<span style="color: #1a1a1a;">${bodyText}</span>`;
      html += `</p>\n`;
      i++; continue;
    }

    // Bullet points
    if (line.match(/^[•-]\s/) || (line.match(/^\*\s/) && !line.match(/^\*{1,2}(Context|Discussion|Agreed|Implication|Meeting)/i))) {
      let listHTML = '<ul style="margin: 8px 0 8px 20px; padding: 0;">\n';
      while (i < lines.length) {
        const curLine = lines[i].trim();
        if (curLine.match(/^[•-]\s/) || (curLine.match(/^\*\s/) && !curLine.match(/^\*{1,2}(Context|Discussion|Agreed|Implication|Meeting)/i))) {
          const itemText = stripInlineMarkdown(curLine.replace(/^[•*-]\s/, ''));
          listHTML += `  <li style="margin: 4px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;">${itemText}</li>\n`;
          i++;
        } else {
          break;
        }
      }
      listHTML += '</ul>\n';
      html += listHTML;
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const fullText = stripInlineMarkdown(line.replace(/^\d+\.\s*/, ''));
      const numberMatch = line.match(/^(\d+)\.\s/);
      const number = numberMatch ? numberMatch[1] : '';
      const colonIndex = fullText.indexOf(':');
      if (colonIndex !== -1) {
        const heading = stripInlineMarkdown(fullText.substring(0, colonIndex + 1));
        const bodyText = stripInlineMarkdown(fullText.substring(colonIndex + 1).trim());
        html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px;">`;
        html += `<strong style="color: #2563EB;">${number}. ${heading}</strong>`;
        if (bodyText) html += ` <span style="color: #1a1a1a; font-weight: normal;">${bodyText}</span>`;
        html += `</p>\n`;
      } else if (fullText.length > 80) {
        // Long numbered line with no colon — model jammed a heading and body paragraph onto one line.
        // Render as plain paragraph with only the number bolded so we don't blue-bold the whole body.
        html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a;"><strong style="color: #2563EB;">${number}.</strong> ${fullText}</p>\n`;
      } else {
        html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px;"><strong style="color: #2563EB;">${number}. ${fullText}</strong></p>\n`;
      }
      i++; continue;
    }

    // Governance decision lines: plain "LABEL — text" — no bold, no colour, no bullet.
    const governanceMatch = line.match(/^[-•*]?\s*\*{0,2}(RESOLVED|AGREED|NOTED)\*{0,2}\s*[—:-]?\s*(.*)$/i);
    if (governanceMatch) {
      const body = governanceMatch[2] ? ` — ${stripInlineMarkdown(governanceMatch[2])}` : '';
      html += `<p style="margin: 6px 0 6px 20px; line-height: 1.55; font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a;"><strong style="font-weight: 600;">${governanceMatch[1].toUpperCase()}</strong>${body}</p>\n`;
      i++; continue;
    }

    // Empty lines
    if (line.length === 0) { i++; continue; }

    // Regular paragraphs
    const htmlLine = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\\\*/g, '')
      .replace(/\*\*/g, '');
    html += `<p style="margin: 8px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;">${htmlLine}</p>\n`;
    i++;
  }

  return html;
};

/** Build the full professional NHS-branded email HTML with meeting details, overview, and notes */
export const buildProfessionalMeetingEmail = (
  content: string,
  senderName: string,
  title: string,
  meetingMeta?: MeetingEmailMeta
): string => {
  // Strip sections that are already conveyed elsewhere (Executive Summary
  // appears as a coloured callout above; Decision Register, Open Items,
  // Action Items and Next Meeting are available in the attached Word doc).
  let bodyContent = content;
  const stripSection = (heading: string) => {
    const re = new RegExp(
      `(^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*${heading}\\s*(?:\\*\\*)?\\s*\\n[\\s\\S]*?(?=\\n\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*[A-Z][A-Z0-9 ,&/()'-]{2,}\\s*(?:\\*\\*)?\\s*\\n|\\n\\s*#{1,6}\\s|$)`,
      'i'
    );
    bodyContent = bodyContent.replace(re, '\n');
  };
  if (meetingMeta?.overview) {
    stripSection('EXECUTIVE SUMMARY');
  }
  stripSection('DECISION REGISTER');
  stripSection('DECISIONS');
  stripSection('OPEN ITEMS(?: & RISKS| AND RISKS)?');
  stripSection('OPEN ITEMS & RISKS');
  stripSection('ACTION ITEMS');
  stripSection('ACTIONS');
  stripSection('NEXT MEETING');
  const formattedNotes = convertToStyledHTML(bodyContent);

  // Derive first name for greeting (fallback to bare "Hi,")
  const firstName = (senderName || '').trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  // Extract attendees from notes content if not provided
  let attendeeList = meetingMeta?.attendees || [];
  if (attendeeList.length === 0) {
    const attendeeMatch = content.match(/(?:ATTENDEES|Attendees)\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n[A-Z]{3,}|\n\n\n)/i);
    if (attendeeMatch) {
      attendeeList = attendeeMatch[1]
        .split('\n')
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 1 && !l.match(/^TBC$/i));
    }
  }

  const timeDisplay = meetingMeta?.time || '';
  const durationDisplay = meetingMeta?.duration ? `${meetingMeta.duration} minutes` : '';

  const formatMap: Record<string, string> = {
    'teams': 'Microsoft Teams',
    'hybrid': 'Hybrid',
    'face-to-face': 'Face to Face',
    'phone': 'Phone Call',
  };
  const formatDisplay = formatMap[meetingMeta?.format || ''] || meetingMeta?.format || '';
  const locationDisplay = meetingMeta?.location || '';

  // Build overview section
  let overviewHTML = '';
  if (meetingMeta?.overview) {
    const overviewText = meetingMeta.overview.replace(/\*\*/g, '').replace(/\\\*/g, '');
    const parts = overviewText.split('\n').filter(l => l.trim());
    const paragraph = parts.filter(l => !l.trim().startsWith('•')).join(' ').trim();
    const bullets = parts.filter(l => l.trim().startsWith('•'));
    overviewHTML = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
        <tr><td style="background-color: #F0F9FF; border-left: 4px solid #2563EB; border-radius: 6px; padding: 16px 20px;">
          <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: 0.5px;">Executive Summary</p>
          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">${paragraph}</p>
          ${bullets.length > 0 ? `
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
              ${bullets.map(b => `<tr><td style="padding: 3px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.5;">• ${b.replace(/^•\s*/, '')}</td></tr>`).join('\n')}
            </table>
          ` : ''}
        </td></tr>
      </table>
    `;
  }

  // Build 3-column metadata grid: Date | Duration (or Time) | Attendees
  const dateValue = meetingMeta?.date || '—';
  const hasDuration = !!meetingMeta?.duration;
  const durationLabel = hasDuration ? 'Duration' : 'Time';
  const durationValue = hasDuration
    ? `${meetingMeta!.duration} min`
    : (timeDisplay || '—');
  const attendeesValue = attendeeList.length === 0
    ? '—'
    : attendeeList.length <= 3
      ? attendeeList.join(', ')
      : `${attendeeList.length} attendees`;

  const labelStyle = 'font-family: Arial, sans-serif; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;';
  const valueStyle = 'font-family: Arial, sans-serif; font-size: 14px; font-weight: 500; color: #1a1a1a; margin: 0; line-height: 1.4;';

  const detailsTableHTML = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; background-color: #ffffff; border: 0.5px solid #E5E7EB; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; width: 33.33%; vertical-align: top;">
          <p style="${labelStyle}">Date</p>
          <p style="${valueStyle}">${dateValue}</p>
        </td>
        <td style="padding: 12px 16px; width: 33.33%; vertical-align: top; border-left: 0.5px solid #E5E7EB;">
          <p style="${labelStyle}">${durationLabel}</p>
          <p style="${valueStyle}">${durationValue}</p>
        </td>
        <td style="padding: 12px 16px; width: 33.34%; vertical-align: top; border-left: 0.5px solid #E5E7EB;">
          <p style="${labelStyle}">Attendees</p>
          <p style="${valueStyle}">${attendeesValue}</p>
        </td>
      </tr>
    </table>
  `;

  return `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background-color: #ffffff;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background-color: #005EB8; padding: 20px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: 0.3px;">Notewell AI</p>
              <p style="margin: 4px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #93C5FD; letter-spacing: 0.5px;">Meeting Notes Service</p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span style="display: inline-block; background-color: rgba(255,255,255,0.15); color: #ffffff; font-family: Arial, sans-serif; font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 3px; letter-spacing: 0.8px; text-transform: uppercase;">OFFICIAL</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Accent stripe -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height: 3px; background: linear-gradient(90deg, #005EB8, #2563EB, #60A5FA);"></td></tr>
  </table>

  <!-- Title bar -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background-color: #EFF6FF; padding: 16px 28px; border-bottom: 1px solid #DBEAFE;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; color: #1E40AF;">${title}</p>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding: 24px 28px;">
        
        <p style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
          ${greeting}
        </p>
        
        ${meetingMeta?.hasAttachment === false ? `
        <p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
          Your meeting notes are ready below. The Word document attachment could not be generated for this meeting — open the meeting in Notewell AI and use the Word export button to download the full minutes.
        </p>
        ` : `
        <p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 14px; color: #374151; line-height: 1.6;">
          Your meeting notes are ready. Full minutes are in the attached Word document — summary below.
        </p>
        `}
        
        ${detailsTableHTML}
        
        ${overviewHTML}
        
        ${meetingMeta?.hasAttachment === false ? `
        <!-- Attachment failure callout -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr><td style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px; padding: 14px 20px;">
            <p style="margin: 0 0 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; color: #92400E;">⚠️ Word document not generated</p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #B45309;">Open the meeting in Notewell AI to download the Word minutes manually.</p>
          </td></tr>
        </table>
        ` : `
        <!-- Attachment callout -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
          <tr><td style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 14px 20px;">
            <p style="margin: 0 0 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; color: #166534;">📎 Full meeting notes attached</p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #15803D;">Open the Word document for the complete minutes</p>
          </td></tr>
        </table>
        `}
        
        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 16px 0;">
          <tr><td style="height: 1px; background-color: #E5E7EB;"></td></tr>
        </table>
        
        ${formattedNotes}
        
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height: 1px; background-color: #E5E7EB;"></td></tr>
    <tr>
      <td style="background-color: #F8FAFC; padding: 20px 28px;">
        <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 13px; color: #374151; line-height: 1.5;">
          — Notewell AI
        </p>
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #9CA3AF; line-height: 1.5;">
          Generated by Notewell AI — Meeting Intelligence for NHS Primary Care<br/>
          This email was sent automatically at the end of your recording session.
        </p>
      </td>
    </tr>
  </table>

</div>`;
};
