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
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Consolidating chunks for meeting: ${meetingId}`);

    // Fetch all chunks for this meeting
    const { data: chunks, error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunkError) {
      throw new Error(`Error fetching chunks: ${chunkError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No chunks found for this meeting',
        chunksProcessed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${chunks.length} chunks to consolidate`);

    // Consolidate chunks: prefer cleaned_text, fallback to raw transcription
    const consolidatedTranscript = chunks
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
      .join(' ')
      .trim();

    const totalWords = chunks.reduce((sum, chunk) => sum + (chunk.word_count || 0), 0);
    const cleanedCount = chunks.filter(c => c.cleaning_status === 'completed').length;
    const pendingCount = chunks.filter(c => c.cleaning_status === 'pending').length;

    console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${totalWords} words`);
    console.log(`📈 Breakdown: ${cleanedCount} cleaned, ${pendingCount} pending`);

    // Update the meeting's transcript in meeting_transcripts table
    const { error: upsertError } = await supabase
      .from('meeting_transcripts')
      .upsert({
        meeting_id: meetingId,
        transcript_text: consolidatedTranscript,
        word_count: totalWords,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'meeting_id'
      });

    if (upsertError) {
      throw new Error(`Error updating meeting: ${upsertError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Chunks consolidated successfully',
      chunksProcessed: chunks.length,
      cleanedChunks: cleanedCount,
      pendingChunks: pendingCount,
      totalWords,
      transcriptLength: consolidatedTranscript.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error consolidating chunks:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
