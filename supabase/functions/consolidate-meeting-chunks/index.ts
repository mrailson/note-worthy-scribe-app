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

// Check if text appears to be hallucinated content
function isTextHallucinated(text: string): boolean {
  if (!text || text.length < 50) return true;
  
  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  }
  
  // If significant portion is hallucination patterns
  if (matchCount > 3) return true;
  
  // Check for excessive repetition
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 3) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    if (repetitionRatio > 0.6) return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, liveTranscript } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Consolidating chunks for meeting: ${meetingId}`);
    console.log(`📝 Live transcript provided: ${liveTranscript ? `${liveTranscript.length} chars` : 'none'}`);

    // FIRST: Fetch existing meeting data to check current transcript state
    const { data: existingMeeting, error: meetingError } = await supabase
      .from('meetings')
      .select('live_transcript_text, whisper_transcript_text, word_count, primary_transcript_source')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('Error fetching existing meeting:', meetingError);
    }

    const existingTranscript = existingMeeting?.live_transcript_text || '';
    const existingWordCount = existingMeeting?.word_count || 0;
    console.log(`📊 Existing transcript: ${existingTranscript.length} chars, ${existingWordCount} words`);

    // Fetch all chunks for this meeting
    const { data: chunks, error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count, confidence')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunkError) {
      throw new Error(`Error fetching chunks: ${chunkError.message}`);
    }

    // If no chunks AND we have a live transcript, save it and return
    if ((!chunks || chunks.length === 0) && liveTranscript && liveTranscript.length > 50) {
      console.log('✅ No chunks found, using provided live transcript');
      
      const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          live_transcript_text: liveTranscript,
          word_count: wordCount,
          primary_transcript_source: 'browser_live',
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Used live transcript (no chunks available)',
        source: 'browser_live',
        transcriptLength: liveTranscript.length,
        wordCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No chunks found and no live transcript provided',
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

    // CRITICAL: If all chunks are filtered but we have a live transcript or existing transcript, use that instead
    if (filteredChunks.length === 0) {
      // Prefer live transcript if provided and valid
      if (liveTranscript && liveTranscript.length > 50 && !isTextHallucinated(liveTranscript)) {
        console.log('✅ All chunks filtered, using provided live transcript');
        const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
        
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            live_transcript_text: liveTranscript,
            word_count: wordCount,
            primary_transcript_source: 'browser_live',
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered as hallucinations - used live transcript',
          source: 'browser_live',
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          transcriptLength: liveTranscript.length,
          wordCount,
          rejectedChunks
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Keep existing transcript if it's valid
      if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
        console.log('✅ All chunks filtered, keeping existing transcript');
        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered as hallucinations - kept existing transcript',
          source: 'existing',
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true,
          rejectedChunks
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Only mark as unavailable if we truly have nothing good
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

    const consolidatedWordCount = consolidatedTranscript.split(/\s+/).filter(w => w.length > 0).length;
    const cleanedCount = filteredChunks.filter(c => c.cleaning_status === 'completed').length;
    const pendingCount = filteredChunks.filter(c => c.cleaning_status === 'pending').length;

    console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${consolidatedWordCount} words`);
    console.log(`📈 Breakdown: ${cleanedCount} cleaned, ${pendingCount} pending, ${rejectedChunks.length} filtered`);

    // NON-DESTRUCTIVE: Compare consolidated vs existing/live and pick the best
    let bestTranscript = consolidatedTranscript;
    let bestSource = 'whisper_chunks_consolidated';
    let bestWordCount = consolidatedWordCount;

    // Check if consolidated text is itself hallucinated
    const consolidatedIsHallucinated = isTextHallucinated(consolidatedTranscript);
    
    // Compare with live transcript if provided
    if (liveTranscript && liveTranscript.length > 50) {
      const liveWordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      const liveIsHallucinated = isTextHallucinated(liveTranscript);
      
      console.log(`🔍 Comparing: Consolidated (${consolidatedWordCount} words, hallucinated=${consolidatedIsHallucinated}) vs Live (${liveWordCount} words, hallucinated=${liveIsHallucinated})`);
      
      // Prefer live transcript if:
      // 1. Consolidated is hallucinated but live is not
      // 2. Live is significantly longer and not hallucinated
      if (consolidatedIsHallucinated && !liveIsHallucinated) {
        bestTranscript = liveTranscript;
        bestSource = 'browser_live';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (consolidated was hallucinated)');
      } else if (!liveIsHallucinated && liveWordCount > consolidatedWordCount * 1.5) {
        bestTranscript = liveTranscript;
        bestSource = 'browser_live';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (significantly longer and valid)');
      }
    }
    
    // Also compare with existing transcript if we're about to overwrite with something worse
    if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
      if (isTextHallucinated(bestTranscript) || (existingWordCount > bestWordCount * 1.5)) {
        console.log('⚠️ Keeping existing transcript - new one is worse quality');
        return new Response(JSON.stringify({
          success: true,
          message: 'Kept existing transcript - new consolidation was lower quality',
          source: 'existing_preserved',
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Update the meeting's transcript with the best option
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        live_transcript_text: bestTranscript,
        whisper_transcript_text: bestSource === 'whisper_chunks_consolidated' ? bestTranscript : undefined,
        word_count: bestWordCount,
        primary_transcript_source: bestSource,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Error updating meeting: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Transcript consolidated successfully',
      source: bestSource,
      chunksProcessed: chunks.length,
      chunksFiltered: rejectedChunks.length,
      cleanedChunks: cleanedCount,
      pendingChunks: pendingCount,
      totalWords: bestWordCount,
      transcriptLength: bestTranscript.length,
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
