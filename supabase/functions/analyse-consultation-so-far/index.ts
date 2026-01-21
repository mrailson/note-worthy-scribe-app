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
    const { transcript, contextContent } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analysing consultation so far, transcript length: ${transcript.length} chars`);

    const systemPrompt = `You are an NHS GP clinical assistant helping with live consultation analysis. Your task is to analyse the consultation transcript so far and provide helpful guidance for the clinician.

IMPORTANT: This is a LIVE consultation analysis to help the clinician, not final documentation.

Analyse the transcript and provide:
1. A brief summary of what has been discussed so far (2-3 sentences)
2. Issues/problems the patient has mentioned or that have been discussed
3. Outstanding questions the clinician might want to ask (things not yet covered)
4. Suggested wrap-up items before ending the consultation
5. Any red flags mentioned that warrant attention

Be practical, concise, and clinically useful. Focus on what would help the clinician in the moment.

${contextContent ? `Additional clinical context has been provided (e.g., blood results, documents). Consider this when making suggestions.` : ''}

Return a JSON response with this structure:
{
  "summary": "Brief summary of consultation so far",
  "issuesDiscussed": ["Issue 1", "Issue 2"],
  "outstandingQuestions": ["Question that hasn't been asked yet", "Another area to explore"],
  "suggestedWrapUp": ["Action to confirm with patient", "Follow-up arrangement to discuss"],
  "redFlagsIdentified": ["Any concerning findings mentioned"]
}

Guidelines:
- Use British English and NHS terminology
- Be concise - this is for quick reference during consultation
- Only include red flags if genuinely concerning symptoms/findings were mentioned
- Outstanding questions should be clinically relevant things not yet covered
- Keep arrays to 3-5 items maximum each`;

    let userMessage = `Please analyse this ongoing consultation and provide guidance:\n\nTRANSCRIPT SO FAR:\n${transcript}`;
    
    if (contextContent) {
      userMessage += `\n\nADDITIONAL CLINICAL CONTEXT:\n${contextContent}`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
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
        issuesDiscussed: [],
        outstandingQuestions: [],
        suggestedWrapUp: [],
        redFlagsIdentified: []
      };
    }

    console.log('Successfully generated consultation analysis');

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyse-consultation-so-far:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
