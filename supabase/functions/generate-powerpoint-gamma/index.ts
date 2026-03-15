import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      includeSpeakerNotes = true,
      pastedContent,
      useStockLibraryImages = false,
      imageOptions: userImageOptions,
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

    // Append pasted content
    if (pastedContent && typeof pastedContent === 'string' && pastedContent.trim().length > 0) {
      console.log(`[Gamma] Including pasted content: ${pastedContent.length} chars`);
      supportingContent += `\n--- Pasted Content ---\n${pastedContent.trim()}\n`;
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
    if (includeSpeakerNotes) {
      inputText += `\n\nInclude a speaker note on every slide with one clear talking point for the presenter.`;
    }

    // Build additional instructions — condensed to stay within Gamma's 5000-char limit
    let additionalInstructions = `British English spelling throughout. Audience: ${audience}. Professional design. Each slide: clear, actionable message.`;

    // Determine effective image source from user selection, default to noImages
    const effectiveImageSource = userImageOptions?.source || 'noImages';
    console.log(`[Gamma] Image source: ${effectiveImageSource}`);

    // Image requirements — conditional on image mode
    if (effectiveImageSource === 'noImages' && !useStockLibraryImages) {
      additionalInstructions += ` Do not include any images. Focus on clean text-based slides.`;
    } else if (!useStockLibraryImages && effectiveImageSource !== 'noImages') {
      additionalInstructions += ` Every slide must include a high-quality image relevant to the topic. No slide without a visual.`;
      additionalInstructions += ` Use the provided stock library images where relevant. Place images as accent visuals alongside content — never let an image dominate or push text to the bottom. Not every slide needs an image.`;
    }

    // Speaker notes (condensed)
    if (includeSpeakerNotes) {
      additionalInstructions += ` PRESENTER NOTES: Write detailed notes in the hidden "notes" field only (Presenter View). Never add visible "Speaker Notes" sections on slides. Visible content: concise bullets and images only. Notes: full-sentence talking points in British English.`;
    }

    // Data integrity (condensed)
    additionalInstructions += ` DATA INTEGRITY: Only use statistics/numbers explicitly in the source content. Never fabricate figures. Use qualitative descriptions if data is absent.`;
    additionalInstructions += ` LAYOUT: Body text must be at least 16pt. Headings at least 24pt. Never shrink text to fit more content — split across slides instead.`;

    // Custom instructions (highest priority — added early)
    if (customInstructions) {
      additionalInstructions += ` ${customInstructions}`;
    }

    // NHS/healthcare (condensed)
    if (presentationType.toLowerCase().includes('nhs') || 
        presentationType.toLowerCase().includes('healthcare') ||
        presentationType.toLowerCase().includes('clinical')) {
      additionalInstructions += ` Follow NHS branding. Healthcare terminology. Accessibility compliant.`;
    }

    // Colour palette (condensed)
    if (localThemeStyle) {
      additionalInstructions += ` Colours: Primary ${localThemeStyle.primaryColor}, Secondary ${localThemeStyle.secondaryColor}, Accent ${localThemeStyle.accentColor}. Apply on headings, backgrounds, key elements.`;
    }

    // Font style — always specify standard Office fonts to prevent "Save with Fonts" warning
    const fontMap: Record<string, string> = {
      'professional': 'Prefer Calibri or Arial',
      'modern': 'Prefer Calibri or Segoe UI',
      'elegant': 'Prefer Georgia or Cambria serif fonts',
      'clean': 'Prefer Arial or Calibri',
    };
    const fontInstruction = fontMap[fontStyle] || 'Prefer standard Office fonts such as Calibri or Arial';
    additionalInstructions += ` FONTS: ${fontInstruction}.`;

    // Branding (condensed)
    if (branding) {
      if (branding.logoUrl) {
        additionalInstructions += ` Logo at ${branding.logoPosition || 'top right'} on each slide.`;
      }
      if (branding.showCardNumbers !== false) {
        additionalInstructions += ` Slide numbers at ${branding.cardNumberPosition || 'bottom right'}.`;
      }
    }

    // Hard safety cap at 4900 chars to stay under Gamma's 5000-char limit
    if (additionalInstructions.length > 4900) {
      console.warn(`[Gamma] additionalInstructions too long (${additionalInstructions.length} chars), truncating to 4900`);
      additionalInstructions = additionalInstructions.substring(0, 4900);
      const lastPeriod = additionalInstructions.lastIndexOf('.');
      if (lastPeriod > 4000) {
        additionalInstructions = additionalInstructions.substring(0, lastPeriod + 1);
      }
    }

    console.log(`[Gamma] additionalInstructions length: ${additionalInstructions.length} chars`);

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
      imageOptions: effectiveImageSource === 'noImages'
        ? { source: 'noImages' }
        : {
            source: effectiveImageSource,
            model: effectiveImageSource === 'aiGenerated' ? 'imagen-4-pro' : undefined,
            style: effectiveImageSource === 'aiGenerated' ? 'photorealistic' : undefined,
          },
      cardOptions: {
        dimensions: '16x9',
      },
    };

    // Add branding/logo if provided
    if (branding?.logo?.src) {
      requestPayload.branding = branding;
      console.log('[Gamma] Branding logo included in payload');
    }

    if (useStockLibraryImages) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        const { data: stockImages, error: stockError } = await supabaseClient
          .from('stock_images')
          .select('image_url, title, tags, category')
          .eq('is_active', true)
          .limit(60);

        if (stockError) {
          console.warn(`[Gamma] Stock images query failed: ${stockError.message}`);
        } else if (stockImages && stockImages.length > 0) {
          // Fisher-Yates shuffle then take first 30
          const shuffled = [...stockImages];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const selected = shuffled.slice(0, 30);
          console.log(`[Gamma] Selected ${selected.length} random stock images from ${stockImages.length} total`);
          
          const imageRefs = selected
            .map((img: any) => `![${img.title || img.category}](${img.image_url})`)
            .join('\n');
          
          requestPayload.inputText += `\n\nPlace each image as a small accent visual (no wider than 40% of the slide). Content text must remain the primary focus. Never allow an image to push content below the fold. Use at most one image per slide.\n${imageRefs}`;
          requestPayload.imageOptions = { source: 'noImages' };
          
          console.log(`[Gamma] Injected ${selected.length} stock image URLs, set imageOptions to noImages`);
        } else {
          console.warn('[Gamma] No active stock images found, falling back to AI-generated images');
        }
      } catch (stockErr) {
        console.error('[Gamma] Error fetching stock images:', stockErr);
        // Fall back to AI-generated images
      }
    }

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
