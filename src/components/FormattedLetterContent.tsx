import React, { useEffect, useState } from 'react';
import { parseLetterContent, FormattedContent } from '@/utils/letterFormatter';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { supabase } from '@/integrations/supabase/client';

interface FormattedLetterContentProps {
  content: string;
  practiceId?: string | null;
  signatoryUserId?: string | null;
}

interface PracticeDetails {
  logo_url: string | null;
  practice_logo_url: string | null;
  phone: string | null;
  email: string | null;
  practice_name: string | null;
}

interface SignatoryProfile {
  full_name: string | null;
  title: string | null;
  email: string | null;
}

export const FormattedLetterContent: React.FC<FormattedLetterContentProps> = ({
  content,
  practiceId = null,
  signatoryUserId = null,
}) => {
  const [practiceLogoUrl, setPracticeLogoUrl] = useState<string | null>(null);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const [signatoryProfile, setSignatoryProfile] = useState<SignatoryProfile | null>(null);

  // Extract practice logo URL from HTML comment if present
  const logoUrlMatch = content.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
  const embeddedLogoUrl = logoUrlMatch ? logoUrlMatch[1] : null;

  // Fetch practice details (logo/phone/email) and signatory details
  useEffect(() => {
    const fetchLetterDetails = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Practice details
        let resolvedPractice: PracticeDetails | null = null;

        // 1) If a specific practice_details id is provided, try that first
        if (practiceId) {
          const { data, error } = await supabase
            .from('practice_details')
            .select('logo_url, practice_logo_url, phone, email, practice_name')
            .eq('id', practiceId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching practice details by practiceId:', error);
          }
          resolvedPractice = (data as PracticeDetails | null) ?? null;
        }

        // 2) Otherwise (or if not found), use the user's default practice details
        if (!resolvedPractice) {
          const { data, error } = await supabase
            .from('practice_details')
            .select('logo_url, practice_logo_url, phone, email, practice_name')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle();

          if (error) {
            console.error('Error fetching default practice details:', error);
          }

          resolvedPractice = (data as PracticeDetails | null) ?? null;
        }

        // 3) Final fallback: most recently updated practice details row
        if (!resolvedPractice) {
          const { data, error } = await supabase
            .from('practice_details')
            .select('logo_url, practice_logo_url, phone, email, practice_name')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (error) {
            console.error('Error fetching practice details fallback:', error);
          }

          resolvedPractice = Array.isArray(data) ? (data[0] as PracticeDetails) : null;
        }

        if (resolvedPractice) {
          setPracticeDetails(resolvedPractice);
          const logoUrl = embeddedLogoUrl || resolvedPractice.practice_logo_url || resolvedPractice.logo_url;
          setPracticeLogoUrl(logoUrl);
        } else if (embeddedLogoUrl) {
          setPracticeLogoUrl(embeddedLogoUrl);
        }

        // Signatory profile (e.g. the person who decided the outcome)
        if (signatoryUserId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, title, email')
            .eq('user_id', signatoryUserId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching signatory profile:', error);
          }

          setSignatoryProfile((data as SignatoryProfile | null) ?? null);
        } else {
          setSignatoryProfile(null);
        }
      } catch (error) {
        console.error('Error fetching letter details:', error);
        if (embeddedLogoUrl) setPracticeLogoUrl(embeddedLogoUrl);
      }
    };

    fetchLetterDetails();
  }, [embeddedLogoUrl, practiceId, signatoryUserId]);
  
  // Replace placeholder text with actual practice details
  const replacePlaceholders = (text: string): string => {
    let result = text;
    if (practiceDetails?.phone) {
      result = result.replace(/\[Practice phone number\]/gi, practiceDetails.phone);
      result = result.replace(/\[Practice phone\]/gi, practiceDetails.phone);
    }
    if (practiceDetails?.email) {
      result = result.replace(/\[Practice email\]/gi, practiceDetails.email);
    }
    if (practiceDetails?.practice_name) {
      result = result.replace(/\[Practice name\]/gi, practiceDetails.practice_name);
    }
    return result;
  };
  
  // Remove the logo metadata comment from content for parsing
  const cleanContent = replacePlaceholders(content)
    .replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown image syntax
    .replace(/\[.*?Logo\/Letterhead.*?\]/gi, '') // Remove letterhead placeholder text
    .replace(/```plaintext|```/g, ''); // Remove code block markers
  
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
      {practiceLogoUrl && (
        <div className="p-4 text-center">
          <img 
            src={practiceLogoUrl}
            alt="Practice Logo" 
            className="h-12 w-auto mx-auto object-contain"
          />
        </div>
      )}

      {/* Letter Content */}
      <div className="p-8 pt-2 space-y-6">
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
          {bodyLines.length > 0 && (() => {
            // Separate special lines (Dear, Re:) from regular content
            const specialLines: React.ReactNode[] = [];
            const regularContent: string[] = [];
            
            bodyLines.forEach((line, index) => {
              const trimmedLine = line.trim();
              
              // Handle "Dear" line specially
              if (trimmedLine.toLowerCase().startsWith('dear ')) {
                specialLines.push(
                  <p key={`dear-${index}`} className="text-lg font-medium mb-6">
                    {formatTextWithBold(trimmedLine)}
                  </p>
                );
                return;
              }
              
              // Handle "Re:" line specially
              if (trimmedLine.toLowerCase().startsWith('re:')) {
                specialLines.push(
                  <div key={`re-${index}`} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500 mb-6">
                    <p className="font-semibold text-gray-900">
                      {formatTextWithBold(trimmedLine)}
                    </p>
                  </div>
                );
                return;
              }
              
              // Add to regular content for markdown processing
              regularContent.push(line);
            });
            
            // Process regular content as one markdown block for proper table/list handling
            const regularContentBlock = regularContent.join('\n');
            
            return (
              <>
                {specialLines}
                {regularContentBlock.trim() && (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: renderNHSMarkdown(regularContentBlock, { enableNHSStyling: true })
                    }}
                  />
                )}
              </>
            );
          })()}
        </div>

        {/* Signature Section */}
        {signatureSection.length > 0 && (
          <div className="mt-8 pt-6">
            <div className="space-y-2">
              {signatureSection.map((line, index) => {
                const trimmedLine = line.trim().replace(/```plaintext|```/g, '').trim();
                
                // Handle closing line
                if (trimmedLine.toLowerCase().includes('yours sincerely') || 
                    trimmedLine.toLowerCase().includes('yours faithfully') ||
                    trimmedLine.toLowerCase().includes('kind regards')) {
                  return (
                    <p key={index} className="text-gray-800 mb-8">
                      {formatTextWithBold(trimmedLine)}
                    </p>
                  );
                }
                
                // Handle signature name (usually in italics or bold)
                if (trimmedLine.includes('*') || index === 1) {
                  const resolvedName =
                    signatoryProfile?.full_name && (index === 1 || /complaints team/i.test(trimmedLine))
                      ? signatoryProfile.full_name
                      : trimmedLine.replace(/\*/g, '');

                  return (
                    <div key={index} className="mt-6">
                      <p className="text-xl font-bold text-blue-800 mb-1">
                        {resolvedName}
                      </p>
                    </div>
                  );
                }
                
                // Handle title, qualifications, practice name, etc.
                return (
                  <p key={index} className="text-gray-600 text-sm leading-tight mb-0">
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
              <p key={index} className="text-sm text-gray-600 leading-tight">
                {formatTextWithBold(line)}
              </p>
            ))}
          </div>
        )}
        
        {/* Separator line */}
        <div className="border-t border-gray-300 pt-3">
          <div className="text-center text-xs text-gray-500">
            <p>This letter was generated by the Notewell AI Complaints Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
};