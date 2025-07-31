import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, consultationData, consultationType } = await req.json();
    
    if (!prompt) {
      throw new Error('No prompt provided');
    }

    console.log('Processing AI consultation request:', prompt);

    // Build context from consultation data
    let contextPrompt = `You are an expert GP assistant helping with clinical documentation and consultation analysis. 

Consultation Context:
- Type: ${consultationType || 'General consultation'}
- Duration: ${consultationData?.duration || 'Not specified'}
- Transcript: ${consultationData?.transcript || 'No transcript available'}
- Current GP Summary: ${consultationData?.gpSummary || 'No summary available'}
- Patient Copy: ${consultationData?.patientCopy || 'No patient copy available'}

User Request: ${prompt}

Please provide a helpful, professional response that addresses the user's request. If they're asking for:
- A referral letter: Create a professional NHS-style referral letter
- Missing items: Review the consultation for any gaps or missing information
- Improvements: Suggest specific improvements to documentation or patient care
- Clinical advice: Provide evidence-based medical guidance

Keep responses concise but thorough, and always maintain professional medical standards.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert GP assistant specializing in clinical documentation, consultation analysis, and medical letter writing. Provide professional, evidence-based responses.'
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log('AI consultation response generated');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI consultation assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});