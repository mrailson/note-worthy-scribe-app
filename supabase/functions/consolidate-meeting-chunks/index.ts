import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= BEST-OF-BOTH MERGER (Deno-compatible) =============

type Engine = 'assembly' | 'whisper';

interface RawChunk {
  engine: Engine;
  idx: number;
  text: string;
  confidence?: number;
  startSec?: number;
  endSec?: number;
}

interface NormChunk {
  engine: Engine;
  idx: number;
  startSec: number;
  endSec: number;
  text: string;
  conf: number;
  tokens: string[];
}

interface MergeConfig {
  chunkDurationSec: number;
  overlapSec: number;
  whisperConfFloor: number;
  overlapSimilarity: number;
  strongConfMargin: number;
  maxLookback: number;
  continuityMinSim: number;
  bufferWindow: number;
}

const DEFAULT_MERGE_CONFIG: MergeConfig = {
  chunkDurationSec: 15,
  overlapSec: 1.5,
  whisperConfFloor: 0.30,
  overlapSimilarity: 0.60,
  strongConfMargin: 0.12,
  maxLookback: 3,
  continuityMinSim: 0.10,
  bufferWindow: 4,
};

function normaliseConfidence(engine: Engine, confidence?: number): number {
  if (engine === 'assembly') return 0.80;
  if (confidence == null) return 0.0;
  if (confidence > 1) return Math.max(0, Math.min(1, confidence / 100));
  return Math.max(0, Math.min(1, confidence));
}

function normaliseText(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')  // Smart double quotes → straight
    .replace(/['']/g, "'")  // Smart single quotes → straight
    .trim();
}

