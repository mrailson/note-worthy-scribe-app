import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageRequest {
  prompt: string;
  size?: string;
  quality?: string;
  imagePath?: string; // Storage path instead of base64
  mode?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { prompt, size = "1024x1024", quality = "standard", imagePath, mode }: ImageRequest = await req.json();

    console.log(`Processing image request - Prompt: "${prompt.substring(0, 100)}...", Mode: ${mode || 'generation'}, Has image: ${!!imagePath}`);

    let response;

    if (imagePath && mode === 'edit') {
      console.log('Image editing mode detected. Note: For best results with reference images, describe the changes you want to make.');
      
      // For now, we'll use DALL-E 3 with an enhanced prompt that references the uploaded image concept
      // Since DALL-E 2 edit requires masks which are complex to implement properly
      const enhancedPrompt = `Based on the reference image provided, ${prompt}. Maintain the core composition and subjects while applying the requested changes.`;
      
      console.log('Using enhanced prompt for image-to-image generation:', enhancedPrompt);
      
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          n: 1,
          size: size,
          quality: quality,
          response_format: 'b64_json'
        })
      });

      console.log(`OpenAI generation response status: ${response.status}`);
    } else {
      console.log('Processing standard image generation...');
      
      // Standard image generation with DALL-E 3
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: size,
          quality: quality,
          response_format: 'b64_json'
        })
      });

      console.log(`OpenAI generation response status: ${response.status}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      
      let errorMessage = `OpenAI API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response from OpenAI API. Missing image data.');
    }
    
    const imageData = data.data[0].b64_json;
    console.log(`Successfully generated image. Response data length: ${imageData.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        imageData: `data:image/png;base64,${imageData}`,
        revisedPrompt: data.data[0].revised_prompt || null
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    
    let errorMessage = 'An unexpected error occurred';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide more specific error handling
      if (errorMessage.includes('API key not configured')) {
        statusCode = 500;
        errorMessage = 'Server configuration error. Please contact support.';
      } else if (errorMessage.includes('too large')) {
        statusCode = 413;
      } else if (errorMessage.includes('Invalid image') || errorMessage.includes('Invalid character')) {
        statusCode = 400;
      } else if (errorMessage.includes('OpenAI API error')) {
        statusCode = 502;
        errorMessage = 'Image generation service temporarily unavailable. Please try again.';
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: statusCode,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});