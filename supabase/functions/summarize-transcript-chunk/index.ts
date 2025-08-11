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

    const { text, meetingTitle, chunkIndex = 0, totalChunks = 1, detailLevel = 'standard' } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `You are an expert meetings note-taker. Summarize this transcript chunk into clean, concise, non-repetitive minutes in markdown.
- Keep headings consistent: Attendees, Agenda, Key Points, Decisions, Actions, Risks/Issues, Next Steps.
- Preserve unique details. Avoid repeating context that may appear in other chunks.
- Use bullet points. Keep action items in "[Owner] – Action – Due date (if mentioned)" format.
- British English.`;

    const user = `Meeting: ${meetingTitle || 'Meeting'}\nChunk ${chunkIndex + 1} of ${totalChunks}. Detail level: ${detailLevel}.\n\nTranscript chunk:\n"""\n${text}\n"""`;

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
    const summary = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ chunkIndex, totalChunks, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('summarize-transcript-chunk error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
