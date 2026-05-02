import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchTranscript, liveTranscript } = await req.json();

    if (!batchTranscript && !liveTranscript) {
      return new Response(
        JSON.stringify({ error: 'At least one transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If only one transcript exists, return it as-is
    if (!batchTranscript || batchTranscript.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          consolidatedTranscript: liveTranscript,
          method: 'live_only',
          stats: {
            batchWords: 0,
            liveWords: liveTranscript?.trim().split(/\s+/).filter((w: string) => w.length > 0).length || 0,
            finalWords: liveTranscript?.trim().split(/\s+/).filter((w: string) => w.length > 0).length || 0,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!liveTranscript || liveTranscript.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          consolidatedTranscript: batchTranscript,
          method: 'batch_only',
          stats: {
            batchWords: batchTranscript?.trim().split(/\s+/).filter((w: string) => w.length > 0).length || 0,
            liveWords: 0,
            finalWords: batchTranscript?.trim().split(/\s+/).filter((w: string) => w.length > 0).length || 0,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const batchWords = batchTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    const liveWords = liveTranscript.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

    const systemPrompt = `You are an expert medical transcription specialist. Your task is to merge two versions of the same meeting transcript into a single, accurate, consolidated version.

IMPORTANT GUIDELINES:
1. Both transcripts cover the same audio recording but may have different accuracy levels
2. Batch (Whisper) transcripts are generally more accurate but may have gaps
3. Live (AssemblyAI) transcripts are real-time and may have more errors but better coverage
4. Prefer medical terminology that appears correctly in either source
5. Keep complete sentences - do not truncate or leave incomplete thoughts
6. Resolve discrepancies by choosing the version that:
   - Contains proper medical/clinical terms
   - Has complete, grammatical sentences
   - Provides more context or detail
7. Remove obvious transcription errors like repeated words or nonsense phrases
8. Maintain chronological order of the conversation
9. Do NOT add any content that doesn't appear in either transcript
10. Do NOT include any commentary or notes - only return the merged transcript text

OUTPUT: Return ONLY the consolidated transcript text, nothing else.`;

    const userPrompt = `Please merge these two transcripts into a single, accurate version:

=== BATCH TRANSCRIPT (Whisper) ===
${batchTranscript}

=== LIVE TRANSCRIPT (AssemblyAI) ===
${liveTranscript}

=== END OF TRANSCRIPTS ===

Produce a single consolidated transcript that represents the most accurate version of what was said.`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: systemPrompt,
        temperature: 0.2,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Anthropic error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const consolidatedTranscript = (aiResponse.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '').trim();

    const finalWords = consolidatedTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;

    console.log(`Transcript consolidation complete: batch=${batchWords} words, live=${liveWords} words, final=${finalWords} words`);

    return new Response(
      JSON.stringify({
        consolidatedTranscript,
        method: 'ai_merged',
        stats: {
          batchWords,
          liveWords,
          finalWords,
          wordDifference: Math.abs(batchWords - liveWords),
          wordDifferencePercent: Math.round(Math.abs(batchWords - liveWords) / Math.max(batchWords, liveWords) * 100),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error consolidating transcripts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
