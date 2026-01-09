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

    const requestBody: GammaGenerationRequest = await req.json();
    const { 
      topic, 
      presentationType = 'Professional Presentation',
      slideCount = 10,
      supportingContent,
      customInstructions,
      audience = 'healthcare professionals',
      themeId,
      themeSource,
      localThemeStyle,
      branding
    } = requestBody;

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
    let additionalInstructions = `Use British English spelling and terminology throughout. Target audience: ${audience}. Use professional, clean design. Include data visualisations where appropriate. Each slide should have a clear, actionable message.`;

    if (customInstructions) {
      additionalInstructions += ` Additional requirements: ${customInstructions}`;
    }

    // NHS/Healthcare specific instructions based on presentation type
    if (presentationType.toLowerCase().includes('nhs') || 
        presentationType.toLowerCase().includes('healthcare') ||
        presentationType.toLowerCase().includes('clinical')) {
      additionalInstructions += ` Follow NHS branding guidelines where appropriate. Use healthcare-appropriate terminology. Ensure accessibility compliance.`;
    }

    // Add local theme styling instructions if using a local theme
    if (themeSource === 'local' && localThemeStyle) {
      additionalInstructions += ` IMPORTANT COLOUR SCHEME: Use these exact colours throughout the presentation - Primary: ${localThemeStyle.primaryColor}, Secondary: ${localThemeStyle.secondaryColor}, Accent: ${localThemeStyle.accentColor}. Theme style: ${localThemeStyle.themeName}. Apply consistent branding with these colours on headings, backgrounds, and key visual elements.`;
      console.log(`[Gamma] Applying local theme styling: ${localThemeStyle.themeName}`);
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

    // Step 3: Download the PPTX file if URL provided (Gamma uses exportUrl)
    let pptxBase64 = '';
    const downloadUrl = completedGeneration.exportUrl || completedGeneration.pptxUrl;
    
    if (downloadUrl) {
      console.log(`[Gamma] Downloading PPTX from: ${downloadUrl}`);
      
      const pptxResponse = await fetch(downloadUrl);
      
      if (!pptxResponse.ok) {
        console.error(`[Gamma] PPTX download failed: ${pptxResponse.status}`);
        throw new Error(`Failed to download PPTX: ${pptxResponse.status}`);
      }

      const pptxBuffer = await pptxResponse.arrayBuffer();
      const pptxBytes = new Uint8Array(pptxBuffer);
      
      console.log(`[Gamma] Downloaded ${pptxBytes.length} bytes`);
      
      // Convert to base64 in chunks to avoid memory issues
      const chunkSize = 8192;
      let base64Str = '';
      for (let i = 0; i < pptxBytes.length; i += chunkSize) {
        const chunk = pptxBytes.slice(i, Math.min(i + chunkSize, pptxBytes.length));
        base64Str += String.fromCharCode.apply(null, Array.from(chunk));
      }
      pptxBase64 = btoa(base64Str);

      console.log(`[Gamma] PPTX converted to base64 (${pptxBase64.length} chars)`);
    } else {
      console.error('[Gamma] No download URL in response:', completedGeneration);
      throw new Error('No PPTX download URL received from Gamma');
    }

    return new Response(
      JSON.stringify({
        success: true,
        pptxBase64,
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