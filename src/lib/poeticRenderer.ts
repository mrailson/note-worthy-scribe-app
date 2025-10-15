import DOMPurify from 'dompurify';

/**
 * Simple renderer for poetic content that preserves line breaks and basic formatting
 * Clean display optimized for limerick verses
 */
export function renderPoeticContent(content: string): string {
  if (!content) return '';

  // Convert the poetic content to HTML while preserving structure
  let html = content
    // Remove ## Verse headers (they're already handled by the component)
    .replace(/^##\s*Verse\s*\d+.*$/gm, '')
    // Remove single # headers at the start (like "# 🎭 Meeting in Verse")
    .replace(/^#\s+.*$/gm, '')
    // Convert line breaks to HTML breaks
    .replace(/\n/g, '<br>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic text (but not asterisks used for list bullets)
    .replace(/(?<!^|\s)\*([^*\n]+?)\*(?!\*)/g, '<em class="italic">$1</em>')
    // Clean up multiple consecutive breaks
    .replace(/(<br>\s*){3,}/g, '<br><br>');

  // Wrap in a simple container with elegant poetic styling
  html = `<div class="poetic-content text-foreground">
    <style>
      .poetic-content {
        line-height: 1.7;
        font-family: 'Georgia', 'Palatino', 'Times New Roman', serif;
        font-size: 1rem;
      }
      .poetic-content br {
        display: block;
        margin: 0.15em 0;
      }
    </style>
    ${html}
  </div>`;

  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'br', 'strong', 'em', 'span', 'style', 'p'],
    ALLOWED_ATTR: ['class', 'style']
  });
}