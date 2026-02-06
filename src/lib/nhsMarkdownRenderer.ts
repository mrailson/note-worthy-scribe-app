import DOMPurify from 'dompurify';

export interface RenderOptions {
  enableNHSStyling?: boolean;
  className?: string;
  isUserMessage?: boolean;
  baseFontSize?: number; // px base font size for dynamic scaling
}

export function renderNHSMarkdown(content: string, options: RenderOptions = {}): string {
  if (!content) return '';

  const { enableNHSStyling = true, isUserMessage = false, baseFontSize = 13 } = options;
  
  // Debug: Log the original content to see what we're processing
  // console.debug disabled to prevent performance issues with large content
  // console.log('🔍 MARKDOWN INPUT:', content);
  
  // Preprocess numbered lists that are run together
  let preprocessedContent = content
    // Add line breaks before numbered items that are run together
    .replace(/(\d+\.\s+[^0-9]+?)(\s+\d+\.\s+)/g, '$1\n$2')
    // Handle various numbered list patterns
    .replace(/(\d+\)\s+[^0-9]+?)(\s+\d+\)\s+)/g, '$1\n$2')
    // Ensure proper spacing for numbered items at start of lines
    .replace(/^(\d+[\.)]\s*)/gm, '\n$1')
    
    // Enhanced preprocessing for medical/dosing content
    // Handle common medical sub-headings that should be on separate lines
    .replace(/([^:\n])\s+(Adults?|Elderly|Children?|Pediatric|Initial|Maintenance|Maximum|Minimum|Loading|Hypertension|Angina|Arrhythmia|Depression|Anxiety|Diabetes|Epilepsy|Asthma|COPD):\s*/g, '$1\n- $2: ')
    
    // Handle inline sub-items with colons that should be separated
    .replace(/([^:\n])\s+([A-Z][a-z]+[^:\n]*?):\s*-\s*/g, '$1\n- $2:\n  - ')
    
    // Fix cases where multiple bullet points are inline
    .replace(/(-\s+[^-\n]+?)\s+(-\s+)/g, '$1\n$2')
    
    // Handle asterisk bullets that are inline (e.g., "* Item 1 * Item 2")
    .replace(/(\*\s+[^*\n]+?)\s+(\*\s+)/g, '$1\n$2')
    
    // Handle cases where asterisks are at start without newlines
    .replace(/([^*\n])\s*(\*\s+[A-Z])/g, '$1\n$2')
    
    // Handle nested dosing patterns specifically
    .replace(/(-\s+[^:\n]+:)\s*(-\s+[^:\n]+:)/g, '$1\n  $2')
    
    // Clean up extra line breaks
    .replace(/\n{3,}/g, '\n\n');
  
  // Convert markdown to HTML
  let html = preprocessedContent
    // Process LaTeX mathematical expressions first
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\approx/g, '≈')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\sqrt/g, '√')
    .replace(/\\infty/g, '∞')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    
    // Handle inline math expressions \( ... \)
    .replace(/\\?\\\(/g, '<span class="inline-math">')
    .replace(/\\?\\\)/g, '</span>')
    
    // Handle display math expressions \[ ... \]
    .replace(/\\?\\\[/g, '<div class="display-math">')
    .replace(/\\?\\\]/g, '</div>')
    
    // Clean up stray backslashes before mathematical operations
    .replace(/\\([+\-*/=<>])/g, '$1')
    .replace(/\\\s*([£$€¥])/g, '$1')
    
    // Preprocess: Move inline headers to new lines
    .replace(/([^#])(#{1,6}\s+)/g, '$1\n$2')
    
    // Fix inline sub-headings in dosing/interaction sections - enhanced preprocessing handles this now
    // The new preprocessing approach separates these properly before reaching this point
    
    // SOAP note sections (handle first to avoid bullet point processing)
    .replace(/^[-•]?\s*(Subjective|Objective|Assessment|Plan):\s*/gm, '<div class="bg-primary/20 border-l-4 border-primary p-3 my-4 rounded-r-lg text-white"><strong class="text-white font-bold text-lg block mb-2 bg-primary px-2 py-1 rounded">$1:</strong>')
    
    // Meeting notes sections (Outcome, Background, Key Points, etc.)
    .replace(/^(Outcome|Background|Key Points?|Conclusion|Decision|Action Items?|Next Steps?):\s*(.+)$/gm, (match, label, content) => {
      const textColor = isUserMessage ? 'text-white' : 'text-primary';
      // Debug disabled: console.log('🔍 FOUND SECTION LABEL:', label);
      return `<div class="mb-4"><h4 class="text-base font-semibold ${textColor} mb-2">${label}:</h4><p class="mb-3 ${isUserMessage ? 'text-white' : 'text-inherit'} leading-relaxed">${content}</p></div>`;
    })
    
    // Horizontal rules (---, ***, ___) — must come before bold/italic processing
    .replace(/^[\t ]*[-]{3,}[\t ]*$/gm, '<hr class="border-t border-border my-6" />')
    .replace(/^[\t ]*[_]{3,}[\t ]*$/gm, '<hr class="border-t border-border my-6" />')
    
    // Headers - Process headers at start of lines
    .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      const textColor = isUserMessage ? 'text-white' : 'text-primary';
      const classMap = {
        1: `text-2xl font-bold ${textColor} mb-4 mt-7`,
        2: `text-xl font-semibold ${textColor} mb-4 mt-6`,  
        3: `text-lg font-semibold ${textColor} mb-3 mt-5`,
        4: `text-base font-semibold ${textColor} mb-2 mt-4`,
        5: `text-sm font-semibold ${textColor} mb-2 mt-2`,
        6: `text-xs font-semibold ${textColor} mb-1 mt-1`
      };
      // Debug disabled: console.log(`🔍 FOUND H${level}:`, match.trim(), '→', content.trim());
      return `<h${level} class="${classMap[level]}">${content.trim()}</h${level}>`;
    })
    
    // Detect standalone section headings (without # symbols)
    // Pattern: Lines that are title-cased or have colons, followed by content
    .replace(/^([A-Z][A-Za-z\s&,'-]+(?::|$))$/gm, (match, heading) => {
      // Only treat as heading if it's relatively short (not a full sentence)
      if (heading.length < 100 && !heading.match(/^(Outcome|Background|Key Points?|Note|Caution|Warning|Important):/)) {
        const textColor = isUserMessage ? 'text-white' : 'text-primary';
        // Debug disabled: console.log('🔍 FOUND STANDALONE HEADING:', heading.trim());
        return `<h3 class="text-lg font-semibold ${textColor} mb-3 mt-4">${heading.trim()}</h3>`;
      }
      return match;
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
    
    // Process markdown tables - improved regex to handle different formats
    .replace(/\|(.+?)\|\s*\n\s*\|[\s\-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
       // Debug disabled: console.log('🔍 TABLE MATCH FOUND:', match);
       
       // Split by | and use slice(1, -1) to remove empty first/last elements from pipe borders
       // This preserves empty cells in the middle of the table
       const rawHeaders = headerRow.split('|').map(h => h.trim());
       const headers = rawHeaders.slice(1, -1);
      // Debug disabled: console.log('🔍 TABLE HEADERS:', headers);
      
      const rows = bodyRows.trim().split('\n').map(row => {
        const rawCells = row.split('|').map(cell => cell.trim());
        // Use slice(1, -1) to preserve empty cells while removing pipe border artifacts
        return rawCells.slice(1, -1);
      }).filter(row => row.length > 0);
      
      // Debug disabled: console.log('🔍 TABLE ROWS:', rows);
      
      const headerHtml = headers.map(header => 
        `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left ${isUserMessage ? 'text-white border-white/20 bg-white/10' : ''}">${header}</th>`
      ).join('');
      
      const bodyHtml = rows.map(row => 
        `<tr>${row.map(cell => 
          `<td class="border border-border px-3 py-2 ${isUserMessage ? 'text-white border-white/20' : ''}">${cell}</td>`
        ).join('')}</tr>`
      ).join('');
      
      const tableHtml = `<div class="overflow-x-auto my-4">
        <table class="w-full border-collapse border border-border ${isUserMessage ? 'border-white/20' : ''} rounded-lg">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>`;
      
      // Debug disabled: console.log('🔍 TABLE HTML:', tableHtml);
      return tableHtml;
    })
    
    // Convert numbered list items
    .replace(/^(\d+)[\.)]\s+(.+)$/gm, `<div class="flex items-start mb-2 ${isUserMessage ? 'text-white' : 'text-inherit'}"><span class="mr-2 text-base leading-relaxed font-medium">$1.</span><span class="flex-1 leading-relaxed">$2</span></div>`)
    
    // Convert nested bullet list items (indented with spaces) - handle -, •, and *
    .replace(/^  [-•*]\s+(.+)$/gm, `<div class="flex items-start mb-2 ml-6 ${isUserMessage ? 'text-white' : 'text-inherit'}"><span class="mr-2 text-sm leading-relaxed">•</span><span class="flex-1 leading-relaxed text-sm">$1</span></div>`)
    
    // Convert asterisk bullet list items
    .replace(/^\*\s+(.+)$/gm, `<div class="flex items-start mb-3 ${isUserMessage ? 'text-white' : 'text-inherit'}"><span class="mr-2 text-base leading-relaxed font-semibold">•</span><span class="flex-1 leading-relaxed">$1</span></div>`)
    
    // Convert dash and bullet point list items
    .replace(/^[-•]\s+(.+)$/gm, `<div class="flex items-start mb-3 ${isUserMessage ? 'text-white' : 'text-inherit'}"><span class="mr-2 text-base leading-relaxed font-semibold">•</span><span class="flex-1 leading-relaxed">$1</span></div>`)
    
    // Line breaks for paragraphs
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
    .replace(/(<p[^>]*>){2,}/g, '<p class="mb-3 text-inherit leading-relaxed">')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    
    // Close SOAP sections
    .replace(/(<div class="bg-primary\/20[^>]*>.*?)(?=<div class="bg-primary\/20|$)/gs, '$1</div>')
    
    // URLs to links
    .replace(/(https?:\/\/[^\s<>"]+)/g, `<a href="$1" target="_blank" rel="noopener noreferrer" class="${isUserMessage ? 'text-white hover:text-white/80' : 'text-primary hover:text-primary/80'} underline">$1</a>`);

  // NHS-specific styling wrapper with mathematical expression styles
  if (enableNHSStyling) {
    html = `<div class="ai4gp-content nhs-content prose max-w-none dark:prose-invert">
      <style>
        .nhs-content { font-size: ${baseFontSize}px; line-height: ${baseFontSize * 1.6}px; }
        .nhs-content h1 { font-size: ${baseFontSize * 1.8}px !important; }
        .nhs-content h2 { font-size: ${baseFontSize * 1.5}px !important; }
        .nhs-content h3 { font-size: ${baseFontSize * 1.3}px !important; }
        .nhs-content h4 { font-size: ${baseFontSize * 1.1}px !important; }
        .nhs-content p,
        .nhs-content li,
        .nhs-content td,
        .nhs-content th { font-size: ${baseFontSize}px !important; line-height: ${baseFontSize * 1.6}px !important; }
        .inline-math { 
          font-family: 'Times New Roman', serif; 
          font-style: italic; 
          background: hsl(var(--accent) / 0.1); 
          padding: 2px 4px; 
          border-radius: 3px; 
          font-size: 0.95em;
        }
        .display-math { 
          font-family: 'Times New Roman', serif; 
          text-align: center; 
          margin: 1rem 0; 
          padding: 0.75rem; 
          background: hsl(var(--accent) / 0.05); 
          border-left: 3px solid hsl(var(--primary)); 
          border-radius: 4px;
          font-size: 1.1em;
        }
        .calculation-result {
          font-weight: 600;
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-block;
          margin: 0 2px;
        }
      </style>
      ${html}
    </div>`;
  }

  
  // Debug disabled: console.log('🔍 MARKDOWN OUTPUT:', html);
  
  // Sanitize the HTML with CSP-compliant flags
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'li', 'a', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'style'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style'],
    SAFE_FOR_TEMPLATES: true,   // Prevent template string evaluation
    RETURN_DOM_FRAGMENT: false, // Return string, not DOM node
    FORCE_BODY: true            // Prevent script execution context
  });
}