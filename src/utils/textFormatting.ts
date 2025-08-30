// Text formatting utilities for meeting minutes

export interface FormatOptions {
  preserveStructure?: boolean;
  addLineBreaks?: boolean;
}

// Bold formatting for titles and headers
export function formatBoldTitles(text: string, options: FormatOptions = {}): string {
  if (!text) return text;
  
  // Match lines that look like titles (standalone lines, often followed by content)
  // This regex looks for lines that are likely titles
  let formatted = text.replace(/^([A-Z][^.!?]*[A-Za-z])$/gm, '**$1**');
  
  // Also bold existing markdown headers
  formatted = formatted.replace(/^(#{1,6})\s*(.+)$/gm, '$1 **$2**');
  
  // Bold lines that end with colon (agenda items, section headers)
  formatted = formatted.replace(/^([^:\n]+):$/gm, '**$1:**');
  
  return formatted;
}

// Italic formatting for emphasis
export function formatItalicEmphasis(text: string): string {
  if (!text) return text;
  
  // Italicize words in parentheses (often notes or asides)
  let formatted = text.replace(/\(([^)]+)\)/g, '(*$1*)');
  
  // Italicize "Note:" or "Action:" prefixes
  formatted = formatted.replace(/\b(Note|Action|Decision|Follow-up):/g, '*$1:*');
  
  return formatted;
}

// Convert to bullet points
export function formatBulletPoints(text: string): string {
  if (!text) return text;
  
  // Convert numbered lists to bullets
  let formatted = text.replace(/^\s*\d+\.\s+/gm, '• ');
  
  // Convert dash lists to bullets
  formatted = formatted.replace(/^\s*[-–—]\s+/gm, '• ');
  
  // Convert lines that start with capital letters and look like list items
  formatted = formatted.replace(/^([A-Z][^.]*[.!?])$/gm, '• $1');
  
  return formatted;
}

// Convert to numbered lists
export function formatNumberedList(text: string): string {
  if (!text) return text;
  
  let counter = 1;
  
  // Convert bullet points to numbered lists
  let formatted = text.replace(/^\s*[•·-]\s+/gm, () => `${counter++}. `);
  
  return formatted;
}

// Add markdown headers
export function formatHeaders(text: string): string {
  if (!text) return text;
  
  // Convert lines that look like main topics to H3
  let formatted = text.replace(/^([A-Z][A-Za-z\s]+):?\s*$/gm, '### $1\n');
  
  // Convert "Agenda Item" or similar to H4
  formatted = formatted.replace(/^(Agenda\s+Item\s+\d+|Item\s+\d+):\s*(.+)$/gm, '#### $1: $2\n');
  
  return formatted;
}

// Convert text to table format (basic attempt)
export function formatTable(text: string): string {
  if (!text) return text;
  
  // Look for patterns like "Name: Value" or "Item | Description"
  const lines = text.split('\n');
  let tableLines: string[] = [];
  let inTable = false;
  
  for (const line of lines) {
    // Check if line contains colon-separated data
    if (line.includes(':') && line.trim().length > 0 && !line.startsWith('#')) {
      const parts = line.split(':');
      if (parts.length === 2) {
        if (!inTable) {
          tableLines.push('| Item | Details |');
          tableLines.push('|------|---------|');
          inTable = true;
        }
        tableLines.push(`| ${parts[0].trim()} | ${parts[1].trim()} |`);
      } else {
        if (inTable) {
          tableLines.push('');
          inTable = false;
        }
        tableLines.push(line);
      }
    } else {
      if (inTable) {
        tableLines.push('');
        inTable = false;
      }
      tableLines.push(line);
    }
  }
  
  return tableLines.join('\n');
}

// Clean up spacing
export function formatCleanSpacing(text: string): string {
  if (!text) return text;
  
  // Remove excessive whitespace
  let formatted = text.replace(/[ \t]+/g, ' ');
  
  // Remove excessive line breaks (more than 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Ensure proper spacing after punctuation
  formatted = formatted.replace(/([.!?])([A-Z])/g, '$1 $2');
  
  // Ensure proper spacing around headers
  formatted = formatted.replace(/(#{1,6}\s+[^\n]+)\n([^\n#])/g, '$1\n\n$2');
  
  // Clean up beginning and end
  formatted = formatted.trim();
  
  return formatted;
}

// Remove all formatting
export function formatRemoveFormatting(text: string): string {
  if (!text) return text;
  
  // Remove markdown formatting
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
  formatted = formatted.replace(/\*(.*?)\*/g, '$1'); // Italic
  formatted = formatted.replace(/#{1,6}\s+/g, ''); // Headers
  formatted = formatted.replace(/^\s*[•·-]\s+/gm, ''); // Bullets
  formatted = formatted.replace(/^\s*\d+\.\s+/gm, ''); // Numbers
  
  // Clean up spacing
  formatted = formatCleanSpacing(formatted);
  
  return formatted;
}

// Main formatting dispatcher
export function applyTextFormatting(text: string, formatType: string): string {
  switch (formatType) {
    case 'format-bold-titles':
      return formatBoldTitles(text);
    case 'format-italic-emphasis':
      return formatItalicEmphasis(text);
    case 'format-bullet-points':
      return formatBulletPoints(text);
    case 'format-numbered-list':
      return formatNumberedList(text);
    case 'format-headers':
      return formatHeaders(text);
    case 'format-table':
      return formatTable(text);
    case 'format-clean-spacing':
      return formatCleanSpacing(text);
    case 'format-remove-formatting':
      return formatRemoveFormatting(text);
    default:
      return text;
  }
}