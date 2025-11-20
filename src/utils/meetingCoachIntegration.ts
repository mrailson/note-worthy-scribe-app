/**
 * Utility functions for integrating Meeting Coach data into meeting notes
 */

export interface ActionItemAssignment {
  id: string;
  assignee?: string;
  dueDate?: string;
}

/**
 * Retrieve Meeting Coach assignments from sessionStorage
 */
export const getMeetingCoachAssignments = (meetingId: string): Map<string, ActionItemAssignment> => {
  if (!meetingId || meetingId === 'temp') {
    return new Map();
  }
  
  try {
    const storageKey = `meetingCoach-assignments-${meetingId}`;
    const saved = sessionStorage.getItem(storageKey);
    
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Error loading Meeting Coach assignments:', error);
  }
  
  return new Map();
};

/**
 * Get removed action items from sessionStorage
 */
export const getRemovedActionItems = (meetingId: string): Set<string> => {
  if (!meetingId || meetingId === 'temp') {
    return new Set();
  }
  
  try {
    const removedKey = `meetingCoach-removedActions-${meetingId}`;
    const savedRemoved = sessionStorage.getItem(removedKey);
    
    if (savedRemoved) {
      return new Set(JSON.parse(savedRemoved));
    }
  } catch (error) {
    console.error('Error loading removed actions:', error);
  }
  
  return new Set();
};

/**
 * Generate a consistent ID for an action item
 */
export const generateActionItemId = (item: string, index: number): string => {
  const cleaned = cleanActionItemText(item);
  return `${cleaned.substring(0, 50)}-${index}`;
};

/**
 * Clean action item text by removing numbering, formatting, and speaker prefixes
 */
export const cleanActionItemText = (item: string): string => {
  // Remove speaker prefixes like "Facilitator/Unknown:", "Speaker:", "Participant:", etc.
  let cleaned = item.replace(/^(Facilitator\/Unknown|Speaker|Participant|Attendee|Unknown):\s*/i, '').trim();
  // Remove numbering and formatting
  cleaned = cleaned.replace(/^\*\*\d+\.\*\*\s*|\d+\.\s*|^[-•]\s*/i, '').trim();
  return cleaned;
};

/**
 * Enhance meeting notes with Meeting Coach assignments
 * Looks for action items in the notes and adds [Assignee] [DueDate] format
 */
export const enhanceMeetingNotesWithAssignments = (
  notes: string,
  meetingId: string
): string => {
  const assignments = getMeetingCoachAssignments(meetingId);
  const removedActions = getRemovedActionItems(meetingId);
  
  if (assignments.size === 0 && removedActions.size === 0) {
    return notes;
  }

  // Find action items section
  const actionItemsRegex = /(?:^|\n)(#{1,6}\s*)?ACTION\s*ITEMS?\s*(?:\n|$)/i;
  const match = notes.match(actionItemsRegex);
  
  if (!match) {
    return notes;
  }

  const startIndex = match.index! + match[0].length;
  const afterActionItems = notes.substring(startIndex);
  
  // Find the end of action items section (next heading or end of document)
  const nextSectionRegex = /\n#{1,6}\s+[A-Z]/;
  const nextSectionMatch = afterActionItems.match(nextSectionRegex);
  const endIndex = nextSectionMatch ? startIndex + nextSectionMatch.index! : notes.length;
  
  const actionItemsSection = notes.substring(startIndex, endIndex);
  const beforeActionItems = notes.substring(0, startIndex);
  const afterSection = notes.substring(endIndex);
  
  // Process each action item line
  const lines = actionItemsSection.split('\n');
  const processedLines: string[] = [];
  let actionIndex = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if this is an action item line
    if (trimmed.match(/^[-•*]\s+/)) {
      const itemText = cleanActionItemText(trimmed.substring(1).trim());
      const itemId = generateActionItemId(itemText, actionIndex);
      actionIndex++;
      
      // Skip if this action was removed
      if (removedActions.has(itemId)) {
        continue;
      }
      
      const assignment = assignments.get(itemId);
      
      if (assignment) {
        const assignee = assignment.assignee || 'TBC';
        const dueDate = assignment.dueDate || 'TBC';
        
        // Check if the line already has assignment format
        if (line.match(/\[.*?\]\s*\[.*?\]/)) {
          // Already has assignments, update them
          const updatedLine = line.replace(
            /\[(.*?)\]\s*\[(.*?)\]/,
            `[${assignee}] [${dueDate}]`
          );
          processedLines.push(updatedLine);
        } else {
          // Add assignments
          const indent = line.match(/^\s*/)?.[0] || '';
          processedLines.push(`${indent}- [${assignee}] [${dueDate}] ${itemText}`);
        }
      } else {
        // No assignment, add TBC
        const indent = line.match(/^\s*/)?.[0] || '';
        processedLines.push(`${indent}- [TBC] [TBC] ${itemText}`);
      }
    } else if (trimmed) {
      // Non-action item line, keep as is
      processedLines.push(line);
    }
  }
  
  return beforeActionItems + processedLines.join('\n') + afterSection;
};

/**
 * Extract action items from notes for Word document table generation
 */
export const extractActionItemsForTable = (notes: string): Array<{
  action: string;
  assignee: string;
  dueDate: string;
}> => {
  const actionItems: Array<{ action: string; assignee: string; dueDate: string }> = [];
  
  // Find action items section
  const actionItemsRegex = /(?:^|\n)(#{1,6}\s*)?ACTION\s*ITEMS?\s*(?:\n|$)/i;
  const match = notes.match(actionItemsRegex);
  
  if (!match) {
    return actionItems;
  }

  const startIndex = match.index! + match[0].length;
  const afterActionItems = notes.substring(startIndex);
  
  // Find the end of action items section
  const nextSectionRegex = /\n#{1,6}\s+[A-Z]/;
  const nextSectionMatch = afterActionItems.match(nextSectionRegex);
  const endIndex = nextSectionMatch ? nextSectionMatch.index! : afterActionItems.length;
  
  const actionItemsSection = afterActionItems.substring(0, endIndex);
  const lines = actionItemsSection.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for action item with assignment format: - [Assignee] [DueDate] Action text
    const assignmentMatch = trimmed.match(/^[-•*]\s*\[(.*?)\]\s*\[(.*?)\]\s*(.+)$/);
    
    if (assignmentMatch) {
      actionItems.push({
        assignee: assignmentMatch[1].trim(),
        dueDate: assignmentMatch[2].trim(),
        action: assignmentMatch[3].trim()
      });
    } else if (trimmed.match(/^[-•*]\s+/)) {
      // Action item without assignment format
      const actionText = trimmed.substring(1).trim();
      actionItems.push({
        assignee: 'TBC',
        dueDate: 'TBC',
        action: actionText
      });
    }
  }
  
  return actionItems;
};
