import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are a transcript quality assurance engine for Notewell AI, an NHS medical device platform. Your sole task is to detect and repair hallucination artefacts in speech-to-text transcripts that have already been through a best-of-three consensus process.

## DETECTION RULES

1. **Repetition loops**: Flag any phrase, clause, or sentence that appears 3 or more times in near-identical form within a 500-word window. This is the most common hallucination pattern from Whisper-based engines.

2. **Stuck tokens**: Flag sequences where 4+ consecutive sentences share the same opening clause or structure with no meaningful variation.

3. **Nonsense bridges**: Flag passages where coherent speech abruptly transitions into garbled or semantically incoherent text for 2+ sentences, then returns to coherent speech.

## REPAIR RULES

- When a repetition loop is detected, KEEP ONLY THE FIRST OCCURRENCE of the repeated phrase.
- Delete all subsequent repetitions.
- If the repeated phrase sits between two coherent passages, join them with a natural paragraph break.
- If removing the hallucination creates a gap in meaning (e.g. the speaker was clearly making a different point before and after the loop), insert: [inaudible — transcript artefact removed]
- NEVER invent, paraphrase, or summarise content to fill the gap. Either the original words survive or the gap is marked.

## OUTPUT FORMAT

Return your response as a JSON object with two keys:

{
  "cleaned_transcript": "the full cleaned transcript text...",
  "repair_log": [
    {
      "type": "repetition_loop" | "stuck_tokens" | "nonsense_bridge",
      "original_text": "first 50 chars of the detected artefact...",
      "repetitions_found": 11,
      "action": "kept_first_occurrence" | "marked_inaudible",
      "position": "approximate word offset or surrounding context"
    }
  ]
}

## CRITICAL CONSTRAINTS

- Do NOT alter any other part of the transcript. Your only job is hallucination removal.
- Do NOT correct grammar, spelling, or speaker errors — these are verbatim transcripts.
- Do NOT reformat, reorder, or restructure the text.
- Preserve all paragraph breaks, speaker labels (e.g. [Speaker 1]:), and structure from the input.
- If no hallucinations are detected, return the transcript unchanged with an empty repair log.

