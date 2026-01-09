import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY');
const GAMMA_API_BASE = 'https://api.gamma.app';

interface GammaGenerationRequest {
  topic: string;
  presentationType?: string;
  slideCount?: number;
  supportingContent?: string;
  customInstructions?: string;
  audience?: string;
}

interface GammaGenerationResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exportUrl?: string;
  error?: string;
}

// Poll for generation completion with exponential backoff
async function pollForCompletion(generationId: string, maxAttempts = 60): Promise<GammaGenerationResponse> {
  let attempts = 0;
  let delay = 2000; // Start with 2 seconds
  
  while (attempts < maxAttempts) {
    console.log(`[Gamma] Polling attempt ${attempts + 1}/${maxAttempts} for generation ${generationId}`);
    
    const response = await fetch(`${GAMMA_API_BASE}/v1.0/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': GAMMA_API_KEY!,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gamma] Poll error: ${response.status} - ${errorText}`);
      throw new Error(`Gamma API poll error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Gamma] Poll response status: ${data.status}`);
    
    if (data.status === 'completed') {
      return data;
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error || 'Gamma generation failed');
    }
    
    // Wait before next poll with exponential backoff (max 10 seconds)
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.2, 10000);
    attempts++;
  }
  
  throw new Error('Gamma generation timed out');
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
      audience = 'healthcare professionals'
    } = requestBody;

    console.log(`[Gamma] Starting generation for topic: "${topic}"`);
    console.log(`[Gamma] Type: ${presentationType}, Slides: ${slideCount}`);

    // Build the input text with context
    let inputText = `Create a ${presentationType} about: ${topic}`;
    
    if (supportingContent) {
      inputText += `\n\nKey content to include:\n${supportingContent}`;
    }

    // Build additional instructions
    let additionalInstructions = `
- Use British English spelling and terminology throughout
- Target audience: ${audience}
- Create exactly ${slideCount} slides
- Use professional, clean design
- Include data visualisations where appropriate
- Each slide should have a clear, actionable message
`;

    if (customInstructions) {
      additionalInstructions += `\n- Additional requirements: ${customInstructions}`;
    }

    // NHS/Healthcare specific instructions based on presentation type
    if (presentationType.toLowerCase().includes('nhs') || 
        presentationType.toLowerCase().includes('healthcare') ||
        presentationType.toLowerCase().includes('clinical')) {
      additionalInstructions += `
- Follow NHS branding guidelines where appropriate
- Use healthcare-appropriate terminology
- Ensure accessibility compliance
- Include relevant NHS/healthcare context
`;
    }

    console.log('[Gamma] Initiating generation request...');

    // Step 1: Create generation request
    const createResponse = await fetch(`${GAMMA_API_BASE}/v1.0/generations`, {
      method: 'POST',
      headers: {
        'X-API-KEY': GAMMA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[Gamma] Create error: ${createResponse.status} - ${errorText}`);
      throw new Error(`Gamma API error: ${createResponse.status} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const generationId = createData.id;
    
    console.log(`[Gamma] Generation started with ID: ${generationId}`);

    // Step 2: Poll for completion
    const completedGeneration = await pollForCompletion(generationId);
    
    if (!completedGeneration.exportUrl) {
      throw new Error('No export URL in completed generation');
    }

    console.log(`[Gamma] Generation completed. Downloading PPTX from: ${completedGeneration.exportUrl}`);

    // Step 3: Download the PPTX file
    const pptxResponse = await fetch(completedGeneration.exportUrl);
    
    if (!pptxResponse.ok) {
      throw new Error(`Failed to download PPTX: ${pptxResponse.status}`);
    }

    const pptxBuffer = await pptxResponse.arrayBuffer();
    const pptxBytes = new Uint8Array(pptxBuffer);
    
    // Convert to base64 in chunks to avoid memory issues
    const chunkSize = 8192;
    let base64 = '';
    for (let i = 0; i < pptxBytes.length; i += chunkSize) {
      const chunk = pptxBytes.slice(i, Math.min(i + chunkSize, pptxBytes.length));
      base64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pptxBase64 = btoa(base64);

    console.log(`[Gamma] PPTX downloaded and converted to base64 (${pptxBase64.length} chars)`);

    return new Response(
      JSON.stringify({
        success: true,
        pptxBase64,
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
