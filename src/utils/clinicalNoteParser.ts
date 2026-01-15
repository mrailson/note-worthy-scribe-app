/**
 * Utility functions for parsing and reconstructing clinical note content
 * Used for inline editing in NarrativeClinicalNoteView
 */

export interface ParsedClinicalLine {
  type: 'heading' | 'bullet' | 'paragraph' | 'label' | 'empty';
  content: string;
  htmlContent: string;
  originalLine: string;
  labelPrefix?: string;
  indent?: number;
}

/**
 * Apply basic inline formatting (bold, italic)
 */
const applyInlineFormatting = (text: string): string => {
  // Escape HTML special characters
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_ (not preceded/followed by another *)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
  
  return result;
};

/**
 * Parse clinical note content into structured lines
 */
export function parseClinicalContent(content: string): ParsedClinicalLine[] {
  if (!content || !content.trim()) {
    return [];
  }

  const lines = content.split('\n');
  const parsedLines: ParsedClinicalLine[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line
    if (!trimmedLine) {
      parsedLines.push({
        type: 'empty',
        content: '',
        htmlContent: '',
        originalLine: line,
      });
      continue;
    }

    // Label pattern: **Label:** content or Label: content at the start
    const labelMatch = trimmedLine.match(/^(\*\*[^*]+:\*\*|\*\*[^*]+\*\*:?|[A-Z][a-zA-Z\s]+:)\s*(.*)$/);
    if (labelMatch) {
      const labelPrefix = labelMatch[1];
      const labelContent = labelMatch[2] || '';
      const cleanLabel = labelPrefix.replace(/\*\*/g, '').replace(/:$/, '');
      
      parsedLines.push({
        type: 'label',
        content: labelContent,
        htmlContent: `<strong>${cleanLabel}:</strong> ${applyInlineFormatting(labelContent)}`,
        originalLine: line,
        labelPrefix: cleanLabel,
      });
      continue;
    }

    // Bullet point: - or • at the start
    const bulletMatch = line.match(/^(\s*)([-•])\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const bulletContent = bulletMatch[3];
      
      parsedLines.push({
        type: 'bullet',
        content: bulletContent,
        htmlContent: `<span class="inline-flex items-start gap-2"><span class="text-muted-foreground select-none">•</span><span>${applyInlineFormatting(bulletContent)}</span></span>`,
        originalLine: line,
        indent: Math.floor(indent / 2),
      });
      continue;
    }

    // Regular paragraph
    parsedLines.push({
      type: 'paragraph',
      content: trimmedLine,
      htmlContent: applyInlineFormatting(trimmedLine),
      originalLine: line,
    });
  }

  return parsedLines;
}

/**
 * Reconstruct clinical note content from parsed lines
 */
export function reconstructClinicalContent(lines: ParsedClinicalLine[]): string {
  return lines.map((line) => {
    switch (line.type) {
      case 'empty':
        return '';
      case 'label':
        return line.labelPrefix 
          ? `**${line.labelPrefix}:** ${line.content}`
          : line.content;
      case 'bullet':
        const indent = '  '.repeat(line.indent || 0);
        return `${indent}- ${line.content}`;
      case 'paragraph':
      default:
        return line.content;
    }
  }).join('\n');
}

/**
 * Strip HTML tags and get plain text
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
