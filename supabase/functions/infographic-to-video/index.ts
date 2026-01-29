import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VideoRequest {
  imageBase64: string;
  mimeType: string;
  orientation: 'portrait' | 'landscape';
  durationSeconds?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Get API key - try Lovable AI gateway first, then Google API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY');
    
    if (!lovableApiKey && !googleApiKey) {
      console.error('No API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'No API key configured for video generation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body: VideoRequest = await req.json();
    const { imageBase64, mimeType = 'image/png', orientation, durationSeconds = 5 } = body;
    
    console.log(`Processing video generation request - orientation: ${orientation}, duration: ${durationSeconds}s`);
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Clean base64 data
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    // High-fidelity animation prompt
    const animationPrompt = `Animate this infographic with high structural fidelity. Keep the background layer completely static and stable to prevent distortion.
Apply a clean, sequential animation where the main content blocks, icons, and data visualizations gently fade in and slightly scale up into position. The animation flow should follow the natural reading order of the document.
Ensure all text remains 100% legible, crisp, and locked in place without morphing. The style should be high-end corporate motion graphics.`;

    // Use Lovable AI Gateway with video generation model
    if (lovableApiKey) {
      console.log('Using Lovable AI Gateway for video generation...');
      
      // Note: Lovable AI gateway currently doesn't support video generation
      // Fall through to Google API if available
      if (!googleApiKey) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Video generation requires a Google API key. Lovable AI Gateway does not currently support video generation.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Use Google Gemini API for video generation (Veo 2)
    console.log('Using Google Veo API for video generation...');
    
    // Determine aspect ratio based on orientation
    const aspectRatio = orientation === 'landscape' ? '16:9' : '9:16';
    
    // Use the generateVideos endpoint for image-to-video
    const veoRequest = {
      model: "veo-2.0-generate-001",
      generateVideoConfig: {
        aspectRatio: aspectRatio,
        numberOfVideos: 1,
        durationSeconds: Math.min(durationSeconds, 8), // Veo max is 8 seconds
        personGeneration: "dont_allow",
      },
      prompt: animationPrompt,
      image: {
        imageBytes: cleanBase64,
        mimeType: mimeType,
      },
    };
    
    console.log('Calling Veo 2 API...');
    
    // Start the video generation operation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideos?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(veoRequest),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Veo API error: ${response.status} - ${errorText}`);
      
      // Try alternative API format
      console.log('Trying alternative Gemini video generation format...');
      
      const altRequest = {
        contents: [
          {
            parts: [
              {
                text: animationPrompt
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["VIDEO"],
          videoDurationSeconds: Math.min(durationSeconds, 8),
        }
      };
      
      const altResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(altRequest),
        }
      );
      
      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.error(`Alternative API error: ${altResponse.status} - ${altErrorText}`);
        
        // Parse error for more user-friendly message
        try {
          const errorJson = JSON.parse(altErrorText);
          const errorMessage = errorJson.error?.message || altErrorText;
          
          if (errorMessage.includes('not been used') || errorMessage.includes('disabled')) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Video generation API is not enabled. Please enable the Generative Language API in Google Cloud Console and ensure you have access to Veo 2.' 
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: `Video generation failed: ${errorMessage}` }),
            { status: altResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch {
          return new Response(
            JSON.stringify({ success: false, error: `Video generation failed: ${altErrorText}` }),
            { status: altResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      const altData = await altResponse.json();
      console.log('Alternative API response received');
      
      // Extract video from response
      const videoPart = altData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('video/'));
      
      if (videoPart?.inlineData) {
        const videoDataUrl = `data:${videoPart.inlineData.mimeType};base64,${videoPart.inlineData.data}`;
        console.log('Video generated successfully via alternative API');
        return new Response(
          JSON.stringify({ success: true, videoUrl: videoDataUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('No video in alternative response:', altData);
      return new Response(
        JSON.stringify({ success: false, error: 'Video generation did not return a video. This feature may not be available for your API key.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const operationData = await response.json();
    console.log('Veo operation response:', JSON.stringify(operationData).substring(0, 500));
    
    // Handle long-running operation
    if (operationData.name) {
      console.log('Polling operation:', operationData.name);
      
      // Poll for completion
      const maxWaitMs = 180000; // 3 minutes
      const pollInterval = 5000; // 5 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const pollResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${operationData.name}?key=${googleApiKey}`,
          { method: 'GET' }
        );
        
        if (!pollResponse.ok) {
          const pollError = await pollResponse.text();
          console.error(`Poll error: ${pollResponse.status} - ${pollError}`);
          continue;
        }
        
        const pollData = await pollResponse.json();
        console.log(`Poll status: done=${pollData.done}`);
        
        if (pollData.done) {
          if (pollData.error) {
            console.error('Operation failed:', pollData.error);
            return new Response(
              JSON.stringify({ success: false, error: pollData.error.message || 'Video generation failed' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Extract video from response
          const videos = pollData.response?.generatedVideos || pollData.response?.generatedSamples;
          if (videos && videos.length > 0) {
            const video = videos[0].video || videos[0];
            
            if (video.uri) {
              console.log('Video generated with URI');
              return new Response(
                JSON.stringify({ success: true, videoUrl: video.uri }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else if (video.bytesBase64Encoded || video.videoBytes) {
              const videoBase64 = video.bytesBase64Encoded || video.videoBytes;
              const videoDataUrl = `data:video/mp4;base64,${videoBase64}`;
              console.log('Video generated with base64 data');
              return new Response(
                JSON.stringify({ success: true, videoUrl: videoDataUrl }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          console.error('No video in completed operation:', pollData);
          return new Response(
            JSON.stringify({ success: false, error: 'No video was generated' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Video generation timed out after 3 minutes' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Immediate response with video
    const videos = operationData.generatedVideos || operationData.generatedSamples;
    if (videos && videos.length > 0) {
      const video = videos[0].video || videos[0];
      
      if (video.uri) {
        return new Response(
          JSON.stringify({ success: true, videoUrl: video.uri }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (video.bytesBase64Encoded || video.videoBytes) {
        const videoBase64 = video.bytesBase64Encoded || video.videoBytes;
        const videoDataUrl = `data:video/mp4;base64,${videoBase64}`;
        return new Response(
          JSON.stringify({ success: true, videoUrl: videoDataUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.error('Unexpected response format:', operationData);
    return new Response(
      JSON.stringify({ success: false, error: 'Unexpected response from video generation API' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in infographic-to-video:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
