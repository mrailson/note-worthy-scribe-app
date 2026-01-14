/**
 * Formats letter content into email-safe HTML with inline styles
 * Works with both complaint letters and AI-generated GP letters
 * Uses only inline styles - no CSS classes or CSS variables (for email client compatibility)
 */

import { parseLetter, cleanMarkdownText, isLetterFormat, ParsedLetter } from './letterParser';

// Email-safe inline styles (hex colours only, no CSS variables)
const EMAIL_STYLES = {
  // Fonts and colours
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  colors: {
    primary: '#2563eb',      // Blue
    primaryDark: '#1e40af',  // Dark blue
    text: '#1f2937',         // Dark grey
    muted: '#4b5563',        // Medium grey
    light: '#6b7280',        // Light grey
    background: '#ffffff',
    accentBg: '#eff6ff',     // Light blue background
    accentBgGradientEnd: '#dbeafe',
    border: '#93c5fd',
  },
  // Size constants
  fontSize: {
    body: '14px',
    heading: '17px',
    signature: '20px',
    small: '13px',
    footer: '11px',
  }
};

/**
 * Converts markdown bold to HTML strong with inline styles
 */
const formatTextWithBold = (text: string): string => {
  return text.replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight: 600; color: ${EMAIL_STYLES.colors.text};">$1</strong>`);
};

/**
 * Cleans text for email display
 */
const cleanForEmail = (text: string): string => {
  return cleanMarkdownText(text)
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '')        // Remove inline code
    .trim();
};

/**
 * Renders body paragraphs with proper email styling
 */
const renderBodyParagraphs = (paragraphs: string[]): string => {
  let html = '';
  
  paragraphs.forEach((paragraph) => {
    const text = cleanForEmail(paragraph);
    if (!text) return;
    
    // Skip reference numbers that appear as standalone lines
    if (/^Reference Number:\s*COMP\d+$/i.test(text)) return;
    
    // Handle "Dear" salutation line
    if (text.toLowerCase().startsWith('dear ')) {
      html += `<p style="margin: 0 0 24px 0; font-size: ${EMAIL_STYLES.fontSize.body}; font-weight: 600; color: ${EMAIL_STYLES.colors.text}; line-height: 1.6; font-family: ${EMAIL_STYLES.fontFamily};">${formatTextWithBold(text)}</p>`;
      return;
    }
    
    // Handle "Re:" or "Subject:" lines with accent box
    if (text.toLowerCase().startsWith('re:') || text.toLowerCase().startsWith('subject:')) {
      html += `<div style="background-color: ${EMAIL_STYLES.colors.accentBg}; padding: 16px 18px; border-radius: 8px; border-left: 4px solid ${EMAIL_STYLES.colors.primary}; margin: 0 0 24px 0;">
        <p style="margin: 0; font-weight: 700; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-family: ${EMAIL_STYLES.fontFamily};">${formatTextWithBold(text)}</p>
      </div>`;
      return;
    }
    
    // Regular paragraphs
    html += `<p style="margin: 0 0 16px 0; color: ${EMAIL_STYLES.colors.text}; font-size: ${EMAIL_STYLES.fontSize.body}; line-height: 1.7; font-family: ${EMAIL_STYLES.fontFamily};">${formatTextWithBold(text)}</p>`;
  });
  
  return html;
};

/**
 * Renders the signature block for email
 */
