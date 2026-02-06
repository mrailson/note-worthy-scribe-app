import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ---- Inlined dedupTranscriptText (mirrors src/lib/dedupTranscriptText.ts) ---- */

function normaliseForComparison(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/([.!?,;:])\1+/g, '$1').trim();
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function splitIntoBlocks(text: string): string[] {
  const doubleNewlineSplit = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  if (doubleNewlineSplit.length >= 2) return doubleNewlineSplit;
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length <= 3) return sentences.length > 0 ? [sentences.join(' ')] : [];
  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    blocks.push(sentences.slice(i, i + 3).join(' '));
  }
  return blocks;
}

function trimRawByNormLen(raw: string, normLen: number): string {
  let normCount = 0;
  let rawIdx = 0;
  const lower = raw.toLowerCase();
  while (rawIdx < raw.length && normCount < normLen) {
    const ch = lower[rawIdx];
    if (ch !== ' ' || (rawIdx > 0 && lower[rawIdx - 1] !== ' ')) normCount++;
    rawIdx++;
  }
  while (rawIdx < raw.length && raw[rawIdx] === ' ') rawIdx++;
  return raw.substring(rawIdx);
}

function dedupTranscriptText(text: string): { text: string; paragraphsDropped: number; overlapsTrimmed: number } {
  if (!text?.trim()) return { text: '', paragraphsDropped: 0, overlapsTrimmed: 0 };

  const blocks = splitIntoBlocks(text);
  const WINDOW = 350, MIN_WINDOW = 50, RATIO = 0.60;
  let trimmed = 0;
  const trimmedBlocks = [blocks[0]];
  for (let i = 1; i < blocks.length; i++) {
    const tailNorm = normaliseForComparison(trimmedBlocks[trimmedBlocks.length - 1].slice(-WINDOW));
    const headNorm = normaliseForComparison(blocks[i].slice(0, WINDOW));
    if (tailNorm.length < MIN_WINDOW || headNorm.length < MIN_WINDOW) { trimmedBlocks.push(blocks[i]); continue; }
    let bestLen = 0;
    const maxScan = Math.min(headNorm.length, tailNorm.length, WINDOW);
    for (let len = maxScan; len >= MIN_WINDOW; len--) {
      if (tailNorm.endsWith(headNorm.substring(0, len))) { bestLen = len; break; }
    }
    if (bestLen > 0 && bestLen / headNorm.length >= RATIO) {
      const t = trimRawByNormLen(blocks[i], bestLen);
      if (t.trim().length > 0) { trimmedBlocks.push(t); }
      trimmed++;
    } else {
      trimmedBlocks.push(blocks[i]);
    }
  }

  const HASH_WINDOW = 50;
  const recentHashes: number[] = [];
  const result: string[] = [];
  let dropped = 0;
  for (const block of trimmedBlocks) {
    const norm = normaliseForComparison(block);
    if (norm.length < 10) { result.push(block); continue; }
    const hash = fnv1a32(norm);
    if (recentHashes.includes(hash)) { dropped++; continue; }
    result.push(block);
    recentHashes.push(hash);
    if (recentHashes.length > HASH_WINDOW) recentHashes.shift();
  }

  return { text: result.join('\n\n'), paragraphsDropped: dropped, overlapsTrimmed: trimmed };
}

/* ---- End inlined dedup ---- */

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
        
        // Join chunks then run shared dedup to remove repeated paragraphs
        const rawConcat = chunkTexts.join('\n\n');
        const dedupResult = dedupTranscriptText(rawConcat);
        const consolidatedTranscript = dedupResult.text;
        
        console.log(`🧹 Dedup meeting ${meetingId}: ${dedupResult.paragraphsDropped} paragraphs dropped, ${dedupResult.overlapsTrimmed} overlaps trimmed`);

        const totalWords = consolidatedTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
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
