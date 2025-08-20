import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AudioChunk {
  id: string;
  chunk_number: number;
  audio_blob_path: string;
  chunk_duration_ms: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎙️ Transcribe meeting audio request received');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse the request
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('No meeting ID provided');
    }

    console.log('📊 Processing meeting:', meetingId);

    // Fetch all audio chunks for this meeting
    const { data: chunks, error: chunksError } = await supabase
      .from('audio_chunks')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunksError) {
      console.error('❌ Error fetching chunks:', chunksError);
      throw chunksError;
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No audio chunks found for meeting');
    }

    console.log(`📦 Found ${chunks.length} audio chunks`);

    // Download and combine all audio chunks
    const audioChunks: Uint8Array[] = [];
    let totalSize = 0;

    for (const chunk of chunks as AudioChunk[]) {
      try {
        console.log(`⬇️ Downloading chunk ${chunk.chunk_number}: ${chunk.audio_blob_path}`);
        
        const { data: audioData, error: downloadError } = await supabase.storage
          .from('meeting-audio-chunks')
          .download(chunk.audio_blob_path);

        if (downloadError) {
          console.error(`❌ Error downloading chunk ${chunk.chunk_number}:`, downloadError);
          continue; // Skip failed chunks
        }

        if (audioData) {
          const arrayBuffer = await audioData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          audioChunks.push(uint8Array);
          totalSize += uint8Array.length;
          console.log(`✅ Chunk ${chunk.chunk_number} downloaded: ${uint8Array.length} bytes`);
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${chunk.chunk_number}:`, error);
        continue; // Skip failed chunks
      }
    }

    if (audioChunks.length === 0) {
      throw new Error('No audio chunks could be downloaded');
    }

    console.log(`🔗 Combining ${audioChunks.length} chunks, total size: ${totalSize} bytes`);

    // Combine all chunks into single audio file
    const combinedAudio = new Uint8Array(totalSize);
    let offset = 0;
    
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    console.log('🎵 Combined audio created, sending to Whisper API...');

    // Send combined audio to Whisper API for transcription
    const whisperFormData = new FormData();
    const audioBlob = new Blob([combinedAudio], { type: 'audio/webm' });
    whisperFormData.append('file', audioBlob, 'meeting-audio.webm');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcript = whisperResult.text;
    console.log('✅ Transcription completed, length:', transcript.length);

    // Save transcript to database
    const { error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: meetingId,
        content: transcript,
        timestamp_seconds: 0
      });

    if (transcriptError) {
      console.error('❌ Error saving transcript:', transcriptError);
      // Don't throw here, we still want to return the transcript
    }

    // Return the results
    const response = {
      success: true,
      transcript: transcript,
      audioSize: totalSize,
      transcriptLength: transcript.length,
      chunksProcessed: audioChunks.length
    };

    console.log('🎉 Transcription process completed successfully');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in transcribe-meeting-audio function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});