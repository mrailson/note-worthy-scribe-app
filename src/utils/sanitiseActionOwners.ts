/**
 * Sanitise action item owners in meeting notes to prevent AI hallucinations.
 * Replaces owner names with "TBC" unless explicitly assigned in the transcript.
 */

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Check if a name is explicitly assigned an action in the transcript
 */
export const hasExplicitAssignment = (transcript: string, name: string): boolean => {
  if (!transcript || !name) return false;
  
  const escaped = escapeRegExp(name);
  const nameWord = `\\b${escaped}\\b`;
  
  // Check for explicit assignment patterns
  const patterns = [
    new RegExp(`${nameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
    new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${nameWord}`, 'i'),
    new RegExp(`${nameWord}.*(?:responsible|owner|lead)`, 'i'),
    new RegExp(`assign(?:ed)?\\s+to\\s+${nameWord}`, 'i')
  ];
  
  // Also check for first name only (if full name is "Claire Curley", check for "Claire to...")
  const firstName = name.split(/\s+/)[0];
  if (firstName && firstName !== name) {
    const firstNameWord = `\\b${escapeRegExp(firstName)}\\b`;
    const firstNamePatterns = [
      new RegExp(`${firstNameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
      new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${firstNameWord}`, 'i'),
      new RegExp(`assign(?:ed)?\\s+to\\s+${firstNameWord}`, 'i')
    ];
    if (firstNamePatterns.some(p => p.test(transcript))) {
      return true;
    }
  }
  
  return patterns.some(p => p.test(transcript));
};

/**
 * Sanitise action items table in markdown notes
 */
export const sanitiseActionOwners = (notes: string, transcript: string): string => {
  if (!notes || !transcript) return notes;
  
  let sanitisedCount = 0;
  
  try {
    // Find ACTION ITEMS section (flexible heading detection)
    const actionHeaderMatch = notes.match(/(?:^|\n)(?:#{1,6}\s*|\d+\.\s*)ACTION ITEMS\b[\s\S]*/i);
    if (!actionHeaderMatch) {
      console.log('ℹ️ No ACTION ITEMS section found');
      return notes;
    }
    
    const afterHeader = actionHeaderMatch[0];
    const headerIdx = notes.indexOf(afterHeader);
    
    // Find markdown table anywhere after the header
    const tableMatch = afterHeader.match(/\n\|.*\|\n\|[-:\s|]+\|\n([\s\S]*?)(?:\n(?:#{1,6}\s|\d+\.\s|$))/);
    if (!tableMatch) {
      console.log('ℹ️ No table found in ACTION ITEMS section');
      return notes;
    }
    
    const tableHeader = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf('\n', tableMatch[0].indexOf('\n') + 1));
    const headerCells = tableHeader.split('\n')[0].split('|').map(c => c.trim()).filter(Boolean);
    
    // Find owner column (flexible column detection)
    const ownerColumnIdx = headerCells.findIndex(h => /responsible|owner|lead|assignee/i.test(h));
    if (ownerColumnIdx === -1) {
      console.log('ℹ️ No owner column found in ACTION ITEMS table');
      return notes;
    }
    
    const tableRows = tableMatch[1]
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.startsWith('|') && r.length > 2);
    
    const rebuiltRows = tableRows.map(row => {
      const cells = row.split('|').map(c => c.trim());
      
      if (cells.length > ownerColumnIdx + 1) {
        const responsible = cells[ownerColumnIdx + 1]; // +1 because first cell is empty
        
        if (responsible && responsible.toUpperCase() !== 'TBC' && responsible.trim() !== '') {
          if (!hasExplicitAssignment(transcript, responsible)) {
            cells[ownerColumnIdx + 1] = 'TBC';
            sanitisedCount++;
          }
        }
      }
      
      return cells.join(' | ');
    });
    
    // Reconstruct the notes
    const beforeTable = notes.substring(0, headerIdx + (tableMatch.index || 0));
    const tableStart = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf(tableMatch[1]));
    const afterTable = afterHeader.substring((tableMatch.index || 0) + tableMatch[0].length);
    
    const reconstructed = beforeTable + tableStart + rebuiltRows.join('\n') + '\n' + afterTable;
    
    if (sanitisedCount > 0) {
      console.log(`✅ Sanitiser: set ${sanitisedCount} owner(s) to TBC`);
    }
    
    return reconstructed;
  } catch (error) {
    console.warn('⚠️ Error sanitising action owners:', error);
    return notes;
  }
};
