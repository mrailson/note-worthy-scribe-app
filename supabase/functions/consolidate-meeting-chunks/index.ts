import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HARD CONFIDENCE GATE - chunks below this are filtered out
const CONFIDENCE_THRESHOLD = 0.30;

// Hallucination patterns to detect and filter
const HALLUCINATION_PATTERNS = [
  /thank you (very much )?for (your )?attention/gi,
  /thank you for watching/gi,
  /please (like and )?subscribe/gi,
  /this (video|webinar) (has been|is now)/gi,
  /if you have any questions/gi,
  /i (hope|will be happy to)/gi,
  /all of the above are in the description/gi,
  /this is the end of the (webinar|video|meeting)/gi,
];

function isLikelyHallucination(text: string, confidence: number): { isHallucination: boolean; reason: string } {
  // Hard confidence gate
  if (confidence < CONFIDENCE_THRESHOLD) {
    return { isHallucination: true, reason: `Confidence ${(confidence * 100).toFixed(1)}% below ${CONFIDENCE_THRESHOLD * 100}% threshold` };
  }

  // Check for hallucination patterns
  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  }

  // If more than 2 hallucination pattern matches, likely hallucinated
  if (matchCount > 2) {
    return { isHallucination: true, reason: `${matchCount} hallucination patterns detected` };
  }

  // Check for excessive repetition within the text
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 3) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    if (repetitionRatio > 0.5) {
      return { isHallucination: true, reason: `${(repetitionRatio * 100).toFixed(0)}% sentence repetition detected` };
    }
  }

  return { isHallucination: false, reason: '' };
}

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
      .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count, confidence')
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

    // FILTER chunks before consolidation - apply hallucination detection
    const filteredChunks: typeof chunks = [];
    const rejectedChunks: { chunkNumber: number; reason: string }[] = [];

    for (const chunk of chunks) {
      const chunkText = chunk.cleaned_text || chunk.transcription_text || '';
      const confidence = chunk.confidence || 0;

      // Parse JSON if needed
      let textToCheck = chunkText;
      try {
        const parsed = JSON.parse(chunkText);
        if (Array.isArray(parsed)) {
          textToCheck = parsed.map(seg => seg.text || '').join(' ');
        }
      } catch {
        // Not JSON, use as-is
      }

      const hallucinationCheck = isLikelyHallucination(textToCheck, confidence);
      
      if (hallucinationCheck.isHallucination) {
        console.log(`🚫 Chunk ${chunk.chunk_number} filtered: ${hallucinationCheck.reason}`);
        rejectedChunks.push({ chunkNumber: chunk.chunk_number, reason: hallucinationCheck.reason });
        
        // Update chunk with rejection reason
        await supabase
          .from('meeting_transcription_chunks')
          .update({ merge_rejection_reason: hallucinationCheck.reason })
          .eq('meeting_id', meetingId)
          .eq('chunk_number', chunk.chunk_number);
      } else {
        filteredChunks.push(chunk);
      }
    }

    console.log(`✅ ${filteredChunks.length}/${chunks.length} chunks passed hallucination filter`);

    if (filteredChunks.length === 0) {
      // All chunks were filtered - this is a complete hallucination scenario
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          live_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
          whisper_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
          word_count: 0,
          primary_transcript_source: 'hallucination_filtered',
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'All chunks filtered as hallucinations - transcript marked as unavailable',
        chunksProcessed: chunks.length,
        chunksFiltered: rejectedChunks.length,
        rejectedChunks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Consolidate FILTERED chunks only
    const consolidatedTranscript = filteredChunks
      .map(chunk => {
        if (chunk.cleaned_text && chunk.cleaning_status === 'completed') {
          return chunk.cleaned_text;
        }
        
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

    const totalWords = consolidatedTranscript.split(/\s+/).filter(w => w.length > 0).length;
    const cleanedCount = filteredChunks.filter(c => c.cleaning_status === 'completed').length;
    const pendingCount = filteredChunks.filter(c => c.cleaning_status === 'pending').length;

    console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${totalWords} words`);
    console.log(`📈 Breakdown: ${cleanedCount} cleaned, ${pendingCount} pending, ${rejectedChunks.length} filtered`);

    // Update the meeting's transcript
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
      chunksFiltered: rejectedChunks.length,
      cleanedChunks: cleanedCount,
      pendingChunks: pendingCount,
      totalWords,
      transcriptLength: consolidatedTranscript.length,
      rejectedChunks
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
