import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageAttachment {
  name: string;
  content: string;  // Base64 encoded image data
  type: string;     // MIME type
}

interface ImageGenerationRequest {
  prompt: string;
  conversationContext?: string;
  documentContent?: string;  // Content from attached files for visual generation
  imageAttachments?: ImageAttachment[];  // Image files for reference-based generation
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  practiceContext?: {
    practiceName?: string;
    pcnName?: string;
    organisationType?: string;
    practiceAddress?: string;
    practicePhone?: string;
    practiceEmail?: string;
    practiceWebsite?: string;
    logoUrl?: string;
    // Legacy branding options (from practiceContext)
    brandingLevel?: 'none' | 'name-only' | 'name-contact' | 'full' | 'custom';
    customBranding?: {
      name?: boolean;
      address?: boolean;
      phone?: boolean;
      email?: boolean;
      website?: boolean;
      pcn?: boolean;
    };
    includeLogo?: boolean;
  };
  requestType?: 'chart' | 'diagram' | 'infographic' | 'calendar' | 'poster' | 'logo' | 'qrcode' | 'leaflet' | 'newsletter' | 'social' | 'waiting-room' | 'form-header' | 'campaign' | 'general';
  includeBranding?: boolean;  // Option to include practice branding
  
  // Image Studio specific fields
  isStudioRequest?: boolean;
  supportingContent?: string;
  summariseSupportingContent?: boolean;
  keyMessages?: string[];
  targetAudience?: 'patients' | 'staff' | 'public' | 'clinical' | 'elderly' | 'parents' | 'young-adults' | 'executive-board';
  purpose?: 'poster' | 'social' | 'leaflet' | 'newsletter' | 'banner' | 'waiting-room' | 'infographic' | 'campaign' | 'form-header' | 'general';
  stylePreset?: 'nhs-professional' | 'modern-minimal' | 'friendly-welcoming' | 'bold-impactful' | 'clinical-medical' | 'custom';
  colourPalette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  layoutPreference?: 'portrait' | 'landscape' | 'square';
  logoPlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'reserve-space';
  referenceImages?: {
    content: string;
    type: string;
    mode: 'style-reference' | 'edit-source' | 'update-previous';
    instructions?: string;
  }[];
  
  // Logo integration - sends logo as reference image to AI
  logoImage?: {
    content: string;       // Base64 data URL of logo
    placement: string;     // 'top-left', 'top-right', etc.
  };
  
