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

    // VERIFICATION: Check if all chunks are adequately represented in consolidated transcript
    // This helps detect merge issues where clinically important content might be under-represented
    const consolidatedWordsSet = new Set(
      consolidatedTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    
    const underRepresentedChunks: number[] = [];
    for (const chunk of chunks) {
      const chunkText = chunk.cleaned_text || chunk.transcription_text || '';
      const chunkWords = chunkText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      if (chunkWords.length < 5) continue; // Skip very short chunks
      
      const matchedWords = chunkWords.filter((w: string) => consolidatedWordsSet.has(w));
      const matchRatio = matchedWords.length / chunkWords.length;
      
      if (matchRatio < 0.5) {
        underRepresentedChunks.push(chunk.chunk_number);
        console.warn(`⚠️ Chunk ${chunk.chunk_number} may be under-represented (${(matchRatio * 100).toFixed(0)}% words matched)`);
      }
    }
    
    if (underRepresentedChunks.length > 0) {
      console.warn(`🚨 VERIFICATION WARNING: ${underRepresentedChunks.length} chunks may be under-represented: [${underRepresentedChunks.join(', ')}]`);
    }

    // Update the meeting's transcript (use live_transcript_text as it's what the UI reads)
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        live_transcript_text: consolidatedTranscript,
        whisper_transcript_text: consolidatedTranscript,
        word_count: totalWords,
        primary_transcript_source: 'whisper_chunks_consolidated',
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Error updating meeting: ${updateError.message}`);
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
