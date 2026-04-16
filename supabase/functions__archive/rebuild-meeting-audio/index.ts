import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { meetingId } = await req.json();

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    console.log(`Rebuilding audio for meeting: ${meetingId}`);

    // Get all audio chunks for this meeting
    const { data: chunks, error: chunksError } = await supabaseClient
      .from('audio_chunks')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunksError) {
      console.error('Error fetching audio chunks:', chunksError);
      throw chunksError;
    }

    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No audio chunks found for this meeting' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${chunks.length} audio chunks`);

    // Download and combine audio chunks
    const audioChunks: ArrayBuffer[] = [];
    let totalDuration = 0;

    for (const chunk of chunks) {
      try {
        // Download audio chunk from storage
        const { data: audioData, error: downloadError } = await supabaseClient.storage
          .from('meeting-audio-chunks')
          .download(chunk.audio_blob_path);

        if (downloadError) {
          console.error(`Error downloading chunk ${chunk.chunk_number}:`, downloadError);
          continue;
        }

        const arrayBuffer = await audioData.arrayBuffer();
        audioChunks.push(arrayBuffer);
        totalDuration += chunk.chunk_duration_ms || 5000; // Default 5 seconds per chunk

        console.log(`Downloaded chunk ${chunk.chunk_number}, size: ${arrayBuffer.byteLength} bytes`);
      } catch (error) {
        console.error(`Failed to process chunk ${chunk.chunk_number}:`, error);
      }
    }

    if (audioChunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to download any audio chunks' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate total size for the combined audio
    const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    console.log(`Combining ${audioChunks.length} chunks, total size: ${totalSize} bytes`);

    // Create combined audio buffer
    const combinedBuffer = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of audioChunks) {
      combinedBuffer.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    // Upload combined audio to storage
    const combinedFileName = `${meetingId}/combined-audio.webm`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('meeting-audio-chunks')
      .upload(combinedFileName, combinedBuffer, {
        contentType: 'audio/webm',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading combined audio:', uploadError);
      throw uploadError;
    }

    console.log(`Combined audio uploaded: ${combinedFileName}`);

    // Update meeting record with combined audio info
    const { error: updateError } = await supabaseClient
      .from('meetings')
      .update({
        meeting_context: {
          combined_audio_path: combinedFileName,
          total_chunks: chunks.length,
          total_duration_ms: totalDuration,
          rebuilt_at: new Date().toISOString()
        }
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting record:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        combinedAudioPath: combinedFileName,
        totalChunks: chunks.length,
        totalDurationMs: totalDuration,
        totalSizeBytes: totalSize
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in rebuild-meeting-audio function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});