  // Top-level branding settings (Studio requests send these at top level)
  brandingLevel?: 'none' | 'name-only' | 'name-contact' | 'full' | 'custom';
  customBranding?: {
    name?: boolean;
    address?: boolean;
    phone?: boolean;
    email?: boolean;
    website?: boolean;
    pcn?: boolean;
  };
  customPracticeName?: string;  // Override for practice name
  includeLogo?: boolean;
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
MANDATORY SPELLING AND GRAMMAR - COPY THESE EXACTLY:
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
- "Pressure" (NOT prossure/pressue)
- "Control" (NOT contol/contriol)
- "Blood sugar" (NOT blood ssure/bblood sugar)
- "Every day" (NOT evay/eveyday)
- "Do not smoke" / "No smoking" (NOT Nio not smoke)
- "painkillers" (NOT painkers/painkeirs)
- "Check-ups" (NOT checkin/checkkin)

⚠️ CRITICAL TEXT QUALITY REQUIREMENTS:
- ALL text must be grammatically correct with NO typos or spelling errors
- Proofread every word before rendering - if unsure, use simpler phrasing
- Use complete sentences with proper punctuation
- Use British English spelling throughout (e.g., colour, organisation, centre)
- Double-check that no words are repeated accidentally (e.g., "in in" or "high high")
- Ensure consistent capitalisation within headings and bullet points
`;

// Build practice branding section for prompts based on user's selected branding level
function buildBrandingSection(practiceContext: ImageGenerationRequest['practiceContext'], requestType: string, requestBrandingLevel?: string, requestIncludeLogo?: boolean, requestCustomBranding?: ImageGenerationRequest['practiceContext']['customBranding'], editedDetails?: string[], customPracticeName?: string): string {
  // Allow a custom practice name to be used even if the practice context is not available.
  // This prevents the "Custom Practice Name" field from appearing to do nothing.
  const ctx = practiceContext ?? (customPracticeName && customPracticeName.trim()
    ? { practiceName: customPracticeName.trim() }
    : null);

  if (!ctx) return '';
  
  // Use branding settings from request body if provided (Studio requests), otherwise fall back to practiceContext
  const brandingLevel = requestBrandingLevel || ctx.brandingLevel || 'full';
  const customBranding = requestCustomBranding || ctx.customBranding;
  const includeLogo = (requestIncludeLogo !== undefined ? requestIncludeLogo : ctx.includeLogo) && ctx.logoUrl;
  
  // Use custom practice name if provided, otherwise fall back to practiceContext.practiceName
  const effectivePracticeName = (customPracticeName && customPracticeName.trim()) 
    ? customPracticeName.trim() 
    : ctx.practiceName;
  
  // If user chose 'none' and no logo, return empty string
  if (brandingLevel === 'none' && !includeLogo) {
    return '';
  }
  
  // If editedDetails is provided and has items, use those directly instead of building from checkboxes
  // This handles the case where users have manually edited the "Will be included" section
  if (editedDetails && editedDetails.length > 0) {
    const detailsList = editedDetails.map(detail => `- "${detail}"`).join('\n');
    
    let logoInstruction = '';
    if (includeLogo) {
      logoInstruction = `
Additionally, leave a clean, empty rectangular space in the TOP-RIGHT corner for the practice logo.
- This space should be approximately 80-120 pixels in height
- DO NOT write "LOGO", "LOGO HERE" or any placeholder text - leave it completely blank
`;
    }
    
    return `

🏥 PRACTICE BRANDING - INCLUDE THESE EXACT DETAILS:
The following practice details MUST be displayed prominently on the image:
${detailsList}

CRITICAL INSTRUCTIONS:
- Copy these details EXACTLY as shown above - no modifications, no abbreviations
- Display them clearly in the header/footer or appropriate location
- Do NOT invent or add any other practice details
- Ensure the text is legible and professional
${logoInstruction}`;
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
  
  // Use effectivePracticeName (which prioritises customPracticeName)
  if (includeName && effectivePracticeName && effectivePracticeName.trim()) {
    availableDetails.push(`Practice Name: "${effectivePracticeName}"`);
  }
  if (includePhone && ctx.practicePhone && ctx.practicePhone.trim()) {
    availableDetails.push(`Phone: "${ctx.practicePhone}"`);
  }
  if (includeEmail && ctx.practiceEmail && ctx.practiceEmail.trim()) {
    availableDetails.push(`Email: "${ctx.practiceEmail}"`);
  }
  if (includeAddress && ctx.practiceAddress && ctx.practiceAddress.trim()) {
    availableDetails.push(`Address: "${ctx.practiceAddress}"`);
  }
  if (includeWebsite && ctx.practiceWebsite && ctx.practiceWebsite.trim()) {
    availableDetails.push(`Website: "${ctx.practiceWebsite}"`);
  }
  if (includePcn && ctx.pcnName && ctx.pcnName.trim()) {
    availableDetails.push(`PCN: "${ctx.pcnName}"`);
  }
  
  // Handle logo-only case (branding is 'none' but logo is enabled)
  if (brandingLevel === 'none' && includeLogo) {
    return `

🖼️ LOGO SPACE - NO TEXT BRANDING:
The user wants to add their practice logo to this image after generation.

CRITICAL INSTRUCTIONS:
- Leave a clean, empty rectangular space in the TOP-RIGHT corner of the image for logo placement
- This space should be approximately 80-120 pixels in height, with appropriate width
- The space should have a neutral/white/light background that will work well with any logo
- DO NOT write "LOGO", "LOGO HERE", or any placeholder text - leave it COMPLETELY BLANK
- DO NOT include any text-based practice details (no name, phone, email, address, or website)

The empty space should be:
- Clean and professional
- Positioned in the top-right corner
- Sized appropriately for a typical business logo
- Ready for the user to overlay their actual logo after downloading
`;
  }
  
  // If no actual details are available and no logo, return empty - DO NOT generate branding
  if (availableDetails.length === 0 && !includeLogo) {
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
  
  // Add logo space instructions if enabled
  if (includeLogo) {
    branding += `

🖼️ LOGO SPACE:
The user wants to add their practice logo after generation.

CRITICAL - LOGO SPACE INSTRUCTIONS:
- Reserve a clean, empty rectangular space in the TOP-RIGHT corner for logo placement
- This space should be approximately 80-120 pixels in height
- The space MUST have a neutral/white/light background compatible with any logo
- DO NOT write "LOGO", "LOGO HERE", "YOUR LOGO", or ANY placeholder text
- Leave the logo space COMPLETELY BLANK - no text, no icons, no placeholder graphics
- The logo will be added by the user after downloading the image

`;
  }
  
  branding += `
🚫 CRITICAL ANTI-HALLUCINATION RULES:
1. Use ONLY the exact details listed above - copy them character-for-character
2. DO NOT invent, create, or hallucinate ANY additional details
3. If a detail is not listed above, DO NOT include it on the image
4. DO NOT add a logo unless explicitly stated above that a logo should be included
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
- Any logo unless explicitly instructed to include one above

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

