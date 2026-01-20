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
      return new Response(JSON.stringify({
        success: false,
        error: 'meetingId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Consolidating batch transcript for meeting: ${meetingId}`);

    // Fetch all chunks for this meeting
    const { data: chunks, error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .select('chunk_number, cleaned_text, cleaning_status, transcription_text, word_count, confidence, transcriber_type')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunkError) {
      throw new Error(`Error fetching chunks: ${chunkError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      console.log(`⚠️ No chunks found for meeting ${meetingId}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'No chunks to consolidate',
        meetingId,
        chunksFound: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${chunks.length} chunks for meeting ${meetingId}`);

    // Deduplicate by chunk_number - take the one with highest confidence
    const chunkMap = new Map<number, typeof chunks[0]>();
    for (const chunk of chunks) {
      const existing = chunkMap.get(chunk.chunk_number);
      if (!existing || (chunk.confidence || 0) > (existing.confidence || 0)) {
        chunkMap.set(chunk.chunk_number, chunk);
      }
    }

    const deduplicatedChunks = Array.from(chunkMap.values())
      .sort((a, b) => a.chunk_number - b.chunk_number);

    console.log(`📊 After deduplication: ${deduplicatedChunks.length} unique chunks`);

    // Filter out very low confidence chunks (< 0.20) but be generous
    const MIN_CONFIDENCE = 0.20;
    const filteredChunks = deduplicatedChunks.filter(chunk => 
      (chunk.confidence || 1) >= MIN_CONFIDENCE
    );

    console.log(`📊 After confidence filter (>=${MIN_CONFIDENCE}): ${filteredChunks.length} chunks`);

    // Extract text from each chunk
    const chunkTexts = filteredChunks
      .map(chunk => {
        // Prefer cleaned text if available
        if (chunk.cleaned_text && chunk.cleaning_status === 'completed') {
          return chunk.cleaned_text;
        }
        
        // Try to parse transcription_text (might be JSON array)
        try {
          const parsed = JSON.parse(chunk.transcription_text);
          if (Array.isArray(parsed)) {
            return parsed.map((seg: any) => seg.text || '').join(' ');
          }
          return chunk.transcription_text;
        } catch {
          return chunk.transcription_text || '';
        }
      })
      .map(text => text.trim())
      .filter(text => text.length > 0);

    // Join with paragraph breaks
    const consolidatedTranscript = chunkTexts.join('\n\n');
    
    // Calculate word count from consolidated transcript
    const wordCount = consolidatedTranscript.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${wordCount} words from ${filteredChunks.length} chunks`);

    // Update the meeting with the consolidated transcript
    // Note: primary_transcript_source must be one of: 'whisper', 'assembly', 'consolidated'
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        whisper_transcript_text: consolidatedTranscript,
        word_count: wordCount,
        primary_transcript_source: 'whisper',
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Error updating meeting: ${updateError.message}`);
    }

    console.log(`✅ Successfully consolidated batch transcript for meeting ${meetingId}`);

    return new Response(JSON.stringify({
      success: true,
      meetingId,
      totalChunks: chunks.length,
      uniqueChunks: deduplicatedChunks.length,
      usedChunks: filteredChunks.length,
      wordCount,
      transcriptLength: consolidatedTranscript.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Consolidation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
