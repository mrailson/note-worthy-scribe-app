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
      
      .minutes-content h2 {
        page-break-after: avoid;
      }
      
      .minutes-content h3 {
        page-break-after: avoid;
      }
      
      .minutes-content table {
        page-break-inside: avoid;
      }
      
      .minutes-content table.meeting-table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
      }
      
      .minutes-content table.meeting-table td,
      .minutes-content table.meeting-table th {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      
      .minutes-content table.meeting-table th {
        background-color: #f8f9fa;
        font-weight: 600;
      }
    </style>
    ${html}
  </div>`;

    // Sanitize
    return DOMPurify.sanitize(wrapped, {
      ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'table', 'tr', 'td', 'th', 'span', 'style'],
      ALLOWED_ATTR: ['class', 'style'],
    });
  } catch (error) {
    console.error('❌ Rendering failed, returning plain text:', error);
    return `<div class="minutes-content font-nhs max-w-full px-2">
      <pre style="white-space: pre-wrap; font-family: inherit; font-size: ${baseFontSize}px;">${content.slice(0, 50000)}</pre>
    </div>`;
  }
}
