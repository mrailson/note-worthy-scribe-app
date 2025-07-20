import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  transcript: string;
  outputLevel: number;
  showSnomedCodes: boolean;
  formatForEmis: boolean;
  formatForSystmOne: boolean;
}

const getStyleInstructions = (level: number, showSnomed: boolean, formatEmis: boolean, formatSystm: boolean) => {
  let baseInstructions = "";
  
  switch (level) {
    case 1: // Code
      baseInstructions = "Generate a very concise one-line GP code summary only (e.g., 'URTI, 3/7, viral, paracetamol, safety-netted'). No formatting, just plain text.";
      break;
    case 2: // Brief
      baseInstructions = "Generate a brief clinical summary with key points only. Include presenting complaint, examination findings, diagnosis, and plan. Use clear headings and bullet points.";
      break;
    case 3: // Standard
      baseInstructions = "Generate a standard clinical consultation note with history, examination, assessment, and plan. Use professional medical terminology with clear structure.";
      break;
    case 4: // Detailed
      baseInstructions = "Generate a comprehensive clinical note including detailed history, full examination findings, investigations, differential diagnosis, and complete management plan with safety netting.";
      break;
    case 5: // Full
      baseInstructions = "Generate a complete consultation record including relevant patient quotes, detailed social history, comprehensive examination, full assessment with reasoning, and detailed management plan with patient education and follow-up.";
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

  return baseInstructions + additionalInstructions + " Use **bold** formatting for headings and key terms, but keep it professional and readable.";
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne }: RequestBody = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Valid transcript is required');
    }

    const styleInstructions = getStyleInstructions(outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne);

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

    // Generate Trainee Feedback (if requested at level 4 or 5)
    let traineeFeedback = "";
    if (outputLevel >= 4) {
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
          content: `You are a senior GP mentor providing comprehensive educational feedback to a GP trainee. Analyze this consultation thoroughly and provide detailed, constructive feedback covering:

**Clinical Assessment:**
- Quality of history taking (systematic approach, relevant questions)
- Examination technique and findings
- Diagnostic reasoning and differential diagnosis
- Investigation planning and interpretation

**Communication Skills:**
- Rapport building and patient engagement
- Use of appropriate language and explanation
- Active listening and empathy demonstration
- Shared decision making

**Professional Practice:**
- Time management and consultation structure
- Record keeping and documentation
- Safety netting and risk management
- Guidelines adherence and evidence-based practice

**Learning Opportunities:**
- Specific areas for improvement
- Recommended reading or training
- Similar cases to review
- Red flags that should be explored

**Positive Feedback:**
- What was done well
- Strengths demonstrated
- Professional behaviors exhibited

**Action Points:**
- Specific, measurable improvement goals
- Resources for further learning
- Follow-up learning activities

Use **bold** formatting for section headings and provide specific, actionable feedback with clinical reasoning.`
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