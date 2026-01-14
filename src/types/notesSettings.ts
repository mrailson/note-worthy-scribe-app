export interface NotesViewSettings {
  visibleSections: {
    executiveSummary: boolean;
    keyPoints: boolean;
    actionList: boolean;
    openItems: boolean;
  };
}

export const DEFAULT_NOTES_VIEW_SETTINGS: NotesViewSettings = {
  visibleSections: {
    executiveSummary: true,
    keyPoints: true,
    actionList: true,
    openItems: true,
  },
};

export const SECTION_LABELS: Record<keyof NotesViewSettings['visibleSections'], string> = {
  executiveSummary: 'Executive Summary',
  keyPoints: 'Key Points',
  actionList: 'Action Items',
  openItems: 'Open Items',
};

// Maps section keys to patterns that match section headings in the notes
export const SECTION_HEADING_PATTERNS: Record<keyof NotesViewSettings['visibleSections'], RegExp> = {
  executiveSummary: /executive\s*summary/i,
  keyPoints: /key\s*points/i,
  actionList: /action\s*(list|items?)/i,
  openItems: /open\s*(items?|issues?)/i,
};
