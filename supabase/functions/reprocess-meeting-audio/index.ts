import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { meetingId } = await req.json();

    if (!meetingId) {
      throw new Error('Missing required field: meetingId');
    }

    console.log('🎙️ Reprocessing audio for meeting:', meetingId);

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the meeting and check permissions
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found or access denied');
    }

    // Try to get audio from meeting_audio_backups first
    let audioData = null;
    const { data: audioBackup, error: backupError } = await supabase
      .from('meeting_audio_backups')
      .select('audio_data')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!backupError && audioBackup?.audio_data) {
      console.log('📦 Found audio backup data');
      audioData = audioBackup.audio_data;
    } else {
      // Fallback to meeting audio_blob if available
      if (meeting.audio_blob) {
        console.log('📦 Using meeting audio_blob');
        audioData = meeting.audio_blob;
      } else {
        throw new Error('No audio data found for this meeting');
      }
    }

    // Process audio data
    console.log('🔄 Processing audio data...');
    const binaryAudio = processBase64Chunks(audioData);
    
    // Prepare form data for Whisper
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'meeting_audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('prompt', 'This is a healthcare meeting recording. Please transcribe medical terms, NHS terminology, and proper nouns accurately.');

    console.log('🎯 Sending to OpenAI Whisper...');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper error:', errorText);
      throw new Error(`Whisper API error: ${errorText}`);
    }

    const result = await response.json();
    const transcript = result.text || '';

    console.log('✅ Whisper transcription completed, length:', transcript.length);

    // Store the new transcript
    const { error: updateError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: meetingId,
        content: transcript,
        source: 'whisper_reprocess',
        processing_status: 'completed'
      });

    if (updateError) {
      console.error('Error storing transcript:', updateError);
      // Don't fail the request if storage fails, just log it
    }

    return new Response(JSON.stringify({ 
      transcript,
      length: transcript.length,
      source: 'whisper_reprocess'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reprocess-meeting-audio:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});