import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { documentText, signatoryNames, totalPages } = await req.json();

    if (!documentText || !signatoryNames || !Array.isArray(signatoryNames)) {
      return new Response(JSON.stringify({ error: 'Missing documentText or signatoryNames' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Truncate document text to avoid token limits
    const truncatedText = documentText.substring(0, 8000);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a document analysis assistant. You analyse document text to suggest where electronic signature blocks should be placed for each signatory. Return positions as page number and percentage coordinates (x, y) where 0,0 is top-left and 100,100 is bottom-right. Signature blocks are typically placed near the bottom of a page, near signature lines, "Signed by:" sections, or where the person's name appears in a signing context. If you cannot find a specific location, suggest the last page near the bottom. Each signature block is roughly 35% wide and 12% tall.`,
          },
          {
            role: 'user',
            content: `Document has ${totalPages} pages. The signatories are: ${signatoryNames.join(', ')}.\n\nDocument text:\n${truncatedText}\n\nFor each signatory, suggest the best page and position (x%, y%) for their signature block. Consider where their name appears in signature sections of the document.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_positions',
              description: 'Return suggested signature positions for each signatory.',
              parameters: {
                type: 'object',
                properties: {
                  positions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Signatory name exactly as provided' },
                        page: { type: 'number', description: 'Page number (1-indexed)' },
                        x: { type: 'number', description: 'X position as percentage (0-100)' },
                        y: { type: 'number', description: 'Y position as percentage (0-100)' },
                      },
                      required: ['name', 'page', 'x', 'y'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['positions'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_positions' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please top up in Settings.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: place all at bottom of last page
    const fallback = {
      positions: signatoryNames.map((name: string, idx: number) => ({
        name,
        page: totalPages,
        x: 10 + (idx % 2) * 45,
        y: 70 + Math.floor(idx / 2) * 15,
      })),
    };

    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('suggest-signature-positions error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