const renderSignatureBlock = (
  closing: string | undefined, 
  signature: ParsedLetter['signature']
): string => {
  let html = `<div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid ${EMAIL_STYLES.colors.primary};">`;
  
  // Closing phrase
  if (closing) {
    html += `<p style="margin: 0 0 28px 0; color: ${EMAIL_STYLES.colors.text}; font-size: 15px; font-weight: 500; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(closing)},</p>`;
  }
  
  // Name
  if (signature.name) {
    html += `<p style="margin: 0 0 4px 0; font-size: ${EMAIL_STYLES.fontSize.signature}; font-weight: 700; color: ${EMAIL_STYLES.colors.primaryDark}; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(signature.name)}</p>`;
  }
  
  // Qualifications
  if (signature.qualifications) {
    html += `<p style="margin: 0 0 2px 0; color: ${EMAIL_STYLES.colors.muted}; font-size: ${EMAIL_STYLES.fontSize.small}; line-height: 1.4; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(signature.qualifications)}</p>`;
  }
  
  // Title/Role
  if (signature.title) {
    html += `<p style="margin: 0 0 2px 0; color: ${EMAIL_STYLES.colors.muted}; font-size: ${EMAIL_STYLES.fontSize.small}; line-height: 1.4; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(signature.title)}</p>`;
  }
  
  // Organisation
  if (signature.organisation) {
    html += `<p style="margin: 0; color: ${EMAIL_STYLES.colors.muted}; font-size: ${EMAIL_STYLES.fontSize.small}; line-height: 1.4; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(signature.organisation)}</p>`;
  }
  
  html += '</div>';
  return html;
};

/**
 * Formats letter content into email-safe HTML
 * Uses only inline styles for maximum email client compatibility
 */
export const formatLetterForEmail = (letterContent: string, logoUrl?: string | null): string => {
  const parsed = parseLetter(letterContent);
  
  // Build the complete HTML email with inline styles only
  let html = `
    <div style="max-width: 700px; margin: 0 auto; background-color: ${EMAIL_STYLES.colors.background}; font-family: ${EMAIL_STYLES.fontFamily};">
  `;
  
  // Main content section
  html += `<div style="padding: 32px 28px;">`;
  
  // Date section (if present)
  if (parsed.date) {
    html += `<p style="margin: 0 0 24px 0; text-align: right; color: ${EMAIL_STYLES.colors.muted}; font-size: ${EMAIL_STYLES.fontSize.body}; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(parsed.date)}</p>`;
  }
  
  // Recipient address block
  if (parsed.headerSection.toLines && parsed.headerSection.toLines.length > 0) {
    html += '<div style="margin-bottom: 24px;">';
    parsed.headerSection.toLines.forEach((line, index) => {
      const weight = index === 0 ? 'font-weight: 600;' : '';
      html += `<p style="margin: 0 0 4px 0; color: ${EMAIL_STYLES.colors.text}; font-size: ${EMAIL_STYLES.fontSize.body}; ${weight} font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(line)}</p>`;
    });
    html += '</div>';
  }
  
  // Subject line
  if (parsed.subject) {
    html += `<div style="background-color: ${EMAIL_STYLES.colors.accentBg}; padding: 16px 18px; border-radius: 8px; border-left: 4px solid ${EMAIL_STYLES.colors.primary}; margin: 0 0 24px 0;">
      <p style="margin: 0; font-weight: 700; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-family: ${EMAIL_STYLES.fontFamily};">Re: ${cleanForEmail(parsed.subject)}</p>
    </div>`;
  }
  
  // Salutation
  if (parsed.salutation) {
    html += `<p style="margin: 0 0 20px 0; font-size: ${EMAIL_STYLES.fontSize.body}; font-weight: 600; color: ${EMAIL_STYLES.colors.text}; line-height: 1.6; font-family: ${EMAIL_STYLES.fontFamily};">${cleanForEmail(parsed.salutation)},</p>`;
  }
  
  // Body paragraphs
  if (parsed.bodyParagraphs.length > 0) {
    html += `<div style="margin-bottom: 24px;">${renderBodyParagraphs(parsed.bodyParagraphs)}</div>`;
  }
  
  // Signature section
  if (parsed.closing || parsed.signature.name) {
    html += renderSignatureBlock(parsed.closing, parsed.signature);
  }
  
  html += '</div>'; // Close main content
  
  // Footer with generated by notice
  html += `
    <div style="background-color: ${EMAIL_STYLES.colors.accentBg}; padding: 20px 28px; border-top: 2px solid ${EMAIL_STYLES.colors.border};">
      <p style="margin: 0; text-align: center; font-size: ${EMAIL_STYLES.fontSize.footer}; color: ${EMAIL_STYLES.colors.light}; font-style: italic; font-family: ${EMAIL_STYLES.fontFamily};">
        Generated by AI4GP Practice Management System
      </p>
    </div>
  `;
  
  html += '</div>'; // Close main wrapper
  
  return html;
};

