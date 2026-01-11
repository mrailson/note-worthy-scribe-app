import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageGenerationRequest {
  prompt: string;
  conversationContext: string;
  documentContent?: string;  // Content from attached files for visual generation
  imageModel?: 'google/gemini-2.5-flash-image-preview' | 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-pro';
  practiceContext?: {
    practiceName?: string;
    pcnName?: string;
    organisationType?: string;
    practiceAddress?: string;
    practicePhone?: string;
    practiceEmail?: string;
    practiceWebsite?: string;
    logoUrl?: string;
    // New branding options
    brandingLevel?: 'none' | 'name-only' | 'name-contact' | 'full' | 'custom';
    customBranding?: {
      name?: boolean;
      address?: boolean;
      phone?: boolean;
      email?: boolean;
      website?: boolean;
      pcn?: boolean;
    };
  };
  requestType: 'chart' | 'diagram' | 'infographic' | 'calendar' | 'poster' | 'logo' | 'qrcode' | 'leaflet' | 'newsletter' | 'social' | 'waiting-room' | 'form-header' | 'campaign' | 'general';
  includeBranding?: boolean;  // Option to include practice branding
}

// Extract URL or text content from QR code request
function extractQRContent(prompt: string): string {
  // Try to find a URL in the prompt
  const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return urlMatch[0];
  }
  
  // Try to find content after common phrases
  const patterns = [
    /qr\s*code\s*(?:to|for|with|containing|linking\s*to)[:\s]*(.+)/i,
    /create\s*(?:a\s*)?qr\s*code[:\s]*(.+)/i,
    /generate\s*(?:a\s*)?qr\s*code[:\s]*(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fall back to the entire prompt if nothing specific found
  return prompt;
}

// Extract clean keywords from document content for accurate text rendering
function extractCleanKeywords(documentContent: string): string[] {
  const keywords: string[] = [];
  const lines = documentContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines or very long lines (paragraphs)
    if (!trimmed || trimmed.length > 80) continue;
    
    // Extract capitalised words/phrases (likely headings or proper nouns)
    const matches = trimmed.match(/[A-Z][A-Za-z]+(?:\s+[A-Za-z]+){0,4}/g);
    if (matches) {
      keywords.push(...matches.filter(m => m.length >= 4 && m.length <= 40));
    }
  }
  
  // Return unique keywords, limited to prevent prompt bloat
  return [...new Set(keywords)].slice(0, 25);
}

// Common spelling corrections reference
const SPELLING_REFERENCE = `
MANDATORY SPELLING - COPY THESE EXACTLY:
- "Collaborative" (NOT Collobrative/Collabrative)
- "Unifying" / "Unified" (NOT Unuifying/Uniified)
- "Professional" (NOT Proffesional/Profesional)
- "Development" (NOT Developement/Develoment)
- "Neighbourhood" (NOT Neighlorhood/Neigbourhood)
- "Commissioning" (NOT Commisssing/Comissioning)
- "Representation" (NOT Representatiok/Representaion)
- "Resilience" (NOT Resilence/Resillience)
- "Productivity" (NOT Producivity/Productivty)
- "Organisation" (NOT Organiztion/Organsation)
- "Fragmented" (NOT Fragenttned/Fragmeneted)
- "Statutory" (NOT Statuory/Statutary)
- "Meeting" (NOT Meetion/Meetting)
- "Directors" (NOT Directons/Direectors)
- "Executive" (NOT Executve/Excecutive)
- "Clinical" (NOT Clinial/Clincal)
- "Practice" (NOT Practise when noun)
- "Provider" (NOT Providor/Providar)
- "Services" (NOT Servces/Serivces)
- "Forum" (NOT Fonum/Fourm)
`;

