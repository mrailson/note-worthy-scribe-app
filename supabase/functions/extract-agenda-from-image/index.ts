import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a meeting preparation assistant. Extract structured meeting information from the provided content (image, document text, or email text).

Return ONLY valid JSON with this structure:
{
  "agendaItems": ["item 1", "item 2", ...],
  "meetingType": "remote" | "face-to-face" | "hybrid" | null,
  "location": "string or null",
  "meetingTitle": "string or null",
  "meetingDate": "string or null",
  "meetingTime": "string or null",
  "chairperson": "string or null"
}

Rules:
- agendaItems: Array of concise agenda item strings. No numbering or bullet prefixes.
- meetingType: Infer from clues like "Teams link", "Zoom", "via video" → "remote"; "Room 3", "Board Room", "at the surgery" → "face-to-face"; "hybrid" if both mentioned. null if unclear.
- location: Physical location or virtual platform if mentioned. null if not found.
- meetingTitle: The title/name of the meeting if mentioned. null if not found.
- meetingDate: Date in ISO format (YYYY-MM-DD) if found. null if not found.
- meetingTime: Time in HH:MM format (24hr) if found. null if not found.
- chairperson: Name of chair/chairperson if mentioned. null if not found.
- If no agenda items can be identified, return an empty array.
- Combine sub-items into their parent where sensible.
- Keep items concise but descriptive.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { imageBase64, mimeType, textContent } = await req.json();

    if (!imageBase64 && !textContent) {
      throw new Error('No image or text data provided');
    }

    // Build the user message content
    const userContent: any[] = [
      {
        type: 'text',
        text: 'Extract meeting information from the following content. Return only valid JSON.',
      },
    ];

    if (imageBase64) {
      const dataUrl = `data:${mimeType || 'image/png'};base64,${imageBase64}`;
      userContent.push({
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'high' },
      });
    }

    if (textContent) {
      userContent.push({
        type: 'text',
        text: `\n\nContent to analyse:\n\n${textContent}`,
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parse the JSON response
    let result = {
      agendaItems: [] as string[],
      meetingType: null as string | null,
      location: null as string | null,
      meetingTitle: null as string | null,
      meetingDate: null as string | null,
      meetingTime: null as string | null,
      chairperson: null as string | null,
    };

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      result = {
        agendaItems: Array.isArray(parsed.agendaItems) ? parsed.agendaItems : [],
        meetingType: parsed.meetingType || null,
        location: parsed.location || null,
        meetingTitle: parsed.meetingTitle || null,
        meetingDate: parsed.meetingDate || null,
        meetingTime: parsed.meetingTime || null,
        chairperson: parsed.chairperson || null,
      };
    } catch {
      console.error('Failed to parse response:', content);
    }

    return new Response(JSON.stringify(result), {
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
