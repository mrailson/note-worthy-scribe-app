import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are creating a patient-facing summary of an NHS GP translation session. The patient does not speak English well, so you must write in their language.

CRITICAL — IDENTIFY THE INTERACTION TYPE FIRST:
Most sessions are GP RECEPTION interactions — booking appointments, asking questions, collecting prescriptions, registering as a new patient, requesting sick notes, etc. They are NOT clinical consultations.
Read the conversation carefully and summarise ONLY what actually happened. Do NOT assume or imply a clinical consultation took place unless a doctor/nurse actually provided clinical advice in the conversation.

WRONG (for an appointment booking): "Your doctor has seen you and provided treatment advice"
RIGHT (for an appointment booking): "You visited the GP reception to book an appointment with Dr Smith on Friday at 2pm for your knee pain"

OUTPUT FORMAT (strict JSON):
{
  "summary": "A 2-3 sentence overview of what ACTUALLY happened, in the patient's language. Be specific — include names, dates, times, reasons.",
  "keyPoints": ["Specific key point from the conversation in patient's language", ...],
  "actions": ["Specific action the patient needs to take, in patient's language", ...],
  "summaryEnglish": "Same summary in English",
  "keyPointsEnglish": ["Key point 1 in English", ...],
  "actionsEnglish": ["Action in English", ...]
}

RULES:
- Write in SIMPLE, CLEAR language — the patient may have limited literacy
- Use short sentences
- Be SPECIFIC — include actual details from the conversation (doctor names, appointment dates/times, medication names, reasons for visit). Never use vague generic summaries
- If the patient booked or requested an appointment, say so clearly. State the date, time, and doctor if mentioned
- If the patient collected a prescription, state which medication
- If the patient asked a question, state what the question was and the answer given
- Do NOT use clinical language ("the doctor saw you", "treatment advice", "clinical assessment") unless a clinical consultation actually occurred in the conversation
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
