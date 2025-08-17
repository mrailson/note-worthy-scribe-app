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

    console.log(`Processing image request - Prompt: "${prompt.substring(0, 100)}...", Mode: ${mode || 'generation'}, Has reference: ${!!referenceImage}`);

    let response;

    if (referenceImage && mode === 'edit') {
      console.log('Processing image edit request...');
      
      // Validate and extract base64 data
      let base64Data = referenceImage;
      
      // Handle IMAGE_DATA_URL prefix
      if (base64Data.startsWith('IMAGE_DATA_URL:')) {
        base64Data = base64Data.replace('IMAGE_DATA_URL:', '');
      }
      
      // Handle data URL format (data:image/type;base64,...)
      if (base64Data.startsWith('data:')) {
        const commaIndex = base64Data.indexOf(',');
        if (commaIndex === -1) {
          throw new Error('Invalid image data format. Missing comma separator.');
        }
        base64Data = base64Data.substring(commaIndex + 1);
      }

      // Validate base64 string
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Empty image data provided.');
      }

      try {
        // Test base64 validity before proceeding
        const testDecode = atob(base64Data.substring(0, 100));
        console.log(`Base64 validation successful. Data length: ${base64Data.length}`);
        
        // Convert base64 to Uint8Array
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        console.log(`Image processed. Size: ${byteArray.length} bytes`);

        // Check file size (4MB limit for OpenAI)
        if (byteArray.length > 4 * 1024 * 1024) {
          throw new Error('Image is too large. Please use an image smaller than 4MB.');
        }

        // Validate minimum file size (avoid empty files)
        if (byteArray.length < 100) {
          throw new Error('Image file appears to be empty or corrupted.');
        }

        // Create PNG blob for OpenAI API (required for edits)
        const imageBlob = new Blob([byteArray], { type: 'image/png' });
        console.log(`Created blob with size: ${imageBlob.size} bytes`);

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
        
      } catch (decodeError) {
        console.error('Base64 decode error:', decodeError);
        if (decodeError instanceof Error && decodeError.message.includes('Invalid character')) {
          throw new Error('Invalid image data. Please ensure the uploaded file is a valid image.');
        }
        throw new Error(`Failed to process image data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
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