    const requestBody = await req.json() as ImageGenerationRequest;
    const { 
      prompt, 
      conversationContext, 
      documentContent, 
      imageAttachments, 
      practiceContext, 
      requestType,
      imageModel,
      // Studio-specific fields
      isStudioRequest,
      supportingContent,
      summariseSupportingContent,
      keyMessages,
      targetAudience,
      purpose,
      stylePreset,
      colourPalette,
      layoutPreference,
      logoPlacement,
      referenceImages,
      // Logo integration (sends logo as reference image)
      logoImage,
      // Branding settings (may be at top level from Studio requests)
      brandingLevel,
      customBranding,
      customPracticeName,
      includeLogo
    } = requestBody;

    // Extract editedDetails from practiceContext (user-edited branding text from dialog)
    const editedDetails = practiceContext?.editedDetails as string[] | undefined;

    // Use selected model or default to Gemini 2.5 Flash Image (Nano banana - fast + reliable)
    const selectedImageModel = imageModel || 'google/gemini-2.5-flash-image';

    // Determine effective request type (studio uses 'purpose', regular uses 'requestType')
    const effectiveRequestType = isStudioRequest ? (purpose || 'general') : (requestType || 'general');

    // Generate current date string for date anchoring (prevents 2023/2024 hallucinations)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const dateStr = currentDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const dateAnchor = `
CURRENT DATE: ${dateStr}
- Use the year ${currentYear} for any dates unless a different year is explicitly specified
- Do not use 2023 or 2024 unless the user requests historical content
`;

    console.log('🎨 AI4GP Image Generation request:', { 
      prompt: prompt.substring(0, 100), 
      requestType: effectiveRequestType,
      isStudioRequest: !!isStudioRequest,
      imageModel: selectedImageModel,
      contextLength: conversationContext?.length || 0,
      hasDocumentContent: !!documentContent,
      hasSupportingContent: !!supportingContent,
      hasImageAttachments: !!(imageAttachments && imageAttachments.length > 0),
      hasReferenceImages: !!(referenceImages && referenceImages.length > 0),
      imageAttachmentsCount: imageAttachments?.length || 0,
      referenceImagesCount: referenceImages?.length || 0,
      hasPracticeContext: !!practiceContext,
      practiceName: practiceContext?.practiceName || 'NOT PROVIDED',
      practicePhone: practiceContext?.practicePhone || 'NOT PROVIDED',
      stylePreset: stylePreset || 'default',
      targetAudience: targetAudience || 'general',
      // Log branding settings
      brandingLevel: brandingLevel || practiceContext?.brandingLevel || 'NOT SET',
      includeLogo: includeLogo !== undefined ? includeLogo : 'NOT SET',
      customBranding: customBranding || 'NOT SET',
      hasEditedDetails: !!(editedDetails && editedDetails.length > 0),
      editedDetailsCount: editedDetails?.length || 0,
      hasLogoImage: !!logoImage,
      logoImagePlacement: logoImage?.placement || 'NOT SET'
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
      banner: 'website or email banner with professional design',
      general: 'image or visual'
    };

    // Build image prompt based on request type
    let imagePrompt: string;
    
    // Handle Image Studio requests with enhanced prompt building
    if (isStudioRequest) {
      console.log('🎨 Building Image Studio prompt with custom settings');
      
      // Build style instructions from preset
      const styleInstructions: Record<string, string> = {
        'nhs-professional': 'NHS professional style: clean, authoritative, trust-inspiring with NHS blues and whites. Clinical yet approachable.',
        'modern-minimal': 'Modern minimalist style: clean lines, generous white space, subtle colours, contemporary typography.',
        'friendly-welcoming': 'Friendly and welcoming style: warm colours, approachable imagery, inviting design that puts patients at ease.',
        'bold-impactful': 'Bold and impactful style: high contrast, eye-catching colours, strong typography for maximum attention.',
        'clinical-medical': 'Clinical medical style: professional, trustworthy, uses medical imagery appropriately, conveys expertise.',
        'custom': 'Custom style as specified by the user.'
      };
      
      // Build audience-specific guidance
      const audienceGuidance: Record<string, string> = {
        'patients': 'Target audience: General patients. Use clear, simple language. Avoid medical jargon.',
        'staff': 'Target audience: Healthcare staff. Professional tone, can use clinical terminology.',
        'public': 'Target audience: General public. Accessible, engaging, community-focused.',
        'clinical': 'Target audience: Clinical professionals. Technical accuracy important.',
        'elderly': 'Target audience: Elderly patients (65+). Large text, high contrast, simple layout.',
        'parents': 'Target audience: Parents and carers. Reassuring, practical, family-focused.',
        'young-adults': 'Target audience: Young adults (18-35). Modern, engaging, digital-native design.',
        'executive-board': 'Target audience: Executive Board and senior leadership. Strategic, professional, data-driven visuals. Use formal business language, polished presentation style, and emphasis on metrics, outcomes, and governance.'
      };
      
      // Build layout guidance
      const layoutGuidance: Record<string, string> = {
        'portrait': 'Layout: Portrait orientation (3:4 aspect ratio). Suitable for A4 posters, leaflets.',
        'landscape': 'Layout: Landscape orientation (16:9 aspect ratio). Suitable for banners, screens.',
        'square': 'Layout: Square format (1:1 aspect ratio). Optimised for social media.'
      };
      
      // Build colour palette instructions
      let colourInstructions = '';
      if (colourPalette) {
        colourInstructions = `
COLOUR SCHEME (apply these colours throughout the design - DO NOT display them as a visible palette/legend):
- Use ${colourPalette.primary} as the primary colour for headings and key elements
- Use ${colourPalette.secondary} for secondary elements and accents
- Use ${colourPalette.accent} for highlights and call-to-action elements
- Use ${colourPalette.background} for the background
- Use ${colourPalette.text} for body text
IMPORTANT: Apply these colours naturally in the design. DO NOT show colour swatches, hex codes, or a colour palette legend anywhere on the image.`;
      }
      
      // Build key messages section
      let keyMessagesSection = '';
      if (keyMessages && keyMessages.length > 0) {
        keyMessagesSection = `
KEY MESSAGES TO INCLUDE:
${keyMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;
      }
      
