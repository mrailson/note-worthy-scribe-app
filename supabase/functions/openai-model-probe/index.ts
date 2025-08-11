import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      // allow empty body
    }

    const modelId: string = body?.modelId || 'gpt-5';
    const prompt: string = body?.prompt || 'Reply with exactly: ping';

    console.log(`[probe] Testing model: ${modelId}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a minimal echo bot used for health checks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 32,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[probe] OpenAI error', err);
      return new Response(
        JSON.stringify({ ok: false, model: modelId, error: err?.error?.message || response.statusText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply: string = data?.choices?.[0]?.message?.content || '';

    console.log(`[probe] Success for ${modelId}:`, reply);

    return new Response(
      JSON.stringify({ ok: true, model: modelId, reply, usage: data?.usage || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[probe] Unexpected error', error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
