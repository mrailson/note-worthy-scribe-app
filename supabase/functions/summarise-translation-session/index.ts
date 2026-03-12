import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are summarising an NHS GP reception translation session. Write a single concise summary in 1-2 sentences maximum.

CRITICAL PRIVACY RULES:
- NEVER include patient names — use "Female patient", "Male patient", or "Patient" instead
- NEVER include dates of birth, phone numbers, postcodes, NHS numbers, or addresses
- NEVER include the names of family members or carers
- You MAY include: doctor names (e.g. Dr Smith), appointment times/dates, medication names, symptoms, and actions taken — these are operationally necessary

Focus on:
- What the patient needed (reason for visit)
- What was agreed or arranged (appointment, referral, prescription etc.)
- Any notable actions (SMS sent, reports requested, follow-up needed)

Be factual and brief — this is for a receptionist scanning a list of past sessions. Write in past tense.

Examples of good summaries:
- "Female patient booked Friday 2pm appointment with Dr Smith (female GP) for persistent knee pain. SMS confirmation sent."
- "Male patient requested emergency appointment for severe chest pain. Triaged as urgent, seen within 30 minutes."
- "Patient collected repeat Metformin 500mg prescription. Directed to nearest pharmacy."
- "New patient registration — family recently arrived, proof of address still needed."`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationText } = await req.json();

    if (!conversationText || typeof conversationText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'conversationText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarise this reception translation session:\n\n${conversationText}` }
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await openaiResponse.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in summarise-translation-session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
