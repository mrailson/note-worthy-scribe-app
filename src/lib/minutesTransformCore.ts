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

  // Basic table detection and formatting
  const tableRegex = /\|(.+)\|/g;
  if (tableRegex.test(html)) {
    html = html.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map((cell: string) => `<td>${cell.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    });
    html = html.replace(/(<tr>.*?<\/tr>)+/gs, '<table class="meeting-table">$&</table>');
  }

  return html;
}