      // Build supporting content section
      let supportingSection = '';
      if (supportingContent) {
        const summariseInstruction = summariseSupportingContent 
          ? '\n(The user has requested this content be summarised into key points for the image rather than including all details verbatim.)' 
          : '';
        supportingSection = `
SUPPORTING CONTENT TO INCORPORATE:${summariseInstruction}
${supportingContent.substring(0, 3000)}`;
      }
      
      // Build reference image instructions with REAL practice details for edits
      let referenceSection = '';
      if (referenceImages && referenceImages.length > 0) {
        const refMode = referenceImages[0].mode;
        const refInstructions = referenceImages[0].instructions || '';
        
        // Build actual practice details string for edit context
        const realDetails: string[] = [];
        if (practiceContext?.practiceName) realDetails.push(`Practice Name: "${practiceContext.practiceName}"`);
        if (practiceContext?.practicePhone) realDetails.push(`Phone: "${practiceContext.practicePhone}"`);
        if (practiceContext?.practiceEmail) realDetails.push(`Email: "${practiceContext.practiceEmail}"`);
        if (practiceContext?.practiceAddress) realDetails.push(`Address: "${practiceContext.practiceAddress}"`);
        if (practiceContext?.practiceWebsite) realDetails.push(`Website: "${practiceContext.practiceWebsite}"`);
        
        const realDetailsBlock = realDetails.length > 0 ? `

⚠️ REAL PRACTICE DETAILS (use ONLY these if adding contact info):
${realDetails.map(d => `• ${d}`).join('\n')}

🚫 CRITICAL: If asked to add a phone number, email, address, or any contact details, you MUST use ONLY the exact values listed above. DO NOT invent fake numbers like "0123 456789" or fake emails. If the detail is not listed above, respond that it's not available rather than making one up.` : '';
        
        if (refMode === 'style-reference') {
          referenceSection = `\nREFERENCE IMAGE: Use the provided image(s) as STYLE REFERENCE. Create a new image inspired by the style, layout, and feel of the reference.${realDetailsBlock}`;
        } else if (refMode === 'edit-source') {
          referenceSection = `\nEDIT REQUEST: Modify the provided image according to these instructions: ${refInstructions || 'Apply the style and content requirements to edit this image.'}${realDetailsBlock}`;
        } else if (refMode === 'update-previous') {
          referenceSection = `\nUPDATE REQUEST: This is a previously generated image. Apply these changes: ${refInstructions || 'Refine and improve the image based on the new settings.'}${realDetailsBlock}`;
        }
        
        if (refInstructions && refMode !== 'style-reference') {
          referenceSection += `\nSpecific changes requested: ${refInstructions}`;
        }
      }
      
