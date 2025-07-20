import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  transcript: string;
  outputStyle: string;
  showSnomedCodes: boolean;
  formatForEmis: boolean;
  formatForSystmOne: boolean;
}

const getStyleInstructions = (style: string, showSnomed: boolean, formatEmis: boolean, formatSystm: boolean) => {
  let baseInstructions = "";
  
  switch (style) {
    case "gp-code-line":
      baseInstructions = "Generate a concise one-line summary using GP shorthand (e.g., 'URTI, 2/7, safety-netted, paracetamol advised').";
      break;
    case "systmone-style":
      baseInstructions = "Use SOAP format (Subjective, Objective, Assessment, Plan) with standard NHS short codes and abbreviations suitable for SystmOne.";
      break;
    case "emis-style":
      baseInstructions = "Use expanded format with clear headings and full sentences, suitable for EMIS systems.";
      break;
    case "full-clinical":
      baseInstructions = "Provide a comprehensive clinical summary including history, examination findings, medications, red flags, safety netting, and follow-up plans.";
      break;
    case "trainee-review":
      baseInstructions = "Provide a comprehensive summary like full clinical, but include annotations on safety netting, potential omissions, and teaching points for trainees.";
      break;
    default:
      baseInstructions = "Generate a standard clinical consultation summary.";
  }

  let additionalInstructions = "";
  
  if (showSnomed) {
    additionalInstructions += " Include relevant SNOMED CT codes in brackets after diagnoses.";
  }
  
  if (formatEmis) {
    additionalInstructions += " Format with expanded terminology and proper spacing for EMIS systems.";
  }
  
  if (formatSystm) {
    additionalInstructions += " Use abbreviated format suitable for copy-paste into SystmOne.";
  }

  return baseInstructions + additionalInstructions;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, outputStyle, showSnomedCodes, formatForEmis, formatForSystmOne }: RequestBody = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Valid transcript is required');
    }

    const styleInstructions = getStyleInstructions(outputStyle, showSnomedCodes, formatForEmis, formatForSystmOne);

    // Generate GP Summary
    const gpSummaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an NHS GP consultation scribe. Generate a structured consultation summary based on the following instructions:

${styleInstructions}

Focus on clinical accuracy, safety, and medico-legal completeness. Extract key clinical information including presenting complaint, examination findings, diagnosis, and management plan.`
          },
          {
            role: 'user',
            content: `Generate a GP consultation summary from this transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const gpSummaryData = await gpSummaryResponse.json();
    const gpSummary = gpSummaryData.choices[0].message.content;

    // Generate Full Clinical Note
    const fullNoteResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an NHS GP creating a comprehensive clinical note. Generate a detailed consultation note with:
- History of presenting complaint
- Past medical history (if mentioned)
- Examination findings
- Clinical assessment
- Investigation results (if any)
- Management plan
- Safety netting advice
- Follow-up arrangements

${showSnomedCodes ? 'Include SNOMED CT codes where appropriate.' : ''}
${formatForEmis ? 'Format for EMIS with expanded terminology.' : ''}
${formatForSystmOne ? 'Use SystmOne compatible abbreviations.' : ''}`
          },
          {
            role: 'user',
            content: `Generate a comprehensive clinical note from this transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const fullNoteData = await fullNoteResponse.json();
    const fullNote = fullNoteData.choices[0].message.content;

    // Generate Patient Copy
    const patientCopyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Create a patient-friendly summary of the consultation in plain English. Include:
- What was discussed
- Any diagnosis or health concern
- Treatment or medication advice
- When to seek further help
- Follow-up arrangements

Use clear, non-medical language that patients can easily understand.`
          },
          {
            role: 'user',
            content: `Generate a patient-friendly summary from this transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.4,
      }),
    });

    const patientCopyData = await patientCopyResponse.json();
    const patientCopy = patientCopyData.choices[0].message.content;

    // Generate Trainee Feedback (if requested)
    let traineeFeedback = "";
    if (outputStyle === "trainee-review") {
      const traineeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are a senior GP providing feedback to a trainee. Review the consultation and provide educational feedback including:
- Areas handled well
- Potential missed opportunities
- Safety netting considerations
- Red flags to watch for
- Learning points for future consultations
- Suggestions for further investigation or management

Be constructive and educational in your feedback.`
            },
            {
              role: 'user',
              content: `Provide trainee feedback for this consultation:\n\n${transcript}`
            }
          ],
          temperature: 0.4,
        }),
      });

      const traineeData = await traineeResponse.json();
      traineeFeedback = traineeData.choices[0].message.content;
    }

    return new Response(JSON.stringify({
      gpSummary,
      fullNote,
      patientCopy,
      traineeFeedback
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-gp-consultation-notes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      gpSummary: "",
      fullNote: "",
      patientCopy: "",
      traineeFeedback: ""
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});