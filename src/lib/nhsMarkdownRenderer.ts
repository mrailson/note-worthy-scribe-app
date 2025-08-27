import DOMPurify from 'dompurify';

export interface RenderOptions {
  enableNHSStyling?: boolean;
  className?: string;
  isUserMessage?: boolean;
}

export function renderNHSMarkdown(content: string, options: RenderOptions = {}): string {
  if (!content) return '';

  const { enableNHSStyling = true, isUserMessage = false } = options;
  
  // Debug: Log the original content to see what we're processing
  console.log('🔍 MARKDOWN INPUT:', content);
  
  // Convert markdown to HTML
  let html = content
    // SOAP note sections (handle first to avoid bullet point processing)
    .replace(/^[-•]?\s*(Subjective|Objective|Assessment|Plan):\s*/gm, '<div class="bg-primary/20 border-l-4 border-primary p-3 my-4 rounded-r-lg text-white"><strong class="text-white font-bold text-lg block mb-2 bg-primary px-2 py-1 rounded">$1:</strong>')
    
    // Headers - Unified processing for all header levels (H1-H6)
    .replace(/^#{1,6}\s+(.*?)(?:\r?\n|$)/gm, (match, p1) => {
      const level = match.match(/^#+/)?.[0].length || 1;
      const textColor = isUserMessage ? 'text-white' : 'text-primary';
      const classMap = {
        1: `text-2xl font-bold ${textColor} mb-4 mt-6`,
        2: `text-xl font-semibold ${textColor} mb-4 mt-5`,
        3: `text-lg font-semibold ${textColor} mb-3 mt-4`,
        4: `text-base font-semibold ${textColor} mb-2 mt-3`,
        5: `text-sm font-semibold ${textColor} mb-2 mt-2`,
        6: `text-xs font-semibold ${textColor} mb-1 mt-1`
      };
      console.log(`🔍 FOUND H${level}:`, match.trim(), '→', p1.trim());
      return `<h${level} class="${classMap[level]}">${p1.trim()}</h${level}>`;
    })
    
    // Caution/Warning sections
    .replace(/^[-•]?\s*(Caution|Warning|Important|Note):\s*(.*?)(?=\n\n|\n(?=[A-Z])|$)/gms, (match, p1, p2) => {
      const content = p2.trim().replace(/\n/g, '<br>');
      const colorClasses = {
        'Caution': 'bg-yellow-50 border-yellow-400 text-yellow-800 bg-yellow-100',
        'Warning': 'bg-red-50 border-red-400 text-red-800 bg-red-100',
        'Important': 'bg-orange-50 border-orange-400 text-orange-800 bg-orange-100',
        'Note': 'bg-blue-50 border-blue-400 text-blue-800 bg-blue-100'
      };
      const colors = colorClasses[p1] || colorClasses['Note'];
      return `<div class="ai4gp-caution ${colors.split(' ')[0]} border-l-4 ${colors.split(' ')[1]} p-4 my-4 rounded-r-lg">
        <strong class="ai4gp-caution-title ${colors.split(' ')[2]} font-bold text-lg block mb-2 ${colors.split(' ')[3]} px-3 py-2 rounded">${p1}:</strong>
        <div class="${colors.split(' ')[2]}">${content}</div>
      </div>`;
    })
    
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, `<strong class="font-semibold ${isUserMessage ? 'text-white' : 'text-foreground'}">$1</strong>`)
    
    // Italic text
    .replace(/\*(.*?)\*/g, `<em class="italic ${isUserMessage ? 'text-white' : ''}">$1</em>`)
    
    // List items (improved styling and alignment)
    .replace(/^[-•]\s+(.+)$/gm, `<li class="ml-6 mb-2 ${isUserMessage ? 'text-white' : 'text-inherit'} list-disc marker:text-primary">$1</li>`)
    
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\s*)+/gs, (match) => {
      return `<ul class="ai4gp-list space-y-2 mb-4 pl-4">${match}</ul>`;
    })
    
    // Line breaks for paragraphs
    .replace(/\n\n/g, `</p><p class="mb-3 ${isUserMessage ? 'text-white' : 'text-inherit'} leading-relaxed">`)
    .replace(/^(.+)$/gm, (match, p1) => {
      // Don't wrap if it's already HTML
      if (match.includes('<')) return match;
      return `<p class="mb-3 ${isUserMessage ? 'text-white' : 'text-inherit'} leading-relaxed">${p1}</p>`;
    })
    
    // Clean up empty paragraphs and double wrapping
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    
    // Close SOAP sections
    .replace(/(<div class="bg-primary\/20[^>]*>.*?)(?=<div class="bg-primary\/20|$)/gs, '$1</div>')
    
    // URLs to links
    .replace(/(https?:\/\/[^\s<>"]+)/g, `<a href="$1" target="_blank" rel="noopener noreferrer" class="${isUserMessage ? 'text-white hover:text-white/80' : 'text-primary hover:text-primary/80'} underline">$1</a>`);

  // NHS-specific styling wrapper
  if (enableNHSStyling) {
    html = `<div class="ai4gp-content nhs-content prose prose-sm max-w-none dark:prose-invert">${html}</div>`;
  }

  
  // Debug: Log the final HTML output
  console.log('🔍 MARKDOWN OUTPUT:', html);
  
  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'li', 'a', 'br'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel']
  });
}