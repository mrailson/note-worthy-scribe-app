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

  // Step A — Block-level overlap trim
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

  // Step B — Paragraph-hash dedup
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

    // Join with paragraph breaks, then run shared dedup to remove repeated chunks
    const rawConcat = chunkTexts.join('\n\n');
    const dedupResult = dedupTranscriptText(rawConcat);
    const consolidatedTranscript = dedupResult.text;
    
    console.log(`🧹 Dedup: ${dedupResult.paragraphsDropped} paragraphs dropped, ${dedupResult.overlapsTrimmed} overlaps trimmed`);
    
    // Calculate word count from deduplicated transcript
    const wordCount = consolidatedTranscript.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`✅ Consolidated: ${consolidatedTranscript.length} chars, ${wordCount} words from ${filteredChunks.length} chunks`);

    // Update the meeting with the consolidated transcript
    // Note: primary_transcript_source must be one of: 'whisper', 'assembly', 'consolidated'
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        whisper_transcript_text: consolidatedTranscript,
        word_count: wordCount,
        primary_transcript_source: 'consolidated',
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
