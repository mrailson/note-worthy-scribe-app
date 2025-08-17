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
  referenceImage?: string;
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

    const { prompt, size = "1024x1024", quality = "standard", referenceImage, mode }: ImageRequest = await req.json();

    console.log(`Generating image with prompt: ${prompt}, mode: ${mode || 'generation'}`);

    let response;

    if (referenceImage && mode === 'edit') {
      // Extract base64 data from the data URL
      const base64Data = referenceImage.startsWith('IMAGE_DATA_URL:') 
        ? referenceImage.replace('IMAGE_DATA_URL:', '') 
        : referenceImage;
      
      const imageBase64 = base64Data.split(',')[1] || base64Data;

      // Use DALL-E 2 for image editing (DALL-E 3 doesn't support edits)
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: (() => {
          const formData = new FormData();
          
          // Convert base64 to blob
          const byteCharacters = atob(imageBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });
          
          formData.append('image', blob, 'image.png');
          formData.append('prompt', prompt);
          formData.append('n', '1');
          formData.append('size', '1024x1024');
          formData.append('response_format', 'b64_json');
          
          return formData;
        })()
      });
    } else {
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
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      
      // Parse the error to provide better user feedback
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.code === 'content_policy_violation') {
          throw new Error('Your prompt was rejected by OpenAI\'s safety system. Try rephrasing your request with different words or focusing on non-medical content.');
        }
      } catch (parseError) {
        // If we can't parse the error, fall through to generic error
      }
      
      throw new Error(`Failed to generate image. Please try a different prompt or try again later.`);
    }

    const data = await response.json();
    const imageData = data.data[0].b64_json;

    return new Response(
      JSON.stringify({ 
        success: true,
        imageData: `data:image/png;base64,${imageData}`,
        revisedPrompt: data.data[0].revised_prompt
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
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});