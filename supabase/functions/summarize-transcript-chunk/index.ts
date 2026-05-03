import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Claude Haiku 4.5 — fast per-chunk summariser for the map step of the
// chunked-notes pipeline. Project policy: claude family only (memory rule).
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert NHS meeting secretary producing a partial chunk summary for later merging.
British English. Professional, factual, neutral. Filter out banter, personal anecdotes, humour, off-topic remarks.
Keep substantive content only. Preserve names, decisions, actions, dates, numbers verbatim where present.
Output structured markdown with these sections (omit empty ones):
- Key Points
- Decisions (use prefixes RESOLVED / AGREED / NOTED in bold where applicable)
- Actions ([Owner] – Action – Due date if mentioned)
- Risks/Issues
Avoid preambles. Keep concise — this is one chunk, not the full minutes.`;

async function callClaude(model: string, systemPrompt: string, userPrompt: string, signal: AbortSignal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 400)}`);
  }
  const data = await response.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  return { text: text || '', inputTokens, outputTokens };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, meetingTitle, chunkIndex = 0, totalChunks = 1, detailLevel = 'standard', meetingDate, meetingYear } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dateGuard = meetingYear
      ? `═══ CRITICAL DATE HANDLING ═══
Meeting date: ${meetingDate} (year = ${meetingYear}).
Resolve all bare or relative dates (e.g. "1st May", "next month", "Friday") against the
meeting date above, NOT against your training cutoff. NEVER write a year earlier than
${meetingYear} unless this chunk EXPLICITLY uses that earlier year.
══════════════════════════════
\n\n`
      : '';

    const userPrompt = `${dateGuard}Meeting: ${meetingTitle || 'Meeting'}
Chunk ${chunkIndex + 1} of ${totalChunks}. Detail level: ${detailLevel}.

Transcript chunk:
"""
${text}
"""`;

    // Retry-once policy with 30s wall-clock per attempt.
    // On both failures, return a deterministic excerpt placeholder so the
    // merge step still has continuity for this chunk. The whole meeting
    // never fails on a single chunk timeout.
    let summary = '';
    let usedFallback = false;
    let lastError: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 1; attempt <= 1; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const result = await callClaude('claude-haiku-4-5', SYSTEM_PROMPT, userPrompt, controller.signal);
        clearTimeout(timer);
        summary = result.text;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        if (summary.trim()) break;
        lastError = 'empty response';
      } catch (e: any) {
        clearTimeout(timer);
        lastError = e?.name === 'AbortError' ? 'timeout after 30s' : (e?.message || 'unknown error');
        console.warn(`[summarize-transcript-chunk] chunk ${chunkIndex} attempt ${attempt} failed: ${lastError}`);
      }
    }

    if (!summary.trim()) {
      usedFallback = true;
      const excerpt = text.slice(0, 1800).replace(/\s+$/, '');
      summary = `_[unsummarised excerpt — chunk ${chunkIndex + 1}/${totalChunks}, reason: ${lastError ?? 'unknown'}]_\n\n${excerpt}${text.length > 1800 ? '…' : ''}`;
      console.error(`[summarize-transcript-chunk] chunk ${chunkIndex} fell back to excerpt placeholder: ${lastError}`);
    }

    return new Response(JSON.stringify({
      chunkIndex, totalChunks, summary, usedFallback,
      error: usedFallback ? lastError : null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, model: 'claude-haiku-4-5' },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('summarize-transcript-chunk fatal:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
