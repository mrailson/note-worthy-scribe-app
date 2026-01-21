import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferralSuggestion {
  id: string;
  type: string;
  displayName: string;
  specialty: string;
  pathway?: string;
  priority: 'routine' | 'urgent' | '2ww' | 'same-day';
  confidence: 'high' | 'medium' | 'low';
  triggerEvidence: Array<{
    type: 'symptom' | 'plan' | 'examination' | 'risk_factor' | 'negative';
    text: string;
    source: string;
  }>;
  contraFlags?: string[];
}

interface ExtractedFacts {
  symptoms: string[];
  riskFactors: string[];
  negatives: string[];
  medications: string[];
  investigations: string[];
  planStatements: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, notes, consultationType } = await req.json();

    if (!transcript && !notes) {
      return new Response(
        JSON.stringify({ error: 'Transcript or notes required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a UK NHS GP practice referral suggestion assistant. Your role is to:

1. EXTRACT FACTS ONLY - Do not infer or assume anything not explicitly stated
2. SUGGEST REFERRAL TYPES - Based on patterns in UK NHS pathways, never diagnose
3. PROVIDE EVIDENCE - Quote exact transcript excerpts that triggered each suggestion
4. BE TRANSPARENT - Show confidence levels honestly

CRITICAL RULES (Scribe-Safe):
- NEVER diagnose conditions (don't say "this is angina")
- NEVER instruct ("you must refer to...")
- NEVER fabricate findings not in the transcript
- Always frame as "based on the symptoms described..." not "the patient has..."
- If the clinician explicitly states a referral plan, prioritise that suggestion
- If critical information is missing, flag it in contraFlags

UK NHS REFERRAL PATHWAYS TO CONSIDER:
- Cardiology: RACPC (chest pain), Heart Failure Clinic, Arrhythmia Clinic
- Respiratory: Chest Clinic, Sleep Clinic, 2WW Lung Cancer
- Gastroenterology: Endoscopy, Lower GI 2WW, IBD Clinic
- Neurology: Headache Clinic, First Seizure Clinic
- Rheumatology: Early Arthritis Clinic
- Dermatology: 2WW Skin Cancer, General
- Orthopaedics: MSK Clinic, Spinal Pathway
- Urology: Haematuria 2WW, LUTS Clinic
- Gynaecology: PMB 2WW, Pelvic Pain Clinic
- ENT: Head & Neck 2WW, Hearing
- Mental Health: IAPT, CMHT
- Physiotherapy: MSK Physio

OUTPUT FORMAT (JSON):
{
  "suggestions": [
    {
      "id": "unique-id",
      "type": "Specialty_Pathway",
      "displayName": "Human readable name",
      "specialty": "Specialty",
      "pathway": "Specific pathway if applicable",
      "priority": "routine|urgent|2ww|same-day",
      "confidence": "high|medium|low",
      "triggerEvidence": [
        {"type": "symptom|plan|risk_factor|examination|negative", "text": "exact quote", "source": "transcript|notes"}
      ],
      "contraFlags": ["missing: duration of symptoms", "missing: red flag check"]
    }
  ],
  "extractedFacts": {
    "symptoms": ["symptom 1", "symptom 2"],
    "riskFactors": ["risk 1"],
    "negatives": ["no collapse", "no weight loss"],
    "medications": ["metformin"],
    "investigations": ["ECG planned"],
    "planStatements": ["refer to cardiology"]
  }
}

Limit to TOP 3 most relevant suggestions. If clinician explicitly mentions a referral, that should be the #1 suggestion with high confidence.`;

    const userContent = `Consultation type: ${consultationType || 'face-to-face'}

TRANSCRIPT:
${transcript || 'Not provided'}

CLINICAL NOTES:
${JSON.stringify(notes, null, 2) || 'Not provided'}

Analyse this consultation and suggest appropriate NHS referrals based ONLY on the information provided. Extract all relevant clinical facts.`;

    console.log('Analysing consultation for referral suggestions...');

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
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Ensure IDs are unique
    if (result.suggestions) {
      result.suggestions = result.suggestions.map((s: ReferralSuggestion, i: number) => ({
        ...s,
        id: s.id || `suggestion-${Date.now()}-${i}`
      }));
    }

    console.log(`Generated ${result.suggestions?.length || 0} referral suggestions`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyse-referral-suggestions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
