/**
 * Utility function to strip markdown formatting from text
 * Removes common markdown patterns while preserving readable text
 */
export function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove HTML tags first
    .replace(/<[^>]*>/g, '')
    
    // Remove markdown headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    
    // Remove bold and italic markers (** __ * _)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    
    // Remove strikethrough (~~text~~)
    .replace(/~~([^~]+)~~/g, '$1')
    
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    
    // Remove images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    
    // Remove list markers (- * +)
    .replace(/^\s*[-*+]\s+/gm, '')
    
    // Remove numbered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Convert markdown to rich HTML suitable for clipboard copying
 * Preserves formatting when pasting into email clients
 */
export function markdownToRichHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let html = text
    // Bold text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    
    // Italic text
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    
    // Headers
    .replace(/^#{6}\s+(.+)$/gm, '<h6 style="margin: 16px 0 8px 0; font-size: 12px; font-weight: 600;">$1</h6>')
    .replace(/^#{5}\s+(.+)$/gm, '<h5 style="margin: 16px 0 8px 0; font-size: 13px; font-weight: 600;">$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4 style="margin: 16px 0 8px 0; font-size: 14px; font-weight: 600;">$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 15px; font-weight: 600;">$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2 style="margin: 20px 0 10px 0; font-size: 16px; font-weight: 600;">$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1 style="margin: 24px 0 12px 0; font-size: 18px; font-weight: 700;">$1</h1>');
  
  // Process tables
  html = html.replace(/\|(.+?)\|\s*\n\s*\|[\s\-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map((h: string) => h.trim()).filter((h: string) => h);
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      return row.split('|').map((cell: string) => cell.trim()).filter((c: string, i: number, arr: string[]) => i > 0 && i < arr.length - 1 || c);
    }).filter((row: string[]) => row.length > 0);
    
    const headerHtml = headers.map((h: string) => 
      `<th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f3f4f6; text-align: left; font-weight: 600;">${h}</th>`
    ).join('');
    
    const bodyHtml = rows.map((row: string[], rowIndex: number) => 
      `<tr>${row.map((cell: string) => 
        `<td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'};">${cell}</td>`
      ).join('')}</tr>`
    ).join('');
    
    return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px;">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>`;
  });
  
  // Bullet lists
  html = html.replace(/^[-•*]\s+(.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>');
  // Wrap consecutive li items in ul
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, '<ul style="margin: 12px 0; padding-left: 24px;">$&</ul>');
  
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>');
  
  // Paragraphs - convert double line breaks to paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p style="margin: 12px 0; line-height: 1.6;">');
  
  // Single line breaks within paragraphs
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = `<p style="margin: 12px 0; line-height: 1.6;">${html}</p>`;
  }
  
  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*>(<h[1-6][^>]*>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*>(<ul)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  
  return html;
}

/**
 * Copy rich HTML to clipboard for pasting into email clients with formatting
 */
export async function copyRichTextToClipboard(text: string, successMessage = 'Copied with formatting'): Promise<boolean> {
  try {
    const html = markdownToRichHtml(text);
    
    // Create a ClipboardItem with both HTML and plain text
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([stripMarkdown(text)], { type: 'text/plain' })
    });
    
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (error) {
    console.error('Failed to copy rich text, falling back to plain text:', error);
    // Fallback to plain text
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
      return false;
    }
  }
}

/**
 * Copy plain text to clipboard (strips markdown formatting)
 */
export async function copyPlainTextToClipboard(text: string, successMessage = 'Copied to clipboard'): Promise<boolean> {
  try {
    const plainText = stripMarkdown(text);
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
