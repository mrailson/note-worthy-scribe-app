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

interface GammaCompletedResponse {
  generationId: string;
  status: 'pending' | 'completed' | 'failed';
  gammaUrl?: string;
  exportUrl?: string;
  pptxUrl?: string;
  pdfUrl?: string;
  error?: string;
  credits?: { deducted: number; remaining: number };
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

    // ──────────────────────────────────────────────────────────
    // MODE 1: Poll for an existing generation's status
    // Client sends { action: 'poll', generationId: '...' }
    // ──────────────────────────────────────────────────────────
    if (requestBody.action === 'poll' && requestBody.generationId) {
      const generationId = requestBody.generationId;
      console.log(`[Gamma] Polling status for generation ${generationId}`);

      const response = await fetch(`${GAMMA_API_BASE}/v1.0/generations/${generationId}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': GAMMA_API_KEY,
          'accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gamma] Poll error: ${response.status} - ${errorText}`);
        throw new Error(`Gamma API poll error: ${response.status}`);
      }

      const data: GammaCompletedResponse = await response.json();
      console.log(`[Gamma] Poll result: status=${data.status}`);

      if (data.status === 'completed') {
        const downloadUrl = data.exportUrl || data.pptxUrl;
        return new Response(
          JSON.stringify({
            success: true,
            status: 'completed',
            downloadUrl,
            gammaUrl: data.gammaUrl,
            generationId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data.status === 'failed') {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'failed',
            error: data.error || 'Gamma generation failed',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Still pending
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          generationId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ──────────────────────────────────────────────────────────
    // MODE 2: Start a new generation (returns immediately)
    // ──────────────────────────────────────────────────────────
    const { 
      topic, 
      presentationType = 'Professional Presentation',
      slideCount = 4,
      customInstructions,
      audience = 'healthcare professionals',
      branding,
      fontStyle,
      supportingFiles,
    } = requestBody;

    // Handle supportingContent
    let supportingContent = requestBody.supportingContent || '';
    
    if (supportingFiles && Array.isArray(supportingFiles) && supportingFiles.length > 0) {
      console.log(`[Gamma] Processing ${supportingFiles.length} supporting files`);
      
      const extractedContent = supportingFiles
        .filter((f: any) => f.content && typeof f.content === 'string')
        .map((f: any) => {
          if (f.content.startsWith('data:')) {
            console.warn(`[Gamma] Skipping Base64 content for ${f.name}`);
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

    const themeId = requestBody.themeId || requestBody.templateId;
    const themeSource = requestBody.themeSource || 
      (themeId?.startsWith('gamma-') ? 'gamma' : 'local');
    
    let localThemeStyle: LocalThemeStyle | null = requestBody.localThemeStyle || null;
    if (!localThemeStyle && requestBody.colourPalette) {
      localThemeStyle = {
        primaryColor: requestBody.colourPalette.primary,
        secondaryColor: requestBody.colourPalette.secondary,
        accentColor: requestBody.colourPalette.accent,
        themeName: themeId || 'Custom Theme',
      };
    }
    
    console.log(`[Gamma] Starting generation for topic: "${topic}"`);
    console.log(`[Gamma] Type: ${presentationType}, Slides: ${slideCount}`);

    // Build input text
    let effectiveTopic = topic;
    if ((!topic || topic === 'General presentation' || topic === 'Content from uploaded files') && supportingContent) {
      const contentLines = supportingContent.split('\n').filter((line: string) => 
        line.trim().length > 5 && 
        !line.startsWith('#') && 
        !line.startsWith('---')
      );
      if (contentLines.length > 0) {
        const firstLine = contentLines[0].substring(0, 100).trim();
        if (firstLine.length > 5) {
          effectiveTopic = firstLine;
        }
      }
    }
    
    let inputText = `Create a ${presentationType} about: ${effectiveTopic}`;
    if (supportingContent) {
      inputText += `\n\nKey content to include:\n${supportingContent}`;
    }

    // Build additional instructions
    let additionalInstructions = `Use British English spelling and terminology throughout. Target audience: ${audience}. Use professional, clean design. Each slide should have a clear, actionable message.`;

    additionalInstructions += ` CRITICAL DATA INTEGRITY RULES: 1) ONLY use statistics, percentages, numbers, dates, and metrics that are EXPLICITLY present in the provided content. 2) NEVER invent, estimate, or fabricate any numerical data, statistics, or percentages. 3) If specific data is not provided, use qualitative descriptions instead (e.g., "significant improvement" rather than inventing "87% improvement"). 4) Do not add example figures or placeholder statistics. 5) If the content lacks sufficient data for a metrics slide, use qualitative summary points instead. 6) All facts must come directly from the source content provided.`;

    if (customInstructions) {
      additionalInstructions += ` Additional requirements: ${customInstructions}`;
    }

    if (presentationType.toLowerCase().includes('nhs') || 
        presentationType.toLowerCase().includes('healthcare') ||
        presentationType.toLowerCase().includes('clinical')) {
      additionalInstructions += ` Follow NHS branding guidelines where appropriate. Use healthcare-appropriate terminology. Ensure accessibility compliance.`;
    }

    if (localThemeStyle) {
      additionalInstructions += ` IMPORTANT COLOUR SCHEME: Use these exact colours throughout the presentation - Primary: ${localThemeStyle.primaryColor}, Secondary: ${localThemeStyle.secondaryColor}, Accent: ${localThemeStyle.accentColor}. Theme style: ${localThemeStyle.themeName}. Apply consistent branding with these colours on headings, backgrounds, and key visual elements.`;
    }

    if (fontStyle) {
      const fontDescriptions: Record<string, string> = {
        'professional': 'Use professional, clean fonts like Calibri or Arial',
        'modern': 'Use modern, contemporary fonts with clean lines',
        'elegant': 'Use elegant, serif fonts for a sophisticated look',
        'clean': 'Use clean, sans-serif fonts for maximum readability',
      };
      additionalInstructions += ` ${fontDescriptions[fontStyle] || 'Use professional fonts'}.`;
    }

    if (branding) {
      if (branding.logoUrl) {
        additionalInstructions += ` Include organisation logo positioned at ${branding.logoPosition || 'top right'} on each slide.`;
      }
      if (branding.showCardNumbers !== false) {
        additionalInstructions += ` Show slide numbers at ${branding.cardNumberPosition || 'bottom right'}.`;
      }
    }

    // Build request payload
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

    if (themeId && themeSource === 'gamma') {
      requestPayload.themeId = themeId;
    }

    console.log('[Gamma] Sending create request to Gamma API...');

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

    console.log(`[Gamma] Generation started with ID: ${generationId} — returning immediately`);

    // Return immediately with generationId — client will poll
    return new Response(
      JSON.stringify({
        success: true,
        status: 'pending',
        generationId,
        title: topic,
        slideCount,
        presentationType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
