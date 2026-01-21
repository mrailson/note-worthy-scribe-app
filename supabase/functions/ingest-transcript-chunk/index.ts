import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { meetingId = null, sessionId, text, chunkIndex = null, detailLevel = 'standard' } = await req.json();

    if (!sessionId || !text) {
      return new Response(JSON.stringify({ error: 'sessionId and text are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Determine next chunk index if not provided
    let indexToUse = chunkIndex;
    if (indexToUse === null) {
      const { data: existing, error: selErr } = await supabase
        .from('meeting_summary_chunks')
        .select('chunk_index')
        .eq('session_id', sessionId)
        .order('chunk_index', { ascending: false })
        .limit(1);
      if (selErr) console.error('Index select error:', selErr);
      indexToUse = (existing && existing.length > 0 ? existing[0].chunk_index + 1 : 0);
    }

    // Summarize the chunk
    const system = `You are an expert minute-taker. Summarize this transcript chunk into concise markdown with sections: Key Points, Decisions, Actions ("Owner – Action – Due"), Risks/Issues.`;
    const user = `Detail level: ${detailLevel}.\nSession: ${sessionId}. Chunk ${indexToUse}.\n\nTranscript:\n"""\n${text}\n"""`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenAI error:', errText);
      return new Response(JSON.stringify({ error: 'OpenAI error', details: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const partialSummary = data.choices?.[0]?.message?.content || '';

    // Get user for both inserts
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Dual save approach: Save to both tables
    const promises = [];

    // 1. Save summary to meeting_summary_chunks (existing functionality)
    promises.push(
      supabase
        .from('meeting_summary_chunks')
        .insert({
          user_id: userId,
          meeting_id: meetingId,
          session_id: sessionId,
          chunk_index: indexToUse,
          source_word_count: text.trim().split(/\s+/).length,
          partial_summary: partialSummary,
          detail_level: detailLevel,
        })
        .select('id, chunk_index')
        .maybeSingle()
    );

    // 2. Save raw transcript to meeting_transcription_chunks (for auto-clean and live notes)
    if (meetingId && userId) {
      promises.push(
        supabase
          .from('meeting_transcription_chunks')
          .insert({
            meeting_id: meetingId,
            session_id: sessionId,
            chunk_number: indexToUse,
            transcription_text: text,
            confidence: 0.85, // Default confidence for ingested chunks
            is_final: true,
            user_id: userId
          })
      );
    }

    // Execute both saves
    const [summaryResult, transcriptResult] = await Promise.allSettled(promises);
    
    // Check for errors
    if (summaryResult.status === 'rejected' || (summaryResult.status === 'fulfilled' && summaryResult.value.error)) {
      const error = summaryResult.status === 'rejected' ? summaryResult.reason : summaryResult.value.error;
      console.error('Summary insert error:', error);
      return new Response(JSON.stringify({ error: 'Summary insert failed', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (transcriptResult?.status === 'rejected' || (transcriptResult?.status === 'fulfilled' && transcriptResult.value?.error)) {
      const error = transcriptResult?.status === 'rejected' ? transcriptResult?.reason : transcriptResult?.value?.error;
      console.error('Transcript chunk insert error:', error);
      // Don't fail the whole request for transcript insert errors, just log them
    }

    const inserted = summaryResult.value.data;

    return new Response(JSON.stringify({ ok: true, chunkIndex: inserted?.chunk_index, summary: partialSummary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('ingest-transcript-chunk error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
