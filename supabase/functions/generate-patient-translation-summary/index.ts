import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are creating a patient-facing summary of an NHS GP reception translation session. The patient does not speak English well, so you must write in their language.

OUTPUT FORMAT (strict JSON):
{
  "summary": "A 2-3 sentence overview of what happened during the visit, in the patient's language",
  "keyPoints": ["Key point 1 in patient's language", "Key point 2", ...],
  "actions": ["Action the patient needs to take, in patient's language", ...],
  "summaryEnglish": "Same summary in English",
  "keyPointsEnglish": ["Key point 1 in English", ...],
  "actionsEnglish": ["Action in English", ...]
}

RULES:
- Write in SIMPLE, CLEAR language — the patient may have limited literacy
- Use short sentences
- Focus on what the patient needs to KNOW and DO
- Include appointment dates/times, medication names, next steps
- NEVER include patient names, dates of birth, NHS numbers, addresses, or phone numbers
- You MAY include doctor names, appointment times, medication names, symptoms
- If no clear actions were agreed, return an empty actions array
- Keep key points to 3-6 items maximum
- Keep actions to 1-4 items maximum
- Always return valid JSON`;

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

    const { conversationText, patientLanguage, patientLanguageName } = await req.json();

    if (!conversationText || !patientLanguage) {
      return new Response(
        JSON.stringify({ error: 'conversationText and patientLanguage are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userPrompt = `The patient speaks ${patientLanguageName || patientLanguage}. Write the patient-facing sections in ${patientLanguageName || patientLanguage} and the English sections in English.

Here is the translation session conversation:

${conversationText}`;

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate patient summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '{}';
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(
        JSON.stringify({ error: 'Invalid response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating patient summary:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
