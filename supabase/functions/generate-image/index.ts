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
      console.log('Processing image-guided generation with reference image:', imagePath);
      
      try {
        // Download image from Supabase Storage
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Supabase configuration missing');
        }
        
        // Fetch the image from storage
        const imageUrl = `${supabaseUrl}/storage/v1/object/image-processing/${imagePath}`;
        console.log('Fetching reference image from:', imageUrl);
        
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        
        if (!imageResponse.ok) {
          console.error('Failed to fetch image from storage:', imageResponse.status, imageResponse.statusText);
          throw new Error(`Failed to fetch image from storage: ${imageResponse.status}`);
        }
        
        // Convert to base64 for GPT-4 Vision
        const imageBlob = await imageResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const imageDataUrl = `data:image/png;base64,${base64Image}`;
        
        console.log('Analyzing reference image with GPT-4 Vision...');
        
        // Use GPT-4 Vision to analyze the reference image
        const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze this image in detail. Describe the subjects, composition, colors, lighting, setting, and mood. Then, based on this analysis and the user's request: "${prompt}", create a detailed prompt for DALL-E 3 that will generate a new image incorporating the requested changes while maintaining the essence of the original scene.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 500
          })
        });

        if (!visionResponse.ok) {
          console.error('GPT-4 Vision analysis failed:', visionResponse.status);
          throw new Error('Failed to analyze reference image');
        }

        const visionData = await visionResponse.json();
        const enhancedPrompt = visionData.choices[0].message.content;
        
        console.log('Enhanced prompt from image analysis:', enhancedPrompt);
        
        // Now use DALL-E 3 with the enhanced prompt
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
        
      } catch (storageError) {
        console.error('Image analysis error:', storageError);
        throw new Error(`Failed to process reference image: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
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