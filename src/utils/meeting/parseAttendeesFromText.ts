/**
 * Parse attendee names from OCR'd text (e.g., from Teams screenshots, Outlook invites)
 * Handles various formats like:
 * - Simple name lists (one per line)
 * - "Name (Organization)" format
 * - "Name - Role" format
 * - Comma-separated names
 * - Teams participant list format
 */
export function parseAttendeesFromText(text: string): Array<{ name: string; organization?: string; role?: string }> {
  if (!text || typeof text !== 'string') return [];
  
  const attendees: Array<{ name: string; organization?: string; role?: string }> = [];
  const seenNames = new Set<string>();
  
  // Split by newlines first
  const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(Boolean);
  
  for (const line of lines) {
    // Skip common header/label lines
    if (isHeaderLine(line)) continue;
    
    // Try to parse the line for attendee info
    const parsed = parseLine(line);
    
    for (const attendee of parsed) {
      const normalizedName = attendee.name.toLowerCase().trim();
      if (normalizedName && !seenNames.has(normalizedName) && isValidName(attendee.name)) {
        seenNames.add(normalizedName);
        attendees.push(attendee);
      }
    }
  }
  
  return attendees;
}

function isHeaderLine(line: string): boolean {
  const headerPatterns = [
    /^(attendees?|participants?|invitees?|present|required|optional|organiser|organizer|chair|cc|bcc|to|from):?\s*$/i,
    /^(meeting|agenda|date|time|location|subject|re:|fwd:|start|end):?\s*/i,
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,  // Date patterns
    /^\d{1,2}:\d{2}/,  // Time patterns
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /^(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /^---+$/,  // Separator lines
    /^═+$/,  // Separator lines
    /^meeting\s+(title|notes|minutes)/i,
    /^(dial-in|join|link|url|https?:)/i,
  ];
  
  return headerPatterns.some(pattern => pattern.test(line.trim()));
}

function isValidName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 100) return false;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  
  // Skip if it looks like an email only
  if (/^[^@]+@[^@]+\.[^@]+$/.test(name) && !name.includes(' ')) return false;
  
  // Skip if it's just numbers or special characters
  if (/^[\d\s\-\.\(\)]+$/.test(name)) return false;
  
  // Skip common non-name patterns
  const invalidPatterns = [
    /^(yes|no|maybe|pending|accepted|declined|tentative)$/i,
    /^(online|offline|busy|away|available|do not disturb)$/i,
    /^(join|leave|left|joined|dial|call)$/i,
    /^\d+\s*(mins?|minutes?|hours?|hrs?)$/i,
    /^(am|pm|gmt|bst|utc|est|pst)$/i,
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(name.trim()));
}

function parseLine(line: string): Array<{ name: string; organization?: string; role?: string }> {
  const results: Array<{ name: string; organization?: string; role?: string }> = [];
  
  // Handle comma-separated names (but be careful of "LastName, FirstName" format)
  // Check if it looks like multiple people separated by commas or semicolons
  const separators = line.split(/[;•·]/).filter(Boolean);
  
  for (const segment of separators) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    
    // Check for "Name (Organization)" pattern
    const orgMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (orgMatch) {
      results.push({
        name: cleanName(orgMatch[1]),
        organization: orgMatch[2].trim()
      });
      continue;
    }
    
    // Check for "Name - Role" or "Name, Role" pattern
    const roleMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (roleMatch && roleMatch[1].split(/\s+/).length <= 4) {
      // Only treat as role if the first part looks like a name (1-4 words)
      results.push({
        name: cleanName(roleMatch[1]),
        role: roleMatch[2].trim()
      });
      continue;
    }
    
    // Check for email format "Name <email@domain.com>" or "email@domain.com (Name)"
    const emailNameMatch = trimmed.match(/^(.+?)\s*<[^>]+>\s*$/) || 
                           trimmed.match(/^[^@]+@[^@]+\.[^@]+\s*\((.+?)\)\s*$/);
    if (emailNameMatch) {
      results.push({ name: cleanName(emailNameMatch[1]) });
      continue;
    }
    
    // Handle comma in names carefully - "Smith, John" vs "John Smith, Jane Doe"
    if (trimmed.includes(',')) {
      const commaParts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      if (commaParts.length === 2 && 
          commaParts[0].split(/\s+/).length === 1 && 
          commaParts[1].split(/\s+/).length === 1) {
        // Looks like "LastName, FirstName" format
        results.push({ name: `${commaParts[1]} ${commaParts[0]}` });
      } else {
        // Treat as multiple names
        for (const part of commaParts) {
          if (isValidName(part)) {
            results.push({ name: cleanName(part) });
          }
        }
      }
      continue;
    }
    
    // Plain name
    if (isValidName(trimmed)) {
      results.push({ name: cleanName(trimmed) });
    }
  }
  
  return results;
}

function cleanName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^[•·\-\*\d\.\)\]]+\s*/, '')  // Remove leading bullets/numbers
    .replace(/\s*[•·\-\*]+$/, '')  // Remove trailing bullets
    .trim();
}
