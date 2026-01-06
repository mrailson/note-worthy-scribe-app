/**
 * Core transformation logic for meeting minutes - extracted for Web Worker use
 * This module handles the heavy regex processing that can block the main thread
 */

/**
 * Strip transcript markers from content for plain text view
 */
export function stripTranscriptMarkers(content: string): string {
  if (!content) return '';
  return content
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Core transformation - converts markdown to NHS-styled HTML
 * This is the heavy processing that should run in a worker
 */
export function transformMinutesToHtml(content: string, baseFontSize: number = 13): string {
  if (!content) return '';

  // Preprocess content
  let preprocessedContent = content
    .replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2');

  let html = preprocessedContent
    // Attendees formatting
    .replace(/(#{1,2}\s*ATTENDEES|#{1,2}\s*Attendees)\s*\n((?:[-•]\s+.+\n?)+)/gi, (match, header, list) => {
      const attendees = list.match(/[-•]\s+(.+)/g)?.map((a: string) => a.replace(/^[-•]\s+/, '').trim()) || [];
      const present = attendees.filter((a: string) => !a.toLowerCase().includes('mentioned'));
      const mentioned = attendees.filter((a: string) => a.toLowerCase().includes('mentioned')).map((a: string) => a.replace(/\s*\(mentioned\)/gi, ''));
      
      let result = `<h3 style="font-size: ${baseFontSize * 1.5}px" class="font-bold text-[#005EB8] mb-3 mt-6 pb-2 border-b-2 border-[#005EB8]">Attendees</h3>`;
      result += '<div class="p-4 mb-6">';
      
      if (present.length > 0) {
        result += `<p class="mb-2 leading-relaxed" style="font-size: ${baseFontSize}px">`;
        result += `<strong class="text-[#005EB8] font-semibold">Present:</strong> `;
        result += present.map((a: string) => `<span class="text-[#212B32]">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        result += `</p>`;
      }
      
      if (mentioned.length > 0) {
        result += `<p class="leading-relaxed" style="font-size: ${baseFontSize}px">`;
        result += `<strong class="text-[#768692] font-semibold">Also mentioned:</strong> `;
        result += mentioned.map((a: string) => `<span class="text-[#768692] italic">${a}</span>`).join('<span class="text-[#768692] mx-2">•</span>');
        result += `</p>`;
      }
      
      result += '</div>';
      return result;
    })

    // Headers formatting
    .replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
      const cleanContent = content.replace(/^#+\s*/, '').trim();
      const isNumberedSection = /^\d+\.?\d*\s+/.test(cleanContent);
      
      if (cleanContent.toLowerCase().includes('key points') || cleanContent.toLowerCase().includes('key discussion')) {
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 700; margin-bottom: 16px; margin-top: 24px; padding-bottom: 8px; border-bottom: 1px solid #768692;" class="font-bold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692] flex items-center gap-2">
          <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
          <span>${cleanContent}</span>
        </h3>`;
      } else if (cleanContent.toLowerCase().includes('meeting details')) {
        return '';
      } else if (cleanContent.toLowerCase().includes('executive summary')) {
        return `<h2 style="font-size: ${baseFontSize * 1.5}px; color: #005EB8; font-weight: 600; margin-bottom: 16px; margin-top: 24px; padding-bottom: 8px; border-bottom: 1px solid #768692;" class="font-semibold text-[#005EB8] mb-4 mt-6 pb-2 border-b border-[#768692]">${cleanContent}</h2>`;
      } else if (cleanContent.toLowerCase().includes('action items') || cleanContent.toLowerCase().includes('discussion') || cleanContent.toLowerCase().includes('decisions made')) {
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 600; margin-bottom: 12px; margin-top: 20px;" class="font-semibold text-[#005EB8] mb-3 mt-5">${cleanContent}</h3>`;
      } else if (isNumberedSection) {
        return `<h3 style="font-size: ${baseFontSize * 1.3}px; color: #005EB8; font-weight: 700; margin-bottom: 12px; margin-top: 24px; padding-bottom: 4px; border-bottom: 2px solid #005EB8;" class="font-bold text-[#005EB8] mb-3 mt-6 pb-1 border-b-2 border-[#005EB8]">${cleanContent}</h3>`;
      } else {
        return `<h4 style="font-size: ${baseFontSize}px; color: #005EB8; font-weight: 600; margin-bottom: 8px; margin-top: 16px;" class="font-semibold text-[#425563] mb-2 mt-4">${cleanContent}</h4>`;
      }
    })

    // Meeting details
    .replace(/(Date|Time|Location|Duration|Meeting Type):\s*([^\n]+)/g, 
      `<div class="flex mb-2" style="font-size: ${baseFontSize}px"><span class="font-semibold text-[#005EB8] min-w-[120px]">$1:</span><span class="text-[#212B32]">$2</span></div>`)
    .replace(/Meeting Title:\s*([^\n]+)/i, 
      `<div class="flex mb-2" style="font-size: ${baseFontSize}px"><span class="font-semibold text-[#005EB8] min-w-[120px]">Meeting Title: </span><span class="text-[#005EB8] font-semibold">$1</span></div>`)

    // Tables
    .replace(/\|(.+?)\|\s*\n\s*\|[-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs, (match, headerRow, bodyRows) => {
      const splitPipeRow = (row: string): string[] => {
        const parts = row.split('|').map((p: string) => p.trim());
        if (parts.length > 0 && parts[0] === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
        return parts;
      };

      const headers = splitPipeRow(headerRow);
      const rows = bodyRows.trim().split('\n').map((row: string) => splitPipeRow(row)).filter((row: string[]) => row.length > 0);

      const isActionItemsTable = headers.some((h: string) => h.toLowerCase().includes('priority'));

      const headerHtml = headers.map((header: string, idx: number) => {
        const width = idx === 0 ? 'w-[40%]' : (isActionItemsTable && idx === headers.length - 2) ? 'w-[15%]' : 'w-auto';
        return `<th style="font-size: ${baseFontSize}px; padding: 12px; text-align: left; background-color: #005EB8; color: white; font-weight: 600; border: 1px solid #768692;" class="border border-[#768692] px-4 py-3 bg-[#005EB8] text-white font-semibold text-left ${width}">${header}</th>`;
      }).join('');

      const bodyHtml = rows.map((row: string[], rowIdx: number) => {
        const bgClass = rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F5]';
        const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#F0F4F5';
        return `<tr class="${bgClass} hover:bg-[#E8EDEE] transition-colors">
          ${row.map((cell: string, cellIdx: number) => {
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

      return `<div class="overflow-x-auto my-6 shadow-sm rounded-lg">
        <table class="w-full border-collapse border border-[#768692]" border="1" cellpadding="8" cellspacing="0" style="border: 1px solid #768692; border-collapse: collapse;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>`;
    })

    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#212B32]">$1</strong>')
    .replace(/(<strong class="font-semibold text-\[#212B32\]">[^<]+?:<\/strong>)\s*\*/g, '$1 ')
    .replace(/^\*([A-Z])/gm, '$1')
    .replace(/\s\*([A-Z])/g, ' $1')
    .replace(/\*([^\*\n]+?)\*/g, '<em class="italic text-[#425563]">$1</em>')

    // Subsection formatting (left-aligned)
    .replace(/<strong class="font-semibold text-\[#212B32\]">([^<]+?):<\/strong>\s*((?:(?!<strong class="font-semibold text-\[#212B32\]">).)+?)(?=<strong class="font-semibold text-\[#212B32\]">[^<]+?:<\/strong>|$)/gs, 
      `<p class="mb-4 mt-2 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px"><strong class="font-bold text-[#005EB8]" style="font-size: ${baseFontSize * 1.15}px">$1:</strong> $2</p>`)

    // Paragraph breaks
    .replace(/(\.\s+)((?:Key |A |The |This |Concerns |Expressions |However,|Additionally,|Furthermore,|Subsequently,|Moreover,|Meanwhile,|In addition,)[A-Z][^.]{20,})/g, `.$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)
    .replace(/(\)\.\s+)([A-Z][a-z]{2,}\s+[^.]{30,})/g, `).$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)
    .replace(/(\.\s+)([A-Z][a-z]+\s+(?:was|were|is|are|has|have|will|should|must|could|would)\s+[^.]{25,})/g, `.$1</p>\n<p class="mb-4 leading-relaxed text-[#212B32]" style="font-size: ${baseFontSize}px">$2`)

    // Subheadings
    .replace(/^[-•]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/gm, `<h4 style="font-size: ${baseFontSize}px" class="font-semibold text-[#425563] mb-2 mt-4">$1</h4>`)

    // Numbered lists
    .replace(/^(\d+)[\.)]\s+(.+)$/gm, (match, num, content) => `<!NUM!>${num}<!NUM_SEP!>${content}<!NUM_END!>`)
    .replace(/<!NUM!>\d+<!NUM_SEP!>[\s\S]*?<!NUM_END!>/g, (match) => match)
    .replace(/(<!NUM!>(\d+)<!NUM_SEP!>((?:.{60,})|(?:.*?\*\*.*))<!NUM_END!>)((?:\s*<!NUM!>\d+<!NUM_SEP!>(?:.{0,100})<!NUM_END!>){2,})/gm, 
      (match, mainItem, mainNum, mainContent, followingItems) => {
        const main = mainItem.replace(/<!NUM!>\d+<!NUM_SEP!>/, '').replace(/<!NUM_END!>/, '');
        const nested = followingItems
          .match(/<!NUM!>\d+<!NUM_SEP!>(.*?)<!NUM_END!>/g)
          ?.map((item: string) => item.replace(/<!NUM!>\d+<!NUM_SEP!>/, '').replace(/<!NUM_END!>/, '').trim())
          .map((item: string) => `<!NESTED_BULLET!>${item}<!NESTED_BULLET_END!>`)
          .join('\n') || '';
        return `<!MAIN_NUM!>${mainNum}<!MAIN_NUM_SEP!>${main}<!NESTED_START!>\n${nested}<!NESTED_STOP!>`;
      })
    .replace(/^([ ]{4,}|\t+)[-•\*]\s+(.+)$/gm, '<!NESTED!>$2<!NESTED_END!>')
    .replace(/^[ ]{2,}(\d+)[\.)]\s+(.+)$/gm, '<!NESTED_NUM!>$2<!NESTED_NUM_END!>')
    .replace(/<!NUM!>(\d+)<!NUM_SEP!>(.*?)<!NUM_END!>/g, `<li style="font-size: ${baseFontSize}px" class="mb-2 text-[#212B32] leading-relaxed pl-2" value="$1">$2</li>`)
    .replace(/<!MAIN_NUM!>(\d+)<!MAIN_NUM_SEP!>(.*?)<!NESTED_START!>(.*?)<!NESTED_STOP!>/gs, (match, num, content, nested) => {
      const nestedBullets = nested
        .match(/<!NESTED_BULLET!>(.*?)<!NESTED_BULLET_END!>/g)
        ?.map((item: string) => item.replace(/<!NESTED_BULLET!>|<!NESTED_BULLET_END!>/g, '').trim())
        .map((item: string) => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `<li style="font-size: ${baseFontSize}px" class="mb-3 text-[#212B32] leading-relaxed pl-2" value="${num}">${content}<ul class="list-disc list-outside ml-8 mt-2 mb-2 space-y-1 text-[#425563]">${nestedBullets}</ul></li>`;
    })
    .replace(/^[-•\*]\s+(.+)$/gm, `<li style="font-size: ${baseFontSize}px" class="mb-2 text-[#212B32] leading-relaxed pl-1">$1</li>`)
    .replace(/(<li[^>]*>.*?)((?:<!NESTED!>.*?<!NESTED_END!>\s*)+)(<\/li>)/gs, (match, opening, nested, closing) => {
      const nestedItems = nested.match(/<!NESTED!>(.*?)<!NESTED_END!>/g)
        ?.map((item: string) => item.replace(/<!NESTED!>|<!NESTED_END!>/g, '').trim())
        .map((item: string) => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `${opening}<ul class="list-circle list-outside ml-6 mt-2 mb-2 space-y-1 text-[#425563]">${nestedItems}</ul>${closing}`;
    })
    .replace(/<!NESTED!>|<!NESTED_END!>/g, '')
    .replace(/(<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*>(?:(?!<li class="mb-[23])[\s\S])*?<\/li>\s*)*)/g, '<ul class="list-disc list-outside ml-4 mb-4 space-y-2">$&</ul>')
    .replace(/(<li[^>]*value="[^"]*">.*?)((?:<!NESTED_NUM!>.*?<!NESTED_NUM_END!>\s*)+)(<\/li>)/gs, (match, opening, nested, closing) => {
      const nestedItems = nested.match(/<!NESTED_NUM!>(.*?)<!NESTED_NUM_END!>/g)
        ?.map((item: string) => item.replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '').trim())
        .map((item: string) => `<li class="mb-1.5 text-[#425563] text-sm leading-relaxed">${item}</li>`)
        .join('') || '';
      return `${opening}<ul class="list-disc list-outside ml-8 mt-2 mb-2 space-y-1 text-[#425563]">${nestedItems}</ul>${closing}`;
    })
    .replace(/<!NESTED_NUM!>|<!NESTED_NUM_END!>/g, '')
    .replace(/(<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-3[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-4 mb-7 space-y-2">$&</ol>')
    .replace(/(<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>(?:\s*<li class="mb-2[^>]*value="[^"]*">(?:(?!<li)[\s\S])*?<\/li>\s*)*)/g, '<ol class="list-decimal list-outside ml-4 mb-6 space-y-1">$&</ol>')

    // Paragraphs
    .replace(/\n\n/g, `</p><p style="font-size: ${baseFontSize}px" class="mb-4 text-[#212B32] leading-relaxed">`)
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<div[^>]*>.*?<\/div>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/g, '$1')
    .replace(/<p[^>]*>(<ol[^>]*>.*?<\/ol>)<\/p>/g, '$1')
    .replace(/(<\/p>){2,}/g, '</p>')

    // URLs
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#005EB8] hover:text-[#003F7F] underline">$1</a>');

  // Wrap initial content
  if (!html.startsWith('<')) {
    html = `<p style="font-size: ${baseFontSize}px" class="mb-4 text-[#212B32] leading-relaxed">` + html + '</p>';
  }

  // Wrap in NHS container with styles
  html = `<div class="minutes-content font-nhs max-w-full px-2">
    <style>
      .minutes-content {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: ${baseFontSize}px;
        line-height: ${baseFontSize * 1.6}px;
        color: #212B32;
      }
      .minutes-content h2 { page-break-after: avoid; }
      .minutes-content h3 { page-break-after: avoid; }
      .minutes-content table { page-break-inside: avoid; }
      .minutes-content ul ul { list-style-type: circle; margin-top: 0.5rem; }
      .minutes-content ol li[class*="border-l-2"] { margin-bottom: 1rem; }
      @media print {
        .minutes-content { max-width: 100%; font-size: 12pt; }
        .minutes-content table th { background-color: #f0f0f0 !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .minutes-content table tr:nth-child(even) { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
    ${html}
  </div>`;

  return html;
}
