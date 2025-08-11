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
      throw new Error('OpenAI API key not configured');
    }

    const { text, meetingTitle, chunkIndex, totalChunks } = await req.json();

    if (!text) {
      throw new Error('Missing required field: text');
    }

    const idx = typeof chunkIndex === 'number' ? chunkIndex : 0;
    const tot = typeof totalChunks === 'number' ? totalChunks : 1;

    console.log(`🧹 Cleaning chunk ${idx + 1}/${tot} for: ${meetingTitle || 'Meeting'}`);
    console.log('🔍 Chunk length:', text.length);
    console.log('🔍 Chunk preview:', text.slice(0, 180));

    const systemPrompt = `You are a transcript cleaner. Clean this SINGLE CHUNK of a larger transcript without inventing content.

Do:
- Fix punctuation, casing, spacing, and simple grammar
- Remove obvious filler words (um, uh) and artifacts like [Music]
- Remove duplicated phrases inside the chunk
- Keep all real information and medical terms
- Keep neutrality and natural tone

Don't:
- Add headers, metadata, or speaker names not present
- Summarize; return the cleaned text only
- Remove meaningful content
`;

    const userPrompt = `Clean this transcript chunk. It comes from a larger meeting: ${meetingTitle || 'Meeting'}.

${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('OpenAI (chunk) error:', err);
      throw new Error(`OpenAI error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const cleaned = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ cleanedChunk: cleaned, chunkIndex: idx, totalChunks: tot }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in clean-transcript-chunk:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
