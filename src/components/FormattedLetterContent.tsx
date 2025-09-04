import React from 'react';
import { parseLetterContent, FormattedContent } from '@/utils/letterFormatter';

interface FormattedLetterContentProps {
  content: string;
}

export const FormattedLetterContent: React.FC<FormattedLetterContentProps> = ({ content }) => {
  // Extract practice logo URL from HTML comment if present
  const logoUrlMatch = content.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
  const logoUrl = logoUrlMatch ? logoUrlMatch[1] : null;
  
  console.log('FormattedLetterContent debug:', {
    contentStart: content.substring(0, 200),
    logoUrlMatch,
    logoUrl
  });
  
  console.log('Logo URL check:', { logoUrl, hasLogoUrl: !!logoUrl, type: typeof logoUrl });
  
  // Remove the logo metadata comment from content for parsing
  const cleanContent = content.replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '');
  
  // Parse content into sections
  const lines = cleanContent.split('\n').filter(line => line.trim());
  
  // Extract different sections
  let headerLines: string[] = [];
  let dateSection = '';
  let addresseeSection: string[] = [];
  let bodyLines: string[] = [];
  let signatureSection: string[] = [];
  
  let currentSection = 'header';
  let bodyStarted = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Detect date (starts with day number and contains month/year)
    if (/^\*?\*?\d{1,2}[\s]*([A-Z][a-z]+|\w+)[\s]*\d{4}\*?\*?/.test(line)) {
      dateSection = line.replace(/\*\*/g, '');
      currentSection = 'addressee';
      continue;
    }
    
    // Detect private/confidential
    if (line.toLowerCase().includes('private') && line.toLowerCase().includes('confidential')) {
      currentSection = 'addressee';
      continue;
    }
    
    // Detect addressee (patient name, address)
    if (currentSection === 'addressee' && !bodyStarted) {
      if (line.toLowerCase().includes('dear ') || line.includes('Re:')) {
        bodyStarted = true;
        currentSection = 'body';
        bodyLines.push(line);
      } else {
        addresseeSection.push(line);
      }
      continue;
    }
    
    // Detect signature section (starts with "Yours sincerely" or similar)
    if (line.toLowerCase().includes('yours sincerely') || 
        line.toLowerCase().includes('yours faithfully') ||
        line.toLowerCase().includes('kind regards')) {
      currentSection = 'signature';
      signatureSection.push(line);
      continue;
    }
    
    // Assign to appropriate section
    if (currentSection === 'header' && !bodyStarted) {
      headerLines.push(line);
    } else if (currentSection === 'body') {
      bodyLines.push(line);
    } else if (currentSection === 'signature') {
      signatureSection.push(line);
    }
  }

  const formatTextWithBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg">
      {/* Practice Logo at Top Center */}
      {logoUrl && (
        <div className="p-8 text-center border-b border-gray-100">
          <img 
            src={logoUrl}
            alt="Practice Logo" 
            className="h-48 w-auto mx-auto object-contain"
            onLoad={() => console.log('Logo loaded successfully:', logoUrl)}
            onError={(e) => {
              console.error('Logo failed to load:', logoUrl, e);
              console.error('Image element:', e.currentTarget);
              // Don't hide on error, let's see what happens
            }}
            style={{
              border: '2px solid red',
              minHeight: '100px',
              display: 'block'
            }}
          />
        </div>
      )}

      {/* Letter Content */}
      <div className="p-8 space-y-6">
        {/* Date */}
        {dateSection && (
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-700">{dateSection}</p>
          </div>
        )}

        {/* Private & Confidential */}
        <div className="text-center">
          <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">
            Private & Confidential
          </p>
        </div>

        {/* Addressee */}
        {addresseeSection.length > 0 && (
          <div className="space-y-1">
            {addresseeSection.map((line, index) => (
              <p key={index} className="text-gray-800">
                {formatTextWithBold(line)}
              </p>
            ))}
          </div>
        )}

        {/* Body Content */}
        <div className="space-y-4 text-gray-800 leading-relaxed">
          {bodyLines.map((line, index) => {
            const trimmedLine = line.trim();
            
            // Handle "Dear" line specially
            if (trimmedLine.toLowerCase().startsWith('dear ')) {
              return (
                <p key={index} className="text-lg font-medium mb-6">
                  {formatTextWithBold(trimmedLine)}
                </p>
              );
            }
            
            // Handle "Re:" line specially
            if (trimmedLine.toLowerCase().startsWith('re:')) {
              return (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500 mb-6">
                  <p className="font-semibold text-gray-900">
                    {formatTextWithBold(trimmedLine)}
                  </p>
                </div>
              );
            }
            
            // Regular paragraph
            return (
              <p key={index} className="mb-4 text-justify">
                {formatTextWithBold(trimmedLine)}
              </p>
            );
          })}
        </div>

        {/* Signature Section */}
        {signatureSection.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="space-y-3">
              {signatureSection.map((line, index) => {
                const trimmedLine = line.trim();
                
                // Handle closing line
                if (trimmedLine.toLowerCase().includes('yours sincerely') || 
                    trimmedLine.toLowerCase().includes('yours faithfully') ||
                    trimmedLine.toLowerCase().includes('kind regards')) {
                  return (
                    <p key={index} className="text-gray-800 mb-4">
                      {formatTextWithBold(trimmedLine)}
                    </p>
                  );
                }
                
                // Handle signature name (usually in italics or bold)
                if (trimmedLine.includes('*') || index === 1) {
                  return (
                    <div key={index} className="mt-6">
                      <p className="text-xl font-bold text-blue-800 mb-1">
                        {trimmedLine.replace(/\*/g, '')}
                      </p>
                    </div>
                  );
                }
                
                // Handle title, qualifications, practice name, etc.
                return (
                  <p key={index} className="text-gray-600 text-sm leading-relaxed">
                    {formatTextWithBold(trimmedLine)}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Practice Information */}
      <div className="bg-gray-50 px-8 py-6 border-t-2 border-gray-200">
        {/* Practice Information */}
        {headerLines.length > 0 && (
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-blue-800 mb-2">
              {headerLines[0].replace(/\*\*/g, '')}
            </h3>
            {headerLines.slice(1).map((line, index) => (
              <p key={index} className="text-sm text-gray-600 leading-relaxed">
                {formatTextWithBold(line)}
              </p>
            ))}
          </div>
        )}
        
        {/* Separator line */}
        <div className="border-t border-gray-300 pt-3">
          <div className="text-center text-xs text-gray-500">
            <p>This letter was generated by the NHS Complaints Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
};