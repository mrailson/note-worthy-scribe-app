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
  // Remove all HTML comments and markdown image syntax
  const cleanContent = content
    .replace(/<!--.*?-->\s*/gs, '')
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
    
    // Handle "Dear" line with enhanced styling
    if (trimmedLine.toLowerCase().startsWith('dear ')) {
      html += `<p style="margin: 0 0 28px 0; font-size: 17px; font-weight: 600; color: #111827; line-height: 1.5;">${formatTextWithBold(trimmedLine)}</p>`;
      return;
    }
    
    // Handle "Re:" line with enhanced box styling
    if (trimmedLine.toLowerCase().startsWith('re:') || trimmedLine.toLowerCase().startsWith('subject:')) {
      html += `<div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 18px 20px; border-radius: 8px; border-left: 5px solid #2563eb; margin: 0 0 28px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <p style="margin: 0; font-weight: 700; color: #1e40af; font-size: 15px;">${formatTextWithBold(trimmedLine)}</p>
      </div>`;
      return;
    }
    
    // Regular paragraphs with better readability
    html += `<p style="margin: 0 0 18px 0; color: #1f2937; font-size: 14px; line-height: 1.7;">${formatTextWithBold(trimmedLine)}</p>`;
  });
  
  return html;
};

export const formatLetterForEmail = (letterContent: string, logoUrl?: string | null): string => {
  const sections = parseLetter(letterContent);
  
  // Build the complete HTML email
  let html = `
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  `;
  
  // Main content section
  html += `<div style="padding: 40px 32px;">`;
  
  
  
  
  // Body
  if (sections.bodyLines.length > 0) {
    html += `<div style="margin-bottom: 32px;">${renderBodyLines(sections.bodyLines)}</div>`;
  }
  
  // Signature with enhanced styling
  if (sections.signatureSection.length > 0) {
    html += `
      <div style="margin-top: 40px; padding-top: 28px; border-top: 3px solid #3b82f6;">
    `;
    
    let nameShown = false;
    sections.signatureSection.forEach((line, index) => {
      const trimmedLine = line.trim().replace(/```plaintext|```/g, '').trim();
      
      if (!trimmedLine) return;
      
      // Closing line
      if (trimmedLine.toLowerCase().includes('yours sincerely') || 
          trimmedLine.toLowerCase().includes('yours faithfully') ||
          trimmedLine.toLowerCase().includes('kind regards')) {
        html += `<p style="margin: 0 0 32px 0; color: #1f2937; font-size: 15px; font-weight: 500;">${formatTextWithBold(trimmedLine)}</p>`;
        return;
      }
      
      // Signature name (show only once)
      if (!nameShown && (trimmedLine.includes('*') || index === 1)) {
        html += `
          <div style="margin-bottom: 6px;">
            <p style="margin: 0; font-size: 20px; font-weight: 700; color: #1e40af; text-transform: none;">${trimmedLine.replace(/\*/g, '')}</p>
          </div>
        `;
        nameShown = true;
        return;
      }
      
      // Skip if it's a duplicate of the name
      if (nameShown) {
        const cleanName = sections.signatureSection.find(l => l.includes('*'))?.replace(/\*/g, '').trim();
        if (cleanName && trimmedLine === cleanName) {
          return; // Skip duplicate name
        }
      }
      
      // Title, qualifications, practice name - with tighter spacing (skip address lines)
      const isAddressLine = trimmedLine.match(/^\d+\s+.*(street|road|lane|avenue|close)/i) || 
                            trimmedLine.match(/^(northampton|london|birmingham|manchester|leeds)/i) ||
                            trimmedLine.match(/^[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}$/i); // UK postcode pattern
      
      if (!isAddressLine) {
        html += `<p style="margin: 0 0 2px 0; color: #4b5563; font-size: 13px; line-height: 1.4;">${formatTextWithBold(trimmedLine)}</p>`;
      }
    });
    
    html += `</div>`;
  }
  
  html += `</div>`; // Close main content
  
  // Footer with practice information - enhanced styling
  if (sections.headerLines.length > 0) {
    html += `
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 28px 32px; border-top: 3px solid #2563eb; margin-top: 20px;">
        <div style="text-align: center; margin-bottom: 18px;">
          <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em;">${sections.headerLines[0].replace(/\*\*/g, '')}</h3>
    `;
    
    sections.headerLines.slice(1).forEach(line => {
      html += `<p style="margin: 0 0 4px 0; font-size: 13px; color: #4b5563; line-height: 1.4;">${formatTextWithBold(line)}</p>`;
    });
    
    html += `
        </div>
        <div style="border-top: 2px solid #93c5fd; padding-top: 14px;">
          <p style="margin: 0; text-align: center; font-size: 11px; color: #6b7280; font-style: italic;">
            Generated by Notewell AI Complaints Management System
          </p>
        </div>
      </div>
    `;
  }
  
  html += `</div>`; // Close main wrapper
  
  return html;
};
