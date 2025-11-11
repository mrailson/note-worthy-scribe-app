/**
 * Core minutes transformation logic (worker-safe, no DOM dependencies)
 * Strips transcript markers, applies formatting, enforces size limits
 */

export function transformMinutesToHtml(content: string, baseFontSize: number): string {
  if (!content) return '';

  // Extended aggressive transcript stripping
  let cleaned = content;
  
  const transcriptPatterns = [
    /===\s*TRANSCRIPT\s*(START|BEGIN)?\s*===/gi,
    /===\s*TRANSCRIPT\s*(END|FINISH)?\s*===/gi,
    /^#{1,6}\s*(Appendix|Appendices):\s*(Transcript|Full Transcript).*$/gim,
    /^#{1,6}\s*Transcript\s*\(for reference\).*$/gim,
    /^---+\s*Transcript\s*---+$/gim,
    /^#{1,6}\s*Raw Transcript.*$/gim,
    /^#{1,6}\s*Full\s*Transcript.*$/gim,
    /^##\s*TRANSCRIPT$/gim,
    /\*\*TRANSCRIPT\*\*/gi,
    /^---+\s*$/gm, // horizontal rules often used as separators
  ];

  for (const pattern of transcriptPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove large blocks after transcript markers
  cleaned = cleaned.replace(
    /(===\s*TRANSCRIPT|##\s*TRANSCRIPT|Appendix.*Transcript)[\s\S]*$/i,
    ''
  );

  // Enforce 50k character hard limit after stripping
  if (cleaned.length > 50000) {
    cleaned = cleaned.slice(0, 50000) + '\n\n⚠️ **Content truncated for performance** (exceeded 50,000 characters)';
  }

  // Apply markdown-like formatting
  let html = cleaned
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap lists
  html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  
  // Wrap in paragraphs
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  // Improved table detection and formatting with proper header detection
  const lines = html.split('<br>');
  let inTable = false;
  let tableRows: string[] = [];
  let isFirstRow = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line contains a table row (has pipes)
    if (line.includes('|') && line.split('|').length > 2) {
      // Skip separator rows (like |---|---|)
      if (/^\|[\s-:|]+\|$/.test(line)) {
        isFirstRow = false;
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        isFirstRow = true;
      }
      
      // Parse the cells
      const cells = line.split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
      
      // Create table row with appropriate cell type
      const cellTag = isFirstRow ? 'th' : 'td';
      const rowHtml = '<tr>' + cells.map(cell => `<${cellTag}>${cell}</${cellTag}>`).join('') + '</tr>';
      tableRows.push(rowHtml);
      
      isFirstRow = false;
      lines[i] = ''; // Clear this line as we've processed it
    } else if (inTable && tableRows.length > 0) {
      // End of table, wrap accumulated rows
      lines[i] = `<table class="meeting-table"><tbody>${tableRows.join('')}</tbody></table><br>${line}`;
      tableRows = [];
      inTable = false;
      isFirstRow = true;
    }
  }
  
  // Handle any remaining table rows
  if (tableRows.length > 0) {
    lines.push(`<table class="meeting-table"><tbody>${tableRows.join('')}</tbody></table>`);
  }
  
  html = lines.join('<br>');

  return html;
}
