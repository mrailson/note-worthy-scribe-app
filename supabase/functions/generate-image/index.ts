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

      // Convert base64 to blob and ensure it's PNG format
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Check if the image is too large (4MB limit for OpenAI)
      if (byteArray.length > 4 * 1024 * 1024) {
        throw new Error('Image is too large. Please use an image smaller than 4MB.');
      }

      // Convert to PNG if it's not already
      let imageBlob: Blob;
      const originalMimeType = base64Data.match(/data:([^;]+);/)?.[1] || 'image/png';
      
      if (originalMimeType !== 'image/png') {
        // Convert image to PNG using Canvas API
        const canvas = new OffscreenCanvas(1024, 1024);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not create canvas context for image conversion');
        }

        // Create image from blob
        const img = new Image();
        const imgBlob = new Blob([byteArray], { type: originalMimeType });
        const imgUrl = URL.createObjectURL(imgBlob);
        
        try {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
          });

          // Draw and resize image to fit canvas
          const aspectRatio = img.width / img.height;
          let drawWidth = 1024;
          let drawHeight = 1024;
          
          if (aspectRatio > 1) {
            drawHeight = 1024 / aspectRatio;
          } else {
            drawWidth = 1024 * aspectRatio;
          }
          
          const offsetX = (1024 - drawWidth) / 2;
          const offsetY = (1024 - drawHeight) / 2;
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, 1024, 1024);
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

          // Convert to PNG blob
          imageBlob = await canvas.convertToBlob({ type: 'image/png' });
        } finally {
          URL.revokeObjectURL(imgUrl);
        }
      } else {
        imageBlob = new Blob([byteArray], { type: 'image/png' });
      }

      // Use DALL-E 2 for image editing (DALL-E 3 doesn't support edits)
      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png');
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      formData.append('response_format', 'b64_json');

      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
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
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
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