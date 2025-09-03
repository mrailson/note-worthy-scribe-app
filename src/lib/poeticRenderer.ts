import DOMPurify from 'dompurify';

/**
 * Simple renderer for poetic content that preserves line breaks and basic formatting
 * without the heavy processing of NHS markdown
 */
export function renderPoeticContent(content: string): string {
  if (!content) return '';

  // Convert the poetic content to HTML while preserving structure
  let html = content
    // Convert line breaks to HTML breaks
    .replace(/\n/g, '<br>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    // Basic headers (if any)
    .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      const classMap = {
        1: 'text-2xl font-bold text-primary mb-4 mt-6',
        2: 'text-xl font-semibold text-primary mb-4 mt-5',  
        3: 'text-lg font-semibold text-primary mb-3 mt-4',
        4: 'text-base font-semibold text-primary mb-2 mt-3',
        5: 'text-sm font-semibold text-primary mb-2 mt-2',
        6: 'text-xs font-semibold text-primary mb-1 mt-1'
      };
      return `<h${level} class="${classMap[level]}">${content.trim()}</h${level}>`;
    });

  // Wrap in a simple container with poetic styling
  html = `<div class="poetic-content font-serif leading-relaxed text-foreground whitespace-pre-wrap">
    <style>
      .poetic-content {
        line-height: 1.8;
        font-family: 'Georgia', 'Times New Roman', serif;
      }
      .poetic-content br {
        display: block;
        margin: 0.25em 0;
      }
    </style>
    ${html}
  </div>`;

  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'span', 'style'],
    ALLOWED_ATTR: ['class', 'style']
  });
}