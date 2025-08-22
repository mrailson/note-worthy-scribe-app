import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to convert image to RGBA format for OpenAI edit API
async function convertToRGBAFormat(imageBuffer: ArrayBuffer): Promise<Blob> {
  try {
    // Try to use imagescript for image processing in Deno
    const { Image } = await import('https://deno.land/x/imagescript@1.2.15/mod.ts');
    
    // Decode the image
    const image = await Image.decode(new Uint8Array(imageBuffer));
    
    // Ensure the image has an alpha channel
    let rgbaImage = image;
    if (image.bitmap.length === image.width * image.height * 3) {
      // RGB format - need to add alpha channel
      console.log('Converting RGB to RGBA format');
      const rgbaData = new Uint8Array(image.width * image.height * 4);
      
      for (let i = 0, j = 0; i < image.bitmap.length; i += 3, j += 4) {
        rgbaData[j] = image.bitmap[i];     // R
        rgbaData[j + 1] = image.bitmap[i + 1]; // G
        rgbaData[j + 2] = image.bitmap[i + 2]; // B
        rgbaData[j + 3] = 255; // A (fully opaque)
      }
      
      // Create new image with RGBA data
      rgbaImage = new Image(image.width, image.height);
      rgbaImage.bitmap = rgbaData;
    }
    
    // Encode as PNG (which preserves alpha channel)
    const pngBuffer = await rgbaImage.encode();
    console.log(`Image converted to RGBA PNG format: ${pngBuffer.length} bytes`);
    
    return new Blob([pngBuffer], { type: 'image/png' });
    
  } catch (imagescriptError) {
    console.log('ImageScript not available, trying simpler approach:', imagescriptError.message);
    
    // Fallback approach - check PNG format and add basic validation
    const uint8Array = new Uint8Array(imageBuffer);
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && 
                  uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
    
    if (!isPNG) {
      throw new Error('Image must be in PNG format for editing. Please convert your image to PNG format first.');
    }
    
    // For PNG files, check if they have an alpha channel by examining the color type
    // PNG color type is at byte 25 (0x19)
    if (uint8Array.length > 25) {
      const colorType = uint8Array[25];
      // Color types 4 and 6 have alpha channels
      const hasAlpha = colorType === 4 || colorType === 6;
      
      if (!hasAlpha) {
        console.log('PNG image does not have alpha channel, this may cause OpenAI API issues');
        // We could try to add an alpha channel here, but it's complex without image processing library
        throw new Error('Image must have transparency support (RGBA format) for editing. Please use an image editor to add an alpha channel.');
      }
    }
    
    console.log(`PNG image appears to have alpha channel support`);
    return new Blob([imageBuffer], { type: 'image/png' });
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const prompt = formData.get('prompt')?.toString();
    const file = formData.get('image') as File | null;
    const mode = formData.get('mode')?.toString() || 'generation'; // 'generation' or 'edit'
    const size = formData.get('size')?.toString() || '1024x1024';
    const quality = formData.get('quality')?.toString() || 'high';

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Generating image with prompt: ${prompt}, mode: ${mode}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let imageUrl: string | undefined;

    // If file is provided, upload it to Supabase storage
    if (file && file.size > 0) {
      console.log(`Uploading reference image: ${file.name}, size: ${file.size} bytes`);
      
      const fileBytes = await file.arrayBuffer();
      const filename = `refs/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await supabase
        .storage
        .from('reference-images')
        .upload(filename, fileBytes, {
          contentType: file.type || 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return new Response(
          JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Get signed URL for the uploaded image (valid for 10 minutes)
      const { data: signedData, error: signedError } = await supabase
        .storage
        .from('reference-images')
        .createSignedUrl(filename, 600); // 10 minutes

      if (signedError) {
        console.error('Signed URL error:', signedError);
        return new Response(
          JSON.stringify({ error: `Failed to create signed URL: ${signedError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      imageUrl = signedData.signedUrl;
      console.log('Reference image uploaded and signed URL created');
    }

    // Build the request for OpenAI
    let requestBody: any;
    let endpoint = 'https://api.openai.com/v1/images/generations';

    if (mode === 'edit' && imageUrl) {
      // Use the edit endpoint for image editing
      endpoint = 'https://api.openai.com/v1/images/edits';
      
      // OpenAI edit API only supports square images: 256x256, 512x512, 1024x1024
      let editSize = size;
      if (!['256x256', '512x512', '1024x1024'].includes(size)) {
        console.log(`Size ${size} not supported for edit mode, defaulting to 1024x1024`);
        editSize = '1024x1024';
      }
      
      // For edits, we need to send as form data
      const editFormData = new FormData();
      editFormData.append('model', 'dall-e-2'); // dall-e-2 supports edits
      editFormData.append('prompt', prompt);
      editFormData.append('size', editSize);
      
      // Download the image and convert it to proper format for OpenAI edit API
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      console.log(`Downloaded image: size=${imageBuffer.byteLength} bytes`);
      
      // Convert image to RGBA format using Canvas API
      // This ensures the image has the alpha channel required by OpenAI
      const processedImageBlob = await convertToRGBAFormat(imageBuffer);
      
      editFormData.append('image', processedImageBlob, 'image.png');

      const editResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: editFormData
      });

      if (!editResponse.ok) {
        const errorText = await editResponse.text();
        console.error('OpenAI edit error:', errorText);
        return new Response(
          JSON.stringify({ error: `OpenAI error: ${errorText}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        );
      }

      const editData = await editResponse.json();
      const imageData = editData.data?.[0]?.url;

      if (!imageData) {
        return new Response(
          JSON.stringify({ error: 'No image returned from OpenAI' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          imageData,
          revisedPrompt: prompt
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Use generation endpoint - just use the user's prompt directly
      const enhancedPrompt = prompt;

      requestBody = {
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        size,
        quality: quality === 'high' ? 'hd' : 'standard',
        n: 1
      };

      // If we have a reference image URL, we could include it in the prompt context
      // Note: gpt-image-1 handles this differently than the older models
      if (imageUrl) {
        requestBody.prompt = `${enhancedPrompt}\n\nReference style from: ${imageUrl}`;
      }
    }

    console.log('Making request to OpenAI:', { endpoint, model: requestBody.model, size: requestBody.size });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${errorText}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    console.log('OpenAI response received');

    // Extract image data
    let imageData: string;
    let revisedPrompt = prompt;

    if (data.data?.[0]?.b64_json) {
      // Base64 format
      imageData = `data:image/png;base64,${data.data[0].b64_json}`;
    } else if (data.data?.[0]?.url) {
      // URL format
      imageData = data.data[0].url;
    } else {
      console.error('Unexpected OpenAI response format:', data);
      return new Response(
        JSON.stringify({ error: 'No image returned from OpenAI' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    // Check if OpenAI provided a revised prompt
    if (data.data?.[0]?.revised_prompt) {
      revisedPrompt = data.data[0].revised_prompt;
    }

    console.log('Image generation successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageData,
        revisedPrompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in advanced-image-generation function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});