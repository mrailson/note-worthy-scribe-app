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
    const { transcript, outputFormat = 'summary' } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating scribe notes for transcript of ${transcript.length} chars, format: ${outputFormat}`);

    const systemPrompt = `You are an expert note-taker and summariser. Analyse the provided transcript and generate structured notes.

Your output must be a valid JSON object with exactly these fields:
{
  "summary": "A concise summary of the main discussion points and outcomes (2-4 paragraphs)",
  "actionItems": "A bulleted list of action items, tasks, or follow-ups identified in the conversation",
  "keyPoints": "The key points, decisions, and important information from the transcript"
}

Guidelines:
- Be concise but comprehensive
- Use British English spelling
- Format action items as a bulleted list with clear owners if mentioned
- Key points should be the most important takeaways
- If the transcript is unclear or lacks content, note this in the summary`;

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
          { role: 'user', content: `Please analyse this transcript and generate notes:\n\n${transcript}` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      parsedContent = {
        summary: content,
        actionItems: "",
        keyPoints: ""
      };
    }

    console.log('Successfully generated scribe notes');

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-scribe-notes:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
