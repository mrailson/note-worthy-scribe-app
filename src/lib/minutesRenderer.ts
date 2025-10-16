import DOMPurify from 'dompurify';

/**
 * Professional NHS-styled renderer for meeting minutes
 * Optimized for formal medical/professional documentation
 */
export function renderMinutesMarkdown(content: string): string {
  if (!content) return '';

  console.log('🔍 MINUTES RENDERER INPUT:', content.substring(0, 200));

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
    // Enhanced ATTENDEES section formatting
    .replace(/(## ATTENDEES|## Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, (match, header, list) => {
      const attendees = list.match(/[-•]\s+(.+)/g)?.map(a => a.replace(/^[-•]\s+/, '').trim()) || [];
      
      // Separate mentioned/present
      const present = attendees.filter(a => !a.toLowerCase().includes('mentioned'));
      const mentioned = attendees.filter(a => a.toLowerCase().includes('mentioned')).map(a => a.replace(/\s*\(mentioned\)/gi, ''));
      
      if (attendees.length <= 4) {
        // Inline format for short lists
        let html = '<h3 class="text-lg font-semibold text-[#005EB8] mb-3 mt-5">Attendees</h3>';
        html += '<div class="bg-[#F0F4F5] border-l-4 border-[#005EB8] p-4 mb-4 rounded-r">';
        if (present.length > 0) html += `<p class="mb-2"><strong class="text-[#005EB8]">Present:</strong> ${present.join(', ')}</p>`;
        if (mentioned.length > 0) html += `<p><strong class="text-[#768692]">Also mentioned:</strong> ${mentioned.join(', ')}</p>`;
        html += '</div>';
        return html;
      } else {
        // Grid format for longer lists
        const presentGrid = present.map(a => 
          `<div class="px-3 py-2 bg-white border border-[#E8EDEE] rounded text-[#212B32]">${a}</div>`
        ).join('');
        const mentionedGrid = mentioned.length > 0 ? mentioned.map(a => 
          `<div class="px-3 py-2 bg-white border border-[#E8EDEE] rounded text-[#768692] italic">${a}</div>`
        ).join('') : '';
        
        let html = '<h3 class="text-lg font-semibold text-[#005EB8] mb-3 mt-5">Attendees</h3>';
        if (present.length > 0) {
          html += '<p class="text-sm font-semibold text-[#005EB8] mb-2">Present:</p>';
          html += `<div class="grid grid-cols-2 gap-2 mb-3">${presentGrid}</div>`;
        }
        if (mentioned.length > 0) {
          html += '<p class="text-sm font-semibold text-[#768692] mb-2">Also mentioned:</p>';
          html += `<div class="grid grid-cols-2 gap-2 mb-4">${mentionedGrid}</div>`;
        }
        return html;
      }
    })

    // Remove remaining markdown headers (##, ###, etc.) but keep the text
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      // Determine header level based on content
      if (content.includes('Meeting Details') || content.includes('Executive Summary') || content.toUpperCase() === 'MEETING DETAILS') {
        return `<h2 class="text-xl font-semibold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692]">${content}</h2>`;
      } else if (content.includes('Action Items') || content.includes('Discussion') || content.includes('Key Discussion') || content.includes('Decisions Made')) {
        return `<h3 class="text-lg font-semibold text-[#005EB8] mb-3 mt-5">${content}</h3>`;
      } else {
        return `<h4 class="text-base font-semibold text-[#425563] mb-2 mt-4">${content}</h4>`;
      }
    })

    // Meeting Details section - create a styled info box
    .replace(/(Date|Time|Location|Duration|Meeting Type):\s*([^\n]+)/g, 
      '<div class="flex mb-2"><span class="font-semibold text-[#005EB8] min-w-[120px]">$1:</span><span class="text-[#212B32]">$2</span></div>')

    // Process markdown tables with enhanced NHS styling
    .replace(/\|(.+?)\|\s*\n\s*\|[-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      const rows = bodyRows.trim().split('\n').map(row => {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        return cells;
      }).filter(row => row.length > 0);

      // Check if this is the Action Items table (has Priority column)
      const isActionItemsTable = headers.some(h => h.toLowerCase().includes('priority'));

      const headerHtml = headers.map((header, idx) => {
        const width = idx === 0 ? 'w-[40%]' : (isActionItemsTable && idx === headers.length - 2) ? 'w-[15%]' : 'w-auto';
        return `<th class="border border-[#768692] px-4 py-3 bg-[#005EB8] text-white font-semibold text-left text-sm ${width}">${header}</th>`;
      }).join('');

      const bodyHtml = rows.map((row, rowIdx) => {
        const bgClass = rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F5]';
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
              return `<td class="border border-[#768692] px-4 py-3 text-sm text-[#212B32]">${badge}</td>`;
            }
            return `<td class="border border-[#768692] px-4 py-3 text-sm text-[#212B32] leading-relaxed">${cell}</td>`;
          }).join('')}
        </tr>`;
      }).join('');

      return `<div class="overflow-x-auto my-6 shadow-sm rounded-lg">\n        <table class="w-full border-collapse border border-[#768692]">\n          <thead><tr>${headerHtml}</tr></thead>\n          <tbody>${bodyHtml}</tbody>\n        </table>\n      </div>`;
    })

    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#212B32]">$1</strong>')

    // Italic text
    .replace(/\*(.*?)\*/g, '<em class="italic text-[#425563]">$1</em>')

    // Detect and convert standalone bullets that are subheadings (like "Background", "Key Points")
    .replace(/^[-•]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/gm, '<h4 class="text-base font-semibold text-[#425563] mb-2 mt-4">$1</h4>')
    
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
    .replace(/<!NUM!>(\d+)<!NUM_SEP!>(.*?)<!NUM_END!>/g, '<li class="mb-2 text-[#212B32] leading-relaxed" value="$1">$2</li>')
    
    // Convert main numbered items with nested content
    .replace(/<!MAIN_NUM!>(\d+)<!MAIN_NUM_SEP!>(.*?)<!NESTED_START!>(.*?)<!NESTED_STOP!>/gs, (match, num, content, nested) => {
      const nestedBullets = nested
        .match(/<!NESTED_BULLET!>(.*?)<!NESTED_BULLET_END!>/g)
        ?.map(item => item.replace(/<!NESTED_BULLET!>|<!NESTED_BULLET_END!>/g, '').trim())
        .map(item => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      
      return `<li class="mb-3 text-[#212B32] leading-relaxed" value="${num}">${content}<ul class="list-disc list-outside ml-6 mt-2 mb-2 space-y-1 text-[#425563]">${nestedBullets}</ul></li>`;
    })
    
    // Convert top-level bullet list items
    .replace(/^[-•\*]\s+(.+)$/gm, '<li class="mb-2 text-[#212B32] leading-relaxed">$1</li>')
    
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
    
    // Wrap consecutive top-level list items in ul tags
    .replace(/(<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-6 mb-4 space-y-1">$&</ul>')

    // Convert nested numbered items to bullets within list items
    .replace(/(<li[^>]*value="[^"]*">.*?)((?:<!NESTED_NUM!>.*?<!NESTED_NUM_END!>\s*)+)(<\/li>)/gs, (match, opening, nested, closing) => {
      const nestedItems = nested.match(/<!NESTED_NUM!>(.*?)<!NESTED_NUM_END!>/g)
        ?.map(item => item.replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '').trim())
        .map(item => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `${opening}<ul class="list-disc list-outside ml-6 mt-2 mb-2 space-y-1 text-[#425563]">${nestedItems}</ul>${closing}`;
    })
    
    // Clean up nested numbered markers
    .replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '')
    
    // Wrap remaining numbered items with mb-3 (items that have nested content)
    .replace(/(<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-6 mb-5 space-y-2">$&</ol>')

    // Wrap remaining numbered items (regular without nesting)
    .replace(/(<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-6 mb-4 space-y-1">$&</ol>')

    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-[#212B32] leading-relaxed">')

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
    html = '<p class="mb-4 text-[#212B32] leading-relaxed">' + html + '</p>';
  }

  // Professional NHS wrapper with optimized typography
  html = `<div class="minutes-content font-nhs max-w-[900px] mx-auto">
    <style>
      .minutes-content {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
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

  // Sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'style'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style', 'value']
  });
}