Respond ONLY with the JSON object. No markdown backticks, no preamble.`;

// ─── Pre-LLM regex check for obvious repetition loops ─────────────────
interface LoopMatch {
  ngram: string;
  count: number;
}

function detectRepetitionLoops(text: string, minRepeats = 3, ngramSize = 6): LoopMatch[] {
  const words = text.split(/\s+/);
  if (words.length < ngramSize) return [];
  
  const seen = new Map<string, number>();
  for (let i = 0; i <= words.length - ngramSize; i++) {
    const ngram = words.slice(i, i + ngramSize).join(' ').toLowerCase();
    seen.set(ngram, (seen.get(ngram) || 0) + 1);
  }
  
  const loops: LoopMatch[] = [];
  for (const [ngram, count] of seen) {
    if (count >= minRepeats) {
      loops.push({ ngram, count });
    }
  }
  return loops;
}

// Detect stuck tokens: 4+ consecutive sentences with same opening
function detectStuckTokens(text: string): boolean {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length < 4) return false;
  
  for (let i = 0; i <= sentences.length - 4; i++) {
    const openings = sentences.slice(i, i + 4).map(s => {
      const words = s.split(/\s+/).slice(0, 4).join(' ').toLowerCase();
      return words;
    });
    const first = openings[0];
    if (openings.every(o => o === first)) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, meetingId } = await req.json();
    
    if (!transcript || transcript.length < 100) {
      return new Response(JSON.stringify({
        success: true,
        cleaned_transcript: transcript || '',
        repair_log: [],
        skipped: true,
        reason: 'Transcript too short for hallucination check',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── Pre-LLM regex check ─────────────────────────────────────
    const loops = detectRepetitionLoops(transcript);
    const hasStuck = detectStuckTokens(transcript);

    if (loops.length === 0 && !hasStuck) {
      console.log(`[HallucinationRepair] No loops detected for meeting ${meetingId || 'unknown'} — skipping LLM call`);
      return new Response(JSON.stringify({
        success: true,
        cleaned_transcript: transcript,
        repair_log: [],
        skipped: true,
        reason: 'No hallucination patterns detected by pre-check',
        pre_check: { loops_found: 0, stuck_tokens: false },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[HallucinationRepair] Detected ${loops.length} repetition loop(s), stuck_tokens=${hasStuck} — calling LLM`);
    if (loops.length > 0) {
      console.log(`[HallucinationRepair] Top loops: ${loops.slice(0, 3).map(l => `\"${l.ngram}\" (×${l.count})`).join(', ')}`);
    }

    // ─── LLM call via Anthropic (Claude Sonnet) ──────────────────
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.warn('[HallucinationRepair] ANTHROPIC_API_KEY not configured — passing through unchanged');
      return new Response(JSON.stringify({
        success: true,
        cleaned_transcript: transcript,
        repair_log: [],
        skipped: true,
        reason: 'ANTHROPIC_API_KEY not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();
    const inputWordCount = transcript.split(/\s+/).length;
    // Budget: input tokens + 500 for repair log
    const maxTokens = Math.min(Math.ceil(inputWordCount * 1.5) + 500, 16000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout (raised from 60s for long governance transcripts)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        temperature: 0.05,
        messages: [{
          role: 'user',
          content: `Clean the following transcript. Detect and remove any hallucination artefacts (repetition loops, stuck tokens, nonsense bridges) per your instructions. Return the cleaned transcript and a repair log.\n\nTRANSCRIPT:\n${transcript}`,
        }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[HallucinationRepair] Anthropic API error: ${response.status} - ${errText}`);
      // Fallback: pass through unchanged
      return new Response(JSON.stringify({
        success: true,
        cleaned_transcript: transcript,
        repair_log: [],
        skipped: true,
        reason: `LLM error: ${response.status}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const rawText = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HallucinationRepair] LLM response received in ${durationSec}s`);

    // Parse the JSON response
    let cleanedText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Attempt JSON repair for truncated responses
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      console.warn('[HallucinationRepair] JSON parse failed, attempting repair…');
      let opens = 0, openBrackets = 0, inString = false, escaped = false;
      for (const ch of cleanedText) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') opens++;
        else if (ch === '}') opens--;
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets--;
      }
      if (inString) cleanedText += '"';
      cleanedText += ']'.repeat(Math.max(0, openBrackets));
      cleanedText += '}'.repeat(Math.max(0, opens));
      
      try {
        parsed = JSON.parse(cleanedText);
        console.log('[HallucinationRepair] JSON repaired successfully');
      } catch {
        console.error('[HallucinationRepair] JSON repair failed — passing through unchanged');
        return new Response(JSON.stringify({
          success: true,
          cleaned_transcript: transcript,
          repair_log: [],
          skipped: true,
          reason: 'LLM response could not be parsed',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const cleanedTranscript = parsed.cleaned_transcript || transcript;
    const repairLog = parsed.repair_log || [];
    const outputWordCount = cleanedTranscript.split(/\s+/).length;
    const wordsRemoved = inputWordCount - outputWordCount;

    console.log(`[HallucinationRepair] Complete: ${repairLog.length} repair(s), ${wordsRemoved} words removed (${inputWordCount} → ${outputWordCount}), took ${durationSec}s`);

    return new Response(JSON.stringify({
      success: true,
      cleaned_transcript: cleanedTranscript,
      repair_log: repairLog,
      skipped: false,
      stats: {
        input_words: inputWordCount,
        output_words: outputWordCount,
        words_removed: wordsRemoved,
        repairs_count: repairLog.length,
        duration_seconds: parseFloat(durationSec),
        pre_check: {
          loops_found: loops.length,
          stuck_tokens: hasStuck,
          top_loops: loops.slice(0, 5),
        },
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[HallucinationRepair] Error:', error);
    
    // On any error, try to extract transcript from request and pass through
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      cleaned_transcript: null,
      repair_log: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
