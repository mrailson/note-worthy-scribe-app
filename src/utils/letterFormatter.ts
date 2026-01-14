import { Document, Paragraph, TextRun, AlignmentType, Header, Footer, ImageRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType } from 'docx';
import { supabase } from '@/integrations/supabase/client';

export interface FormattedContent {
  type: 'text' | 'bold' | 'heading';
  content: string;
}

export interface LetterDetails {
  signatoryName: string | null;
  practiceDetails: {
    phone: string | null;
    email: string | null;
    practice_name: string | null;
  } | null;
}

// Fetch signatory and practice details for letter generation
export async function fetchLetterDetails(signatoryUserId?: string | null): Promise<LetterDetails> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { signatoryName: null, practiceDetails: null };

    let signatoryName: string | null = null;
    let practiceDetails: LetterDetails['practiceDetails'] = null;

    // Fetch signatory profile
    if (signatoryUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', signatoryUserId)
        .maybeSingle();
      signatoryName = profile?.full_name || null;
    }

    // Fetch practice details - try default first, then fallback
    const { data: defaultPractice } = await supabase
      .from('practice_details')
      .select('phone, email, practice_name')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .maybeSingle();

    if (defaultPractice) {
      practiceDetails = defaultPractice;
    } else {
      // Fallback to most recent
      const { data: practices } = await supabase
        .from('practice_details')
        .select('phone, email, practice_name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (practices && practices.length > 0) {
        practiceDetails = practices[0];
      }
    }

    return { signatoryName, practiceDetails };
  } catch (error) {
    console.error('Error fetching letter details:', error);
    return { signatoryName: null, practiceDetails: null };
  }
}

export function parseLetterContent(content: string): FormattedContent[] {
  const lines = content.split('\n');
  const formatted: FormattedContent[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      formatted.push({ type: 'text', content: '\n' });
      continue;
    }

    // Check for bold text patterns (**text**)
    if (trimmedLine.includes('**')) {
      const parts = trimmedLine.split(/(\*\*.*?\*\*)/);
      parts.forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          formatted.push({ 
            type: 'bold', 
            content: part.slice(2, -2) 
          });
        } else if (part.trim()) {
          formatted.push({ 
            type: 'text', 
            content: part 
          });
        }
      });
      formatted.push({ type: 'text', content: '\n' });
    } else {
      // Regular text
      formatted.push({ 
        type: 'text', 
        content: trimmedLine + '\n'
      });
    }
  }

  return formatted;
}

