import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RunwareImageRequest {
  taskType: string;
  taskUUID: string;
  positivePrompt: string;
  model?: string;
  width?: number;
  height?: number;
  numberResults?: number;
  outputFormat?: string;
  CFGScale?: number;
  scheduler?: string;
  strength?: number;
  seed?: number;
}

interface RunwareAuthRequest {
  taskType: string;
  apiKey: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const runwareApiKey = Deno.env.get('RUNWARE_API_KEY');
    if (!runwareApiKey) {
      return new Response(
        JSON.stringify({ error: 'Runware API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const formData = await req.formData();
    const prompt = formData.get('prompt')?.toString();
    const mode = formData.get('mode')?.toString() || 'generation';
    const size = formData.get('size')?.toString() || '1024x1024';
    const quality = formData.get('quality')?.toString() || 'high';
    const referenceImageFile = formData.get('image') as File | null;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Generating image with Runware - prompt: ${prompt}, mode: ${mode}, hasReferenceImage: ${!!referenceImageFile}`);

    // Initialize Supabase client for image uploads
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let referenceImageUrl: string | null = null;

    // Upload reference image to Supabase storage if provided
    if (referenceImageFile && referenceImageFile.size > 0) {
      console.log(`Uploading reference image: ${referenceImageFile.name}, size: ${referenceImageFile.size} bytes`);
      
      const fileBytes = await referenceImageFile.arrayBuffer();
      const filename = `refs/${crypto.randomUUID()}-${referenceImageFile.name}`;

      const { error: uploadError } = await supabase
        .storage
        .from('reference-images')
        .upload(filename, fileBytes, {
          contentType: referenceImageFile.type || 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return new Response(
          JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Get signed URL for the uploaded image
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

      referenceImageUrl = signedData.signedUrl;
      console.log('Reference image uploaded and signed URL created');
    }

    // Parse dimensions from size string
    const [width, height] = size.split('x').map(Number);

    // Create task UUID for this request
    const taskUUID = crypto.randomUUID();

    // Prepare the enhanced prompt based on mode and reference image
    let enhancedPrompt = prompt;
    if (mode === 'edit' && referenceImageUrl) {
      enhancedPrompt = `Apply this transformation to the uploaded reference image: ${prompt}. Maintain the main subject and composition while applying the requested style changes.`;
    } else if (mode === 'edit') {
      enhancedPrompt = `Create an image with this style or transformation: ${prompt}`;
    }

    // Prepare Runware API request - use different taskType if we have a reference image
    let imageRequest: any;
    
    if (referenceImageUrl && mode === 'edit') {
      // Use image-to-image generation for reference-based editing
      imageRequest = {
        taskType: "imageInference", // Runware's image-to-image task
        taskUUID,
        positivePrompt: enhancedPrompt,
        inputImage: referenceImageUrl, // Use the reference image
        model: "runware:100@1",
        width: width || 1024,
        height: height || 1024,
        numberResults: 1,
        outputFormat: "WEBP",
        CFGScale: 7, // Higher for better adherence to prompt
        scheduler: "FlowMatchEulerDiscreteScheduler",
        strength: 0.7 // Controls how much to transform the input image
      };
    } else {
      // Standard text-to-image generation
      imageRequest = {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: enhancedPrompt,
        model: "runware:100@1",
        width: width || 1024,
        height: height || 1024,
        numberResults: 1,
        outputFormat: "WEBP",
        CFGScale: 1,
        scheduler: "FlowMatchEulerDiscreteScheduler",
        strength: 0.8
      };
    }

    // Prepare Runware API request
    const runwareRequests = [
      {
        taskType: "authentication",
        apiKey: runwareApiKey
      } as RunwareAuthRequest,
      imageRequest
    ];

    console.log('Making request to Runware API...');
    
    // Make request to Runware
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runwareRequests)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Runware API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Runware API error: ${errorText}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    console.log('Runware response:', data);

    // Find the image result in the response
    const imageResult = data.data?.find((item: any) => item.taskType === 'imageInference' && item.taskUUID === taskUUID);
    
    if (!imageResult || !imageResult.imageURL) {
      console.error('No image result found in Runware response:', data);
      return new Response(
        JSON.stringify({ error: 'No image returned from Runware' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    console.log('Image generation successful with Runware');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageData: imageResult.imageURL,
        revisedPrompt: enhancedPrompt,
        seed: imageResult.seed,
        cost: imageResult.cost
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in runware-image-generation function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});