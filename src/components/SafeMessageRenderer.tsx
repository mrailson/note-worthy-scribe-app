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
  // Simple markdown-to-HTML conversion for basic formatting
  const convertMarkdownToHtml = (text: string): string => {
    return text
      // Convert **bold** to <strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *italic* to <em>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert line breaks to <br> tags
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Convert numbered lists (1. 2. etc.)
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Convert bullet points (- or •)
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      // Wrap in paragraphs
      .replace(/^(.+)$/gm, '<p>$1</p>')
      // Clean up multiple paragraph tags
      .replace(/<\/p><p>/g, '</p>\n<p>')
      // Wrap lists in ul tags
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      // Clean up nested lists
      .replace(/<\/ul>\s*<ul>/g, '')
      // Remove empty paragraphs
      .replace(/<p><\/p>/g, '')
      // Handle headings with numbered prefixes like "1️⃣ **Attendees**"
      .replace(/\d+️⃣\s*<strong>(.*?)<\/strong>/g, '<h3>$1</h3>')
      // Handle section numbers like "## 1️⃣ Attendees"
      .replace(/##\s*\d+️⃣\s*<strong>(.*?)<\/strong>/g, '<h3>$1</h3>')
      // Convert standalone **Section** headers to h3
      .replace(/<p><strong>([^<]*?)<\/strong><\/p>/g, '<h3>$1</h3>');
  };

  // Convert markdown to HTML
  const htmlContent = convertMarkdownToHtml(content);

  // Configure DOMPurify to allow only safe HTML elements and attributes
  const cleanContent = DOMPurify.sanitize(htmlContent, {
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