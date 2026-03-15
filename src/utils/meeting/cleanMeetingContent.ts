/**
 * Shared content cleaning utilities for meeting notes
 * Used by both Word document generation and email body formatting
 */

// Strip transcript sections and duplicate meeting details
export const stripTranscriptAndDetails = (content: string): string => {
  let cleaned = content;
  
  // Remove transcript sections
  cleaned = cleaned.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*Full Transcript:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
  
  // Remove duplicate Meeting Title lines
  cleaned = cleaned.replace(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*.*$/gim, '');
  
  // Remove Background heading
  cleaned = cleaned.replace(/^#+?\s*Background\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*Background\s*$/gim, '');
  
  // Remove duplicate inline meeting details (Date:, Time:, Location:) - these are shown in the header box
  cleaned = cleaned.replace(/^\s*Date\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Time\s*:\s*.+$/gim, '');
  cleaned = cleaned.replace(/^\s*Location\s*:\s*.+$/gim, '');
  
  // Remove standalone ATTENDEES section with TBC
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+TBC\s*\n*/gi, '\n\n');
  cleaned = cleaned.replace(/\n*#+ ATTENDEES\s*\n+[-•*]?\s*To be confirmed\s*\n*/gi, '\n\n');
  
  // Clean up any resulting empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

// Deduplicate action items in content - critical to prevent repeated sections
export const deduplicateActionItems = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  
  // Track unique action items by normalised text
  const seenActionItems = new Set<string>();
  // Track if we've seen "Completed" section header
  let seenCompletedHeader = false;
  // Track if we're in an action items section
  let inActionSection = false;
  
  // Helper to normalise action text for deduplication
  const normaliseAction = (text: string): string => {
    return text
      .replace(/^[-•*]\s*/, '')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\s*—\s*@\w+/g, '')
      .replace(/\s*\([^)]+\)/g, '')
      .replace(/\s*\[\w+\]/g, '')
      .replace(/\s*\{[^}]+\}/g, '')
      .toLowerCase()
      .trim();
  };
  
  // Helper to check if line is an action item
  const isActionItem = (line: string): boolean => {
    const trimmed = line.trim();
    return (
      (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) &&
      (trimmed.includes('@') || trimmed.includes('[') || trimmed.includes('~~'))
    );
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect Action Items section
    if (/^#{1,3}\s*action\s+items?\s*:?\s*$/i.test(trimmed)) {
      inActionSection = true;
      result.push(line);
      continue;
    }
    
    // Detect end of action section (new main heading)
    if (inActionSection && /^#{1,2}\s+\S/.test(trimmed) && !/action|completed/i.test(trimmed)) {
      inActionSection = false;
    }
    
    // Handle "Completed" or "Completed Items" headers - only keep first
    if (/^\*\*completed\s*items?\*\*\s*:?\s*$/i.test(trimmed) || 
        /^#{1,3}\s*completed\s*(items?)?\s*:?\s*$/i.test(trimmed)) {
      if (seenCompletedHeader) {
        // Skip duplicate completed headers and all following action items until next section
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (!nextLine || isActionItem(nextLine)) {
            i++;
          } else if (/^\*\*completed/i.test(nextLine) || /^#{1,3}\s*completed/i.test(nextLine)) {
            i++;
          } else {
            break;
          }
        }
        continue;
      }
      seenCompletedHeader = true;
      result.push(line);
      continue;
    }
    
    // Deduplicate action items
    if (isActionItem(line)) {
      const normalised = normaliseAction(line);
      if (normalised && seenActionItems.has(normalised)) {
        continue; // Skip duplicate
      }
      if (normalised) {
        seenActionItems.add(normalised);
      }
    }
    
    result.push(line);
  }
  
  // Clean up excessive blank lines
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

/**
 * Test whether a line is an Action Items or Completed Items heading.
 * Extremely broad matching to prevent any variant from leaking through.
 * Supports: `## Action Items`, `# ACTION ITEMS:`, `**Action Items**`,
 * `Action Items`, `COMPLETED`, `## Completed Items`, with or without
 * trailing punctuation, bold markers, numbering, etc.
 */
