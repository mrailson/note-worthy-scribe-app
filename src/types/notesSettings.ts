export interface NotesViewSettings {
  visibleSections: {
    executiveSummary: boolean;
    discussionSummary: boolean;
    keyPoints: boolean;
    decisionsRegister: boolean;
    actionList: boolean;
    openItems: boolean;
  };
}

export const DEFAULT_NOTES_VIEW_SETTINGS: NotesViewSettings = {
  visibleSections: {
    executiveSummary: true,
    discussionSummary: true,
    keyPoints: true,
    decisionsRegister: true,
    actionList: true,
    openItems: true,
  },
};

export const SECTION_LABELS: Record<keyof NotesViewSettings['visibleSections'], string> = {
  executiveSummary: 'Executive Summary',
  discussionSummary: 'Discussion Summary',
  keyPoints: 'Key Points',
  decisionsRegister: 'Decisions Register',
  actionList: 'Action Items',
  openItems: 'Open Items',
};

// Maps section keys to patterns that match section headings in the notes
export const SECTION_HEADING_PATTERNS: Record<keyof NotesViewSettings['visibleSections'], RegExp> = {
  executiveSummary: /executive\s*summary/i,
  discussionSummary: /discussion\s*summary/i,
  keyPoints: /key\s*(points|discussion|discussion\s*points|highlights|takeaways)/i,
  decisionsRegister: /decisions?\s*register/i,
  actionList: /action\s*(list|items?)/i,
  openItems: /open\s*(items?|issues?)(\s*&\s*risks?)?/i,
};
