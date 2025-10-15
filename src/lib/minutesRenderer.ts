import DOMPurify from 'dompurify';

/**
 * Professional NHS-styled renderer for meeting minutes
 * Optimized for formal medical/professional documentation
 */
export function renderMinutesMarkdown(content: string): string {
  if (!content) return '';

  console.log('🔍 MINUTES RENDERER INPUT:', content.substring(0, 200));

  // Preprocess content to normalize spacing
  let preprocessedContent = content
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Clean up multiple consecutive line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Ensure headers are on their own lines
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2');

  // Convert markdown to HTML with NHS professional styling
  let html = preprocessedContent
    // Remove markdown headers (##, ###, etc.) but keep the text
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      // Determine header level based on content
      if (content.includes('Meeting Details') || content.includes('Executive Summary')) {
        return `<h2 class="text-xl font-semibold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692]">${content}</h2>`;
      } else if (content.includes('Action Items') || content.includes('Attendees') || content.includes('Discussion')) {
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

    // Convert bullet list items
    .replace(/^[-•]\s+(.+)$/gm, '<li class="mb-2 text-[#212B32] leading-relaxed">$1</li>')

    // Wrap consecutive list items in ul tags (using non-greedy, safer pattern)
    .replace(/(<li class="mb-2[^>]*>(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*>(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-6 mb-4 space-y-1">$&</ul>')

    // Convert numbered list items
    .replace(/^(\d+)[\.)]\s+(.+)$/gm, '<li class="mb-2 text-[#212B32] leading-relaxed" value="$1">$2</li>')

    // Wrap consecutive numbered items in ol tags (using safer pattern)
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
