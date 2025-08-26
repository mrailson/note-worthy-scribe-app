import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { sanitizeLinks } from '@/utils/nhsUrlValidation';

interface SafeMessageRendererProps {
  content: string;
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
}

export const SafeMessageRenderer: React.FC<SafeMessageRendererProps> = ({ 
  content, 
  className = "",
  tag: Tag = "div" 
}) => {
  const [sanitizedContent, setSanitizedContent] = useState<string>('');

  useEffect(() => {
    const processSanitization = async () => {
      // Clean AI response content by removing separators and extra blank lines
      const cleanAIContent = (text: string): string => {
        return text
          .replace(/^---+\s*$/gm, '') // Remove lines with only dashes
          .replace(/^\s*---+\s*$/gm, '') // Remove lines with dashes and whitespace
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple blank lines with single blank line
          .replace(/^\s+$/gm, '') // Remove lines with only whitespace
          .trim();
      };

      // Convert markdown to HTML
      const markdownToHtml = (text: string): string => {
        // Split into lines and process
        const lines = text.split('\n');
        const result: string[] = [];
        let inList = false;
        let listType = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip empty lines but preserve them for paragraph breaks
          if (!line) {
            // Close any open list
            if (inList) {
              result.push(`</${listType}>`);
              inList = false;
            }
            // Add paragraph break for multiple empty lines
            if (result.length > 0 && !result[result.length - 1].includes('<br/>')) {
              result.push('<br/>');
            }
            continue;
          }
          
          // Headers (process from most specific to least specific)
          if (line.startsWith('######')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h6>${line.substring(6).trim()}</h6>`);
          } else if (line.startsWith('#####')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h5>${line.substring(5).trim()}</h5>`);
          } else if (line.startsWith('####')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h4>${line.substring(4).trim()}</h4>`);
          } else if (line.startsWith('###')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h3>${line.substring(3).trim()}</h3>`);
          } else if (line.startsWith('##')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h2>${line.substring(2).trim()}</h2>`);
          } else if (line.startsWith('#')) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h1>${line.substring(1).trim()}</h1>`);
          }
          // Bullet points
          else if (line.match(/^[•\-\*]\s/)) {
            const content = line.replace(/^[•\-\*]\s/, '').trim();
            if (!inList || listType !== 'ul') {
              if (inList) result.push(`</${listType}>`);
              result.push('<ul>');
              inList = true;
              listType = 'ul';
            }
            result.push(`<li>${content}</li>`);
          }
          // Numbered lists
          else if (line.match(/^\d+\.\s/)) {
            const content = line.replace(/^\d+\.\s/, '').trim();
            if (!inList || listType !== 'ol') {
              if (inList) result.push(`</${listType}>`);
              result.push('<ol>');
              inList = true;
              listType = 'ol';
            }
            result.push(`<li>${content}</li>`);
          }
          // Regular paragraph text
          else {
            if (inList) {
              result.push(`</${listType}>`);
              inList = false;
            }
            
            // Process inline formatting
            let processedLine = line
              // Bold text
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/__(.*?)__/g, '<strong>$1</strong>')
              // Italic text
              .replace(/(?<!\*)\*([^\*]+?)\*(?!\*)/g, '<em>$1</em>')
              .replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
            
            result.push(`<p>${processedLine}</p>`);
          }
        }
        
        // Close any remaining open list
        if (inList) {
          result.push(`</${listType}>`);
        }
        
        return result.join('\n');
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
      const linkedContent = linkifyContent(markdownContent.replace(/\n/g, '<br/>'));

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
    return <Tag className={className}>Loading...</Tag>;
  }

  return (
    <Tag 
      className={className}
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