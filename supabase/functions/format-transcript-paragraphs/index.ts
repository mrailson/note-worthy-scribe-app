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

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎨 Formatting transcript into paragraphs, length:', transcript.length);

    const systemPrompt = `You are a professional transcript formatter. Your job is to take raw transcript text and format it into clear, well-structured paragraphs with proper spacing.

FORMATTING RULES:
1. Group related thoughts and topics into distinct paragraphs
2. Add proper line breaks between paragraphs (use double newlines)
3. Preserve all original content - do not remove, summarize, or add information
4. Maintain speaker attributions if present (e.g., "Speaker 1:", "John:")
5. Keep timestamps if they exist
6. Fix obvious punctuation issues for readability
7. Capitalize the start of sentences
8. Create natural paragraph breaks at topic transitions or speaker changes

DO NOT:
- Summarize or condense content
- Remove any spoken words or phrases
- Add content that wasn't in the original
- Change the meaning or order of information

Return ONLY the formatted transcript text with proper paragraphs and spacing.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Format this transcript into clear paragraphs:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
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
