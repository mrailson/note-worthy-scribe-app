import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, unsolvedOutput } = await req.json();

    console.log('Received request to explain unresolved section');
    console.log('Unresolved output:', unsolvedOutput);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI assistant that explains your own reasoning. When asked about why you included certain sections in meeting notes, provide clear explanations based on the content and context.' 
          },
          { 
            role: 'user', 
            content: `I asked you to generate meeting notes from a transcript, and you included a section called "unresolved section" with this content:

${unsolvedOutput}

Based on this transcript:
${transcript}

Can you explain:
1. What specific content in the transcript led you to create this "unresolved section"?
2. Why did you call it "unresolved" specifically?
3. What makes these items different from other action items or decisions?
4. Should these items be categorized differently?

Please be specific about which parts of the transcript influenced this categorization.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices[0].message.content;

    console.log('Generated explanation:', explanation);

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in explain-unresolved-section function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});