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
      console.log('Processing image edit request with storage path:', imagePath);
      
      try {
        // Download image from Supabase Storage
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Supabase configuration missing');
        }
        
        // Fetch the image from storage
        const imageUrl = `${supabaseUrl}/storage/v1/object/image-processing/${imagePath}`;
        console.log('Fetching image from:', imageUrl);
        
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        
        if (!imageResponse.ok) {
          console.error('Failed to fetch image from storage:', imageResponse.status, imageResponse.statusText);
          throw new Error(`Failed to fetch image from storage: ${imageResponse.status}`);
        }
        
        // Convert to blob for OpenAI
        const imageBlob = await imageResponse.blob();
        console.log(`Downloaded image blob. Size: ${imageBlob.size} bytes`);
        
        // Check file size (4MB limit for OpenAI)
        if (imageBlob.size > 4 * 1024 * 1024) {
          throw new Error('Image is too large. Please use an image smaller than 4MB.');
        }
        
        // Validate minimum file size (avoid empty files)
        if (imageBlob.size < 100) {
          throw new Error('Image file appears to be empty or corrupted.');
        }

        // Image should already be in PNG format from frontend conversion
        console.log(`Image received. Size: ${imageBlob.size} bytes, Type: ${imageBlob.type}`);
        
        // Prepare form data for DALL-E 2 image editing
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('prompt', prompt);
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('response_format', 'b64_json');

        console.log('Sending edit request to OpenAI...');
        
        response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: formData
        });

        console.log(`OpenAI edit response status: ${response.status}`);
        
      } catch (storageError) {
        console.error('Storage processing error:', storageError);
        throw new Error(`Failed to process image from storage: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
      }
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