export async function createLetterDocument(
  letterContent: string, 
  letterType: string, 
  referenceNumber: string,
  signatoryName?: string | null,
  practiceDetails?: { phone?: string | null; email?: string | null; practice_name?: string | null } | null
): Promise<Document> {
  // Extract logo URL from HTML comment if present
  const logoUrlMatch = letterContent.match(/<!--\s*logo_url:\s*(https?:\/\/[^\s\n]+|\/[^\s\n]+)\s*-->/);
  const logoUrl = logoUrlMatch ? logoUrlMatch[1] : null;
  
  // Replace placeholders with actual practice details
  let processedContent = letterContent;
  if (practiceDetails?.phone) {
    processedContent = processedContent.replace(/\[Practice phone number\]/gi, practiceDetails.phone);
    processedContent = processedContent.replace(/\[Practice phone\]/gi, practiceDetails.phone);
    processedContent = processedContent.replace(/\[[^\]]+\s+phone\s*number\]/gi, practiceDetails.phone);
    processedContent = processedContent.replace(/\[[^\]]+\s+phone\]/gi, practiceDetails.phone);
  }
  if (practiceDetails?.email) {
    processedContent = processedContent.replace(/\[Practice email\]/gi, practiceDetails.email);
    processedContent = processedContent.replace(/\[[^\]]+\s+email\]/gi, practiceDetails.email);
    // Replace hallucinated email patterns
    processedContent = processedContent.replace(/[a-z]+\.?surgery@nhs\.net/gi, practiceDetails.email);
    processedContent = processedContent.replace(/[a-z]+\.practice@nhs\.net/gi, practiceDetails.email);
  }
  if (practiceDetails?.practice_name) {
    processedContent = processedContent.replace(/\[Practice name\]/gi, practiceDetails.practice_name);
  }
  
  // Remove the logo metadata comment from content for parsing
  const cleanContent = processedContent
    .replace(/<!--\s*logo_url:.*?-->\s*\n*/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown image syntax
    .replace(/```[\s\S]*?$/g, '') // Remove markdown code blocks at the end
    .replace(/```/g, '') // Remove any stray backticks
    .trim();
  
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

  const formatTextWithBold = (text: string): TextRun[] => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    const runs: TextRun[] = [];
    
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Calibri"
        }));
      } else if (part.trim()) {
        runs.push(new TextRun({
          text: part,
          font: "Calibri"
        }));
      }
    });
    
    return runs;
  };

  // Build document sections
  const documentChildren: Paragraph[] = [];

  // Add logo at the top center with actual image embedding
  if (logoUrl) {
    try {
      const imageResponse = await fetch(logoUrl);
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        const uint8Array = new Uint8Array(imageBuffer);

        // Compute dimensions preserving aspect ratio within bounds
        let targetWidth = 200;
        let targetHeight = 80;
        try {
          const tempImg = document.createElement('img');
          const objectUrl = URL.createObjectURL(imageBlob);
          await new Promise<void>((resolve, reject) => {
            tempImg.onload = () => resolve();
            tempImg.onerror = () => reject(new Error('Image load failed'));
            tempImg.src = objectUrl;
          });
          const naturalW = tempImg.naturalWidth || tempImg.width;
          const naturalH = tempImg.naturalHeight || tempImg.height;
          URL.revokeObjectURL(objectUrl);

          if (naturalW && naturalH) {
            const maxW = 280; // max width in pixels
            const maxH = 120; // max height in pixels
            const aspectRatio = naturalW / naturalH;
            
            // Scale to fit within bounds while preserving aspect ratio
            if (naturalW > maxW || naturalH > maxH) {
              if (maxW / aspectRatio <= maxH) {
                // Width is the limiting factor
                targetWidth = maxW;
                targetHeight = Math.round(maxW / aspectRatio);
              } else {
                // Height is the limiting factor
                targetHeight = maxH;
                targetWidth = Math.round(maxH * aspectRatio);
              }
            } else {
              // Image is smaller than max, use natural size
              targetWidth = naturalW;
              targetHeight = naturalH;
            }
          }
        } catch (_) {
          // keep defaults
        }

        documentChildren.push(new Paragraph({
          children: [
            new ImageRun({
              data: uint8Array,
              transformation: { width: targetWidth, height: targetHeight },
              type: logoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }));
      } else {
        throw new Error('Failed to fetch logo image');
      }
    } catch (error) {
      console.error('Error embedding logo in Word document:', error);
      // Fallback to practice name only
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: "OAK LANE MEDICAL PRACTICE",
            size: 20,
            bold: true,
            color: "1f4e79",
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }));
    }
  }

  // Date (right aligned)
  if (dateSection) {
    documentChildren.push(new Paragraph({
      children: [
        new TextRun({
          text: dateSection,
          size: 22,
          font: "Calibri"
        })
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 300 }
    }));
  }

  // Private & Confidential (centered)
  documentChildren.push(new Paragraph({
    children: [
      new TextRun({
        text: "PRIVATE & CONFIDENTIAL",
        bold: true,
        size: 20,
        color: "c5504b",
        font: "Calibri"
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 }
  }));

  // Addressee section - compact spacing for envelope window
  addresseeSection.forEach(line => {
    documentChildren.push(new Paragraph({
      children: formatTextWithBold(line),
      spacing: { after: 0, line: 240, lineRule: "auto" } // Single line spacing, no paragraph gap
    }));
  });

  // Add spacing after addressee
  if (addresseeSection.length > 0) {
    documentChildren.push(new Paragraph({
      children: [new TextRun("")],
      spacing: { after: 200 }
    }));
  }

  // Body content
  bodyLines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Handle "Dear" line specially
    if (trimmedLine.toLowerCase().startsWith('dear ')) {
      documentChildren.push(new Paragraph({
        children: formatTextWithBold(trimmedLine),
        spacing: { after: 300 }
      }));
      return;
    }
    
    // Handle "Re:" line specially
    if (trimmedLine.toLowerCase().startsWith('re:')) {
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmedLine.replace(/\*\*/g, ''),
            bold: true,
            size: 22,
            font: "Calibri"
          })
        ],
        spacing: { after: 300 }
      }));
      return;
    }
    
    // Regular paragraph
    documentChildren.push(new Paragraph({
      children: formatTextWithBold(trimmedLine),
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED
    }));
  });

  // Signature section
  if (signatureSection.length > 0) {
    // Add spacing before signature
    documentChildren.push(new Paragraph({
      children: [new TextRun("")],
      spacing: { after: 400 }
    }));

    signatureSection.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Handle closing line
      if (trimmedLine.toLowerCase().includes('yours sincerely') || 
          trimmedLine.toLowerCase().includes('yours faithfully') ||
          trimmedLine.toLowerCase().includes('kind regards')) {
        documentChildren.push(new Paragraph({
          children: formatTextWithBold(trimmedLine),
          spacing: { after: 600 }
        }));
        return;
      }
      
      // Handle signature name (usually bold) - use provided signatory name if available
      if (trimmedLine.includes('*') || index === 1) {
        // Check if this is a generic "Complaints Team" line and we have a real signatory name
        const isGenericTeamName = /complaints?\s*team/i.test(trimmedLine);
        const displayName = (signatoryName && isGenericTeamName) 
          ? signatoryName 
          : trimmedLine.replace(/\*/g, '');
        
        documentChildren.push(new Paragraph({
          children: [
            new TextRun({
              text: displayName,
              bold: true,
              size: 24,
              color: "1f4e79",
              font: "Calibri"
            })
          ],
          spacing: { after: 100 }
        }));
        return;
      }
      
      // Handle title, qualifications, practice name, etc.
      documentChildren.push(new Paragraph({
        children: formatTextWithBold(trimmedLine),
        spacing: { after: 100 }
      }));
    });
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,  // 1 inch
            bottom: 1440, // 1 inch
            left: 1440,   // 1 inch
          },
        },
      },
      children: documentChildren
    }],
    creator: "Notewell AI Complaints Management System",
    title: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} Letter - ${referenceNumber}`,
    description: `${letterType === 'acknowledgement' ? 'Acknowledgement' : 'Outcome'} letter for complaint ${referenceNumber}`,
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22
          },
          paragraph: {
            spacing: {
              line: 360,
              lineRule: "auto"
            }
          }
        }
      }
    }
  });
}