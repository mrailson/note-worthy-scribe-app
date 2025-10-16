/**
 * Table rendering utility for mobile and desktop
 * Extracts table data structure from markdown
 */

export interface TableData {
  headers: string[];
  rows: Array<{ [key: string]: string }>;
}

/**
 * Parse markdown table into structured data
 */
export function parseMarkdownTable(tableMarkdown: string): TableData | null {
  // Match: | header | header | ... followed by separator row and data rows
  const tableRegex = /\|(.+?)\|\s*\n\s*\|[\s\-:]+\|.*?\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gs;
  const match = tableRegex.exec(tableMarkdown);

  if (!match) return null;

  const [, headerRow, bodyRows] = match;

  const headers = headerRow
    .split('|')
    .map(h => h.trim())
    .filter(h => h);

  const rows = bodyRows
    .trim()
    .split('\n')
    .map(row => {
      const cells = row
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);

      const rowData: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        rowData[header] = cells[index] || '';
      });

      return rowData;
    })
    .filter(row => Object.keys(row).length > 0);

  return { headers, rows };
}

/**
 * Convert table data to HTML for desktop
 */
export function tableToHtml(
  tableData: TableData,
  options: {
    isUserMessage?: boolean;
    className?: string;
  } = {}
): string {
  const { isUserMessage = false, className = '' } = options;

  const headerHtml = tableData.headers
    .map(
      header =>
        `<th class="border border-border px-4 py-3 bg-primary text-primary-foreground font-semibold text-left text-sm ${
          isUserMessage ? 'border-white/20 bg-white/10 text-white' : ''
        }">${header}</th>`
    )
    .join('');

  const isActionItemsTable = tableData.headers.some(h =>
    h.toLowerCase().includes('priority')
  );

  const bodyHtml = tableData.rows
    .map((row, rowIndex) => {
      const bgClass = rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/30';
      const cellsHtml = tableData.headers
        .map(header => {
          const cellValue = row[header] || '';

          // Priority badge rendering
          if (header.toLowerCase().includes('priority')) {
            let badge = '';
            const priority = cellValue.toLowerCase();
            if (priority.includes('high')) {
              badge = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground">🔴 High</span>`;
            } else if (priority.includes('medium')) {
              badge = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-warning text-warning-foreground">🟡 Medium</span>`;
            } else if (priority.includes('low')) {
              badge = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success text-success-foreground">🟢 Low</span>`;
            } else {
              badge = cellValue;
            }
            return `<td class="border border-border px-4 py-3 text-sm ${
              isUserMessage ? 'text-white border-white/20' : ''
            }">${badge}</td>`;
          }

          return `<td class="border border-border px-4 py-3 text-sm text-card-foreground leading-relaxed ${
            isUserMessage ? 'text-white border-white/20' : ''
          }">${cellValue}</td>`;
        })
        .join('');

      return `<tr class="${bgClass} hover:bg-muted/50 transition-colors">${cellsHtml}</tr>`;
    })
    .join('');

  return `<div class="overflow-x-auto my-4 shadow-sm rounded-lg ${className}">
    <table class="w-full border-collapse border border-border ${
      isUserMessage ? 'border-white/20' : ''
    }">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </div>`;
}
