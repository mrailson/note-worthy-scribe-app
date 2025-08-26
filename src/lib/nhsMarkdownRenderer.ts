import DOMPurify from 'dompurify';

export interface RenderOptions {
  enableNHSStyling?: boolean;
  className?: string;
}

export function renderNHSMarkdown(content: string, options: RenderOptions = {}): string {
  if (!content) return '';

  const { enableNHSStyling = true } = options;
  
  // Convert markdown to HTML
  let html = content
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-primary mb-3 mt-4">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-primary mb-4 mt-5">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-primary mb-4 mt-6">$1</h1>')
    
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    
    // Italic text
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    
    // SOAP note sections (special handling)
    .replace(/^(Subjective|Objective|Assessment|Plan):\s*/gm, '<div class="bg-primary/10 border-l-4 border-primary p-3 my-4 rounded-r-lg"><strong class="text-primary text-lg block mb-2">$1:</strong>')
    
    // List items
    .replace(/^[-•]\s+(.+)$/gm, '<li class="ml-4 mb-1 text-foreground">$1</li>')
    
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\s*)+/gs, (match) => {
      return `<ul class="space-y-1 mb-4">${match}</ul>`;
    })
    
    // Line breaks for paragraphs
    .replace(/\n\n/g, '</p><p class="mb-3 text-foreground leading-relaxed">')
    .replace(/^(.+)$/gm, (match, p1) => {
      // Don't wrap if it's already HTML
      if (match.includes('<')) return match;
      return `<p class="mb-3 text-foreground leading-relaxed">${p1}</p>`;
    })
    
    // Clean up empty paragraphs and double wrapping
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    
    // Close SOAP sections
    .replace(/(<div class="bg-primary\/10[^>]*>.*?)(?=<div class="bg-primary\/10|$)/gs, '$1</div>')
    
    // URLs to links
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 underline">$1</a>');

  // NHS-specific styling wrapper
  if (enableNHSStyling) {
    html = `<div class="nhs-content prose prose-sm max-w-none dark:prose-invert">${html}</div>`;
  }

  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'li', 'a', 'br'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel']
  });
}