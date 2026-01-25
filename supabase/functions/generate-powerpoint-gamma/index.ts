import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY');
const GAMMA_API_BASE = 'https://public-api.gamma.app';

interface BrandingOptions {
  logoUrl?: string;
  logoPosition?: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
  showCardNumbers?: boolean;
  cardNumberPosition?: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
  dimensions?: 'fluid' | 'standard' | 'wide';
}

interface LocalThemeStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeName: string;
}

interface GammaGenerationRequest {
  topic: string;
  presentationType?: string;
  slideCount?: number;
  supportingContent?: string;
  customInstructions?: string;
  audience?: string;
  themeId?: string;
  themeSource?: 'gamma' | 'local';
  localThemeStyle?: LocalThemeStyle;
  branding?: BrandingOptions;
}

interface GammaCompletedResponse {
  generationId: string;
  status: 'pending' | 'completed' | 'failed';
  gammaUrl?: string;
  exportUrl?: string; // Gamma returns exportUrl for the PPTX file
  pptxUrl?: string;
  pdfUrl?: string;
  error?: string;
  credits?: { deducted: number; remaining: number };
}

// Poll for generation completion with exponential backoff
async function pollForCompletion(generationId: string, maxAttempts = 60): Promise<GammaCompletedResponse> {
  let attempts = 0;
  let delay = 5000; // Start with 5 seconds as recommended by Gamma
  
  while (attempts < maxAttempts) {
    console.log(`[Gamma] Polling attempt ${attempts + 1}/${maxAttempts} for generation ${generationId}`);
    
    const response = await fetch(`${GAMMA_API_BASE}/v1.0/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': GAMMA_API_KEY!,
        'accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gamma] Poll error: ${response.status} - ${errorText}`);
      throw new Error(`Gamma API poll error: ${response.status}`);
    }
    
    const data: GammaCompletedResponse = await response.json();
    console.log(`[Gamma] Poll response status: ${data.status}`, data);
    
    if (data.status === 'completed') {
      return data;
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error || 'Gamma generation failed');
    }
    
    // Wait before next poll (5 second intervals as recommended)
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  
  throw new Error('Gamma generation timed out after 5 minutes');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GAMMA_API_KEY) {
      throw new Error('GAMMA_API_KEY not configured');
    }

    const requestBody = await req.json();
    const { 
      topic, 
      presentationType = 'Professional Presentation',
      slideCount = 4,
      customInstructions,
      audience = 'healthcare professionals',
      branding,
      fontStyle,
      supportingFiles, // Array of { name, content, type } from frontend
    } = requestBody;

    // Handle supportingContent - accept both old string format and new array format
    let supportingContent = requestBody.supportingContent || '';
    
    // If we have supportingFiles array, combine them into supportingContent
    if (supportingFiles && Array.isArray(supportingFiles) && supportingFiles.length > 0) {
      console.log(`[Gamma] Processing ${supportingFiles.length} supporting files`);
      
      const extractedContent = supportingFiles
        .filter((f: any) => f.content && typeof f.content === 'string')
        .map((f: any) => {
          // Skip if still Base64 DataURL (extraction failed on frontend)
          if (f.content.startsWith('data:')) {
            console.warn(`[Gamma] Skipping Base64 content for ${f.name} - extraction may have failed`);
            return '';
          }
          console.log(`[Gamma] Including content from ${f.name}: ${f.content.length} chars`);
          return `\n--- Content from: ${f.name} ---\n${f.content}\n`;
        })
        .filter((c: string) => c.length > 0)
        .join('\n');
      
      if (extractedContent) {
        supportingContent = extractedContent;
        console.log(`[Gamma] Combined supporting content: ${supportingContent.length} chars`);
      }
    }

    // Accept both naming conventions for theme/template
    const themeId = requestBody.themeId || requestBody.templateId;
    
    // Auto-detect theme source based on themeId format
    // Gamma themes would typically have specific IDs, local themes are our custom ones
    const themeSource = requestBody.themeSource || 
      (themeId?.startsWith('gamma-') ? 'gamma' : 'local');
    
    // Accept colour palette in either format (localThemeStyle or colourPalette)
    let localThemeStyle: LocalThemeStyle | null = requestBody.localThemeStyle || null;
    if (!localThemeStyle && requestBody.colourPalette) {
      localThemeStyle = {
        primaryColor: requestBody.colourPalette.primary,
        secondaryColor: requestBody.colourPalette.secondary,
        accentColor: requestBody.colourPalette.accent,
        themeName: themeId || 'Custom Theme',
      };
    }
    
    console.log(`[Gamma] Theme settings - ID: ${themeId}, Source: ${themeSource}, LocalStyle: ${!!localThemeStyle}`);

    console.log(`[Gamma] Starting generation for topic: "${topic}"`);
    console.log(`[Gamma] Type: ${presentationType}, Slides: ${slideCount}`);
    console.log(`[Gamma] Supporting content length: ${supportingContent?.length || 0} chars`);

    // Build the input text with context
    // If topic is generic but we have supporting content, extract a better topic
    let effectiveTopic = topic;
    if ((!topic || topic === 'General presentation' || topic === 'Content from uploaded files') && supportingContent) {
      // Try to extract first meaningful line from supporting content
      const contentLines = supportingContent.split('\n').filter(line => 
        line.trim().length > 5 && 
        !line.startsWith('#') && 
        !line.startsWith('---')
      );
      if (contentLines.length > 0) {
        const firstLine = contentLines[0].substring(0, 100).trim();
        if (firstLine.length > 5) {
          effectiveTopic = firstLine;
          console.log(`[Gamma] Extracted topic from content: "${effectiveTopic}"`);
        }
      }
    }
    
    let inputText = `Create a ${presentationType} about: ${effectiveTopic}`;
    
    if (supportingContent) {
      inputText += `\n\nKey content to include:\n${supportingContent}`;
    }

    // Build additional instructions
    let additionalInstructions = `Use British English spelling and terminology throughout. Target audience: ${audience}. Use professional, clean design. Each slide should have a clear, actionable message.`;

    // CRITICAL: Add strict content-fidelity rules to prevent fabrication
    additionalInstructions += ` CRITICAL DATA INTEGRITY RULES: 1) ONLY use statistics, percentages, numbers, dates, and metrics that are EXPLICITLY present in the provided content. 2) NEVER invent, estimate, or fabricate any numerical data, statistics, or percentages. 3) If specific data is not provided, use qualitative descriptions instead (e.g., "significant improvement" rather than inventing "87% improvement"). 4) Do not add example figures or placeholder statistics. 5) If the content lacks sufficient data for a metrics slide, use qualitative summary points instead. 6) All facts must come directly from the source content provided.`;

    if (customInstructions) {
      additionalInstructions += ` Additional requirements: ${customInstructions}`;
    }

    // NHS/Healthcare specific instructions based on presentation type
    if (presentationType.toLowerCase().includes('nhs') || 
        presentationType.toLowerCase().includes('healthcare') ||
        presentationType.toLowerCase().includes('clinical')) {
      additionalInstructions += ` Follow NHS branding guidelines where appropriate. Use healthcare-appropriate terminology. Ensure accessibility compliance.`;
    }

    // Always apply colour scheme if we have local theme style (regardless of themeSource)
    if (localThemeStyle) {
      additionalInstructions += ` IMPORTANT COLOUR SCHEME: Use these exact colours throughout the presentation - Primary: ${localThemeStyle.primaryColor}, Secondary: ${localThemeStyle.secondaryColor}, Accent: ${localThemeStyle.accentColor}. Theme style: ${localThemeStyle.themeName}. Apply consistent branding with these colours on headings, backgrounds, and key visual elements.`;
      console.log(`[Gamma] Applying colour scheme: Primary=${localThemeStyle.primaryColor}, Secondary=${localThemeStyle.secondaryColor}, Theme=${localThemeStyle.themeName}`);
    }

    // Add font style instructions
    if (fontStyle) {
      const fontDescriptions: Record<string, string> = {
        'professional': 'Use professional, clean fonts like Calibri or Arial',
        'modern': 'Use modern, contemporary fonts with clean lines',
        'elegant': 'Use elegant, serif fonts for a sophisticated look',
        'clean': 'Use clean, sans-serif fonts for maximum readability',
      };
      additionalInstructions += ` ${fontDescriptions[fontStyle] || 'Use professional fonts'}.`;
      console.log(`[Gamma] Applying font style: ${fontStyle}`);
    }

    // Add branding instructions if provided
    if (branding) {
      if (branding.logoUrl) {
        additionalInstructions += ` Include organisation logo positioned at ${branding.logoPosition || 'top right'} on each slide.`;
      }
      if (branding.showCardNumbers !== false) {
        additionalInstructions += ` Show slide numbers at ${branding.cardNumberPosition || 'bottom right'}.`;
      }
      console.log(`[Gamma] Branding options applied:`, branding);
    }

    console.log('[Gamma] Initiating generation request to:', `${GAMMA_API_BASE}/v1.0/generations`);

    // Step 1: Create generation request
    const requestPayload: Record<string, any> = {
      inputText,
      textMode: 'generate',
      format: 'presentation',
      numCards: slideCount,
      exportAs: 'pptx',
      additionalInstructions: additionalInstructions.trim(),
      textOptions: {
        language: 'en',
        audience,
        tone: 'professional',
        amount: 'medium',
      },
      imageOptions: {
        source: 'aiGenerated',
        style: 'photorealistic',
      },
    };

    // Include theme ID if provided (only for Gamma-sourced themes)
    if (themeId && themeSource === 'gamma') {
      requestPayload.themeId = themeId;
      console.log(`[Gamma] Using Gamma theme ID: ${themeId}`);
    }

    // Note: Gamma API doesn't support cardOptions.headerFooter - branding is applied via additionalInstructions above
    // Set dimensions if specified (Gamma may support this at generation level)
    if (branding?.dimensions && branding.dimensions !== 'fluid') {
      // Gamma API may not support custom dimensions - this is handled via additionalInstructions
      console.log(`[Gamma] Requested dimensions: ${branding.dimensions}`);
    }

    console.log('[Gamma] Request payload:', JSON.stringify(requestPayload, null, 2));

    const createResponse = await fetch(`${GAMMA_API_BASE}/v1.0/generations`, {
      method: 'POST',
      headers: {
        'X-API-KEY': GAMMA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[Gamma] Create error: ${createResponse.status} - ${errorText}`);
      throw new Error(`Gamma API error: ${createResponse.status} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const generationId = createData.generationId;
    
    if (!generationId) {
      console.error('[Gamma] No generationId in response:', createData);
      throw new Error('No generation ID received from Gamma');
    }

    console.log(`[Gamma] Generation started with ID: ${generationId}`);

    // Step 2: Poll for completion
    const completedGeneration = await pollForCompletion(generationId);
    
    console.log(`[Gamma] Generation completed:`, completedGeneration);

    // Step 3: Return the download URL directly instead of downloading and converting to base64
    // This avoids memory issues with large files (Gamma can generate 70MB+ presentations)
    const downloadUrl = completedGeneration.exportUrl || completedGeneration.pptxUrl;
    
    if (!downloadUrl) {
      console.error('[Gamma] No download URL in response:', completedGeneration);
      throw new Error('No PPTX download URL received from Gamma');
    }

    console.log(`[Gamma] Returning direct download URL: ${downloadUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl, // Direct Gamma URL - client will download from here
        gammaUrl: completedGeneration.gammaUrl,
        title: topic,
        slideCount,
        presentationType,
        generationId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Gamma] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate presentation',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});