      // Build logo integration instructions
      let logoSection = '';
      if (logoImage && logoImage.content) {
        // Logo is being sent as a reference image - build integration instructions
        const placementGuide: Record<string, string> = {
          'top-left': 'TOP LEFT corner',
          'top-right': 'TOP RIGHT corner',
          'bottom-left': 'BOTTOM LEFT corner',
          'bottom-right': 'BOTTOM RIGHT corner',
          'center-top': 'centered at the TOP',
          'reserve-space': 'TOP RIGHT corner'
        };
        
        logoSection = `
LOGO INTEGRATION - CRITICAL REQUIREMENT:
I have provided an image of a logo that MUST be integrated into this design.
- Place the logo in the ${placementGuide[logoImage.placement] || placementGuide['top-right']} of the image
- The logo should be clearly visible and appropriately sized (typically 80-150px height equivalent)
- Ensure the logo has adequate contrast with the background
- Do NOT modify, redraw, or recreate the logo - use it EXACTLY as provided
- The logo should look naturally incorporated into the design
- If the background colour behind the logo placement clashes, add a subtle backdrop or adjust that area
- Maintain the logo's original colours and proportions
`;
      } else if (includeLogo && logoPlacement) {
        // Fallback: Legacy "reserve space" mode when no logoImage is provided
        const placements: Record<string, string> = {
          'top-left': 'Reserve space in the TOP LEFT corner for a logo to be added later.',
          'top-right': 'Reserve space in the TOP RIGHT corner for a logo to be added later.',
          'bottom-left': 'Reserve space in the BOTTOM LEFT corner for a logo to be added later.',
          'bottom-right': 'Reserve space in the BOTTOM RIGHT corner for a logo to be added later.',
          'reserve-space': 'Reserve appropriate space for a logo to be added manually after generation.'
        };
        logoSection = `\nLOGO PLACEMENT: ${placements[logoPlacement] || placements['reserve-space']}`;
      }
      
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
      imagePrompt = `Create a professional ${typeDescriptions[effectiveRequestType] || 'image'}.

USER REQUEST:
${prompt}
${keyMessagesSection}
${supportingSection}
${dateAnchor}

STYLE REQUIREMENTS:
${styleInstructions[stylePreset || 'nhs-professional']}
${layoutGuidance[layoutPreference || 'portrait']}
${audienceGuidance[targetAudience || 'patients']}
${colourInstructions}
${brandingSection}
${logoSection}
${referenceSection}

DESIGN GUIDELINES:
- Create a polished, professional image ready for immediate use
- Text should be clear, readable, and properly spelled
- Use high contrast for accessibility
- Ensure visual hierarchy guides the viewer's eye
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery
- For posters and leaflets: use HEADINGS and SHORT BULLET POINTS only, avoid long paragraphs
- Use large font sizes for better readability - avoid small body copy

${SPELLING_REFERENCE}`;

    } else if (effectiveRequestType === 'logo') {
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
    } else if (effectiveRequestType === 'infographic' && documentContent) {
      // Infographic with document content - generate visual FROM the document
      // IMPORTANT: Also include the user's prompt as it may contain custom styling instructions
      // Extract keywords for accurate spelling reference
      const extractedKeywords = extractCleanKeywords(documentContent);
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
      // Check if the prompt contains custom style instructions (from useMeetingInfographic)
      const hasCustomStyleInPrompt = prompt.includes('CUSTOM STYLE REQUEST:') || prompt.includes('Custom visual style requested:');
      
      imagePrompt = hasCustomStyleInPrompt 
        ? `${prompt}

SOURCE CONTENT TO VISUALISE:
${documentContent.substring(0, 5000)}
${brandingSection}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below
- Good visual hierarchy with headings, subheadings and body text

${SPELLING_REFERENCE}
${keywordReference}

ADDITIONAL REQUIREMENTS:
- Create an ACTUAL visual infographic image, NOT a text description
- High contrast for accessibility and readability
- DO NOT display colour swatches, hex codes, or colour palette legends anywhere in the image

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`
        : `Create a professional single-page infographic that visualises the following content.

SOURCE CONTENT TO VISUALISE:
${documentContent.substring(0, 5000)}
${brandingSection}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below
- Good visual hierarchy with headings, subheadings and body text

${SPELLING_REFERENCE}
${keywordReference}

INFOGRAPHIC DESIGN REQUIREMENTS:
- Create an ACTUAL visual infographic image, NOT a text description
- Use a professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility and readability
- DO NOT display colour swatches, hex codes, or colour palette legends anywhere in the image

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (effectiveRequestType === 'infographic') {
      // Infographic without document content - use prompt directly
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
      imagePrompt = `Create a professional single-page infographic.

${prompt}
${brandingSection}

TEXT GUIDELINES:
- Text should be clear and readable with professional typography
- Use proper spelling - refer to the spelling reference below

${SPELLING_REFERENCE}

INFOGRAPHIC DESIGN REQUIREMENTS:
- Create an ACTUAL visual infographic image, NOT a text description
- Use a professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility
- DO NOT display colour swatches, hex codes, or colour palette legends anywhere in the image

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (['chart', 'diagram', 'poster'].includes(effectiveRequestType) && documentContent) {
      // Visual types WITH document content - generate visual FROM the document
      const extractedKeywords = extractCleanKeywords(documentContent);
      const keywordReference = extractedKeywords.length > 0 
        ? `\nEXACT TERMS FROM SOURCE (use these spellings exactly):\n${extractedKeywords.map(k => `- "${k}"`).join('\n')}`
        : '';
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);

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
- Use a professional colour scheme (blues, teals, clean modern palette)
- High contrast for accessibility and readability
- DO NOT display colour swatches, hex codes, or colour palette legends anywhere in the image

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery`;
    } else if (effectiveRequestType === 'leaflet') {
      // Patient information leaflet
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
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
    } else if (effectiveRequestType === 'newsletter') {
      // Practice newsletter header/section
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
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
    } else if (effectiveRequestType === 'social') {
      // Social media post image
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
      imagePrompt = `Create a social media post image.

${prompt}
${brandingSection}

SOCIAL MEDIA DESIGN REQUIREMENTS:
- LANDSCAPE format (1536x1024 pixels / 3:2 aspect ratio) - IMPORTANT: Design for wide format, not square
- Bold, eye-catching design with complete, fully visible elements
- Large, readable text that works at small sizes
- Engagement-focused with clear message
- NHS-appropriate colour scheme (blues, greens, professional palette)
- Simple, uncluttered layout with balanced composition
- Include call-to-action if relevant (e.g., "Book Now", "Learn More")
- ALL content boxes, panels, or containers MUST have FULLY ROUNDED CORNERS on ALL sides (top AND bottom)
- Ensure ALL design elements are COMPLETE and not cropped at edges
- Leave adequate margin/padding around all edges to prevent cropping
${practiceContext?.practiceName ? `- MUST display the practice name "${practiceContext.practiceName}" prominently at top or bottom` : ''}
${practiceContext?.practicePhone ? `- MUST include contact number "${practiceContext.practicePhone}" visibly on the image` : ''}

${SPELLING_REFERENCE}

CRITICAL LAYOUT RULES:
- Design MUST be complete within the frame with NO elements cut off at edges
- White boxes or panels MUST have matching rounded corners on TOP and BOTTOM
- Ensure balanced visual weight with content centred and fully visible

Content guidelines:
- Keep all content professional and social media appropriate
- Suitable for Facebook, Instagram, LinkedIn, or Twitter/X
- NO placeholder text - use the real practice details provided above`;
    } else if (effectiveRequestType === 'waiting-room') {
      // Waiting room display poster
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
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
    } else if (effectiveRequestType === 'form-header') {
      // Document header/letterhead
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
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
    } else if (effectiveRequestType === 'campaign') {
      // Health campaign promotional material
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
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
      const brandingSection = buildBrandingSection(practiceContext, effectiveRequestType, brandingLevel, includeLogo, customBranding, editedDetails, customPracticeName);
      
      imagePrompt = `${prompt}
${brandingSection}

Style: ${typeDescriptions[effectiveRequestType] || 'visual'}

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

    let imageUrl: string;
    let textContent = '';

    // Check if using OpenAI gpt-image-1 model
    if (selectedImageModel === 'openai/gpt-image-1') {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured for gpt-image-1 model');
      }

      console.log('🎨 Using OpenAI gpt-image-1 API...');
      
      // Determine optimal size based on layout preference (explicit user choice) or request type
      // Portrait (1024x1536): leaflets, posters, newsletters, form-headers - tall content
      // Landscape (1536x1024): social media, waiting-room displays, calendars, banners - wide content
      // Square (1024x1024): logos, charts, diagrams, infographics, general
      const portraitTypes = ['leaflet', 'poster', 'newsletter', 'form-header'];
      const landscapeTypes = ['social', 'waiting-room', 'calendar', 'campaign', 'banner'];
      
      let imageSize = '1024x1024'; // Default square
      
      // PRIORITY: User's explicit layoutPreference from Image Studio takes precedence
      if (layoutPreference) {
        if (layoutPreference === 'landscape') {
          imageSize = '1536x1024'; // Landscape
        } else if (layoutPreference === 'portrait') {
          imageSize = '1024x1536'; // Portrait
        } else if (layoutPreference === 'square') {
          imageSize = '1024x1024'; // Square
        }
      } else if (portraitTypes.includes(effectiveRequestType)) {
        // Fall back to type-based defaults only if no explicit preference
        imageSize = '1024x1536'; // Portrait for documents/leaflets
      } else if (landscapeTypes.includes(effectiveRequestType)) {
        imageSize = '1536x1024'; // Landscape for displays/social
      }
      
      console.log(`📐 Using size ${imageSize} for request type: ${effectiveRequestType}, layoutPreference: ${layoutPreference || 'not set'}`);
      
      const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: imagePrompt,
          n: 1,
          size: imageSize,
          quality: 'high'
        }),
      });

      if (openaiResponse.status === 429) {
        console.error('OpenAI rate limit exceeded');
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded. Please try again in a moment.',
          code: 'RATE_LIMIT',
          success: false
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        throw new Error(`OpenAI image generation failed: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      console.log('OpenAI response:', JSON.stringify(openaiData).substring(0, 500));
      
      // gpt-image-1 returns base64 by default
      const b64Data = openaiData.data?.[0]?.b64_json;
      const urlData = openaiData.data?.[0]?.url;
      
      if (b64Data) {
        imageUrl = `data:image/png;base64,${b64Data}`;
      } else if (urlData) {
        imageUrl = urlData;
      } else {
        console.error('No image in OpenAI response:', JSON.stringify(openaiData).substring(0, 500));
        throw new Error('No image was generated. Please try rephrasing your request.');
      }
      
      textContent = openaiData.data?.[0]?.revised_prompt || '';
      
    } else {
      // Use Lovable AI Gateway for Gemini models
      // Build message content - include image attachments and reference images if provided
      const messageContent: any[] = [];
      
      // Add logo image FIRST if provided (for logo integration)
      if (logoImage && logoImage.content) {
        const logoDataUrl = logoImage.content.startsWith('data:') 
          ? logoImage.content 
          : `data:image/png;base64,${logoImage.content}`;
        
        // Estimate size for logging
        const base64Part = logoDataUrl.split(',')[1] || logoDataUrl;
        const sizeKB = Math.round((base64Part.length * 3 / 4) / 1024);
        console.log(`🖼️ Including logo image for integration: ${sizeKB}KB, placement: ${logoImage.placement}`);
        
        messageContent.push({
          type: 'image_url',
          image_url: { url: logoDataUrl }
        });
      }
      
      // Add reference images from Image Studio if provided
      if (referenceImages && referenceImages.length > 0) {
        const firstRefMode = referenceImages[0]?.mode || 'unknown';
        const firstRefInstructions = referenceImages[0]?.instructions;
        console.log(`📎 Including ${referenceImages.length} studio reference image(s) for ${firstRefMode} mode`);
        let totalRefSizeKB = 0;
        
        for (const refImg of referenceImages) {
          const imageDataUrl = refImg.content.startsWith('data:') 
            ? refImg.content 
            : `data:${refImg.type};base64,${refImg.content}`;
          
          // Estimate size for logging
          const base64Part = imageDataUrl.split(',')[1] || imageDataUrl;
          const sizeKB = Math.round((base64Part.length * 3 / 4) / 1024);
          totalRefSizeKB += sizeKB;
          console.log(`  📊 Reference image: ${sizeKB}KB, mode: ${refImg.mode}`);
          
          messageContent.push({
            type: 'image_url',
            image_url: { url: imageDataUrl }
          });
        }
        
        console.log(`  📊 Total reference images size: ${totalRefSizeKB}KB`);
        
        if (firstRefInstructions) {
          console.log(`  📝 Edit instructions: "${firstRefInstructions.substring(0, 100)}..."`);
        }
      }
      
      // Add regular image attachments if provided
      if (imageAttachments && imageAttachments.length > 0) {
        console.log(`📎 Including ${imageAttachments.length} image attachment(s) for reference`);
        for (const attachment of imageAttachments) {
          // Check if content is already a data URL or needs conversion
          const imageDataUrl = attachment.content.startsWith('data:') 
            ? attachment.content 
            : `data:${attachment.type};base64,${attachment.content}`;
          
          messageContent.push({
            type: 'image_url',
            image_url: { url: imageDataUrl }
          });
        }
      }
      
      // Add the text prompt
      messageContent.push({
        type: 'text',
        text: imagePrompt
      });
      
      // Add timeout to prevent hanging indefinitely (90 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('Image generation timeout after 90 seconds');
        controller.abort();
      }, 90000);

      let response;
      try {
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedImageModel,
            messages: [
              { role: 'user', content: messageContent.length === 1 ? imagePrompt : messageContent }
            ],
            modalities: ['image', 'text']
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

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

      // Safely parse JSON response - handle empty or malformed responses
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from AI Gateway');
        throw new Error('Image generation returned an empty response. Please try again.');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse AI Gateway response:', responseText.substring(0, 500));
        throw new Error('Image generation returned an invalid response. Please try again.');
      }
      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason;
      const nativeFinishReason = choice?.native_finish_reason;
      textContent = choice?.message?.content || '';
      imageUrl = choice?.message?.images?.[0]?.image_url?.url;

      // Check for errors in the response
      const choiceError = data.choices?.[0]?.error;
      if (choiceError) {
        console.error('AI Gateway error in response:', JSON.stringify(choiceError));
        
        // Check for rate limit / resource exhausted errors
        const errorMetadata = choiceError.metadata?.raw || '';
        if (errorMetadata.includes('RESOURCE_EXHAUSTED') || errorMetadata.includes('429') || choiceError.code === 429) {
          return new Response(JSON.stringify({
            error: 'The AI image service is temporarily busy. Please wait a moment and try again.',
            code: 'RATE_LIMIT',
            success: false
          }), { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        // Check for content moderation blocks
        if (choiceError.message === 'PROHIBITED_CONTENT' || choiceError.code === 502) {
          return new Response(JSON.stringify({
            error: 'Content moderation: This image request was blocked by the AI safety system. Medical and health-related imagery can sometimes trigger content filters. Try simplifying your request, removing reference images, or using more general descriptive terms.',
            code: 'CONTENT_MODERATION',
            success: false
          }), { 
            status: 422, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        // Generic error fallback
        throw new Error(choiceError.message || 'Image generation failed. Please try again.');
      }

      if (!imageUrl) {
        console.error('No image in response:', JSON.stringify(data).substring(0, 500));

        const reason = String(nativeFinishReason || finishReason || '').toUpperCase();
        const isSafetyBlock =
          reason.includes('PROHIBITED') ||
          reason.includes('SAFETY') ||
          reason.includes('CONTENT') ||
          finishReason === 'content_filter';

        if (isSafetyBlock) {
          return new Response(JSON.stringify({
            success: false,
            code: 'CONTENT_MODERATION',
            error: 'This image request was blocked by the AI safety system. If you are aiming for a recognisable franchise theme, try describing the visual vibe without naming the franchise, characters, or logos (e.g. “cinematic space‑opera sci‑fi with starfields and glowing accents”).'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'No image was generated. Please try rephrasing your request.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
