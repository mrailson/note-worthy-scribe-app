/**
 * Generate a clean, sortable filename for meeting document exports.
 * Format: "DD MMM YYYY - Meeting Title.ext"
 */
export function generateMeetingFilename(
  title: string,
  date: Date | string,
  extension: string = 'docx'
): string {
  // Parse date
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const dateStr = `${day} ${month} ${year}`;

  // Clean up the title
  let cleanTitle = title
    // Remove common filler prefixes that add no value
    .replace(/^(?:primary care network|pcn|blue pcn|meeting notes?|notes for|minutes of|minutes from)\s*[-:–]?\s*/gi, '')
    // Remove trailing date references (the date is already in the filename)
    .replace(/\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*$/gi, '')
    .replace(/\s*[-–]\s*\d{4}[-/]\d{2}[-/]\d{2}\s*$/g, '')
    // Strip invalid Windows filename characters
    .replace(/[\\/:*?"<>|]/g, '-')
    // Collapse multiple spaces or hyphens
    .replace(/\s{2,}/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim();

  // Title Case (capitalise first letter of each major word)
  cleanTitle = cleanTitle
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Don't capitalise short conjunctions/prepositions unless first word
      if (i > 0 && ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(lower)) {
        return lower;
      }
      // Keep acronyms uppercase (NHS, ICB, GPA, PCN, LD, etc.)
      if (word === word.toUpperCase() && word.length >= 2 && word.length <= 5) {
        return word;
      }
      // Standard title case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Ensure we have something
  if (!cleanTitle || cleanTitle.length < 3) {
    cleanTitle = 'Meeting Notes';
  }

  return `${dateStr} - ${cleanTitle}.${extension}`;
}
