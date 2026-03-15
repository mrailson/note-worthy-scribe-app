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
 * Supports: `## Action Items`, `# ACTION ITEMS:`, `**Action Items**`,
 * `**Action Items:**`, `Action Items`, `COMPLETED`, `## Completed Items`, etc.
 */
const isActionOrCompletedHeading = (line: string): boolean => {
  const t = line.trim();
  // Markdown heading variants: # Action Items, ## Completed Items:
  if (/^#{1,6}\s*\**\s*(?:action\s+items?|completed(?:\s+items?)?)\s*\**\s*:?\s*$/i.test(t)) return true;
  // Bold heading variants: **Action Items**, **Completed Items:**
  if (/^\*{2}\s*(?:action\s+items?|completed(?:\s+items?)?)\s*:?\s*\*{2}\s*$/i.test(t)) return true;
  // Plain text heading variants: ACTION ITEMS, Completed Items:
  if (/^(?:action\s+items?|completed(?:\s+items?)?)\s*:?\s*$/i.test(t)) return true;
  return false;
};

/**
 * Test whether a line is any non-action main section heading.
 * Returns true for `## Something`, `# Heading`, bold headings like `**HEADING**`,
 * or ALLCAPS plain headings (3+ chars).
 */
const isNonActionSectionHeading = (line: string): boolean => {
  const t = line.trim();
  // Markdown heading that is NOT action/completed
  if (/^#{1,6}\s+\S/.test(t) && !isActionOrCompletedHeading(line)) return true;
  // Bold heading that is NOT action/completed (e.g. **KEY DECISIONS**)
  if (/^\*{2}[A-Z][A-Z\s&]{2,}\*{2}\s*:?\s*$/.test(t) && !isActionOrCompletedHeading(line)) return true;
  return false;
};

// Remove action items & completed sections from content (line-based, robust)
export const removeActionItemsSection = (content: string): string => {
  const lines = content.split('\n');
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
  
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
};

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
