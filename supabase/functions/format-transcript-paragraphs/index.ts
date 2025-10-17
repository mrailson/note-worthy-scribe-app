import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    
    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Transcript text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('Lovable API key not configured');
      return new Response(
        JSON.stringify({ error: 'Lovable API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎨 Formatting transcript into paragraphs, length:', transcript.length);

    const systemPrompt = `You are a professional transcript formatter. Your job is to take raw transcript text and format it into clear, well-structured paragraphs with proper spacing.

FORMATTING RULES:
1. Group related thoughts and topics into distinct paragraphs
2. Add proper line breaks between paragraphs (use double newlines)
3. Add EXTRA spacing (triple or quadruple newlines) between major sections or topic transitions
4. Preserve all original content - do not remove, summarize, or add information
5. Maintain speaker attributations if present (e.g., "Speaker 1:", "John:")
6. Keep timestamps if they exist
7. Fix obvious punctuation issues for readability
8. Capitalise the start of sentences
9. Create natural paragraph breaks at topic transitions or speaker changes

DO NOT:
- Summarise or condense content
- Remove any spoken words or phrases
- Add content that wasn't in the original
- Change the meaning or order of information

Return ONLY the formatted transcript text with proper paragraphs and extra spacing between major sections.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Format this transcript into clear paragraphs:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 32000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Lovable AI API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const formattedTranscript = data.choices[0].message.content;

    console.log('✅ Successfully formatted transcript');
    console.log('📊 Original length:', transcript.length, 'Formatted length:', formattedTranscript.length);

    return new Response(
      JSON.stringify({ 
        formattedTranscript,
        originalLength: transcript.length,
        formattedLength: formattedTranscript.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in format-transcript-paragraphs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
