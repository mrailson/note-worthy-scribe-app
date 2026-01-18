import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[AssemblyAI-Transcription] Processing request...');

  try {
    const { audio, mimeType, chunkIndex } = await req.json();
    
    if (!audio) {
      return Response.json({ error: 'No audio data provided' }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const assemblyApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyApiKey) {
      console.error('[AssemblyAI-Transcription] API key not found');
      return Response.json({ error: 'AssemblyAI API key not configured' }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[AssemblyAI-Transcription] Processing chunk ${chunkIndex}, size: ${audio.length} chars`);

    // Decode base64 audio
    const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    console.log(`[AssemblyAI-Transcription] Decoded audio: ${audioBytes.length} bytes, MIME: ${mimeType}`);
    
    // Skip very small audio chunks 
    if (audioBytes.length < 1000) {
      console.log(`[AssemblyAI-Transcription] Skipping tiny chunk: ${audioBytes.length} bytes`);
      return Response.json({ 
        text: '', 
        confidence: 0, 
        chunkIndex,
        note: 'Chunk too small to process' 
      }, { headers: corsHeaders });
    }

    // Create form data for AssemblyAI upload with proper file extension
    const formData = new FormData();
    const fileExtension = mimeType?.includes('wav') ? 'wav' : 'webm';
    const audioBlob = new Blob([audioBytes], { type: mimeType || 'audio/wav' });
    formData.append('audio', audioBlob, `chunk-${chunkIndex}.${fileExtension}`);

    // Upload audio to AssemblyAI
    console.log('[AssemblyAI-Transcription] Uploading to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': assemblyApiKey,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      console.error('[AssemblyAI-Transcription] Upload failed:', uploadError);
      return Response.json({ error: 'Audio upload failed' }, { 
        status: uploadResponse.status, 
        headers: corsHeaders 
      });
    }

    const uploadResult = await uploadResponse.json();
    const audioUrl = uploadResult.upload_url;
    console.log('[AssemblyAI-Transcription] Audio uploaded, URL:', audioUrl);

    // Submit transcription job
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_gb',
        speech_model: 'best',
        // Enable useful features
        punctuate: true,
        format_text: true,
        // Fast processing for chunks
        boost_param: 'high'
      }),
    });

    if (!transcriptResponse.ok) {
      const transcriptError = await transcriptResponse.text();
      console.error('[AssemblyAI-Transcription] Transcript request failed:', transcriptError);
      return Response.json({ error: 'Transcription request failed' }, { 
        status: transcriptResponse.status, 
        headers: corsHeaders 
      });
    }

    const transcriptJob = await transcriptResponse.json();
    const transcriptId = transcriptJob.id;
    console.log('[AssemblyAI-Transcription] Transcription job created:', transcriptId);

    // Poll for completion (AssemblyAI is async)
    let attempts = 0;
    const maxAttempts = 60; // 1 minute max wait
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyApiKey,
        },
      });

      if (!statusResponse.ok) {
        console.error('[AssemblyAI-Transcription] Status check failed');
        break;
      }

      const result = await statusResponse.json();
      console.log(`[AssemblyAI-Transcription] Status: ${result.status}, attempt ${attempts + 1}`);

      if (result.status === 'completed') {
        console.log('[AssemblyAI-Transcription] Transcription completed successfully');
        return Response.json({
          text: result.text || '',
          confidence: result.confidence || 0.9,
          chunkIndex,
          processingTime: attempts + 1
        }, { headers: corsHeaders });
      }

      if (result.status === 'error') {
        console.error('[AssemblyAI-Transcription] Transcription failed:', result.error);
        return Response.json({ error: `Transcription failed: ${result.error}` }, { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      attempts++;
    }

    // Timeout
    console.error('[AssemblyAI-Transcription] Transcription timeout');
    return Response.json({ error: 'Transcription timeout' }, { 
      status: 408, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('[AssemblyAI-Transcription] Error:', error);
    return Response.json({ error: 'Internal server error: ' + error.message }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});