// Build practice branding section for prompts based on user's selected branding level
function buildBrandingSection(practiceContext: ImageGenerationRequest['practiceContext'], requestType: string): string {
  if (!practiceContext) return '';
  
  const brandingLevel = practiceContext.brandingLevel || 'full';
  const customBranding = practiceContext.customBranding;
  
  // If user chose 'none', return empty string
  if (brandingLevel === 'none') {
    return '';
  }
  
  // Determine what to include based on branding level
  const includeName = brandingLevel === 'full' || brandingLevel === 'name-only' || brandingLevel === 'name-contact' || 
                      (brandingLevel === 'custom' && customBranding?.name);
  const includePhone = brandingLevel === 'full' || brandingLevel === 'name-contact' || 
                       (brandingLevel === 'custom' && customBranding?.phone);
  const includeEmail = brandingLevel === 'full' || brandingLevel === 'name-contact' || 
                       (brandingLevel === 'custom' && customBranding?.email);
  const includeAddress = brandingLevel === 'full' || (brandingLevel === 'custom' && customBranding?.address);
  const includeWebsite = brandingLevel === 'full' || (brandingLevel === 'custom' && customBranding?.website);
  const includePcn = brandingLevel === 'full' || (brandingLevel === 'custom' && customBranding?.pcn);
  
  // Build list of ONLY the details that are both selected AND actually have values
  const availableDetails: string[] = [];
  
  if (includeName && practiceContext.practiceName && practiceContext.practiceName.trim()) {
    availableDetails.push(`Practice Name: "${practiceContext.practiceName}"`);
  }
  if (includePhone && practiceContext.practicePhone && practiceContext.practicePhone.trim()) {
    availableDetails.push(`Phone: "${practiceContext.practicePhone}"`);
  }
  if (includeEmail && practiceContext.practiceEmail && practiceContext.practiceEmail.trim()) {
    availableDetails.push(`Email: "${practiceContext.practiceEmail}"`);
  }
  if (includeAddress && practiceContext.practiceAddress && practiceContext.practiceAddress.trim()) {
    availableDetails.push(`Address: "${practiceContext.practiceAddress}"`);
  }
  if (includeWebsite && practiceContext.practiceWebsite && practiceContext.practiceWebsite.trim()) {
    availableDetails.push(`Website: "${practiceContext.practiceWebsite}"`);
  }
  if (includePcn && practiceContext.pcnName && practiceContext.pcnName.trim()) {
    availableDetails.push(`PCN: "${practiceContext.pcnName}"`);
  }
  
  // If no actual details are available, return empty - DO NOT generate branding
  if (availableDetails.length === 0) {
    return `

⚠️ CRITICAL - NO BRANDING AVAILABLE:
No practice details have been provided. DO NOT include ANY practice name, phone number, email, address, website, logo, or any other branding on this image.
DO NOT INVENT OR HALLUCINATE any practice details. DO NOT use placeholder text like "Oak Lane Medical Practice", "0123 456789", "info@example.org", or "AB12 3CD".
The image should have NO practice branding whatsoever - just focus on the content requested.
`;
  }
  
  // Build the branding section with ONLY the available details
  let branding = `

⚠️ MANDATORY PRACTICE BRANDING - USE ONLY THESE EXACT DETAILS:
The following are the ONLY practice details available. Copy them EXACTLY as shown:

`;
  
  for (const detail of availableDetails) {
    branding += `• ${detail}\n`;
  }
  
  branding += `

🚫 CRITICAL ANTI-HALLUCINATION RULES:
1. Use ONLY the exact details listed above - copy them character-for-character
2. DO NOT invent, create, or hallucinate ANY additional details
3. If a detail is not listed above, DO NOT include it on the image
4. DO NOT add a logo unless a logo URL was provided above
5. DO NOT add a phone number unless one was provided above
6. DO NOT add an email unless one was provided above
7. DO NOT add an address or postcode unless one was provided above
8. DO NOT add a website unless one was provided above

🚫 FORBIDDEN - DO NOT USE ANY OF THESE:
- Made-up practice names like "Oak Lane Medical Practice", "Riverside Surgery", "Dr Smith's Practice"
- Fake phone numbers like "0123 456789", "01onal 123456", "020 7123 4567"
- Fake emails like "info@oaklanepractice.org", "contact@example.com"
- Fake postcodes like "AB12 3CD", "SW1A 1AA", "M1 1AA"
- Fake addresses like "123 High Street", "1 Example Road"
- Any placeholder text in [square brackets] or <angle brackets>
- Any logo unless specifically provided

Display ONLY the details listed above, positioned professionally on the image.
`;
  
  return branding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { prompt, conversationContext, documentContent, practiceContext, requestType, imageModel } = await req.json() as ImageGenerationRequest;

    // Use selected model or default to Nano Banana
    const selectedImageModel = imageModel || 'google/gemini-2.5-flash-image-preview';

    console.log('🎨 AI4GP Image Generation request:', { 
      prompt: prompt.substring(0, 100), 
      requestType,
      imageModel: selectedImageModel,
      contextLength: conversationContext?.length || 0,
      hasDocumentContent: !!documentContent,
      hasPracticeContext: !!practiceContext,
      practiceName: practiceContext?.practiceName || 'NOT PROVIDED',
      practicePhone: practiceContext?.practicePhone || 'NOT PROVIDED'
    });

    // Handle QR code generation separately using the qrcode library
    if (requestType === 'qrcode') {
      console.log('📱 Generating QR code with qrcode library...');
      
      const qrContent = extractQRContent(prompt);
      console.log('QR content extracted:', qrContent.substring(0, 100));
      
      try {
        // Generate QR code as SVG string (works in Deno without canvas)
        const qrSvg = await QRCode.toString(qrContent, {
          type: 'svg',
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });
        
        // Convert SVG to data URL
        const svgBase64 = btoa(qrSvg);
        const qrDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
        
        console.log('✅ QR code generated successfully');
        
        return new Response(JSON.stringify({
          success: true,
          image: {
            url: qrDataUrl,
            alt: 'QR code',
            prompt: `QR code for: ${qrContent.substring(0, 100)}`,
            requestType: 'qrcode'
          },
          textResponse: `I've created a QR code that links to: ${qrContent}\n\nYou can download it using the button below the image. The QR code is scannable with any smartphone camera or QR reader app.`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (qrError) {
        console.error('QR code generation error:', qrError);
        throw new Error(`Failed to generate QR code: ${qrError.message}`);
      }
    }

    // Build comprehensive prompt for the Gemini image model (non-QR requests)
    const typeDescriptions: Record<string, string> = {
      chart: 'data visualisation chart with clear labels and legends',
      diagram: 'process flow diagram or structural diagram',
      infographic: 'informative visual summary with icons and key points',
      calendar: 'calendar or schedule grid layout',
      poster: 'professional notice or poster',
      logo: 'professional logo or brand mark',
      // New practice communication types
      leaflet: 'patient information leaflet with clear sections, headings and NHS-style design',
      newsletter: 'practice newsletter header or section with welcoming, professional design',
      social: 'social media post graphic optimised for Facebook/Instagram (square format)',
      'waiting-room': 'waiting room display poster with large, clear text readable from distance',
      'form-header': 'professional document header or letterhead with clean, formal design',
      campaign: 'health campaign promotional material with clear call-to-action',
      general: 'image or visual'
    };

    // Build image prompt based on request type
    let imagePrompt: string;
    
    if (requestType === 'logo') {
      // Logo-specific prompt
      imagePrompt = `${prompt}

Style: Professional logo or brand mark

Logo Design Requirements:
- Clean, simple design that works at any size (scalable)
- Memorable and distinctive
- Professional appearance suitable for letterheads, signage, and digital use
- Works well on both light and dark backgrounds
- No complex gradients or tiny details that won't scale
- Modern, trustworthy aesthetic
- Use simple shapes and clean lines
- Maximum 2-3 colours

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (requestType === 'infographic' && documentContent) {
      // Infographic with document content - generate visual FROM the document
      // Extract keywords for accurate spelling reference
      const extractedKeywords = extractCleanKeywords(documentContent);
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      
      imagePrompt = `Create a professional single-page infographic that visualises the following content.

SOURCE CONTENT TO VISUALISE:
${documentContent.substring(0, 5000)}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below
- Good visual hierarchy with headings, subheadings and body text

${SPELLING_REFERENCE}
${keywordReference}

INFOGRAPHIC DESIGN REQUIREMENTS:
- Create an ACTUAL visual infographic image, NOT a text description
- Professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility and readability

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (requestType === 'infographic') {
      // Infographic without document content - use prompt directly
      imagePrompt = `Create a professional single-page infographic.

${prompt}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below

${SPELLING_REFERENCE}

INFOGRAPHIC DESIGN REQUIREMENTS:
- Create an ACTUAL visual infographic image, NOT a text description
- Professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (['chart', 'diagram', 'poster'].includes(requestType) && documentContent) {
      // Visual types WITH document content - generate visual FROM the document
      const extractedKeywords = extractCleanKeywords(documentContent);
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      const brandingSection = buildBrandingSection(practiceContext, requestType);

      imagePrompt = `Create a professional ${typeDescriptions[requestType]} that visualises the following content.

SOURCE CONTENT TO VISUALISE:
${documentContent.substring(0, 5000)}

USER REQUEST:
${prompt}
${brandingSection}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below

${SPELLING_REFERENCE}
${keywordReference}

DESIGN REQUIREMENTS:
- Create an ACTUAL visual ${requestType} image, NOT a text description
- Professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility and readability

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (requestType === 'leaflet') {
      // Patient information leaflet
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      const extractedKeywords = documentContent ? extractCleanKeywords(documentContent) : [];
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      
      imagePrompt = `Create a professional patient information leaflet.

${prompt}
${documentContent ? `\nSOURCE CONTENT:\n${documentContent.substring(0, 5000)}` : ''}
${brandingSection}

LEAFLET DESIGN REQUIREMENTS:
- A4 portrait format, suitable for printing
- Clear sections with headings and subheadings
- NHS-style colour palette (blues, teals, white backgrounds)
- Patient-friendly, accessible design
- Large, readable text (minimum 12pt equivalent)
- Clear visual hierarchy
- Include relevant icons or simple illustrations
- Space for key information, contact details

${SPELLING_REFERENCE}
${keywordReference}

Content guidelines:
- Keep all content professional and patient-appropriate
- Use plain English, avoid medical jargon
- Include clear action points or next steps if relevant`;
    } else if (requestType === 'newsletter') {
      // Practice newsletter header/section
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      
      imagePrompt = `Create a professional practice newsletter header or section.

${prompt}
${brandingSection}

NEWSLETTER DESIGN REQUIREMENTS:
- Modern, welcoming design
- Professional but friendly aesthetic
- Suitable for digital or print newsletters
- Include space for practice name/logo
- Seasonal or themed elements if appropriate
- Clear typography for headlines
- NHS-appropriate colour scheme (blues, teals, warm accents)

${SPELLING_REFERENCE}

Content guidelines:
- Keep all content professional and welcoming
- Suitable for patients and staff alike`;
    } else if (requestType === 'social') {
      // Social media post image
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      
      imagePrompt = `Create a social media post image.

${prompt}
${brandingSection}

SOCIAL MEDIA DESIGN REQUIREMENTS:
- Square format (1080x1080 pixels / 1:1 aspect ratio)
- Bold, eye-catching design
- Large, readable text that works at small sizes
- Engagement-focused with clear message
- NHS-appropriate colour scheme
- Simple, uncluttered layout
- Include call-to-action if relevant (e.g., "Book Now", "Learn More")
${practiceContext?.practiceName ? `- MUST display the practice name "${practiceContext.practiceName}" prominently at top or bottom` : ''}
${practiceContext?.practicePhone ? `- MUST include contact number "${practiceContext.practicePhone}" visibly on the image` : ''}

${SPELLING_REFERENCE}

Content guidelines:
- Keep all content professional and social media appropriate
- Suitable for Facebook, Instagram, or Twitter/X
- NO placeholder text - use the real practice details provided above`;
    } else if (requestType === 'waiting-room') {
      // Waiting room display poster
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      
      imagePrompt = `Create a waiting room display poster.

${prompt}
${brandingSection}

WAITING ROOM DISPLAY REQUIREMENTS:
- Large, clear text readable from 2-3 metres distance
- Landscape format (suitable for TV screens or notice boards)
- High contrast colours for visibility
- Simple, uncluttered design
- Key message immediately visible
- NHS-style professional appearance
- Include relevant icons or simple graphics

${SPELLING_REFERENCE}

Content guidelines:
- Keep all content professional and patient-appropriate
- Clear, actionable information`;
    } else if (requestType === 'form-header') {
      // Document header/letterhead
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      
      imagePrompt = `Create a professional document header or letterhead.

${prompt}
${brandingSection}

LETTERHEAD DESIGN REQUIREMENTS:
- Clean, formal design
- Professional appearance suitable for official documents
- Space for practice name, logo, and contact details
- Works well on A4 paper
- Minimal but elegant design
- NHS-appropriate colour scheme
- Clear typography

${SPELLING_REFERENCE}

Content guidelines:
- Keep all content professional and formal
- Suitable for official correspondence and documents`;
    } else if (requestType === 'campaign') {
      // Health campaign promotional material
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      const extractedKeywords = documentContent ? extractCleanKeywords(documentContent) : [];
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      
      imagePrompt = `Create a health campaign promotional poster.

${prompt}
${documentContent ? `\nCAMPAIGN INFORMATION:\n${documentContent.substring(0, 3000)}` : ''}
${brandingSection}

CAMPAIGN DESIGN REQUIREMENTS:
- Action-oriented, motivating design
- Clear call-to-action (e.g., "Book Your Appointment", "Get Checked")
- Prominent date/time information if relevant
- NHS-style colour scheme with emphasis colours for urgency
- Professional but engaging design
- Clear key message visible at a glance
- Include relevant health icons or imagery

${SPELLING_REFERENCE}
${keywordReference}

Content guidelines:
- Keep all content professional and health-appropriate
- Encourage positive health behaviours
- Include relevant booking or contact information`;
    } else {
      // Standard prompt for other request types without document content
      const brandingSection = buildBrandingSection(practiceContext, requestType);
      
      imagePrompt = `${prompt}
${brandingSection}

Style: ${typeDescriptions[requestType] || 'visual'}

Requirements:
- Follow the user's request exactly as specified
- Professional, clean design with good visual hierarchy
- Clear, readable typography if text is needed
- High contrast for accessibility
- Do NOT add any healthcare, NHS, or medical branding unless explicitly requested
- Do NOT add charts, schedules, or data visualisations unless explicitly requested
- Keep the image focused on what the user asked for

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    }

    console.log('🖼️ Generating image with model:', selectedImageModel);

    // Call Lovable AI Gateway with selected image model
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedImageModel,
        messages: [
          { role: 'user', content: imagePrompt }
        ],
        modalities: ['image', 'text']
      }),
    });

    // Handle rate limits and payment errors
    if (response.status === 429) {
      console.error('Rate limit exceeded');
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please try again in a moment.',
        code: 'RATE_LIMIT',
        success: false
      }), { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (response.status === 402) {
      console.error('Payment required');
      return new Response(JSON.stringify({
        error: 'Usage limit reached. Please check your Lovable workspace credits.',
        code: 'PAYMENT_REQUIRED',
        success: false
      }), { 
        status: 402, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image was generated. Please try rephrasing your request.');
    }

    console.log('✅ Image generated successfully');

    const descriptions: Record<string, string> = {
      chart: 'Data visualisation chart',
      diagram: 'Process or structure diagram',
      infographic: 'Visual information summary',
      calendar: 'Schedule or calendar visualisation',
      poster: 'Professional poster or notice',
      logo: 'Professional logo',
      // New practice communication types
      leaflet: 'Patient information leaflet',
      newsletter: 'Practice newsletter visual',
      social: 'Social media post image',
      'waiting-room': 'Waiting room display',
      'form-header': 'Document header/letterhead',
      campaign: 'Health campaign poster',
      general: 'Visual representation'
    };

    const description = descriptions[requestType] || 'Generated visual';

    // Build response with appropriate message
    let responseText = textContent || `I've created a ${description.toLowerCase()} based on your request. You can download it using the button below the image.`;
    
    // Add spelling disclaimer for visual types that contain text
    const textHeavyTypes = ['infographic', 'chart', 'diagram', 'poster', 'leaflet', 'newsletter', 'waiting-room', 'form-header', 'campaign'];
    if (textHeavyTypes.includes(requestType)) {
      responseText += `\n\n**Note:** AI-generated images may occasionally contain minor text variations. For documents requiring precise text, consider using the **PowerPoint generator** instead (just ask "create a presentation from this document") where all text is fully editable.`;
    }

    return new Response(JSON.stringify({
      success: true,
      image: {
        url: imageUrl,
        alt: description,
        prompt: imagePrompt.substring(0, 300),
        requestType
      },
      textResponse: responseText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ AI4GP Image Generation error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate image',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
