import DOMPurify from 'dompurify';
import { transformMinutesToHtml } from './minutesTransformCore';

export function renderMinutesMarkdown(content: string, baseFontSize: number = 13): string {
  if (!content) return '';

  try {
    // Transform content to HTML using worker-safe core logic
    const html = transformMinutesToHtml(content, baseFontSize);

    // Wrap with NHS style
    const wrapped = `<div class="minutes-content font-nhs max-w-full px-2">
    <style>
      .minutes-content {
        font-family: 'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: ${baseFontSize}px;
        line-height: ${baseFontSize * 1.6}px;
        color: #212B32;
      }
      
      .minutes-content h1, .minutes-content h2, .minutes-content h3 {
        color: #005EB8;
        font-weight: 600;
        margin-top: 20px;
        margin-bottom: 12px;
        page-break-after: avoid;
      }
      
      .minutes-content h1 { font-size: ${baseFontSize * 1.8}px; }
      .minutes-content h2 { font-size: ${baseFontSize * 1.5}px; }
      .minutes-content h3 { font-size: ${baseFontSize * 1.3}px; }
      
      .minutes-content table {
        page-break-inside: avoid;
      }
      
      .minutes-content table.meeting-table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        table-layout: fixed;
        border: 1px solid #d1d5db;
      }
      
      .minutes-content table.meeting-table thead th {
        background-color: #005EB8;
        color: white;
        font-weight: 600;
        padding: 12px;
        text-align: left;
        border: 1px solid #d1d5db;
      }
      
      .minutes-content table.meeting-table tbody tr:nth-child(odd) {
        background-color: #ffffff;
      }
      
      .minutes-content table.meeting-table tbody tr:nth-child(even) {
        background-color: #f8fafb;
      }
      
      .minutes-content table.meeting-table tbody tr:hover {
        background-color: #e8f4f8;
      }
      
      .minutes-content table.meeting-table td {
        border: 1px solid #d1d5db;
        padding: 10px;
        text-align: left;
        word-wrap: break-word;
      }
    </style>
    ${html}
  </div>`;

    // Sanitize
    return DOMPurify.sanitize(wrapped, {
      ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span', 'style'],
      ALLOWED_ATTR: ['class', 'style'],
    });
  } catch (error) {
    console.error('❌ Rendering failed, returning plain text:', error);
    return `<div class="minutes-content font-nhs max-w-full px-2">
      <pre style="white-space: pre-wrap; font-family: inherit; font-size: ${baseFontSize}px;">${content.slice(0, 50000)}</pre>
    </div>`;
  }
}