function tokenise(s: string): string[] {
  return normaliseText(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSim(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function endsCleanly(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text.trim());
}

function startsCleanly(text: string): boolean {
  return /^["'(\[]?[A-Z]|^(and|but|so|because|then)\b/i.test(text.trim());
}

function looksLikeHangingFragment(text: string): boolean {
  const t = text.trim();
  return /[,;:\-]\s*$/.test(t) || /\b(and|but|so|because|that|which|who)\s*$/i.test(t);
}

function scoreChunk(c: NormChunk): number {
  const len = Math.min(1, c.tokens.length / 40);
  const endBonus = endsCleanly(c.text) ? 0.08 : 0;
  const startBonus = startsCleanly(c.text) ? 0.04 : 0;
  return (c.conf * 0.75) + (len * 0.15) + endBonus + startBonus;
}

function continuitySimAgainstRecent(recent: NormChunk[], chunk: NormChunk): number {
  if (!recent.length) return 1;
  let best = 0;
  for (const r of recent) {
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim > best) best = sim;
  }
  return best;
}

function normaliseChunks(raw: RawChunk[], cfg: MergeConfig): NormChunk[] {
  return raw
    .map(r => {
      const text = normaliseText(r.text);
      const conf = normaliseConfidence(r.engine, r.confidence);
      const syntheticStart = r.idx * cfg.chunkDurationSec;
      const syntheticEnd = syntheticStart + cfg.chunkDurationSec;
      const startSec = (r.engine === 'assembly' && r.startSec != null) ? r.startSec : syntheticStart;
      const endSec = (r.engine === 'assembly' && r.endSec != null) ? r.endSec : syntheticEnd;
      return { engine: r.engine, idx: r.idx, startSec, endSec, text, conf, tokens: tokenise(text) };
    })
    .filter(c => c.text.length > 0);
}

function timeOverlaps(a: NormChunk, b: NormChunk, cfg: MergeConfig): boolean {
  const tol = Math.max(0.5, cfg.overlapSec);
  return !(a.endSec < b.startSec - tol || b.endSec < a.startSec - tol);
}

function findBestOverlapCandidate(recent: NormChunk[], chunk: NormChunk, cfg: MergeConfig): NormChunk | null {
  let best: NormChunk | null = null;
  let bestSim = 0;
  for (const r of recent) {
    if (!timeOverlaps(r, chunk, cfg)) continue;
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim >= cfg.overlapSimilarity && sim > bestSim) {
      best = r;
      bestSim = sim;
    }
  }
  return best;
}

function chooseWinner(a: NormChunk, b: NormChunk, cfg: MergeConfig): NormChunk {
  const aScore = scoreChunk(a);
  const bScore = scoreChunk(b);
  if (a.engine !== b.engine) {
    const assembly = a.engine === 'assembly' ? a : b;
    const whisper = a.engine === 'whisper' ? a : b;
    const assemblyScore = assembly.engine === a.engine ? aScore : bScore;
    const whisperScore = whisper.engine === a.engine ? aScore : bScore;
    if (whisperScore >= assemblyScore + cfg.strongConfMargin) return whisper;
    return assembly;
  }
  return bScore > aScore ? b : a;
}

function mergeBestOfBoth(whisperRaw: RawChunk[], assemblyRaw: RawChunk[], cfg: MergeConfig = DEFAULT_MERGE_CONFIG) {
  const whisper = normaliseChunks(whisperRaw, cfg).sort((a, b) => a.idx - b.idx);
  const assembly = normaliseChunks(assemblyRaw, cfg).sort((a, b) => (a.startSec - b.startSec) || (a.idx - b.idx));
  
  const combined = [...assembly, ...whisper].sort((a, b) => {
    const t = a.startSec - b.startSec;
    if (t !== 0) return t;
    if (a.engine !== b.engine) return a.engine === 'assembly' ? -1 : 1;
    return a.idx - b.idx;
  });

  const kept: NormChunk[] = [];
  const dropped: NormChunk[] = [];
  const buffer: NormChunk[] = [];
  let overlapConflicts = 0;
  let bufferedDrops = 0;

  for (const chunk of combined) {
    if (chunk.engine === 'whisper' && chunk.conf < cfg.whisperConfFloor) {
      const hasAssemblyNear = kept.slice(-cfg.maxLookback).some(k =>
        k.engine === 'assembly' && timeOverlaps(k, chunk, cfg) && jaccardSim(k.tokens, chunk.tokens) >= 0.25
      );
      if (hasAssemblyNear) { dropped.push(chunk); continue; }
    }

    const recent = kept.slice(-cfg.maxLookback);
    const overlapCandidate = findBestOverlapCandidate(recent, chunk, cfg);
    
    if (!overlapCandidate) {
      const contSim = continuitySimAgainstRecent(recent, chunk);
      const last = kept[kept.length - 1];
      const hangingThreshold = last && looksLikeHangingFragment(last.text)
        ? cfg.continuityMinSim * 1.8
        : cfg.continuityMinSim;
      
      if (recent.length > 0 && contSim < hangingThreshold) {
        buffer.push(chunk);
        if (buffer.length > cfg.bufferWindow) {
          const oldest = buffer.shift()!;
          dropped.push(oldest);
          bufferedDrops++;
        }
        continue;
      }
      
      kept.push(chunk);
      
      for (let i = buffer.length - 1; i >= 0; i--) {
        const b = buffer[i];
        const sim = continuitySimAgainstRecent(kept.slice(-cfg.maxLookback), b);
        if (sim >= cfg.continuityMinSim) {
          kept.push(b);
          buffer.splice(i, 1);
        }
      }
      continue;
    }
    
    overlapConflicts++;
    const winner = chooseWinner(overlapCandidate, chunk, cfg);
    if (winner === overlapCandidate) {
      dropped.push(chunk);
    } else {
      const idx = kept.lastIndexOf(overlapCandidate);
      if (idx >= 0) kept.splice(idx, 1, chunk);
      else kept.push(chunk);
      dropped.push(overlapCandidate);
    }
  }

  for (const b of buffer) {
    dropped.push(b);
    bufferedDrops++;
  }

  kept.sort((a, b) => (a.startSec - b.startSec) || (a.engine === 'assembly' ? -1 : 1));
  
  let transcript = kept.map(k => k.text).join(' ').replace(/\s+/g, ' ').trim();
  transcript = transcript.replace(/([.!?])\s+([a-z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`);
  transcript = transcript.replace(/\b(the|a|an|and|but|so|we|i|you|is|are|was|were|to|of|in|on|for|it)\s+\1\b/gi, '$1');
  transcript = transcript.replace(/\s+,/g, ',').replace(/\s+\./g, '.');
  transcript = transcript.replace(/\.{3,}\s*/g, '... ').trim();

  return {
    transcript,
    kept,
    dropped,
    stats: {
      whisperChunks: whisperRaw.length,
      assemblyChunks: assemblyRaw.length,
      keptCount: kept.length,
      droppedCount: dropped.length,
      overlapConflicts,
      bufferedDrops
    }
  };
}

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
  if (confidence < 0.30) {
    return { isHallucination: true, reason: `Confidence ${(confidence * 100).toFixed(1)}% below 30% threshold` };
  }

  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matchCount += matches.length;
  }
  if (matchCount > 2) {
    return { isHallucination: true, reason: `${matchCount} hallucination patterns detected` };
  }

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

function isTextHallucinated(text: string): boolean {
  if (!text || text.length < 50) return true;
  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matchCount += matches.length;
  }
  if (matchCount > 3) return true;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 3) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    if (repetitionRatio > 0.6) return true;
  }
  return false;
}

// ============= MAIN HANDLER =============

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

    console.log(`🔄 Consolidating chunks for meeting: ${meetingId} using Best-of-Both merge`);
    console.log(`📝 Live transcript provided: ${liveTranscript ? `${liveTranscript.length} chars` : 'none'}`);

    // Fetch existing meeting data
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
      .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count, confidence, transcriber_type, start_time, end_time')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunkError) {
      throw new Error(`Error fetching chunks: ${chunkError.message}`);
    }

    // If no chunks AND we have a live transcript, save it and return
    if ((!chunks || chunks.length === 0) && liveTranscript && liveTranscript.length > 50) {
      console.log('✅ No chunks found, using provided live transcript');
      const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      
      await supabase.from('meetings').update({
        live_transcript_text: liveTranscript,
        word_count: wordCount,
        primary_transcript_source: 'browser_live',
        updated_at: new Date().toISOString()
      }).eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Used live transcript (no chunks available)',
        source: 'browser_live',
        transcriptLength: liveTranscript.length,
        wordCount
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No chunks found and no live transcript provided',
        chunksProcessed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📊 Found ${chunks.length} chunks to consolidate`);

    // Build RawChunks for Best-of-Both merger
    const whisperRaw: RawChunk[] = [];
    const assemblyRaw: RawChunk[] = [];
    const rejectedChunks: { chunkNumber: number; reason: string }[] = [];

    for (const chunk of chunks) {
      const chunkText = chunk.cleaned_text || chunk.transcription_text || '';
      const confidence = chunk.confidence || 0;

      // Parse JSON if needed
      let textToCheck = chunkText;
      try {
        const parsed = JSON.parse(chunkText);
        if (Array.isArray(parsed)) {
          textToCheck = parsed.map((seg: any) => seg.text || '').join(' ');
        }
      } catch { /* Not JSON */ }

      // Pre-filter obvious hallucinations
      const hallucinationCheck = isLikelyHallucination(textToCheck, confidence);
      if (hallucinationCheck.isHallucination) {
        console.log(`🚫 Chunk ${chunk.chunk_number} pre-filtered: ${hallucinationCheck.reason}`);
        rejectedChunks.push({ chunkNumber: chunk.chunk_number, reason: hallucinationCheck.reason });
        
        await supabase.from('meeting_transcription_chunks')
          .update({ merge_rejection_reason: hallucinationCheck.reason })
          .eq('meeting_id', meetingId)
          .eq('chunk_number', chunk.chunk_number);
        continue;
      }

      // Add to appropriate array based on transcriber_type
      const rawChunk: RawChunk = {
        engine: chunk.transcriber_type === 'assembly' ? 'assembly' : 'whisper',
        idx: chunk.chunk_number,
        text: textToCheck,
        confidence: confidence
      };

      // Add timing for assembly if available
      if (chunk.transcriber_type === 'assembly' && chunk.start_time) {
        try {
          rawChunk.startSec = new Date(chunk.start_time).getTime() / 1000;
          if (chunk.end_time) {
            rawChunk.endSec = new Date(chunk.end_time).getTime() / 1000;
          }
        } catch { /* Ignore timing parse errors */ }
      }

      if (chunk.transcriber_type === 'assembly') {
        assemblyRaw.push(rawChunk);
      } else {
        whisperRaw.push(rawChunk);
      }
    }

    console.log(`📊 After pre-filter: ${whisperRaw.length} Whisper, ${assemblyRaw.length} Assembly chunks`);

    // If all chunks were filtered, fall back to live transcript or existing
    if (whisperRaw.length === 0 && assemblyRaw.length === 0) {
      if (liveTranscript && liveTranscript.length > 50 && !isTextHallucinated(liveTranscript)) {
        console.log('✅ All chunks filtered, using provided live transcript');
        const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
        
        await supabase.from('meetings').update({
          live_transcript_text: liveTranscript,
          word_count: wordCount,
          primary_transcript_source: 'browser_live',
          updated_at: new Date().toISOString()
        }).eq('id', meetingId);

        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered - used live transcript',
          source: 'browser_live',
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          transcriptLength: liveTranscript.length,
          wordCount,
          rejectedChunks
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
        console.log('✅ All chunks filtered, keeping existing transcript');
        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered - kept existing transcript',
          source: 'existing',
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true,
          rejectedChunks
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabase.from('meetings').update({
        live_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
        whisper_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
        word_count: 0,
        primary_transcript_source: 'whisper',
        updated_at: new Date().toISOString()
      }).eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'All chunks filtered as hallucinations - transcript marked as unavailable',
        chunksProcessed: chunks.length,
        chunksFiltered: rejectedChunks.length,
        rejectedChunks
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= PERFORM BEST-OF-BOTH MERGE =============
    const mergeResult = mergeBestOfBoth(whisperRaw, assemblyRaw, DEFAULT_MERGE_CONFIG);
    
    console.log(`🔀 Best-of-Both merge complete:`);
    console.log(`   Whisper: ${mergeResult.stats.whisperChunks}, Assembly: ${mergeResult.stats.assemblyChunks}`);
    console.log(`   Kept: ${mergeResult.stats.keptCount}, Dropped: ${mergeResult.stats.droppedCount}`);
    console.log(`   Overlap conflicts resolved: ${mergeResult.stats.overlapConflicts}`);
    console.log(`   Final transcript: ${mergeResult.transcript.length} chars`);

    const mergedWordCount = mergeResult.transcript.split(/\s+/).filter(w => w.length > 0).length;

    // Check if merged result is worse than alternatives
    let bestTranscript = mergeResult.transcript;
    let bestSource = 'best_of_both';
    let bestWordCount = mergedWordCount;

    const mergedIsHallucinated = isTextHallucinated(mergeResult.transcript);

    // Compare with live transcript if provided
    if (liveTranscript && liveTranscript.length > 50) {
      const liveWordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      const liveIsHallucinated = isTextHallucinated(liveTranscript);
      
      if (mergedIsHallucinated && !liveIsHallucinated) {
        bestTranscript = liveTranscript;
        bestSource = 'browser_live';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (merged was hallucinated)');
      } else if (!liveIsHallucinated && liveWordCount > mergedWordCount * 1.5) {
        bestTranscript = liveTranscript;
        bestSource = 'browser_live';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (significantly longer and valid)');
      }
    }

    // Protect existing good transcript
    if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
      if (isTextHallucinated(bestTranscript) || (existingWordCount > bestWordCount * 1.5)) {
        console.log('⚠️ Keeping existing transcript - new one is worse quality');
        return new Response(JSON.stringify({
          success: true,
          message: 'Kept existing transcript - new consolidation was lower quality',
          source: 'existing_preserved',
          mergeStats: mergeResult.stats,
          chunksProcessed: chunks.length,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Update the meeting with the best transcript
    const { error: updateError } = await supabase.from('meetings').update({
      live_transcript_text: bestTranscript,
      whisper_transcript_text: bestSource === 'best_of_both' ? bestTranscript : undefined,
      word_count: bestWordCount,
      primary_transcript_source: bestSource,
      updated_at: new Date().toISOString()
    }).eq('id', meetingId);

    if (updateError) {
      throw new Error(`Error updating meeting: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Transcript consolidated using Best-of-Both merge',
      source: bestSource,
      mergeStats: mergeResult.stats,
      chunksProcessed: chunks.length,
      chunksFiltered: rejectedChunks.length,
      totalWords: bestWordCount,
      transcriptLength: bestTranscript.length,
      rejectedChunks: rejectedChunks.slice(0, 10) // Limit for response size
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
