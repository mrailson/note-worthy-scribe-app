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
    
    // Headers (handle #### first, then work down) - Debug these replacements
    .replace(/^#### (.*$)/gm, (match, p1) => {
      console.log('🔍 FOUND H4:', match, '→', p1);
      return `<h4 class="text-base font-semibold ${isUserMessage ? 'text-white' : 'text-primary'} mb-2 mt-3">${p1}</h4>`;
    })
    .replace(/^### (.*$)/gm, (match, p1) => {
      console.log('🔍 FOUND H3:', match, '→', p1);
      return `<h3 class="text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-primary'} mb-3 mt-4">${p1}</h3>`;
    })
    .replace(/^## (.*$)/gm, (match, p1) => {
      console.log('🔍 FOUND H2:', match, '→', p1);
      return `<h2 class="text-xl font-semibold ${isUserMessage ? 'text-white' : 'text-primary'} mb-4 mt-5">${p1}</h2>`;
    })
    .replace(/^# (.*$)/gm, (match, p1) => {
      console.log('🔍 FOUND H1:', match, '→', p1);
      return `<h1 class="text-2xl font-bold ${isUserMessage ? 'text-white' : 'text-primary'} mb-4 mt-6">${p1}</h1>`;
    })
    
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, `<strong class="font-semibold ${isUserMessage ? 'text-white' : 'text-foreground'}">$1</strong>`)
    
    // Italic text
    .replace(/\*(.*?)\*/g, `<em class="italic ${isUserMessage ? 'text-white' : ''}">$1</em>`)
    
    // List items (exclude already processed SOAP sections)
    .replace(/^[-•]\s+(.+)$/gm, `<li class="ml-4 mb-1 ${isUserMessage ? 'text-white' : 'text-inherit'} list-none before:content-["-"] before:mr-2 before:text-current">$1</li>`)
    
    // Wrap consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\s*)+/gs, (match) => {
      return `<ul class="space-y-1 mb-4">${match}</ul>`;
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
    html = `<div class="nhs-content prose prose-sm max-w-none dark:prose-invert">${html}</div>`;
  }

  
  // Debug: Log the final HTML output
  console.log('🔍 MARKDOWN OUTPUT:', html);
  
  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'li', 'a', 'br'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel']
  });
}