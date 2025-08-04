import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Enhanced audio transcription function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !openAIApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Parse the multipart form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const meetingId = formData.get('meetingId') as string;
    const chunkNumber = parseInt(formData.get('chunkNumber') as string);
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const contextPrompt = formData.get('contextPrompt') as string || 'This is a meeting transcription.';

    if (!audioFile || !meetingId || isNaN(chunkNumber)) {
      throw new Error('Missing required fields: audio, meetingId, chunkNumber');
    }

    console.log(`Processing chunk ${chunkNumber} for meeting ${meetingId}`);

    // Check audio signal strength to avoid transcribing silence
    const audioBuffer = await audioFile.arrayBuffer();
    const isSpeech = await checkAudioSignal(audioBuffer);
    
    if (!isSpeech) {
      console.log('Skipping silent chunk');
      return new Response(JSON.stringify({ 
        success: true, 
        transcript: '',
        skipped: true,
        reason: 'Silent audio detected'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store audio chunk in database
    const { data: audioChunk, error: chunkError } = await supabase
      .from('audio_chunks')
      .insert({
        meeting_id: meetingId,
        chunk_number: chunkNumber,
        start_time: startTime,
        end_time: endTime,
        processing_status: 'processing'
      })
      .select('id')
      .single();

    if (chunkError) {
      console.error('Error storing audio chunk:', chunkError);
      throw new Error('Failed to store audio chunk');
    }

    console.log('Audio chunk stored with ID:', audioChunk.id);

    // Prepare Whisper API request
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, `chunk_${chunkNumber}.wav`);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('temperature', '0');
    whisperFormData.append('prompt', contextPrompt);
    whisperFormData.append('response_format', 'verbose_json');

    const startTranscription = Date.now();

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API failed: ${whisperResponse.status}`);
    }

    const transcriptionResult = await whisperResponse.json();
    const processingTime = Date.now() - startTranscription;

    console.log('Transcription completed in', processingTime, 'ms');
    console.log('Transcript:', transcriptionResult.text);

    // Store transcription result
    const { error: transcriptError } = await supabase
      .from('transcription_chunks')
      .insert({
        audio_chunk_id: audioChunk.id,
        meeting_id: meetingId,
        chunk_number: chunkNumber,
        transcript_text: transcriptionResult.text || '',
        confidence: transcriptionResult.confidence || null,
        language: transcriptionResult.language || 'en',
        processing_time_ms: processingTime
      });

    if (transcriptError) {
      console.error('Error storing transcription:', transcriptError);
      throw new Error('Failed to store transcription');
    }

    // Update audio chunk status
    await supabase
      .from('audio_chunks')
      .update({ processing_status: 'completed' })
      .eq('id', audioChunk.id);

    // Update session statistics
    await supabase
      .from('audio_sessions')
      .update({
        total_chunks: chunkNumber + 1,
        total_duration_seconds: Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      })
      .eq('meeting_id', meetingId)
      .eq('user_id', user.id);

    console.log('Transcription processing completed successfully');

    return new Response(JSON.stringify({
      success: true,
      transcript: transcriptionResult.text || '',
      confidence: transcriptionResult.confidence || null,
      language: transcriptionResult.language || 'en',
      chunkId: audioChunk.id,
      processingTime: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhanced audio transcription error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Function to check audio signal strength
async function checkAudioSignal(audioBuffer: ArrayBuffer): Promise<boolean> {
  try {
    // This is a simplified check - in a real implementation you'd need
    // a more sophisticated audio analysis library
    const uint8View = new Uint8Array(audioBuffer);
    
    // Calculate RMS (Root Mean Square) for signal strength
    let sumSquares = 0;
    let peak = 0;
    const samples = uint8View.length;
    
    for (let i = 0; i < samples; i += 2) {
      // Convert bytes to 16-bit sample
      const sample = (uint8View[i + 1] << 8) | uint8View[i];
      const normalizedSample = sample / 32768.0;
      
      sumSquares += normalizedSample * normalizedSample;
      peak = Math.max(peak, Math.abs(normalizedSample));
    }
    
    const rms = Math.sqrt(sumSquares / (samples / 2));
    const dynamicRange = peak - rms;
    
    console.log(`Audio analysis - RMS: ${rms}, Peak: ${peak}, Dynamic Range: ${dynamicRange}`);
    
    // Thresholds to determine if audio contains speech
    const rmsThreshold = 0.005;
    const dynamicRangeThreshold = 0.02;
    
    return rms > rmsThreshold && dynamicRange > dynamicRangeThreshold;
  } catch (error) {
    console.error('Error analyzing audio signal:', error);
    // If analysis fails, assume it contains speech to be safe
    return true;
  }
}