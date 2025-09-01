import DOMPurify from 'dompurify';

export interface RenderOptions {
  enableNHSStyling?: boolean;
  className?: string;
  isUserMessage?: boolean;
}

export function renderNHSMarkdown(content: string, options: RenderOptions = {}): string {
  if (!content) return '';

  const { enableNHSStyling = true, isUserMessage = false } = options;
  
  // Convert markdown to HTML
  let html = content
    // Preprocess: Move inline headers to new lines
    .replace(/([^#])(#{1,6}\s+)/g, '$1\n$2')
    
    // Enhanced clinical section detection and formatting
    .replace(/(-\s+)([A-Z][^:]*:)([^-]*?)(\s+-\s+[A-Z][^:]*:)/g, '$1$2$3\n$4')
    .replace(/(-\s+)([A-Z][^:]*:)(.{20,}?)(\s+-\s+[A-Z][^:]*:)/g, '$1$2$3\n$4')
    .replace(/^(-\s+[A-Z][^:]*:[^-]+?)(\s+-\s+)/gm, '$1\n$2')
    
    // Enhanced clinical section headers with better recognition
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:dosing|dose|posology|administration)[:.]\s*)/gis, '\n\n### 💊 Dosing Information\n\n')
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:contraindications?|contraindicated)[:.]\s*)/gis, '\n\n### ⚠️ Contraindications\n\n')
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:interactions?|drug interactions?)[:.]\s*)/gis, '\n\n### ⚡ Drug Interactions\n\n')
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:side effects?|adverse effects?|adverse reactions?)[:.]\s*)/gis, '\n\n### ⚠️ Side Effects\n\n')
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:warnings?|cautions?|precautions?)[:.]\s*)/gis, '\n\n### 🚨 Warnings & Precautions\n\n')
    .replace(/(?:^|\n)(?:[-•]?\s*)?((?:indications?|uses?|indicated for)[:.]\s*)/gis, '\n\n### 🎯 Indications\n\n')
    
    // SOAP note sections (handle first to avoid bullet point processing)
    .replace(/^[-•]?\s*(Subjective|Objective|Assessment|Plan):\s*/gm, '<div class="bg-primary/20 border-l-4 border-primary p-3 my-4 rounded-r-lg text-white"><strong class="text-white font-bold text-lg block mb-2 bg-primary px-2 py-1 rounded">$1:</strong>')
    
    // Headers - Process headers at start of lines
    .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      const textColor = isUserMessage ? 'text-white' : 'text-primary';
      const classMap = {
        1: `text-2xl font-bold ${textColor} mb-4 mt-6`,
        2: `text-xl font-semibold ${textColor} mb-4 mt-5`,  
        3: `text-lg font-semibold ${textColor} mb-3 mt-4`,
        4: `text-base font-semibold ${textColor} mb-2 mt-3`,
        5: `text-sm font-semibold ${textColor} mb-2 mt-2`,
        6: `text-xs font-semibold ${textColor} mb-1 mt-1`
      };
      return `<h${level} class="${classMap[level]}">${content.trim()}</h${level}>`;
    })
    
    // Enhanced caution/warning sections with better styling
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
    
    // Enhanced table processing with better styling for clinical data
    .replace(/\|(.+?)\|\s*\n\s*\|[\s\-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      
      const rows = bodyRows.trim().split('\n').map(row => {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        return cells;
      }).filter(row => row.length > 0);
      
      const headerHtml = headers.map(header => 
        `<th class="border border-border px-4 py-3 bg-primary/10 font-semibold text-left text-primary ${isUserMessage ? 'text-white border-white/20 bg-white/10' : ''}">${header}</th>`
      ).join('');
      
      const bodyHtml = rows.map((row, idx) => 
        `<tr class="${idx % 2 === 0 ? 'bg-muted/30' : 'bg-background'}">${row.map(cell => 
          `<td class="border border-border px-4 py-3 ${isUserMessage ? 'text-white border-white/20' : 'text-foreground'}">${cell}</td>`
        ).join('')}</tr>`
      ).join('');
      
      return `<div class="overflow-x-auto my-6 rounded-lg border border-border shadow-sm">
        <table class="w-full border-collapse ${isUserMessage ? 'border-white/20' : ''}">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>`;
    })
    
    // Convert list items to better formatted lists
    .replace(/^[-•]\s+(.+)$/gm, `<div class="flex items-start gap-2 mb-2"><span class="text-primary font-bold">•</span><span class="${isUserMessage ? 'text-white' : 'text-inherit'}"">$1</span></div>`)
    
    // Line breaks for paragraphs with better spacing
    .replace(/\n\n/g, `</p><p class="mb-4 ${isUserMessage ? 'text-white' : 'text-inherit'} leading-relaxed">`)
    .replace(/^(.+)$/gm, (match, p1) => {
      // Don't wrap if it's already HTML
      if (match.includes('<')) return match;
      return `<p class="mb-4 ${isUserMessage ? 'text-white' : 'text-inherit'} leading-relaxed">${p1}</p>`;
    })
    
    // Clean up empty paragraphs and double wrapping
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/(<\/p>){2,}/g, '</p>')
    .replace(/(<p[^>]*>){2,}/g, '<p class="mb-4 text-inherit leading-relaxed">')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    
    // Close SOAP sections
    .replace(/(<div class="bg-primary\/20[^>]*>.*?)(?=<div class="bg-primary\/20|$)/gs, '$1</div>')
    
    // URLs to links
    .replace(/(https?:\/\/[^\s<>"]+)/g, `<a href="$1" target="_blank" rel="noopener noreferrer" class="${isUserMessage ? 'text-white hover:text-white/80' : 'text-primary hover:text-primary/80'} underline">$1</a>`);

  // NHS-specific styling wrapper
  if (enableNHSStyling) {
    html = `<div class="ai4gp-content nhs-content prose prose-sm max-w-none dark:prose-invert">${html}</div>`;
  }

  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'li', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel']
  });
}