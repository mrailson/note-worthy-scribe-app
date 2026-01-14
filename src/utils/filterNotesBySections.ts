import { NotesViewSettings, SECTION_HEADING_PATTERNS } from '@/types/notesSettings';

/**
 * Filters markdown notes content based on section visibility settings.
 * Removes sections that are marked as hidden in the visibility settings.
 * 
 * @param content - The full markdown notes content
 * @param visibleSections - The visibility settings for each section
 * @returns Filtered content with hidden sections removed
 */
export const filterNotesBySections = (
  content: string,
  visibleSections: NotesViewSettings['visibleSections']
): string => {
  if (!content) return '';
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const result: string[] = [];
  
  let currentSectionKey: keyof NotesViewSettings['visibleSections'] | null = null;
  let isInHiddenSection = false;
  let currentSectionLevel = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line is a heading
    const headingMatch = line.match(/^(#{1,4})\s*\**(.+?)\**\s*$/);
    
    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      
      // Check if this heading matches any of our tracked sections
      let matchedSectionKey: keyof NotesViewSettings['visibleSections'] | null = null;
      
      for (const [key, pattern] of Object.entries(SECTION_HEADING_PATTERNS)) {
        if (pattern.test(headingText)) {
          matchedSectionKey = key as keyof NotesViewSettings['visibleSections'];
          break;
        }
      }
      
      if (matchedSectionKey) {
        // This is a tracked section heading
        currentSectionKey = matchedSectionKey;
        currentSectionLevel = headingLevel;
        isInHiddenSection = !visibleSections[matchedSectionKey];
        
        if (!isInHiddenSection) {
          result.push(line);
        }
      } else {
        // This is a different heading
        // If we're in a hidden section and this heading is same or higher level, we're exiting
        if (isInHiddenSection && headingLevel <= currentSectionLevel) {
          isInHiddenSection = false;
          currentSectionKey = null;
        }
        
        if (!isInHiddenSection) {
          result.push(line);
        }
      }
    } else {
      // Not a heading - include if not in hidden section
      if (!isInHiddenSection) {
        result.push(line);
      }
    }
  }
  
  // Clean up multiple consecutive blank lines
  let cleanedResult = result.join('\n');
  cleanedResult = cleanedResult.replace(/\n{3,}/g, '\n\n');
  
  return cleanedResult.trim();
};

/**
 * Checks if action items should be included based on visibility settings
 */
export const shouldIncludeActionItems = (
  visibleSections: NotesViewSettings['visibleSections']
): boolean => {
  return visibleSections.actionList;
};
