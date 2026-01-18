import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
  consultationType?: string;
  userId?: string;
  noteFormat?: 'heidi' | 'soap';
  useGPShorthand?: boolean;
  patientLanguage?: string; // New field for patient's primary language
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

    const { transcript, outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne, consultationType, userId, noteFormat = 'heidi', useGPShorthand = false, patientLanguage }: RequestBody = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Valid transcript is required');
    }

    // Initialize Supabase client for fetching user settings
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch GP signature settings and practice details if userId is provided
    let gpSignature = '';
    let practiceDetails = '';
    
    if (userId) {
      try {
        // Fetch GP signature settings
        const { data: signatureData } = await supabase
          .from('gp_signature_settings')
          .select('*')
          .eq('user_id', userId)
          .eq('is_default', true)
          .single();

        if (signatureData) {
          gpSignature = `\n\n**GP Details:**\n${signatureData.gp_name}${signatureData.qualifications ? `, ${signatureData.qualifications}` : ''}${signatureData.gmc_number ? `\nGMC Number: ${signatureData.gmc_number}` : ''}${signatureData.job_title ? `\n${signatureData.job_title}` : ''}`;
        }

        // Fetch practice details
        const { data: practiceData } = await supabase
          .from('practice_details')
          .select('*')
          .eq('user_id', userId)
          .eq('is_default', true)
          .single();

        if (practiceData) {
          practiceDetails = `\n\n**Practice Details:**\n${practiceData.practice_name}${practiceData.address ? `\n${practiceData.address}` : ''}${practiceData.phone ? `\nTel: ${practiceData.phone}` : ''}${practiceData.email ? `\nEmail: ${practiceData.email}` : ''}${practiceData.website ? `\nWebsite: ${practiceData.website}` : ''}`;
        }
      } catch (error) {
        console.warn('Could not fetch user settings:', error);
        // Continue without settings
      }
    }

    const styleInstructions = getStyleInstructions(outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne);
    
    // Format consultation type for display
    const formattedConsultationType = consultationType === "face-to-face" ? "Face to Face" : 
                                    consultationType === "telephone" ? "Telephone Consultation" : 
                                    "Face to Face"; // default

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
            content: `You are an NHS GP consultation scribe following the HeidiHealth template EXACTLY. You MUST NEVER hallucinate or make up information that was not explicitly mentioned in the transcript.

CRITICAL INSTRUCTIONS:
- Use ONLY information explicitly mentioned in the transcript
- If information for any section is not mentioned, COMPLETELY OMIT that section - do not include empty headers
- Never invent patient details, symptoms, examination findings, diagnoses, or treatments
- Follow the EXACT HeidiHealth template structure below
- DO NOT include any header with practice details, patient details, or dates
- Start directly with the consultation type and presenting complaint
- Only include section headers (like "- FH:", "- SH:", "- Vital signs:") if there is actual content to put under them
- DH (Drug History) MUST ALWAYS appear in the History section as the FINAL item - NEVER in Examination
- Do NOT infer diagnoses from medications (e.g., seeing Ramipril does NOT mean adding "hypertension" to PMH)
- Transcribe medication content exactly as stated - do not summarise or modify

TEMPLATE STRUCTURE TO FOLLOW:

${formattedConsultationType} [specify whether anyone else is present e.g. "seen alone" or "seen with..." based on introductions]. '[Reason for visit - current issues or presenting complaint or booking note or follow up]'.

**History:**
- [History of presenting complaints]
- [ICE: Patient's Ideas, Concerns and Expectations]
- [Presence or absence of red flag symptoms relevant to the presenting complaint]
- [Relevant risk factors]
- [PMH: / PSH: - include the past medical history or surgical history (if applicable). Do NOT infer diagnoses from medications]
- [Allergies: (only include if explicitly mentioned in the transcript, otherwise leave blank)]
- [FH: Relevant family history (if applicable)]
- [SH: Social history i.e. lives with, occupation, smoking/alcohol/drugs, recent travel, carers/package of care (if applicable)]
- [DH: FINAL ITEM - Drug history/medications exactly as stated. Do NOT infer diagnoses from medications. Do NOT summarise or modify]

**Examination:**
- [Vital signs listed, eg. T, Sats %, HR, BP, RR, (as applicable)]
- [Physical or mental state examination findings, including system specific examination] (only include if applicable, and use as many bullet points as needed to capture the examination findings)
- [Investigations with results (include only if applicable and if mentioned)]

**Impression:**
1. Issue, problem or request 1 (issue, request or condition name only). Assessment, likely diagnosis for Issue 1 (condition name only) (include only if mentioned)
- Differential diagnosis for Issue 1 (include only if applicable and if mentioned)
2. Issue, problem or request 2 (issue, request or condition name only). Assessment, likely diagnosis for Issue 2 (condition name only) (include only if mentioned)
- Differential diagnosis for Issue 2 (include only if applicable and if mentioned)
Continue for additional issues as needed. Do NOT use square brackets around numbered items.

**Plan:**
- [Investigations planned for Issue 1 (include only if applicable and if mentioned)]
- [Treatment planned for Issue 1 (include only if applicable and if mentioned)]
- [Relevant referrals for Issue 1 (include only if applicable and if mentioned)]
- [Investigations planned for Issue 2 (include only if applicable and if mentioned)]
- [Treatment planned for Issue 2 (include only if applicable and if mentioned)]
- [Relevant referrals for Issue 2 (include only if applicable and if mentioned)]
- [Continue for additional issues as needed]
- [Follow up plan (noting timeframe if stated or applicable and if mentioned)]
- [Safety netting advice given (include only the advice/options which are mentioned in transcript)]

REMEMBER: If any information related to a placeholder has not been explicitly mentioned in the transcript, leave the relevant placeholder or section blank. Never state that information has not been mentioned - just omit it.

${styleInstructions}`
          },
          {
            role: 'user',
            content: `Generate a GP consultation summary following the HeidiHealth template EXACTLY from this transcript. Use ONLY information explicitly mentioned:\n\n${transcript}`
          }
        ],
        temperature: 0.1,
      }),
    });

    const gpSummaryData = await gpSummaryResponse.json();
    const gpSummary = gpSummaryData.choices[0].message.content;

    // Generate Full Clinical Note using HeidiHealth template
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
            content: `You are an NHS GP creating a comprehensive clinical note using the HeidiHealth template. You MUST NEVER hallucinate or make up information.

CRITICAL INSTRUCTIONS:
- Use ONLY information explicitly mentioned in the transcript
- Follow the HeidiHealth template structure EXACTLY
- Never invent or assume information not stated in the transcript
- If information is not mentioned, COMPLETELY OMIT that section - do not include empty headers
- DO NOT include any header with practice details, patient details, or dates
- Start directly with the consultation type and presenting complaint
- Only include section headers (like "- FH:", "- SH:", "- Vital signs:") if there is actual content to put under them
- DH (Drug History) MUST ALWAYS appear in the History section as the FINAL item - NEVER in Examination
- Do NOT infer diagnoses from medications (e.g., seeing Ramipril does NOT mean adding "hypertension" to PMH)
- Transcribe medication content exactly as stated - do not summarise or modify

Generate a detailed consultation note following the EXACT HeidiHealth template:

${formattedConsultationType} [specify whether anyone else is present e.g. "seen alone" or "seen with..." based on introductions]. '[Reason for visit - current issues or presenting complaint or booking note or follow up]'.

**History:**
- [History of presenting complaints]
- [ICE: Patient's Ideas, Concerns and Expectations]
- [Presence or absence of red flag symptoms relevant to the presenting complaint]
- [Relevant risk factors]
- [PMH: / PSH: - include the past medical history or surgical history (if applicable). Do NOT infer diagnoses from medications]
- [Allergies: (only include if explicitly mentioned in the transcript, otherwise leave blank)]
- [FH: Relevant family history (if applicable)]
- [SH: Social history i.e. lives with, occupation, smoking/alcohol/drugs, recent travel, carers/package of care (if applicable)]
- [DH: FINAL ITEM - Drug history/medications exactly as stated. Do NOT infer diagnoses from medications. Do NOT summarise or modify]

**Examination:**
- [Vital signs listed, eg. T, Sats %, HR, BP, RR, (as applicable)]
- [Physical or mental state examination findings, including system specific examination] (only include if applicable, and use as many bullet points as needed to capture the examination findings)
- [Investigations with results (include only if applicable and if mentioned)]

**Impression:**
1. Issue, problem or request 1 (issue, request or condition name only). Assessment, likely diagnosis for Issue 1 (condition name only) (include only if mentioned)
- Differential diagnosis for Issue 1 (include only if applicable and if mentioned)
2. Issue, problem or request 2 (issue, request or condition name only). Assessment, likely diagnosis for Issue 2 (condition name only) (include only if mentioned)
- Differential diagnosis for Issue 2 (include only if applicable and if mentioned)
Continue for additional issues as needed. Do NOT use square brackets around numbered items.

**Plan:**
- [Investigations planned for Issue 1 (include only if applicable and if mentioned)]
- [Treatment planned for Issue 1 (include only if applicable and if mentioned)]
- [Relevant referrals for Issue 1 (include only if applicable and if mentioned)]
- [Investigations planned for Issue 2 (include only if applicable and if mentioned)]
- [Treatment planned for Issue 2 (include only if applicable and if mentioned)]
- [Relevant referrals for Issue 2 (include only if applicable and if mentioned)]
- [Continue for additional issues as needed]
- [Follow up plan (noting timeframe if stated or applicable and if mentioned)]
- [Safety netting advice given (include only the advice/options which are mentioned in transcript)]

${showSnomedCodes ? 'Include SNOMED CT codes where appropriate.' : ''}
${formatForEmis ? 'Format for EMIS with expanded terminology.' : ''}
${formatForSystmOne ? 'Use SystmOne compatible abbreviations.' : ''}`
          },
          {
            role: 'user',
            content: `Generate a comprehensive clinical note using the HeidiHealth template from this transcript. Use ONLY information explicitly mentioned:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const fullNoteData = await fullNoteResponse.json();
    const fullNote = fullNoteData.choices[0].message.content;

    // Generate Bilingual Patient Copy (Patient's Language + English)
    let patientCopy = "";
    
    // First generate English patient copy
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
    const englishPatientCopy = patientCopyData.choices[0].message.content;
    
    // If patient language is specified and not English, create bilingual version
    if (patientLanguage && patientLanguage.toLowerCase() !== 'english' && patientLanguage.toLowerCase() !== 'en') {
      console.log(`🌍 Generating bilingual patient copy for language: ${patientLanguage}`);
      
      // Translate the English version to patient's language
      const translateResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are a professional medical translator. Translate the following patient consultation summary into ${patientLanguage}. 
              
CRITICAL REQUIREMENTS:
- Maintain medical accuracy while using patient-friendly language
- Preserve all important medical information
- Use culturally appropriate expressions
- Keep the same structure and formatting
- Ensure the translation is suitable for patients and families to understand`
            },
            {
              role: 'user',
              content: `Please translate this patient consultation summary into ${patientLanguage}:\n\n${englishPatientCopy}`
            }
          ],
          temperature: 0.3,
        }),
      });

      const translateData = await translateResponse.json();
      const translatedPatientCopy = translateData.choices[0].message.content;
      
      // Create bilingual patient copy with clear page separation
      patientCopy = `==================== PAGE 1 - ${patientLanguage.toUpperCase()} VERSION ====================

${translatedPatientCopy}


==================== PAGE 2 - ENGLISH VERSION ====================

${englishPatientCopy}


==================== BILINGUAL CONSULTATION SUMMARY ====================
Generated: ${new Date().toLocaleDateString()}
Patient Language: ${patientLanguage}
Both versions contain the same medical information for your reference.`;
      
      console.log(`✅ Bilingual patient copy generated successfully`);
    } else {
      // English only version
      patientCopy = englishPatientCopy;
      console.log(`✅ English-only patient copy generated`);
    }

    // Generate Trainee Feedback (if requested at level 4 or 5)
    let traineeFeedback = "";
    let soapNote = "";
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

    // Generate SOAP note (always available for detailed view)
    try {
      const soapResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an NHS GP producing a SOAP note (Subjective, Objective, Assessment, Plan).\n\nSTRICT RULES:\n- Use ONLY information explicitly present in the transcript\n- Do NOT hallucinate or invent details\n- Omit any section if there is no information for it (no empty headers)\n- Keep it professional and structured\n${useGPShorthand ? 'Use standard GP shorthand and abbreviations where appropriate (e.g., Pt, Hx, Ex, Rx, NKDA, /7, /52), ensuring clarity.' : ''}\n${showSnomedCodes ? 'Include SNOMED CT codes in brackets where appropriate.' : ''}`
            },
            {
              role: 'user',
              content: `Create a concise, high-quality SOAP note from this transcript. Use professional NHS GP standards.\n\nTranscript:\n${transcript}`
            }
          ],
          temperature: 0.2,
        }),
      });
      if (soapResponse.ok) {
        const soapData = await soapResponse.json();
        soapNote = soapData.choices[0].message.content;
      }
    } catch (_) {
      // If SOAP generation fails, silently continue
    }

    return new Response(JSON.stringify({
      gpSummary,
      fullNote,
      patientCopy,
      traineeFeedback,
      soapNote
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