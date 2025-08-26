import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { sanitizeLinks } from '@/utils/nhsUrlValidation';

// Function to process markdown tables
const processMarkdownTables = (text: string): string => {
  // Split text into lines
  const lines = text.split('\n');
  let result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line looks like a table header (contains |)
    if (line.includes('|') && line.trim().length > 0) {
      // Look ahead to see if next line is a separator (contains - and |)
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.includes('|') && nextLine.includes('-')) {
        // Found a table - process it
        const tableLines = [line];
        let j = i + 2; // Skip the separator line
        
        // Collect all subsequent table rows
        while (j < lines.length && lines[j].includes('|') && lines[j].trim().length > 0) {
          tableLines.push(lines[j]);
          j++;
        }
        
        // Convert to HTML table
        const htmlTable = convertMarkdownTableToHTML(tableLines);
        result.push(htmlTable);
        i = j; // Skip processed lines
      } else {
        result.push(line);
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }
  
  return result.join('\n');
};

// Convert markdown table to HTML
const convertMarkdownTableToHTML = (tableLines: string[]): string => {
  if (tableLines.length === 0) return '';
  
  const [headerLine, ...bodyLines] = tableLines;
  
  // Parse header
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h.length > 0);
  
  // Parse body rows
  const rows = bodyLines.map(line => 
    line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)
  );
  
  // Build HTML table
  let html = '<table>';
  
  // Add header
  if (headers.length > 0) {
    html += '<thead><tr>';
    headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';
  }
  
  // Add body
  if (rows.length > 0) {
    html += '<tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }
  
  html += '</table>';
  return html;
};

interface SafeMessageRendererProps {
  content: string;
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
  enableNHSStyling?: boolean;
}

