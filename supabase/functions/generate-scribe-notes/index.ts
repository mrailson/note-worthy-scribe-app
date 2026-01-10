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
    const { transcript, consultationType = 'f2f', outputFormat = 'soap', detailLevel = 3 } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating SOAP notes for ${consultationType} consultation, detail level: ${detailLevel}, transcript length: ${transcript.length} chars`);

    const consultationTypeLabel = {
      'f2f': 'face to face',
      'telephone': 'telephone',
      'video': 'video'
    }[consultationType] || 'face to face';

    // Detail level instructions
    const detailLevelInstructions: Record<number, string> = {
      1: "Use GP shorthand and medical codes only. Maximum brevity. Example: 'URTI, 2/7, no red flags. Rx: supportive. Safety-netted.'",
      2: "Be extremely concise. Key points only in bullet format. No full sentences needed.",
      3: "Standard complete clinical note with appropriate detail for EMR documentation.",
      4: "Include comprehensive examination findings, detailed clinical reasoning, and thorough differential diagnosis discussion.",
      5: "Include patient quotes where relevant, full contextual details, comprehensive history, and detailed clinical narrative."
    };

    const detailInstruction = detailLevelInstructions[detailLevel] || detailLevelInstructions[3];

    const systemPrompt = `You are an expert NHS GP clinical documentation assistant. Your task is to analyse a consultation transcript and generate structured SOAP notes suitable for UK primary care EMR systems (EMIS Web, SystmOne).

This is a ${consultationTypeLabel} consultation.

DETAIL LEVEL INSTRUCTION: ${detailInstruction}

Generate a JSON response with exactly these fields:
{
  "S": "Subjective section - Patient's presenting complaint, history of presenting complaint (HPC), relevant past medical history (PMH), drug history (DH), allergies, social history (SH), family history (FH). Write in concise clinical note style.",
  "O": "Objective section - Examination findings, observations, vital signs mentioned. For telephone/video consultations, note 'Remote consultation - no physical examination performed' if appropriate, but include any patient-reported observations.",
  "A": "Assessment section - Clinical impression, differential diagnoses, working diagnosis. Use appropriate clinical terminology.",
  "P": "Plan section - Investigations ordered, prescriptions, referrals, follow-up arrangements, safety-netting advice given, patient education provided. Be specific about actions.",
  "snomedCodes": ["Optional array of relevant SNOMED CT codes if clearly identifiable conditions are mentioned"]
}

Guidelines:
- Use British English spelling and NHS terminology
- Adjust verbosity according to the detail level instruction above
- Use standard medical abbreviations (PMH, DH, SH, FH, O/E, Ix, Rx, F/U)
- Include all clinically relevant information from the transcript
- If information is not mentioned, do not invent it - leave that aspect out or note "not documented"
- For telephone consultations, acknowledge the consultation type appropriately
- Safety-netting advice should always be documented in the Plan
- Format for easy reading in EMR systems`;

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
          { role: 'user', content: `Please analyse this consultation transcript and generate SOAP notes:\n\n${transcript}` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2500,
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
      // Fallback structure if parsing fails
      parsedContent = {
        S: content,
        O: "",
        A: "",
        P: "",
        snomedCodes: []
      };
    }

    console.log('Successfully generated SOAP notes');

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
