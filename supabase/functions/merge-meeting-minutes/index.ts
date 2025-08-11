import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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

    const { summaries, meetingTitle, meetingDate, meetingTime, detailLevel = 'standard' } = await req.json();

    if (!Array.isArray(summaries) || summaries.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing summaries[]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `You are a senior minute taker. Merge multiple partial meeting summaries into a single, coherent set of minutes.
- Structure with these sections (single H1 per doc):\n# ${meetingTitle || 'Meeting Minutes'}\n- Date/Time\n- Attendees\n- Agenda\n- Key Points\n- Decisions\n- Actions\n- Risks/Issues\n- Next Steps\n- Keep concise, deduplicate, and resolve contradictions.
- British English. Markdown output. Do not include non-deterministic preambles.`;

    const joined = summaries.map((s, i) => `--- Chunk ${i + 1} ---\n${s}`).join("\n\n");

    const user = `Detail level: ${detailLevel}. Date: ${meetingDate || ''}. Time: ${meetingTime || ''}.\nMerge the following partial summaries into polished final minutes.\n\n${joined}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
    const meetingMinutes = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ meetingMinutes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('merge-meeting-minutes error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
