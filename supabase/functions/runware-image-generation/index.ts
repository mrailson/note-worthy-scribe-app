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

    const { prompt, mode, size = '1024x1024', quality = 'high', referenceImage } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Generating image with Runware - prompt: ${prompt}, mode: ${mode || 'generation'}`);

    // Parse dimensions from size string
    const [width, height] = size.split('x').map(Number);

    // Create task UUID for this request
    const taskUUID = crypto.randomUUID();

    // Prepare the enhanced prompt based on mode
    let enhancedPrompt = prompt;
    if (mode === 'edit') {
      if (referenceImage) {
        enhancedPrompt = `Transform the image style: ${prompt}. Create a new artistic interpretation that applies this transformation while maintaining visual coherence and quality.`;
      } else {
        enhancedPrompt = `Create an image with this style or transformation: ${prompt}`;
      }
    }

    // Prepare Runware API request
    const runwareRequests = [
      {
        taskType: "authentication",
        apiKey: runwareApiKey
      } as RunwareAuthRequest,
      {
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
      } as RunwareImageRequest
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