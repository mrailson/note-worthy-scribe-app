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
          .replace(/^\s*---+\s*$/gm, '') // Remove lines with dashes and whitespace only
          .replace(/^---+\s+(.+)$/gm, '$1') // Remove leading dashes from content lines
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple blank lines with single blank line
          .replace(/^\s+$/gm, '') // Remove lines with only whitespace
          .trim();
      };

      // Convert markdown to HTML - using improved regex approach
      const markdownToHtml = (text: string): string => {
        let html = text;
        
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
        
        // Handle bullet points and numbered lists
        // First mark list items
        html = html.replace(/^[•\-\*] (.+)$/gm, '<li-bullet>$1</li-bullet>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li-numbered>$1</li-numbered>');
        
        // Group consecutive bullet list items
        html = html.replace(/(<li-bullet>.*?<\/li-bullet>(\n<li-bullet>.*?<\/li-bullet>)*)/gs, (match) => {
          const items = match.replace(/<li-bullet>/g, '<li>').replace(/<\/li-bullet>/g, '</li>');
          return `<ul>${items}</ul>`;
        });
        
        // Group consecutive numbered list items
        html = html.replace(/(<li-numbered>.*?<\/li-numbered>(\n<li-numbered>.*?<\/li-numbered>)*)/gs, (match) => {
          const items = match.replace(/<li-numbered>/g, '<li>').replace(/<\/li-numbered>/g, '</li>');
          return `<ol>${items}</ol>`;
        });
        
        // Handle paragraphs - split by double line breaks and wrap non-HTML content
        const blocks = html.split(/\n\s*\n/);
        html = blocks.map(block => {
          const trimmed = block.trim();
          // Don't wrap if it's already HTML (headers, lists, etc.)
          if (trimmed.match(/^<(h[1-6]|ul|ol|li)/)) {
            return trimmed;
          }
          // Don't wrap empty blocks
          if (!trimmed) {
            return '';
          }
          // Wrap regular text in paragraphs
          return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
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