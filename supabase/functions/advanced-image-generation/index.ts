import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to convert image to RGBA format for OpenAI edit API using Canvas API
async function convertToRGBAFormat(imageBuffer: ArrayBuffer): Promise<Blob> {
  try {
    console.log(`Processing image buffer: ${imageBuffer.byteLength} bytes`);
    
    // Create image data from buffer using Canvas API available in Deno
    const uint8Array = new Uint8Array(imageBuffer);
    
    // Basic format validation
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && 
                  uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
    const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8;
    const isWebP = uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && 
                   uint8Array[10] === 0x42 && uint8Array[11] === 0x50;
    
    if (!isPNG && !isJPEG && !isWebP) {
      throw new Error('Unsupported image format. Please use PNG, JPEG, or WebP.');
    }
    
    console.log(`Detected format: ${isPNG ? 'PNG' : isJPEG ? 'JPEG' : 'WebP'}`);
    
    // Convert buffer to blob for Image constructor
    const imageBlob = new Blob([uint8Array]);
    
    // Create ImageBitmap from the blob using Deno's Canvas API
    const imageBitmap = await createImageBitmap(imageBlob);
    
    console.log(`Image dimensions: ${imageBitmap.width}x${imageBitmap.height}`);
    
    // Create an OffscreenCanvas to process the image
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }
    
    // Clear canvas with transparent background to ensure RGBA format
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the image bitmap to canvas (this ensures RGBA format)
    ctx.drawImage(imageBitmap, 0, 0);
    
    // Convert canvas to PNG blob (PNG format always supports RGBA)
    const blob = await canvas.convertToBlob({ 
      type: 'image/png',
      quality: 1.0 
    });
    
    console.log(`Image converted to RGBA PNG: ${blob.size} bytes`);
    
    // Clean up resources
    imageBitmap.close();
    
    return blob;
    
  } catch (error) {
    console.error('RGBA conversion failed:', error);
    
    // Enhanced error messaging for common issues
    if (error instanceof Error) {
      if (error.message.includes('createImageBitmap')) {
        throw new Error('Invalid image file. Please ensure the image is not corrupted and try again.');
      } else if (error.message.includes('OffscreenCanvas')) {
        throw new Error('Canvas processing failed. This may be a temporary issue - please try again.');
      } else if (error.message.includes('convertToBlob')) {
        throw new Error('Image processing failed. The image may be too large or corrupted.');
      }
    }
    
    // Re-throw with original error message if no specific handling
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.log('=== STARTING IMAGE EDIT PROCESS ===');
      console.log(`Edit mode activated with imageUrl: ${imageUrl}`);
      console.log(`Original prompt: "${prompt}"`);
      
      // OpenAI edit API only supports square images: 256x256, 512x512, 1024x1024
      let editSize = size;
      if (!['256x256', '512x512', '1024x1024'].includes(size)) {
        console.log(`Size ${size} not supported for edit mode, defaulting to 1024x1024`);
        editSize = '1024x1024';
      }
      console.log(`Using edit size: ${editSize}`);
      
      // For edits, we need to send as form data
      const editFormData = new FormData();
      editFormData.append('model', 'dall-e-2'); // dall-e-2 supports edits
      editFormData.append('prompt', prompt);
      editFormData.append('size', editSize);
      console.log('Form data prepared for OpenAI edit API');
      
      // Download the image and convert it to proper format for OpenAI edit API
      console.log(`=== DOWNLOADING IMAGE ===`);
      console.log(`Downloading reference image from: ${imageUrl}`);
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        console.error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      console.log(`Downloaded image: type=${imageResponse.headers.get('content-type')}, size=${imageBuffer.byteLength} bytes`);
      
      // Validate image size (OpenAI has limits)
      if (imageBuffer.byteLength > 4 * 1024 * 1024) { // 4MB limit
        console.error('Image too large for OpenAI API');
        throw new Error('Image file is too large. Please use an image smaller than 4MB.');
      }
      
      // Convert image to RGBA format using Canvas API
      console.log('=== STARTING RGBA CONVERSION ===');
      console.log('Converting image to RGBA format...');
      let processedImageBlob;
      try {
        processedImageBlob = await convertToRGBAFormat(imageBuffer);
        console.log(`✅ RGBA conversion successful: ${processedImageBlob.size} bytes, type: ${processedImageBlob.type}`);
      } catch (conversionError) {
        console.error('❌ RGBA conversion failed:', conversionError);
        throw new Error(`Image conversion failed: ${conversionError.message}`);
      }
      
      editFormData.append('image', processedImageBlob, 'image.png');
      console.log('Image attached to form data');
      
      console.log('=== CALLING OPENAI EDIT API ===');
      console.log(`Making request to OpenAI edit API...`);
      console.log(`Edit request details:`);
      console.log(`- Endpoint: ${endpoint}`);
      console.log(`- Prompt: "${prompt}"`);
      console.log(`- Size: ${editSize}`);
      console.log(`- Model: dall-e-2`);
      console.log(`- Image size: ${processedImageBlob.size} bytes`);

      const editResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: editFormData
      });
      
      console.log(`OpenAI edit response received with status: ${editResponse.status}`);

      if (!editResponse.ok) {
        const errorText = await editResponse.text();
        console.error('❌ OpenAI edit API error:', editResponse.status, errorText);
        
        // Parse error for better user messaging
        let userFriendlyError = 'Image editing failed. ';
        try {
          const errorData = JSON.parse(errorText);
          console.log('Parsed OpenAI error:', errorData);
          if (errorData.error?.message) {
            const message = errorData.error.message;
            console.log('OpenAI error message:', message);
            if (message.includes('RGBA') || message.includes('format')) {
              userFriendlyError += 'The image format is not compatible. Please try with a PNG image that has transparency support.';
            } else if (message.includes('size') || message.includes('dimensions')) {
              userFriendlyError += 'The image dimensions are not supported. Please use a square image (e.g., 1024x1024).';
            } else {
              userFriendlyError += message;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse OpenAI error:', parseError);
          userFriendlyError += 'Please try again with a different image or contact support if the issue persists.';
        }
        
        return new Response(
          JSON.stringify({ error: userFriendlyError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        );
      }

      const editData = await editResponse.json();
      console.log('✅ OpenAI edit response received successfully');
      console.log('Edit response data structure:', Object.keys(editData));
      
      const imageData = editData.data?.[0]?.url;
      console.log('Extracted image URL:', imageData ? 'Present' : 'Missing');

      if (!imageData) {
        console.error('❌ No image URL in OpenAI response:', editData);
        return new Response(
          JSON.stringify({ error: 'No image returned from OpenAI' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        );
      }

      console.log('=== IMAGE EDIT COMPLETED SUCCESSFULLY ===');
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