const isActionOrCompletedHeading = (line: string): boolean => {
  // Strip \r, trim whitespace
  const t = line.replace(/\r/g, '').trim();
  if (!t) return false;
  // Strip leading markdown heading markers and whitespace
  const stripped = t
    .replace(/^#{1,6}\s*/, '')   // remove leading # markers
    .replace(/^\d+\.\s*/, '')    // remove leading numbering
    .replace(/^\*{1,2}\s*/, '')  // remove leading bold/italic markers
    .replace(/\s*\*{1,2}\s*$/, '') // remove trailing bold/italic markers
    .replace(/\s*:?\s*$/, '')    // remove trailing colon and whitespace
    .trim();
  // Now check if what remains is "action items", "action item", "completed", "completed items"
  if (/^action\s+items?$/i.test(stripped)) return true;
  if (/^completed(?:\s+items?)?$/i.test(stripped)) return true;
  return false;
};

/**
 * Test whether a line is any non-action main section heading.
 * Returns true for `## Something`, `# Heading`, bold headings like `**HEADING**`,
 * or ALLCAPS plain headings (3+ chars).
 */
const isNonActionSectionHeading = (line: string): boolean => {
  const t = line.replace(/\r/g, '').trim();
  if (!t) return false;
  // Markdown heading that is NOT action/completed
  if (/^#{1,6}\s+\S/.test(t) && !isActionOrCompletedHeading(line)) return true;
  // Bold heading that is NOT action/completed (e.g. **KEY DECISIONS**)
  if (/^\*{2}[A-Z][A-Z\s&]{2,}\*{2}\s*:?\s*$/.test(t) && !isActionOrCompletedHeading(line)) return true;
  // Plain ALLCAPS heading (3+ uppercase chars, possibly with & and spaces)
  if (/^[A-Z][A-Z\s&]{2,}$/.test(t) && !isActionOrCompletedHeading(line)) return true;
  return false;
};

// Remove action items & completed sections from content (line-based, robust)
export const removeActionItemsSection = (content: string): string => {
  if (!content) return content;
  
  // Normalise line endings
  const normalised = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalised.split('\n');
  const result: string[] = [];
  let skipping = false;
  
  for (const line of lines) {
    // Start skipping when we hit an action/completed heading
    if (isActionOrCompletedHeading(line)) {
      skipping = true;
      continue;
    }
    
    // Stop skipping when we hit a real non-action section heading
    if (skipping && isNonActionSectionHeading(line)) {
      skipping = false;
    }
    
    if (!skipping) {
      result.push(line);
    }
  }
  
  let cleaned = result.join('\n');
  
  // FALLBACK: aggressive regex pass to catch any remaining action items blocks
  // that the line-based parser might have missed
  // Matches "Action Items" heading (with any markdown/bold decoration) followed by
  // content until the next section heading or end of string
  cleaned = cleaned.replace(
    /\n*(?:^|\n)(?:#{1,6}\s*)?(?:\*{0,2})(?:action\s+items?)(?:\*{0,2})\s*:?\s*\n[\s\S]*?(?=\n#{1,6}\s|\n[A-Z][A-Z\s&]{2,}\n|\n\*{2}[A-Z]|\s*$)/gi,
    '\n'
  );
  
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;

// Remove executive summary section from content (when rendering in separate box)
export const removeExecutiveSummarySection = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSummarySection = false;
  let summaryParagraphFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect Executive Summary / Overview heading
    if (/^#{1,3}\s*(executive\s*summary|overview|summary)\s*$/i.test(trimmed)) {
      inSummarySection = true;
      summaryParagraphFound = false;
      continue; // Skip the heading
    }
    
    // If we're in summary section, skip the first paragraph (the summary text)
    if (inSummarySection && !summaryParagraphFound) {
      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        // This is the summary paragraph - skip it
        summaryParagraphFound = true;
        continue;
      } else if (trimmed.startsWith('#')) {
        // Hit another heading without finding paragraph
        inSummarySection = false;
        result.push(line);
        continue;
      }
    }
    
    // Once we've skipped the summary paragraph, exit summary section
    if (inSummarySection && summaryParagraphFound) {
      inSummarySection = false;
    }
    
    result.push(line);
  }
  
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Comprehensive content cleaning - combines all cleaning operations
export const cleanMeetingContent = (content: string, options?: {
  removeActionItems?: boolean;
  removeExecutiveSummary?: boolean;
}): string => {
  let cleaned = stripTranscriptAndDetails(content);
  cleaned = deduplicateActionItems(cleaned);
  
  if (options?.removeActionItems) {
    cleaned = removeActionItemsSection(cleaned);
  }
  
  if (options?.removeExecutiveSummary) {
    cleaned = removeExecutiveSummarySection(cleaned);
  }
  
  // Strip bold markers
  cleaned = cleaned.replace(/\*\*/g, '');
  
  return cleaned;
};
