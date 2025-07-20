import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  transcript: string;
  gpSummary: string;
  fullNote: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, gpSummary, fullNote }: RequestBody = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Valid transcript is required');
    }

    console.log('Generating referral letter for transcript length:', transcript.length);

    // Generate Referral Letter
    const referralResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an NHS GP writing a referral letter to a specialist service. Generate a professional, comprehensive referral letter that includes:

**Essential Components:**
- Patient demographics (use placeholder if not in transcript)
- Referring practice details
- Specialist service being referred to (determine from consultation)
- Clear reason for referral
- Relevant clinical history
- Current medications (if mentioned)
- Examination findings
- Investigation results (if any)
- Specific questions for the specialist
- Urgency level
- GP contact details

**Format Requirements:**
- Use formal NHS referral letter format
- Professional medical language
- Clear, structured layout with headings
- Include date and reference numbers (use placeholders)
- Use **bold** formatting for section headings

**Clinical Context:**
Use the provided GP summary and full clinical note to ensure consistency and completeness.`
          },
          {
            role: 'user',
            content: `Generate a specialist referral letter based on this consultation:

**Transcript:**
${transcript}

**GP Summary:**
${gpSummary}

**Full Clinical Note:**
${fullNote}

Please determine the most appropriate specialist service from the consultation content and generate a comprehensive referral letter.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!referralResponse.ok) {
      throw new Error(`OpenAI API error: ${referralResponse.status}`);
    }

    const referralData = await referralResponse.json();
    const referralLetter = referralData.choices[0].message.content;

    console.log('Referral letter generated successfully');

    return new Response(JSON.stringify({
      referralLetter
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-referral-letter function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      referralLetter: ""
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});