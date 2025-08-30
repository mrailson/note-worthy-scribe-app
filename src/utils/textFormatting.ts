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

// Standardize dates to consistent format
export function standardizeDates(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Convert various date formats to DD/MM/YYYY
  // Match patterns like 1st Jan 2024, Jan 1 2024, 01-01-2024, etc.
  formatted = formatted.replace(/(\d{1,2})(st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/gi, 
    (match, day, suffix, month, year) => {
      const monthMap: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const paddedDay = day.padStart(2, '0');
      const monthNum = monthMap[month.toLowerCase().substring(0, 3)];
      return `${paddedDay}/${monthNum}/${year}`;
    });
  
  // Convert MM-DD-YYYY or MM/DD/YYYY to DD/MM/YYYY (assuming US format input)
  formatted = formatted.replace(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/g, 
    (match, m1, m2, year) => {
      const month = m1.padStart(2, '0');
      const day = m2.padStart(2, '0');
      return `${day}/${month}/${year}`;
    });
  
  return formatted;
}

// Format numbers consistently
export function formatNumbers(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Add commas to large numbers (1000 -> 1,000)
  formatted = formatted.replace(/\b(\d{1,3})(\d{3})\b/g, '$1,$2');
  formatted = formatted.replace(/\b(\d{1,3}),(\d{3})(\d{3})\b/g, '$1,$2,$3');
  
  // Standardize currency (£1000 -> £1,000.00, $1000 -> $1,000.00)
  formatted = formatted.replace(/(£|\$)(\d{1,3}(?:,\d{3})*)(?!\.)/g, '$1$2.00');
  
  // Standardize percentages (add % if missing from obvious percentages)
  formatted = formatted.replace(/\b(\d{1,3}(?:\.\d{1,2})?)\s*percent/gi, '$1%');
  
  return formatted;
}

// Standardize time formats
export function formatTimeStamps(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Convert 12-hour to 24-hour format
  formatted = formatted.replace(/(\d{1,2}):?(\d{2})?\s*(am|pm)/gi, (match, hour, min, period) => {
    let h = parseInt(hour);
    const m = min || '00';
    
    if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (period.toLowerCase() === 'am' && h === 12) h = 0;
    
    return `${h.toString().padStart(2, '0')}:${m}`;
  });
  
  // Convert simple times (9am -> 09:00, 2pm -> 14:00)
  formatted = formatted.replace(/(\d{1,2})\s*(am|pm)/gi, (match, hour, period) => {
    let h = parseInt(hour);
    
    if (period.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (period.toLowerCase() === 'am' && h === 12) h = 0;
    
    return `${h.toString().padStart(2, '0')}:00`;
  });
  
  return formatted;
}

// Standardize names and titles
export function standardizeNames(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Capitalize proper names (basic implementation)
  formatted = formatted.replace(/\b(dr|mr|mrs|ms|prof|professor)\s+([a-z]+)/gi, 
    (match, title, name) => `${title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()} ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`);
  
  // Standardize NHS titles
  formatted = formatted.replace(/\b(consultant|registrar|nurse|matron|administrator)\b/gi, 
    match => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
  
  return formatted;
}

// Standardize abbreviations
export function standardizeAbbreviations(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Common medical/business abbreviations
  const abbrevMap: Record<string, string> = {
    'nhs': 'NHS',
    'gp': 'GP',
    'ccg': 'CCG',
    'ceo': 'CEO',
    'cfo': 'CFO',
    'hr': 'HR',
    'it': 'IT',
    'uk': 'UK',
    'eu': 'EU',
    'usa': 'USA',
    'covid': 'COVID',
    'gdpr': 'GDPR'
  };
  
  Object.entries(abbrevMap).forEach(([lower, upper]) => {
    const regex = new RegExp(`\\b${lower}\\b`, 'gi');
    formatted = formatted.replace(regex, upper);
  });
  
  return formatted;
}

// Clean punctuation and spacing
export function cleanPunctuation(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  
  // Fix spacing around punctuation
  formatted = formatted.replace(/\s+([,.!?;:])/g, '$1'); // Remove space before punctuation
  formatted = formatted.replace(/([,.!?;:])([A-Za-z])/g, '$1 $2'); // Add space after punctuation
  
  // Fix quotation marks
  formatted = formatted.replace(/"\s+/g, '"'); // Remove space after opening quote
  formatted = formatted.replace(/\s+"/g, '"'); // Remove space before closing quote
  
  // Fix multiple spaces
  formatted = formatted.replace(/\s{2,}/g, ' ');
  
  // Fix apostrophes
  formatted = formatted.replace(/\s+'/g, "'"); // Remove space before apostrophe
  
  return formatted;
}

// Remove filler words
export function removeFillerWords(text: string): string {
  if (!text) return text;
  
  const fillers = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', 'literally', 'actually', 'obviously'];
  let formatted = text;
  
  fillers.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b[,\\s]*`, 'gi');
    formatted = formatted.replace(regex, '');
  });
  
  // Clean up any double spaces that might result
  formatted = formatted.replace(/\s{2,}/g, ' ').trim();
  
  return formatted;
}

// Apply all standardizations at once
export function standardizeAll(text: string): string {
  if (!text) return text;
  
  let formatted = text;
  formatted = standardizeDates(formatted);
  formatted = formatNumbers(formatted);
  formatted = formatTimeStamps(formatted);
  formatted = standardizeNames(formatted);
  formatted = standardizeAbbreviations(formatted);
  formatted = cleanPunctuation(formatted);
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
    case 'standardize-dates':
      return standardizeDates(text);
    case 'format-numbers':
      return formatNumbers(text);
    case 'format-timestamps':
      return formatTimeStamps(text);
    case 'standardize-names':
      return standardizeNames(text);
    case 'standardize-abbreviations':
      return standardizeAbbreviations(text);
    case 'clean-punctuation':
      return cleanPunctuation(text);
    case 'remove-filler-words':
      return removeFillerWords(text);
    case 'standardize-all':
      return standardizeAll(text);
    default:
      return text;
  }
}