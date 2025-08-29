import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

console.log("🎙️ Speech-to-Text-Chunked Edge Function starting...");

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ WHISPER EDGE: Handling CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`📨 WHISPER EDGE: ${req.method} request received`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error(`❌ [${requestId}] OpenAI API key not found`);
      throw new Error('OpenAI API key not configured');
    }

    console.log(`🔑 [${requestId}] OpenAI API key found: ${openAiApiKey.slice(0, 10)}...`);

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    const chunkIndex = formData.get('chunkIndex') as string;
    const isFinal = formData.get('isFinal') === 'true';
    const meetingId = formData.get('meetingId') as string;
    const sessionId = formData.get('sessionId') as string;

    console.log(`📋 [${requestId}] Form data parsed:`, {
      hasAudioFile: !!audioFile,
      fileName: audioFile?.name,
      fileSize: audioFile?.size,
      fileType: audioFile?.type,
      chunkIndex,
      isFinal,
      meetingId,
      sessionId,
    });

    if (!audioFile || audioFile.size === 0) {
      if (isFinal) {
        // Final empty chunk - return success with empty result
        console.log(`🏁 [${requestId}] Final empty chunk received - session complete`);
        return new Response(JSON.stringify({
          text: '',
          isFinal: true,
          chunkIndex: parseInt(chunkIndex || '0'),
          message: 'Session completed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.warn(`⚠️ [${requestId}] No audio file provided or empty file`);
      throw new Error('No audio file provided');
    }

    // Convert File to Blob for OpenAI
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { 
      type: audioFile.type || 'audio/webm' 
    });

    console.log(`📡 [${requestId}] Sending to OpenAI Whisper API...`, {
      audioSize: audioBlob.size,
      chunkIndex,
      isFinal,
    });

    // Prepare form data for OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioBlob, `chunk-${chunkIndex}.webm`);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('response_format', 'json');

    // Send to OpenAI Whisper API
    const openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: openaiFormData,
    });

    console.log(`📥 [${requestId}] OpenAI API response status: ${openAiResponse.status}`);

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error(`❌ [${requestId}] OpenAI API error:`, {
        status: openAiResponse.status,
        statusText: openAiResponse.statusText,
        error: errorText,
      });
      throw new Error(`OpenAI API error: ${openAiResponse.status} - ${errorText}`);
    }

    const result = await openAiResponse.json();
    console.log(`✅ [${requestId}] OpenAI transcription result:`, {
      textLength: result.text?.length || 0,
      text: result.text?.slice(0, 100) + (result.text?.length > 100 ? '...' : ''),
    });

    // Return the transcription result
    const response = {
      text: result.text || '',
      confidence: 0.95, // Default confidence for Whisper
      chunkIndex: parseInt(chunkIndex || '0'),
      isFinal,
      sessionId,
      meetingId,
      timestamp: new Date().toISOString(),
    };

    console.log(`📤 [${requestId}] Sending response:`, {
      textLength: response.text.length,
      chunkIndex: response.chunkIndex,
      isFinal: response.isFinal,
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error in speech-to-text-chunked function:`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      requestId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});