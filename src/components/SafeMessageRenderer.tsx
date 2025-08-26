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
        return text
          // Headers (process from most specific to least specific)
          .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
          .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
          .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          // Bold text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/__(.*?)__/g, '<strong>$1</strong>')
          // Italic text  
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/_(.*?)_/g, '<em>$1</em>')
          // Convert line breaks to temporary markers first
          .replace(/\n/g, '|||LINEBREAK|||')
          // Bullet points (handle multiple lines)
          .replace(/^\* (.*)$/gm, '<li>$1</li>')
          .replace(/^- (.*)$/gm, '<li>$1</li>')
          // Numbered lists
          .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
          // Wrap consecutive list items in ul/ol tags
          .replace(/(<li>.*?<\/li>)(\|\|\|LINEBREAK\|\|\|<li>.*?<\/li>)+/g, (match) => {
            // Check if it's a numbered list by looking for digits
            const isNumbered = /^\d+\./.test(match);
            const tag = isNumbered ? 'ol' : 'ul';
            return `<${tag}>${match.replace(/\|\|\|LINEBREAK\|\|\|/g, '')}</${tag}>`;
          })
          // Handle single list items
          .replace(/^<li>(.*?)<\/li>$/gm, '<ul><li>$1</li></ul>')
          // Restore line breaks
          .replace(/\|\|\|LINEBREAK\|\|\|/g, '\n');
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