/**
 * Converts generic markdown/text content to email-safe HTML
 * For non-letter content (meeting notes, summaries, etc.)
 */
export const convertToEmailSafeHTML = (content: string): string => {
  if (!content) return '';
  
  // Check if this is a letter format - use letter formatter
  if (isLetterFormat(content)) {
    return formatLetterForEmail(content);
  }
  
  // Clean content
  let text = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/<!--.*?-->/gs, '')    // Remove HTML comments
    .trim();
  
  // Split into lines for processing
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }
    
    // Heading 1 (# Title or **TITLE**)
    if (/^#\s+/.test(line) || /^\*\*[A-Z\s]+\*\*$/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const headingText = cleanMarkdownText(line.replace(/^#\s+/, ''));
      html += `<h1 style="font-size: 22px; font-weight: bold; color: ${EMAIL_STYLES.colors.primary}; margin: 24px 0 16px 0; font-family: ${EMAIL_STYLES.fontFamily};">${headingText}</h1>`;
      continue;
    }
    
    // Heading 2 (## Title)
    if (/^##\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const headingText = cleanMarkdownText(line.replace(/^##\s+/, ''));
      html += `<h2 style="font-size: 18px; font-weight: 600; color: ${EMAIL_STYLES.colors.primary}; margin: 20px 0 12px 0; font-family: ${EMAIL_STYLES.fontFamily};">${headingText}</h2>`;
      continue;
    }
    
    // Heading 3 (### Title)
    if (/^###\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const headingText = cleanMarkdownText(line.replace(/^###\s+/, ''));
      html += `<h3 style="font-size: 16px; font-weight: 600; color: ${EMAIL_STYLES.colors.primary}; margin: 16px 0 10px 0; font-family: ${EMAIL_STYLES.fontFamily};">${headingText}</h3>`;
      continue;
    }
    
    // Bullet points
    if (/^[-•*]\s+/.test(line)) {
      if (!inList) {
        html += `<ul style="margin: 12px 0; padding-left: 24px;">`;
        inList = true;
      }
      const bulletText = formatTextWithBold(cleanMarkdownText(line.replace(/^[-•*]\s+/, '')));
      html += `<li style="margin-bottom: 8px; color: ${EMAIL_STYLES.colors.text}; font-size: ${EMAIL_STYLES.fontSize.body}; line-height: 1.6; font-family: ${EMAIL_STYLES.fontFamily};">${bulletText}</li>`;
      continue;
    }
    
    // Numbered lists
    if (/^\d+\.\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const listText = formatTextWithBold(cleanMarkdownText(line.replace(/^\d+\.\s+/, '')));
      html += `<p style="margin: 0 0 8px 16px; color: ${EMAIL_STYLES.colors.text}; font-size: ${EMAIL_STYLES.fontSize.body}; line-height: 1.6; font-family: ${EMAIL_STYLES.fontFamily};">${line.match(/^\d+/)?.[0]}. ${listText}</p>`;
      continue;
    }
    
    // Regular paragraph
    if (inList) { html += '</ul>'; inList = false; }
    const paraText = formatTextWithBold(cleanMarkdownText(line));
    html += `<p style="margin: 0 0 12px 0; color: ${EMAIL_STYLES.colors.text}; font-size: ${EMAIL_STYLES.fontSize.body}; line-height: 1.6; font-family: ${EMAIL_STYLES.fontFamily};">${paraText}</p>`;
  }
  
  if (inList) html += '</ul>';
  
  // Wrap in container
  return `
    <div style="max-width: 700px; margin: 0 auto; background-color: ${EMAIL_STYLES.colors.background}; font-family: ${EMAIL_STYLES.fontFamily}; padding: 24px;">
      ${html}
    </div>
  `;
};
