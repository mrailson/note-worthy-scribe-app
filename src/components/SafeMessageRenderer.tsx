import React from 'react';
import DOMPurify from 'dompurify';

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
  // Function to convert URLs to clickable links
  const linkifyContent = (text: string): string => {
    // URL regex pattern that excludes trailing punctuation and markdown syntax
    const urlRegex = /(https?:\/\/[^\s<>")\]]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-600 underline break-all">$1</a>');
  };

  // Clean AI response content by removing separators and extra blank lines
  const cleanAIContent = (text: string): string => {
    return text
      .replace(/^---+\s*$/gm, '') // Remove lines with only dashes
      .replace(/^\s*---+\s*$/gm, '') // Remove lines with dashes and whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple blank lines with single blank line
      .replace(/^\s+$/gm, '') // Remove lines with only whitespace
      .trim();
  };

  // Apply content cleaning and linkification before sanitization
  const cleanedContent = cleanAIContent(content);
  const linkedContent = linkifyContent(cleanedContent.replace(/\n/g, '<br/>'));

  // Configure DOMPurify to allow only safe HTML elements and attributes
  const cleanContent = DOMPurify.sanitize(linkedContent, {
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

  return (
    <Tag 
      className={className}
      dangerouslySetInnerHTML={{ __html: cleanContent }}
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