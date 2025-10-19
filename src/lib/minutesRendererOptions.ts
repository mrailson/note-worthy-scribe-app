import DOMPurify from 'dompurify';

/**
 * OPTION 1: Compact Inline (Enhanced Current Style)
 * - Inline attendees with bullet separators
 * - Compact key points with better visual hierarchy
 */
export function renderMinutesCompactInline(content: string): string {
  if (!content) return '';

  let preprocessedContent = content
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2');

  let html = preprocessedContent
    // ENHANCED: Force inline attendees regardless of count
    .replace(/(## ATTENDEES|## Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, (match, header, list) => {
      const attendees = list.match(/[-•]\s+(.+)/g)?.map(a => a.replace(/^[-•]\s+/, '').trim()) || [];
      
      const present = attendees.filter(a => !a.toLowerCase().includes('mentioned'));
      const mentioned = attendees.filter(a => a.toLowerCase().includes('mentioned')).map(a => a.replace(/\s*\(mentioned\)/gi, ''));
      
      // Always use inline format with better styling
      let html = '<h3 class="text-xl font-bold text-[#005EB8] mb-3 mt-6 pb-2 border-b-2 border-[#005EB8]">Attendees</h3>';
      html += '<div class="bg-gradient-to-r from-[#F0F4F5] to-white border-l-4 border-[#005EB8] p-4 mb-6 rounded-r shadow-sm">';
      
      if (present.length > 0) {
        html += `<p class="mb-2 text-base leading-relaxed">`;
        html += `<strong class="text-[#005EB8] font-semibold">Present:</strong> `;
        html += present.map(a => `<span class="text-[#212B32]">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        html += `</p>`;
      }
      
      if (mentioned.length > 0) {
        html += `<p class="text-base leading-relaxed">`;
        html += `<strong class="text-[#768692] font-semibold">Also mentioned:</strong> `;
        html += mentioned.map(a => `<span class="text-[#768692] italic">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        html += `</p>`;
      }
      
      html += '</div>';
      return html;
    })

    // ENHANCED: Better key points formatting
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      if (content.toLowerCase().includes('key points') || content.toLowerCase().includes('key discussion')) {
        return `<h3 class="text-lg font-bold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692] flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
          ${content}
        </h3>`;
      } else if (content.includes('Meeting Details') || content.includes('Executive Summary')) {
        return `<h2 class="text-xl font-semibold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692]">${content}</h2>`;
      } else {
        return `<h4 class="text-base font-semibold text-[#425563] mb-2 mt-4">${content}</h4>`;
      }
    })

    // Meeting details
    .replace(/(Date|Time|Location|Duration|Meeting Type):\s*([^\n]+)/g, 
      '<div class="flex mb-2"><span class="font-semibold text-[#005EB8] min-w-[120px]">$1:</span><span class="text-[#212B32]">$2</span></div>')

    // Tables
    .replace(/\|(.+?)\|\s*\n\s*\|[-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      const rows = bodyRows.trim().split('\n').map(row => {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        return cells;
      }).filter(row => row.length > 0);

      const isActionItemsTable = headers.some(h => h.toLowerCase().includes('priority'));

      const headerHtml = headers.map((header, idx) => {
        const width = idx === 0 ? 'w-[40%]' : (isActionItemsTable && idx === headers.length - 2) ? 'w-[15%]' : 'w-auto';
        return `<th class="border border-[#768692] px-4 py-3 bg-[#005EB8] text-white font-semibold text-left text-sm ${width}">${header}</th>`;
      }).join('');

      const bodyHtml = rows.map((row, rowIdx) => {
        const bgClass = rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F5]';
        return `<tr class="${bgClass} hover:bg-[#E8EDEE] transition-colors">\n          ${row.map((cell, cellIdx) => {
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

    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#212B32]">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-[#425563]">$1</em>')
    
    // Lists
    .replace(/^[-•\*]\s+(.+)$/gm, '<li class="mb-2 text-[#212B32] leading-relaxed pl-1">$1</li>')
    .replace(/(<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-6 mb-4 space-y-2">$&</ul>')

    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-[#212B32] leading-relaxed">')
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')

    // URLs
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#005EB8] hover:text-[#003F7F] underline">$1</a>');

  if (!html.startsWith('<')) {
    html = '<p class="mb-4 text-[#212B32] leading-relaxed">' + html + '</p>';
  }

  html = `<div class="minutes-content font-nhs max-w-[900px] mx-auto">
    <style>
      .minutes-content {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #212B32;
      }
    </style>
    ${html}
  </div>`;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'style', 'svg', 'path'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style', 'value', 'fill', 'viewBox', 'fill-rule', 'clip-rule', 'd']
  });
}

/**
 * OPTION 2: Professional Cards
 * - Attendees as clean cards in grid
 * - Key points with background highlights and icons
 */
export function renderMinutesProfessionalCards(content: string): string {
  if (!content) return '';

  let preprocessedContent = content
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  let html = preprocessedContent
    // Attendees as cards
    .replace(/(## ATTENDEES|## Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, (match, header, list) => {
      const attendees = list.match(/[-•]\s+(.+)/g)?.map(a => a.replace(/^[-•]\s+/, '').trim()) || [];
      
      const present = attendees.filter(a => !a.toLowerCase().includes('mentioned'));
      const mentioned = attendees.filter(a => a.toLowerCase().includes('mentioned')).map(a => a.replace(/\s*\(mentioned\)/gi, ''));
      
      let html = '<h3 class="text-xl font-bold text-[#005EB8] mb-4 mt-6">Attendees</h3>';
      
      if (present.length > 0) {
        html += '<p class="text-sm font-semibold text-[#005EB8] mb-3">Present</p>';
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">';
        present.forEach(a => {
          const [name, ...roleParts] = a.split(/[-–]/);
          const role = roleParts.join('-').trim() || '';
          html += `
            <div class="bg-white border-2 border-[#E8EDEE] rounded-lg p-3 hover:border-[#005EB8] hover:shadow-md transition-all">
              <div class="flex items-start gap-2">
                <div class="w-8 h-8 rounded-full bg-[#005EB8] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  ${name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-[#212B32] text-sm leading-tight truncate">${name.trim()}</p>
                  ${role ? `<p class="text-xs text-[#768692] mt-0.5 leading-tight">${role}</p>` : ''}
                </div>
              </div>
            </div>
          `;
        });
        html += '</div>';
      }
      
      if (mentioned.length > 0) {
        html += '<p class="text-sm font-semibold text-[#768692] mb-3 mt-4">Also Mentioned</p>';
        html += '<div class="flex flex-wrap gap-2 mb-4">';
        mentioned.forEach(a => {
          html += `<span class="bg-[#F0F4F5] border border-[#E8EDEE] rounded-full px-3 py-1.5 text-sm text-[#768692] italic">${a}</span>`;
        });
        html += '</div>';
      }
      
      return html;
    })

    // Key points with highlight boxes
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      if (content.toLowerCase().includes('key points') || content.toLowerCase().includes('key discussion')) {
        return `<h3 class="text-xl font-bold text-[#005EB8] mb-4 mt-8 pb-3 border-b-2 border-[#005EB8] flex items-center gap-2">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
          ${content}
        </h3>`;
      } else if (content.includes('Meeting Details') || content.includes('Executive Summary')) {
        return `<h2 class="text-2xl font-bold text-[#005EB8] mb-4 mt-6 pb-2 border-b-2 border-[#768692]">${content}</h2>`;
      } else {
        return `<h4 class="text-lg font-semibold text-[#425563] mb-3 mt-5">${content}</h4>`;
      }
    })

    // Meeting details in cards
    .replace(/(Date|Time|Location|Duration|Meeting Type):\s*([^\n]+)/g, 
      '<div class="bg-[#F0F4F5] rounded-lg px-4 py-2 mb-2 flex items-center gap-3"><span class="font-bold text-[#005EB8] text-sm">$1</span><span class="text-[#212B32]">$2</span></div>')

    // Lists with better styling
    .replace(/^[-•\*]\s+(.+)$/gm, '<li class="mb-3 text-[#212B32] leading-relaxed pl-2 relative before:content-[\'\'] before:absolute before:left-[-16px] before:top-[10px] before:w-2 before:h-2 before:rounded-full before:bg-[#005EB8]">$1</li>')
    .replace(/(<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-none ml-6 mb-6 space-y-1">$&</ul>')

    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#005EB8]">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-[#425563]">$1</em>')

    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-[#212B32] leading-relaxed">')
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1');

  if (!html.startsWith('<')) {
    html = '<p class="mb-4 text-[#212B32] leading-relaxed">' + html + '</p>';
  }

  html = `<div class="minutes-content-cards font-nhs max-w-[950px] mx-auto p-6 bg-white">
    <style>
      .minutes-content-cards {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #212B32;
      }
    </style>
    ${html}
  </div>`;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'li', 'span', 'style', 'svg', 'path'],
    ALLOWED_ATTR: ['class', 'fill', 'viewBox', 'fill-rule', 'clip-rule', 'd']
  });
}

/**
 * OPTION 3: Two-Column Layout
 * - Attendees in left sidebar
 * - Main content in right column
 */
export function renderMinutesTwoColumn(content: string): string {
  if (!content) return '';

  let preprocessedContent = content
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Extract attendees section
  const attendeesMatch = content.match(/(## ATTENDEES|## Attendees)\s*\n((?:[-•]\s+.+\n?)+)/i);
  let attendeesHtml = '';
  let mainContent = preprocessedContent;

  if (attendeesMatch) {
    const list = attendeesMatch[2];
    const attendees = list.match(/[-•]\s+(.+)/g)?.map(a => a.replace(/^[-•]\s+/, '').trim()) || [];
    
    const present = attendees.filter(a => !a.toLowerCase().includes('mentioned'));
    const mentioned = attendees.filter(a => a.toLowerCase().includes('mentioned')).map(a => a.replace(/\s*\(mentioned\)/gi, ''));
    
    attendeesHtml = '<div class="bg-[#F0F4F5] border-r-4 border-[#005EB8] p-4 rounded-l h-full">';
    attendeesHtml += '<h3 class="text-lg font-bold text-[#005EB8] mb-4 pb-2 border-b border-[#005EB8]">Attendees</h3>';
    
    if (present.length > 0) {
      attendeesHtml += '<div class="mb-4"><p class="text-xs font-bold text-[#005EB8] mb-2 uppercase">Present</p>';
      present.forEach(a => {
        attendeesHtml += `<div class="mb-2 pb-2 border-b border-[#E8EDEE] last:border-0"><p class="text-sm text-[#212B32] leading-snug">${a}</p></div>`;
      });
      attendeesHtml += '</div>';
    }
    
    if (mentioned.length > 0) {
      attendeesHtml += '<div><p class="text-xs font-bold text-[#768692] mb-2 uppercase">Mentioned</p>';
      mentioned.forEach(a => {
        attendeesHtml += `<p class="text-xs text-[#768692] italic mb-1.5">${a}</p>`;
      });
      attendeesHtml += '</div>';
    }
    
    attendeesHtml += '</div>';
    
    // Remove attendees from main content
    mainContent = mainContent.replace(/(## ATTENDEES|## Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, '');
  }

  let contentHtml = mainContent
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      if (content.toLowerCase().includes('key points')) {
        return `<h3 class="text-lg font-bold text-[#005EB8] mb-3 mt-6 pb-2 border-b border-[#005EB8]">${content}</h3>`;
      } else if (content.includes('Meeting Details') || content.includes('Executive Summary')) {
        return `<h2 class="text-xl font-bold text-[#005EB8] mb-4 mt-6 pb-2 border-b-2 border-[#768692]">${content}</h2>`;
      } else {
        return `<h4 class="text-base font-semibold text-[#425563] mb-2 mt-4">${content}</h4>`;
      }
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#212B32]">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-[#425563]">$1</em>')
    .replace(/^[-•\*]\s+(.+)$/gm, '<li class="mb-2 text-[#212B32] leading-relaxed">$1</li>')
    .replace(/(<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li[^>]*>(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-6 mb-4 space-y-1">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mb-4 text-[#212B32] leading-relaxed">')
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1');

  if (!contentHtml.startsWith('<')) {
    contentHtml = '<p class="mb-4 text-[#212B32] leading-relaxed">' + contentHtml + '</p>';
  }

  const html = `<div class="minutes-content-columns font-nhs max-w-[1100px] mx-auto">
    <style>
      .minutes-content-columns {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #212B32;
      }
    </style>
    <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      <div class="md:sticky md:top-4 md:self-start">
        ${attendeesHtml}
      </div>
      <div class="p-4">
        ${contentHtml}
      </div>
    </div>
  </div>`;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'li', 'style'],
    ALLOWED_ATTR: ['class']
  });
}
