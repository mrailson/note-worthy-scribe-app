import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      throw new Error('No image data provided');
    }

    const dataUrl = `data:${mimeType || 'image/png'};base64,${imageBase64}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an agenda extraction assistant. Extract meeting agenda items from images of agendas, meeting papers, or documents.

Return ONLY a JSON array of strings, where each string is a concise agenda item. For example:
["Welcome and apologies", "Minutes of the last meeting", "Finance update", "AOB"]

If you cannot identify clear agenda items, return an empty array [].
Do not include numbering, bullet points, or prefixes — just the text of each item.
Keep items concise but descriptive. Combine sub-items into their parent where sensible.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the agenda items from this image. Return only a JSON array of strings.'
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'high' }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Parse the JSON array from the response
    let agendaItems: string[] = [];
    try {
      // Handle potential markdown code blocks
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      agendaItems = JSON.parse(cleaned);
      if (!Array.isArray(agendaItems)) {
        agendaItems = [];
      }
    } catch {
      console.error('Failed to parse agenda items:', content);
      agendaItems = [];
    }

    return new Response(JSON.stringify({ agendaItems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