export const SafeMessageRenderer: React.FC<SafeMessageRendererProps> = ({ 
  content, 
  className = "",
  tag: Tag = "div",
  enableNHSStyling = true
}) => {
  // Automatically add NHS styling classes if enabled
  const nhsClassName = enableNHSStyling 
    ? `message-content ai-response-content ${className}`.trim()
    : className;
  const [sanitizedContent, setSanitizedContent] = useState<string>('');

  useEffect(() => {
    const processSanitization = async () => {
      // Clean AI response content by removing separators and extra blank lines
      const cleanAIContent = (text: string): string => {
        return text
          .replace(/^---+\s*$/gm, '') // Remove lines with only dashes
          .replace(/^\s*---+\s*$/gm, '') // Remove lines with dashes and whitespace only
          .replace(/^---+\s+(.+)$/gm, '$1') // Remove leading dashes from content lines
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple blank lines with single blank line
          .replace(/^\s+$/gm, '') // Remove lines with only whitespace
          .trim();
      };

      // Normalize content for better markdown processing
      const normalizeContent = (text: string): string => {
        return text
          // Normalize bullet point patterns
          .replace(/^[\s]*[•\-\*\+]\s+/gm, '- ')
          // Normalize numbered list patterns
          .replace(/^[\s]*(\d+)[\.\)]\s+/gm, '$1. ')
          // Ensure proper line breaks before list items
          .replace(/([^\n])\n([\s]*[\-\*\+•])/gm, '$1\n\n$2')
          .replace(/([^\n])\n([\s]*\d+[\.\)])/gm, '$1\n\n$2')
          // Clean up multiple consecutive spaces
          .replace(/[ \t]+/g, ' ')
          // Normalize line endings
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
      };

      // Convert markdown to HTML - enhanced processing
      const markdownToHtml = (text: string): string => {
        let html = normalizeContent(text);
        
        // Process tables first (before other processing)
        html = processMarkdownTables(html);
        
        // Process headers first (h6 to h1 to avoid conflicts)
        html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // Process inline formatting before lists
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
        
        // Enhanced list processing
        // Split into blocks first to handle lists properly
        const blocks = html.split(/\n\s*\n/);
        const processedBlocks = blocks.map(block => {
          const lines = block.split('\n');
          let result = '';
          let currentListType = null;
          let listItems = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for bullet points
            const bulletMatch = line.match(/^[\-\*\+•]\s+(.+)$/);
            const numberMatch = line.match(/^(\d+)\.\s+(.+)$/);
            
            if (bulletMatch) {
              if (currentListType !== 'bullet') {
                // Finish previous list
                if (currentListType === 'number' && listItems.length > 0) {
                  result += `<ol>${listItems.join('')}</ol>\n`;
                }
                currentListType = 'bullet';
                listItems = [];
              }
              listItems.push(`<li>${bulletMatch[1]}</li>`);
            } else if (numberMatch) {
              if (currentListType !== 'number') {
                // Finish previous list
                if (currentListType === 'bullet' && listItems.length > 0) {
                  result += `<ul>${listItems.join('')}</ul>\n`;
                }
                currentListType = 'number';
                listItems = [];
              }
              listItems.push(`<li>${numberMatch[2]}</li>`);
            } else {
              // Finish any current list
              if (currentListType === 'bullet' && listItems.length > 0) {
                result += `<ul>${listItems.join('')}</ul>\n`;
              } else if (currentListType === 'number' && listItems.length > 0) {
                result += `<ol>${listItems.join('')}</ol>\n`;
              }
              currentListType = null;
              listItems = [];
              
              // Add non-list line
              if (line && !line.match(/^<(h[1-6]|table|ul|ol)/)) {
                result += `${line}\n`;
              } else if (line.match(/^<(h[1-6]|table|ul|ol)/)) {
                result += `${line}\n`;
              }
            }
          }
          
          // Finish any remaining list
          if (currentListType === 'bullet' && listItems.length > 0) {
            result += `<ul>${listItems.join('')}</ul>`;
          } else if (currentListType === 'number' && listItems.length > 0) {
            result += `<ol>${listItems.join('')}</ol>`;
          }
          
          return result.trim();
        });
        
        // Join processed blocks and handle paragraphs
        html = processedBlocks.map(block => {
          if (!block) return '';
          
          // Don't wrap if it's already HTML (headers, lists, tables, etc.)
          if (block.match(/^<(h[1-6]|ul|ol|table)/)) {
            return block;
          }
          
          // Split block into lines and process paragraphs
          const lines = block.split('\n').filter(line => line.trim());
          if (lines.length === 0) return '';
          
          // If all lines are already HTML, return as is
          if (lines.every(line => line.match(/^<[^>]+>/))) {
            return lines.join('\n');
          }
          
          // Wrap non-HTML content in paragraphs
          const paragraphContent = lines.join('<br>');
          return `<p>${paragraphContent}</p>`;
        }).filter(block => block).join('\n\n');
        
        return html;
      };

      // Function to convert URLs to clickable links
      const linkifyContent = (text: string): string => {
        // URL regex pattern that excludes trailing punctuation and markdown syntax
        const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-600 underline break-all">$1</a>');
      };

      // Apply content cleaning, markdown conversion, and linkification
      const cleanedContent = cleanAIContent(content);
      const markdownContent = markdownToHtml(cleanedContent);
      const linkedContent = linkifyContent(markdownContent);

      // Sanitize links to only allow NHS-approved URLs
      const linkSanitized = await sanitizeLinks(linkedContent, 'health information');

      // Configure DOMPurify to allow only safe HTML elements and attributes
      const finalContent = DOMPurify.sanitize(linkSanitized, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 'b', 'i', 
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'div', 'span', 'a'
        ],
        ALLOWED_ATTR: [
          'class', 'href', 'title', 'alt', 'target', 'rel', 'id'
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ['target', 'rel'],
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_TRUSTED_TYPE: false
      });

      setSanitizedContent(finalContent);
    };

    processSanitization();
  }, [content]);

  if (!sanitizedContent) {
    return <Tag className={nhsClassName}>Loading...</Tag>;
  }

  return (
    <Tag 
      className={nhsClassName}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

// For plain text content (when HTML is not needed)
export const SafeTextRenderer: React.FC<{ 
  content: string; 
  className?: string;
  preserveWhitespace?: boolean;
}> = ({ content, className = "", preserveWhitespace = false }) => {
  // Strip all HTML tags and render as plain text
  const textContent = DOMPurify.sanitize(content, { 
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true 
  });

  return (
    <div 
      className={className}
      style={{ whiteSpace: preserveWhitespace ? 'pre-wrap' : 'normal' }}
    >
      {textContent}
    </div>
  );
};