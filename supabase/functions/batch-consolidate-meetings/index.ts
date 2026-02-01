import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting batch consolidation of all meetings with chunks...');

    // Find all meetings that have transcription chunks
    const { data: meetingsWithChunks, error: queryError } = await supabase
      .from('meeting_transcription_chunks')
      .select('meeting_id')
      .order('meeting_id');

    if (queryError) {
      throw new Error(`Error querying chunks: ${queryError.message}`);
    }

    // Get unique meeting IDs
    const uniqueMeetingIds = [...new Set(meetingsWithChunks?.map(c => c.meeting_id) || [])];
    
    console.log(`📊 Found ${uniqueMeetingIds.length} meetings with chunks to consolidate`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each meeting
    for (const meetingId of uniqueMeetingIds) {
      try {
        console.log(`🔄 Processing meeting: ${meetingId}`);

        // Fetch all chunks for this meeting
        const { data: chunks, error: chunkError } = await supabase
          .from('meeting_transcription_chunks')
          .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count')
          .eq('meeting_id', meetingId)
          .order('chunk_number');

        if (chunkError || !chunks || chunks.length === 0) {
          console.log(`⚠️ No chunks found for meeting ${meetingId}`);
          continue;
        }

        console.log(`📊 Found ${chunks.length} chunks for meeting ${meetingId}`);

        // Consolidate chunks: prefer cleaned_text, fallback to raw transcription
        const chunkTexts = chunks
          .map(chunk => {
            // Use cleaned text if available and status is completed
            if (chunk.cleaned_text && chunk.cleaning_status === 'completed') {
              return chunk.cleaned_text;
            }
            
            // Fallback to parsing raw transcription_text
            try {
              const parsed = JSON.parse(chunk.transcription_text);
              if (Array.isArray(parsed)) {
                return parsed.map(seg => seg.text || '').join(' ');
              }
              return chunk.transcription_text;
            } catch {
              return chunk.transcription_text;
            }
          })
          .map(text => text.trim())
          .filter(text => text.length > 0);
        
        // Format into paragraphs: join chunks with double newlines for paragraph spacing
        const consolidatedTranscript = chunkTexts.join('\n\n');

        const totalWords = chunks.reduce((sum, chunk) => sum + (chunk.word_count || 0), 0);
        const cleanedCount = chunks.filter(c => c.cleaning_status === 'completed').length;
        const pendingCount = chunks.filter(c => c.cleaning_status === 'pending').length;

        console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${totalWords} words`);

        // Update the meeting's primary transcript in the meetings table
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            whisper_transcript_text: consolidatedTranscript,
            word_count: totalWords,
            primary_transcript_source: 'consolidated', // Changed from 'whisper_chunks_consolidated'
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        if (updateError) {
          console.error(`❌ Error updating meeting ${meetingId}:`, updateError);
          errorCount++;
          results.push({
            meetingId,
            status: 'error',
            error: updateError.message
          });
          continue;
        }

        successCount++;
        results.push({
          meetingId,
          status: 'success',
          chunksProcessed: chunks.length,
          cleanedChunks: cleanedCount,
          pendingChunks: pendingCount,
          totalWords,
          transcriptLength: consolidatedTranscript.length
        });

        console.log(`✅ Successfully consolidated meeting ${meetingId}`);

      } catch (error) {
        console.error(`❌ Error processing meeting ${meetingId}:`, error);
        errorCount++;
        results.push({
          meetingId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Batch consolidation complete: ${successCount} succeeded, ${errorCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch consolidation complete`,
      totalMeetings: uniqueMeetingIds.length,
      successCount,
      errorCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Batch consolidation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
