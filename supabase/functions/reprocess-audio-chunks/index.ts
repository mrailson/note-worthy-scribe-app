import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Process audio in chunks to prevent token/timeout limits
async function processAudioInChunks(audioBuffer: ArrayBuffer, meetingId: string, userId: string) {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const chunks = [];
  
  for (let i = 0; i < audioBuffer.byteLength; i += chunkSize) {
    const chunk = audioBuffer.slice(i, i + chunkSize);
    chunks.push({
      data: chunk,
      index: Math.floor(i / chunkSize),
      isLast: i + chunkSize >= audioBuffer.byteLength
    });
  }
  
  console.log(`Processing ${chunks.length} audio chunks for meeting ${meetingId}`);
  
  let allTranscripts = [];
  
  for (const chunk of chunks) {
    try {
      console.log(`Processing chunk ${chunk.index + 1}/${chunks.length}`);
      
      const formData = new FormData();
      const blob = new Blob([chunk.data], { type: 'audio/m4a' });
      formData.append('file', blob, `chunk_${chunk.index}.m4a`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('prompt', 'This is a medical/healthcare practice partnership meeting discussing dispensary operations, staff roles, training, and practice management.');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Chunk ${chunk.index} failed:`, errorText);
        continue;
      }

      const result = await response.json();
      
      if (result.text && result.text.trim()) {
        allTranscripts.push({
          chunkIndex: chunk.index,
          text: result.text.trim(),
          timestamp: new Date().toISOString()
        });
        
        console.log(`Chunk ${chunk.index} completed: ${result.text.substring(0, 100)}...`);
      }
      
      // Rate limiting - wait between chunks
      if (!chunk.isLast) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${chunk.index}:`, error);
      continue;
    }
  }
  
  return allTranscripts;
}

// Update meeting transcript with new chunks
async function updateMeetingTranscript(meetingId: string, userId: string, newChunks: any[]) {
  try {
    console.log(`Updating transcript for meeting ${meetingId} with ${newChunks.length} chunks`);
    
    // First, delete existing transcript entries for this meeting
    const { error: deleteError } = await supabase
      .from('meeting_transcripts')
      .delete()
      .eq('meeting_id', meetingId);
    
    if (deleteError) {
      console.error('Error deleting existing transcript:', deleteError);
      // Continue anyway - might not have existing transcript
    }
    
    // Combine all chunks into new content
    const newContent = newChunks.map(chunk => chunk.text).join(' ');
    
    // Insert the new transcript
    const { error: insertError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: meetingId,
        content: newContent,
        speaker_name: 'Reprocessed Audio',
        timestamp_seconds: 0,
        confidence_score: 0.95
      });
    
    if (insertError) {
      console.error('Error inserting reprocessed transcript:', insertError);
      throw insertError;
    }
    
    console.log(`Successfully saved reprocessed transcript: ${newContent.length} characters`);
    
    // Log the reprocessing
    const { error: logError } = await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'meeting_transcripts',
        operation: 'AUDIO_REPROCESSED',
        record_id: meetingId,
        user_id: userId,
        new_values: {
          chunks_processed: newChunks.length,
          total_new_length: newContent.length,
          reprocessed_at: new Date().toISOString()
        }
      });
    
    if (logError) console.error('Logging error:', logError);
    
    return {
      success: true,
      chunksProcessed: newChunks.length,
      totalLength: newContent.length,
      newContentLength: newContent.length
    };
    
  } catch (error) {
    console.error('Error updating transcript:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, userId, audioFilePath } = await req.json();
    
    if (!meetingId || !userId || !audioFilePath) {
      throw new Error('Missing required parameters: meetingId, userId, audioFilePath');
    }
    
    console.log(`Reprocessing audio for meeting ${meetingId}, file: ${audioFilePath}`);
    
    // Download audio file from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('meeting-audio-backups')
      .download(audioFilePath);
    
    if (downloadError) {
      throw new Error(`Failed to download audio: ${downloadError.message}`);
    }
    
    // Convert to ArrayBuffer
    const audioBuffer = await audioData.arrayBuffer();
    console.log(`Downloaded audio file: ${audioBuffer.byteLength} bytes`);
    
    // Process in chunks
    const transcriptChunks = await processAudioInChunks(audioBuffer, meetingId, userId);
    
    if (transcriptChunks.length === 0) {
      throw new Error('No valid transcript chunks were generated');
    }
    
    // Update meeting transcript
    const updateResult = await updateMeetingTranscript(meetingId, userId, transcriptChunks);
    
    console.log(`Successfully reprocessed ${transcriptChunks.length} chunks for meeting ${meetingId}`);
    
    return new Response(JSON.stringify({
      success: true,
      meetingId,
      chunksProcessed: transcriptChunks.length,
      updateResult,
      transcriptChunks: transcriptChunks.map(chunk => ({
        index: chunk.chunkIndex,
        preview: chunk.text.substring(0, 100) + (chunk.text.length > 100 ? '...' : ''),
        length: chunk.text.length
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reprocess-audio-chunks function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});