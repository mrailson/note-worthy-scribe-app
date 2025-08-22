import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      
      // Download the image and append directly (frontend should already convert to PNG)
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      
      console.log(`Downloaded image: type=${imageBlob.type}, size=${imageBlob.size} bytes`);
      
      // Ensure we have a PNG file (frontend should handle this, but double-check)
      if (imageBlob.type !== 'image/png') {
        console.error(`Invalid image type for editing: ${imageBlob.type}. OpenAI edit API requires PNG format.`);
        return new Response(
          JSON.stringify({ 
            error: 'Image must be in PNG format for editing. Please ensure your image is converted to PNG before uploading.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      editFormData.append('image', imageBlob, 'image.png');

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