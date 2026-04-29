/**
 * Table rendering utility for mobile and desktop
 * Extracts table data structure from markdown
 */

export interface TableData {
  headers: string[];
  rows: Array<{ [key: string]: string }>;
}

/**
 * Split a pipe-delimited markdown table row.
 * Supports both bordered rows (`| A | B |`) and loose rows (`A | B`).
 */
export function splitMarkdownTableRow(row: string): string[] {
  const trimmed = row.trim();
  if (!trimmed.includes('|')) return [];

  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.replace(/\*\*/g, '').trim());
}

export function isMarkdownSeparatorRow(row: string): boolean {
  const cells = splitMarkdownTableRow(row).filter(Boolean);
  return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, '')));
}

const looksLikeMarkdownTableRow = (row: string): boolean =>
  row.includes('|') && splitMarkdownTableRow(row).length >= 2;

const makeHeadersUnique = (headers: string[]): string[] => {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const clean = header.trim() || `Column ${index + 1}`;
    const key = clean.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    return count === 0 ? clean : `${clean} ${count + 1}`;
  });
};

/**
 * Extract markdown table blocks from a larger body of text.
 * This is deliberately line-based so malformed AI output does not leak raw pipes into the UI.
 */
export function extractMarkdownTableBlocks(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!looksLikeMarkdownTableRow(lines[i])) continue;

    let separatorIndex = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      if (!lines[j].trim()) continue;
      if (isMarkdownSeparatorRow(lines[j])) {
        separatorIndex = j;
      }
      break;
    }

    if (separatorIndex === -1) continue;

    const blockLines = [lines[i], lines[separatorIndex]];
    let cursor = separatorIndex + 1;

    while (cursor < lines.length) {
      const line = lines[cursor];
      const trimmed = line.trim();

      if (!trimmed) break;
      if (/^#{1,6}\s+/.test(trimmed)) break;
      if (!looksLikeMarkdownTableRow(line)) break;

      blockLines.push(line);
      cursor++;
    }

    blocks.push(blockLines.join('\n'));
    i = Math.max(i, cursor - 1);
  }

  return blocks;
}

/**
 * Parse markdown table into structured data.
 */
export function parseMarkdownTable(tableMarkdown: string): TableData | null {
  const block = extractMarkdownTableBlocks(tableMarkdown)[0] || tableMarkdown;
  const lines = block
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((line, index) =>
    looksLikeMarkdownTableRow(line) && lines.slice(index + 1).some(next => !next.trim() || isMarkdownSeparatorRow(next))
  );

  if (headerIndex === -1) return null;

  const separatorIndex = lines.findIndex((line, index) => index > headerIndex && isMarkdownSeparatorRow(line));
  if (separatorIndex === -1) return null;

  let headers = makeHeadersUnique(splitMarkdownTableRow(lines[headerIndex]));
  if (headers.length < 2) return null;

  const dataLines = lines.slice(separatorIndex + 1);
  const firstDataCells = dataLines.find(line => looksLikeMarkdownTableRow(line) && !isMarkdownSeparatorRow(line));
  const firstCellCount = firstDataCells ? splitMarkdownTableRow(firstDataCells).length : headers.length;

  // Some generated notes accidentally prepend the section title to the header row,
  // e.g. `| Action | Owner | Action | Due Date |` while data rows have 3 cells.
  // Drop that synthetic first header so the table aligns again.
  if (headers.length === firstCellCount + 1 && /^action items?$|^actions?$/i.test(headers[0])) {
    headers = makeHeadersUnique(headers.slice(1));
  }

  const rows = dataLines
    .filter(line => looksLikeMarkdownTableRow(line) && !isMarkdownSeparatorRow(line))
    .map(row => {
      const cells = splitMarkdownTableRow(row);
      const rowData: { [key: string]: string } = {};

      headers.forEach((header, index) => {
        rowData[header] = cells[index] || '';
      });

      return rowData;
    })
    .filter(row => Object.values(row).some(value => value.trim().length > 0));

  if (rows.length === 0) return null;

  return { headers, rows };
}

export function isActionItemsTableData(tableData: TableData): boolean {
  const headerText = tableData.headers.join(' ').toLowerCase();
  const hasActionColumn = /\b(action|task|next step|agreed action)\b/.test(headerText);
  const hasOwnerColumn = /\b(owner|assignee|lead|responsible|who)\b/.test(headerText);
  const hasDeadlineColumn = /\b(due|deadline|date|when|timescale)\b/.test(headerText);

  if (hasActionColumn && (hasOwnerColumn || hasDeadlineColumn)) return true;

  const firstRow = tableData.rows[0];
  if (!firstRow) return false;

  const values = tableData.headers.map(header => firstRow[header] || '').filter(Boolean);
  const longActionLikeCell = values.some(value => value.length > 35);
  const shortOwnerLikeCell = values.some(value => value.length > 0 && value.length <= 45 && !/[.!?]$/.test(value));

  return hasActionColumn && longActionLikeCell && shortOwnerLikeCell;
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
