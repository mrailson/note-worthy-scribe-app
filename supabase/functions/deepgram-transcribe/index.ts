import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎤 Deepgram transcription request received');
    
    const { audio, meetingId, sessionId, chunkNumber } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`📦 Processing chunk ${chunkNumber} for meeting ${meetingId}`);

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Prepare multipart form data for Deepgram
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="audio.webm"`,
      `Content-Type: audio/webm`,
      ``,
      new TextDecoder().decode(binaryAudio),
      `--${boundary}--`
    ].join('\r\n');

    // Send to Deepgram API
    const deepgramResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=false', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: binaryAudio,
    });

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error('❌ Deepgram API error:', deepgramResponse.status, errorText);
      throw new Error(`Deepgram API error: ${deepgramResponse.status}`);
    }

    const deepgramResult = await deepgramResponse.json();
    
    // Extract transcript and confidence
    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const words = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];

    console.log(`✅ Deepgram transcription: "${transcript.substring(0, 50)}..." (confidence: ${confidence})`);

    // Save to database
    const { error: dbError } = await supabase
      .from('deepgram_transcriptions')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        session_id: sessionId,
        chunk_number: chunkNumber,
        transcription_text: transcript,
        confidence: confidence,
        is_final: true,
        word_count: transcript.trim().split(/\s+/).length
      });

    if (dbError) {
      console.error('❌ Database save error:', dbError);
      throw dbError;
    }

    console.log(`💾 Saved Deepgram chunk ${chunkNumber} to database`);

    return new Response(
      JSON.stringify({
        text: transcript,
        confidence: confidence,
        words: words,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Deepgram transcription error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});