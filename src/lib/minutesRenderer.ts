import DOMPurify from 'dompurify';

/**
 * Professional NHS-styled renderer for meeting minutes - OPTION 1: Compact Inline
 * Optimized for formal medical/professional documentation
 * Enhanced: Always inline attendees with bullet separators, improved key points formatting
 */
export function renderMinutesMarkdown(content: string, baseFontSize: number = 13): string {
  if (!content) return '';

  // Preprocess content to normalize spacing and remove transcript section
  let preprocessedContent = content
    // Remove "MEETING TRANSCRIPT FOR REFERENCE" section and everything after it
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Clean up multiple consecutive line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Ensure headers are on their own lines
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2');

  // Convert markdown to HTML with NHS professional styling
  let html = preprocessedContent
    // ENHANCED: Force inline attendees regardless of count - handles both # and ## headers
    .replace(/(#{1,2}\s*ATTENDEES|#{1,2}\s*Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, (match, header, list) => {
      const attendees = list.match(/[-•]\s+(.+)/g)?.map(a => a.replace(/^[-•]\s+/, '').trim()) || [];
      
      // Separate mentioned/present
      const present = attendees.filter(a => !a.toLowerCase().includes('mentioned'));
      const mentioned = attendees.filter(a => a.toLowerCase().includes('mentioned')).map(a => a.replace(/\s*\(mentioned\)/gi, ''));
      
      // Always use inline format with better styling
      let html = `<h3 style="font-size: ${baseFontSize * 1.5}px" class="font-bold text-[#005EB8] mb-3 mt-6 pb-2 border-b-2 border-[#005EB8]">Attendees</h3>`;
      html += '<div class="p-4 mb-6">';
      
      if (present.length > 0) {
        html += `<p class="mb-2 leading-relaxed" style="font-size: ${baseFontSize}px">`;
        html += `<strong class="text-[#005EB8] font-semibold">Present:</strong> `;
        html += present.map(a => `<span class="text-[#212B32]">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        html += `</p>`;
      }
      
      if (mentioned.length > 0) {
        html += `<p class="leading-relaxed" style="font-size: ${baseFontSize}px">`;
        html += `<strong class="text-[#768692] font-semibold">Also mentioned:</strong> `;
        html += mentioned.map(a => `<span class="text-[#768692] italic">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        html += `</p>`;
      }
      
      html += '</div>';
      return html;
    })

    // ENHANCED: Better key points and header formatting with icons - handles ALL # variations
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      // Remove any remaining # symbols from the content
      const cleanContent = content.replace(/^#+\s*/, '').trim();
      
      // Check if this is a numbered section (e.g., "1.0 Meeting Called to Order" or "2. Commercial Opportunities")
      const isNumberedSection = /^\d+\.?\d*\s+/.test(cleanContent);
      
      // Key discussion points get special treatment with icon
      if (cleanContent.toLowerCase().includes('key points') || cleanContent.toLowerCase().includes('key discussion')) {
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 700; margin-bottom: 16px; margin-top: 24px; padding-bottom: 8px; border-bottom: 1px solid #768692;" class="font-bold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692] flex items-center gap-2">
          <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
          <span>${cleanContent}</span>
        </h3>`;
      } else if (cleanContent.toLowerCase().includes('meeting details')) {
        return ''; // Hide Meeting Details header
      } else if (cleanContent.toLowerCase().includes('executive summary')) {
        return `<h2 style="font-size: ${baseFontSize * 1.5}px; color: #005EB8; font-weight: 600; margin-bottom: 16px; margin-top: 24px; padding-bottom: 8px; border-bottom: 1px solid #768692;" class="font-semibold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692]">${cleanContent}</h2>`;
      } else if (cleanContent.toLowerCase().includes('action items') || cleanContent.toLowerCase().includes('discussion') || cleanContent.toLowerCase().includes('decisions made')) {
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 600; margin-bottom: 12px; margin-top: 20px;" class="font-semibold text-[#005EB8] mb-3 mt-5">${cleanContent}</h3>`;
      } else if (isNumberedSection) {
        // Numbered sections get prominent styling with left alignment
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 700; margin-bottom: 12px; margin-top: 24px; padding-bottom: 4px; border-bottom: 2px solid #005EB8;" class="font-bold text-[#005EB8] mb-3 mt-6 pb-1 border-b-2 border-[#005EB8]">${cleanContent}</h3>`;
      } else {
        return `<h4 style="font-size: ${baseFontSize}px; color: #005EB8; font-weight: 600; margin-bottom: 8px; margin-top: 16px;" class="font-semibold text-[#425563] mb-2 mt-4">${cleanContent}</h4>`;
      }
    })

    // Meeting Details section - create a styled info box
    .replace(/(Date|Time|Location|Duration|Meeting Type):\s*([^\n]+)/g, 
      `<div class="flex mb-2" style="font-size: ${baseFontSize}px"><span class="font-semibold text-[#005EB8] min-w-[120px]">$1:</span><span class="text-[#212B32]">$2</span></div>`)

    // Meeting Title styling - value in NHS blue
    .replace(/Meeting Title:\s*([^\n]+)/i, 
      `<div class="flex mb-2" style="font-size: ${baseFontSize}px"><span class="font-semibold text-[#005EB8] min-w-[120px]">Meeting Title: </span><span class="text-[#005EB8] font-semibold">$1</span></div>`)

    // Process markdown tables with enhanced NHS styling
    .replace(/\|(.+?)\|\s*\n\s*\|[-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
      // Split rows by pipe and remove ONLY the outer border pipes (preserve empty cells in the middle)
      const splitPipeRow = (row: string): string[] => {
        const parts = row.split('|').map((p) => p.trim());
        if (parts.length > 0 && parts[0] === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
        return parts;
      };

      const headers = splitPipeRow(headerRow);
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row) => splitPipeRow(row))
        .filter((row) => row.length > 0);

      // Check if this is the Action Items table (has Priority column)
      const isActionItemsTable = headers.some(h => h.toLowerCase().includes('priority'));

      const headerHtml = headers.map((header, idx) => {
        const width = idx === 0 ? 'w-[40%]' : (isActionItemsTable && idx === headers.length - 2) ? 'w-[15%]' : 'w-auto';
        return `<th style="font-size: ${baseFontSize}px; padding: 12px; text-align: left; background-color: #005EB8; color: white; font-weight: 600; border: 1px solid #768692;" class="border border-[#768692] px-4 py-3 bg-[#005EB8] text-white font-semibold text-left ${width}">${header}</th>`;
      }).join('');

      const bodyHtml = rows.map((row, rowIdx) => {
        const bgClass = rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F5]';
        const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#F0F4F5';
        return `<tr class="${bgClass} hover:bg-[#E8EDEE] transition-colors">\n          ${row.map((cell, cellIdx) => {
            // Check if this is the Priority column
            if (isActionItemsTable && headers[cellIdx]?.toLowerCase().includes('priority')) {
              let badge = '';
              const priority = cell.toLowerCase();
              if (priority.includes('high')) {
                badge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DA291C] text-white">High</span>`;
              } else if (priority.includes('medium')) {
                badge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFB81C] text-[#212B32]">Medium</span>`;
              } else if (priority.includes('low')) {
                badge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#007F3B] text-white">Low</span>`;
              } else {
                badge = cell;
              }
              return `<td style="font-size: ${baseFontSize}px; padding: 12px; border: 1px solid #768692; background-color: ${bgColor}; color: #212B32;" class="border border-[#768692] px-4 py-3 text-[#212B32]">${badge}</td>`;
            }
            return `<td style="font-size: ${baseFontSize}px; padding: 12px; border: 1px solid #768692; background-color: ${bgColor}; color: #212B32; line-height: 1.6;" class="border border-[#768692] px-4 py-3 text-[#212B32] leading-relaxed">${cell}</td>`;
          }).join('')}
        </tr>`;
      }).join('');

      return `<div class="overflow-x-auto my-6 shadow-sm rounded-lg">\n        <table class="w-full border-collapse border border-[#768692]" border="1" cellpadding="8" cellspacing="0" style="border: 1px solid #768692; border-collapse: collapse;">\n          <thead><tr>${headerHtml}</tr></thead>\n          <tbody>${bodyHtml}</tbody>\n        </table>\n      </div>`;
    })

    // Bold text - handle both ** and remaining single *
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#212B32]">$1</strong>')
    
    // Remove stray asterisks after headings (like "**Heading:** * content")
    .replace(/(<strong class="font-semibold text-\[#212B32\]">[^<]+?:<\/strong>)\s*\*/g, '$1 ')
    
    // Remove stray asterisks at the beginning of lines (not part of lists or formatting)
    .replace(/^\*([A-Z])/gm, '$1')
    .replace(/\s\*([A-Z])/g, ' $1')

    // Italic text (only if not already processed)
    .replace(/\*([^\*\n]+?)\*/g, '<em class="italic text-[#425563]">$1</em>')
    
    // Enhanced subsection formatting with improved spacing, prominent headings - LEFT ALIGNED
    .replace(/<strong class="font-semibold text-\[#212B32\]">([^<]+?):<\/strong>\s*((?:(?!<strong class="font-semibold text-\[#212B32\]">).)+?)(?=<strong class="font-semibold text-\[#212B32\]">[^<]+?:<\/strong>|$)/gs, 
      `<p class="mb-4 mt-2 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px"><strong class="font-bold text-[#005EB8]" style="font-size: ${baseFontSize * 1.15}px">$1:</strong> $2</p>`)
    
    // Enhanced intelligent paragraph breaking - detect natural topic transitions
    // Split after sentences when followed by key transition phrases or topic changes
    .replace(/(\.\s+)((?:Key |A |The |This |Concerns |Expressions |However,|Additionally,|Furthermore,|Subsequently,|Moreover,|Meanwhile,|In addition,)[A-Z][^.]{20,})/g, `.$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)
    
    // Add breaks after sentences ending with closing parentheses followed by new topic sentences
    .replace(/(\)\.\s+)([A-Z][a-z]{2,}\s+[^.]{30,})/g, `).$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)
    
    // Add breaks when a sentence ends and the next starts with a capitalized term followed by specific phrases
    .replace(/(\.\s+)([A-Z][a-z]+\s+(?:was|were|is|are|has|have|will|should|must|could|would)\s+[^.]{25,})/g, `.$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)

    // Detect and convert standalone bullets that are subheadings (like "Background", "Key Points")
    .replace(/^[-•]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/gm, `<h4 style="font-size: ${baseFontSize}px" class="font-semibold text-[#425563] mb-2 mt-4">$1</h4>`)
    
    // Smart numbered list processing: detect which numbered items should be nested
    // This converts sequences of short numbered items after a longer one into nested bullets
    .replace(/^(\d+)[\.)]\s+(.+)$/gm, (match, num, content) => {
      // Mark numbered items for processing
      return `<!NUM!>${num}<!NUM_SEP!>${content}<!NUM_END!>`;
    })
    
    // Process marked numbered items and determine nesting
    .replace(/<!NUM!>\d+<!NUM_SEP!>[\s\S]*?<!NUM_END!>/g, (match) => {
      // This will be processed in a second pass
      return match;
    })
    
    // Smart nested conversion: Look for patterns where short items follow longer ones
    .replace(/(<!NUM!>(\d+)<!NUM_SEP!>((?:.{60,})|(?:.*?\*\*.*))<!NUM_END!>)((?:\s*<!NUM!>\d+<!NUM_SEP!>(?:.{0,100})<!NUM_END!>){2,})/gm, 
      (match, mainItem, mainNum, mainContent, followingItems) => {
        // Main item: longer text (60+ chars) or has bold text
        // Following items: 2+ shorter items that should be nested
        
        const main = mainItem.replace(/<!NUM!>\d+<!NUM_SEP!>/, '').replace(/<!NUM_END!>/, '');
        const nested = followingItems
          .match(/<!NUM!>\d+<!NUM_SEP!>(.*?)<!NUM_END!>/g)
          ?.map(item => item.replace(/<!NUM!>\d+<!NUM_SEP!>/, '').replace(/<!NUM_END!>/, '').trim())
          .map(item => `<!NESTED_BULLET!>${item}<!NESTED_BULLET_END!>`)
          .join('\n') || '';
        
        return `<!MAIN_NUM!>${mainNum}<!MAIN_NUM_SEP!>${main}<!NESTED_START!>\n${nested}<!NESTED_STOP!>`;
      })
    
    // Mark nested bullets (indented with 4+ spaces or tabs) for later processing
    .replace(/^([ ]{4,}|\t+)[-•\*]\s+(.+)$/gm, '<!NESTED!>$2<!NESTED_END!>')
    
    // Mark nested numbered items (indented with 2+ spaces before number)
    .replace(/^[ ]{2,}(\d+)[\.)]\s+(.+)$/gm, '<!NESTED_NUM!>$2<!NESTED_NUM_END!>')
    
    // Convert remaining simple numbered items (not processed by smart nesting)
    .replace(/<!NUM!>(\d+)<!NUM_SEP!>(.*?)<!NUM_END!>/g, `<li style="font-size: ${baseFontSize}px" class="mb-2 text-[#212B32] leading-relaxed pl-2" value="$1">$2</li>`)
    
    // Convert main numbered items with nested content
    .replace(/<!MAIN_NUM!>(\d+)<!MAIN_NUM_SEP!>(.*?)<!NESTED_START!>(.*?)<!NESTED_STOP!>/gs, (match, num, content, nested) => {
      const nestedBullets = nested
        .match(/<!NESTED_BULLET!>(.*?)<!NESTED_BULLET_END!>/g)
        ?.map(item => item.replace(/<!NESTED_BULLET!>|<!NESTED_BULLET_END!>/g, '').trim())
        .map(item => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      
      return `<li style="font-size: ${baseFontSize}px" class="mb-3 text-[#212B32] leading-relaxed pl-2" value="${num}">${content}<ul class="list-disc list-outside ml-8 mt-2 mb-2 space-y-1 text-[#425563]">${nestedBullets}</ul></li>`;
    })
    
    // Convert top-level bullet list items with better spacing
    .replace(/^[-•\*]\s+(.+)$/gm, `<li style="font-size: ${baseFontSize}px" class="mb-2 text-[#212B32] leading-relaxed pl-1">$1</li>`)
    
    // Convert nested bullets within list items
    .replace(/(<li[^>]*>.*?)((?:<!NESTED!>.*?<!NESTED_END!>\s*)+)(<\/li>)/gs, (match, opening, nested, closing) => {
      const nestedItems = nested.match(/<!NESTED!>(.*?)<!NESTED_END!>/g)
        ?.map(item => item.replace(/<!NESTED!>|<!NESTED_END!>/g, '').trim())
        .map(item => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `${opening}<ul class="list-circle list-outside ml-6 mt-2 mb-2 space-y-1 text-[#425563]">${nestedItems}</ul>${closing}`;
    })
    
    // Clean up any remaining nested markers
    .replace(/<!NESTED!>|<!NESTED_END!>/g, '')
    
    // Wrap consecutive top-level list items in ul tags with better spacing
    .replace(/(<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-4 mb-4 space-y-2">$&</ul>')

    // Convert nested numbered items to bullets within list items
    .replace(/(<li[^>]*value="[^"]*">.*?)((?:<!NESTED_NUM!>.*?<!NESTED_NUM_END!>\s*)+)(<\/li>)/gs, (match, opening, nested, closing) => {
      const nestedItems = nested.match(/<!NESTED_NUM!>(.*?)<!NESTED_NUM_END!>/g)
        ?.map(item => item.replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '').trim())
        .map(item => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `${opening}<ul class="list-disc list-outside ml-8 mt-2 mb-2 space-y-1 text-[#425563]">${nestedItems}</ul>${closing}`;
    })
    
    // Clean up nested numbered markers
    .replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '')
    
    // Wrap remaining numbered items with mb-3 (items that have nested content)
    .replace(/(<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-4 mb-7 space-y-2">$&</ol>')

    // Wrap remaining numbered items (regular without nesting)
    .replace(/(<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-4 mb-6 space-y-1">$&</ol>')

    // Paragraphs
    .replace(/\n\n/g, `</p><p style="font-size: ${baseFontSize}px" class="mb-4 text-[#212B32] leading-relaxed">`)

    // Clean up empty paragraphs and double wrapping
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ol[^>]*>.*?<\/ol>)<\/p>/g, '$1')
    .replace(/(<\/p>){2,}/g, '</p>')

    // URLs to links
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#005EB8] hover:text-[#003F7F] underline">$1</a>');

  // Wrap initial paragraphs
  if (!html.startsWith('<')) {
    html = `<p style="font-size: ${baseFontSize}px" class="mb-4 text-[#212B32] leading-relaxed">` + html + '</p>';
  }

  // Professional NHS wrapper with optimized typography
  html = `<div class="minutes-content font-nhs max-w-full px-2">
    <style>
      .minutes-content {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: ${baseFontSize}px;
        line-height: ${baseFontSize * 1.6}px;
        color: #212B32;
      }
      
      .minutes-content h2 {
        page-break-after: avoid;
      }
      
      .minutes-content h3 {
        page-break-after: avoid;
      }
      
      .minutes-content table {
        page-break-inside: avoid;
      }
      
      .minutes-content ul ul {
        list-style-type: circle;
        margin-top: 0.5rem;
      }
      
      .minutes-content ol li[class*="border-l-2"] {
        margin-bottom: 1rem;
      }
      
      /* Print optimization */
      @media print {
        .minutes-content {
          max-width: 100%;
          font-size: 12pt;
        }
        
        .minutes-content table th {
          background-color: #f0f0f0 !important;
          color: #000 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .minutes-content table tr:nth-child(even) {
          background-color: #f9f9f9 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
    ${html}
  </div>`;

  console.log('🔍 MINUTES RENDERER OUTPUT (first 500 chars):', html.substring(0, 500));

  // Sanitize the HTML - added SVG support for icons and CSP-compliant flags
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'style', 'svg', 'path'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style', 'value', 'fill', 'viewBox', 'fill-rule', 'clip-rule', 'd'],
    SAFE_FOR_TEMPLATES: true,   // Prevent template string evaluation
    RETURN_DOM_FRAGMENT: false, // Return string, not DOM node
    FORCE_BODY: true            // Prevent script execution context
  });
}
