/**
 * Formats acknowledgement letter content into HTML for email with proper styling
 * Matches the layout and design of the Word document and FormattedLetterContent component
 */

interface LetterSections {
  headerLines: string[];
  dateSection: string;
  addresseeSection: string[];
  bodyLines: string[];
  signatureSection: string[];
}

const formatTextWithBold = (text: string): string => {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
};

const parseLetter = (content: string): LetterSections => {
  // Remove logo metadata and markdown image syntax
  const cleanContent = content
    .replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '');
  
  const lines = cleanContent.split('\n').filter(line => line.trim());
  
  const sections: LetterSections = {
    headerLines: [],
    dateSection: '',
    addresseeSection: [],
    bodyLines: [],
    signatureSection: []
  };
  
  let currentSection = 'header';
  let bodyStarted = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Detect date
    if (/^\*?\*?\d{1,2}[\s]*([A-Z][a-z]+|\w+)[\s]*\d{4}\*?\*?/.test(line)) {
      sections.dateSection = line.replace(/\*\*/g, '');
      currentSection = 'addressee';
      continue;
    }
    
    // Skip private/confidential
    if (line.toLowerCase().includes('private') && line.toLowerCase().includes('confidential')) {
      currentSection = 'addressee';
      continue;
    }
    
    // Detect addressee
    if (currentSection === 'addressee' && !bodyStarted) {
      if (line.toLowerCase().includes('dear ') || line.includes('Re:')) {
        bodyStarted = true;
        currentSection = 'body';
        sections.bodyLines.push(line);
      } else {
        sections.addresseeSection.push(line);
      }
      continue;
    }
    
    // Detect signature
    if (line.toLowerCase().includes('yours sincerely') || 
        line.toLowerCase().includes('yours faithfully') ||
        line.toLowerCase().includes('kind regards')) {
      currentSection = 'signature';
      sections.signatureSection.push(line);
      continue;
    }
    
    // Assign to sections
    if (currentSection === 'header' && !bodyStarted) {
      sections.headerLines.push(line);
    } else if (currentSection === 'body') {
      sections.bodyLines.push(line);
    } else if (currentSection === 'signature') {
      sections.signatureSection.push(line);
    }
  }
  
  return sections;
};

const renderBodyLines = (bodyLines: string[]): string => {
  let html = '';
  
  bodyLines.forEach((line) => {
    const trimmedLine = line.trim();
    
    // Handle "Dear" line
    if (trimmedLine.toLowerCase().startsWith('dear ')) {
      html += `<p style="margin: 0 0 24px 0; font-size: 16px; font-weight: 500; color: #1a1a1a; line-height: 1.5;">${formatTextWithBold(trimmedLine)}</p>`;
      return;
    }
    
    // Handle "Re:" line
    if (trimmedLine.toLowerCase().startsWith('re:')) {
      html += `<div style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; border-left: 4px solid #0066cc; margin: 0 0 24px 0;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a; font-size: 14px;">${formatTextWithBold(trimmedLine)}</p>
      </div>`;
      return;
    }
    
    // Regular paragraphs
    html += `<p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 14px; line-height: 1.6;">${formatTextWithBold(trimmedLine)}</p>`;
  });
  
  return html;
};

export const formatLetterForEmail = (letterContent: string, logoUrl?: string | null): string => {
  const sections = parseLetter(letterContent);
  
  // Build the complete HTML email
  let html = `
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; font-family: Arial, sans-serif;">
  `;
  
  // Main content section
  html += `<div style="padding: 32px;">`;
  
  // Date
  if (sections.dateSection) {
    html += `
      <div style="text-align: right; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">${sections.dateSection}</p>
      </div>
    `;
  }
  
  // Private & Confidential
  html += `
    <div style="text-align: center; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em;">
        Private & Confidential
      </p>
    </div>
  `;
  
  // Body
  if (sections.bodyLines.length > 0) {
    html += `<div style="margin-bottom: 32px;">${renderBodyLines(sections.bodyLines)}</div>`;
  }
  
  // Signature
  if (sections.signatureSection.length > 0) {
    html += `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid #e5e7eb;">
    `;
    
    sections.signatureSection.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Closing line
      if (trimmedLine.toLowerCase().includes('yours sincerely') || 
          trimmedLine.toLowerCase().includes('yours faithfully') ||
          trimmedLine.toLowerCase().includes('kind regards')) {
        html += `<p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 14px;">${formatTextWithBold(trimmedLine)}</p>`;
        return;
      }
      
      // Signature name
      if (trimmedLine.includes('*') || index === 1) {
        html += `
          <div style="margin-top: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1e40af;">${trimmedLine.replace(/\*/g, '')}</p>
          </div>
        `;
        return;
      }
      
      // Title, qualifications, etc.
      html += `<p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px;">${formatTextWithBold(trimmedLine)}</p>`;
    });
    
    html += `</div>`;
  }
  
  html += `</div>`; // Close main content
  
  // Footer with practice information
  if (sections.headerLines.length > 0) {
    html += `
      <div style="background-color: #f8f9fa; padding: 24px 32px; border-top: 2px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1e40af;">${sections.headerLines[0].replace(/\*\*/g, '')}</h3>
    `;
    
    sections.headerLines.slice(1).forEach(line => {
      html += `<p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">${formatTextWithBold(line)}</p>`;
    });
    
    html += `
        </div>
        <div style="border-top: 1px solid #d1d5db; padding-top: 12px;">
          <p style="margin: 0; text-align: center; font-size: 11px; color: #9ca3af;">
            This letter was generated by the Notewell AI Complaints Management System
          </p>
        </div>
      </div>
    `;
  }
  
  html += `</div>`; // Close main wrapper
  
  return html;
};
