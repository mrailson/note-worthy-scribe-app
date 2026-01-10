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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      suggestion, 
      extractedFacts, 
      transcript,
      notes,
      userId,
      patientContext
    } = await req.json();

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: 'Referral suggestion required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch GP signature, profile, and practice details if userId provided
    let gpDetails = null;
    let practiceDetails = null;
    let profileDetails = null;

    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profile) {
        profileDetails = profile;
      }
      
      // Fetch GP signature settings
      const { data: gpSignature } = await supabase
        .from('gp_signature_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (gpSignature) {
        gpDetails = {
          full_name: gpSignature.gp_name,
          gmc_number: gpSignature.gmc_number,
          qualifications: gpSignature.qualifications,
          job_title: gpSignature.job_title,
          practice_name: gpSignature.practice_name,
        };
      }
      
      // Fetch practice details - try practice_id from profile or get first practice for user
      const { data: practice } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (practice) {
        practiceDetails = practice;
      }
    }

    const systemPrompt = `You are a UK NHS GP referral letter drafting assistant. Generate a professional referral letter based on the provided information.

CRITICAL RULES (Scribe-Safe):
1. ONLY use facts explicitly provided - never fabricate examination findings, test results, or history
2. Use intent-based language: "Please assess..." not "I have diagnosed..."
3. If information is missing, use placeholders like "[Please confirm: duration of symptoms]"
4. Never state diagnoses unless the clinician explicitly confirmed one
5. Frame clinical concerns as "concerning for" or "to exclude" not definitive statements

LETTER STRUCTURE:
1. Header with practice details and date
2. Recipient service clearly stated
3. Patient demographics (if provided)
4. Reason for referral (1-2 sentences, factual)
5. Clinical summary:
   - Presenting symptoms with time course
   - Relevant positives and negatives
   - Risk factors
   - Current medications (if relevant)
   - Investigations done/planned
6. Requested action (what you're asking them to do)
7. Safety-netting given (only if confirmed)
8. Closing with clinician contact details

URGENCY WORDING:
- routine: "I would be grateful if you could see..."
- urgent: "I would be grateful for an urgent review..."
- 2ww: "I am referring under the 2 week wait pathway..."
- same-day: "I am requesting same-day assessment..."

Keep the letter concise and professional. UK NHS style.`;

    // Build practice info - prefer practice_details, fall back to GP signature settings
    const practiceName = practiceDetails?.practice_name || gpDetails?.practice_name || '';
    const practiceAddress = practiceDetails?.address || '';
    const practicePhone = practiceDetails?.phone || '';
    const practiceEmail = practiceDetails?.email || '';
    
    // Build GP info - prefer GP signature settings, fall back to profile
    const gpName = gpDetails?.full_name || profileDetails?.full_name || '';
    const gpJobTitle = gpDetails?.job_title || profileDetails?.role || profileDetails?.title || '';
    const gpGmc = gpDetails?.gmc_number || '';
    const gpQualifications = gpDetails?.qualifications || '';

    const practiceInfo = `
Practice: ${practiceName || '[Practice Name - please update in Settings]'}
Address: ${practiceAddress || '[Practice Address - please update in Settings]'}
Phone: ${practicePhone || '[Phone - please update in Settings]'}
Email: ${practiceEmail || '[Email - please update in Settings]'}`;

    const gpInfo = `
GP Name: ${gpName || '[Your Name - please update in Settings]'}
Job Title: ${gpJobTitle || '[Job Title - please update in Settings]'}
GMC: ${gpGmc || '[GMC Number - please update in Settings]'}
Qualifications: ${gpQualifications || ''}`;

    const patientInfo = patientContext ? `
Patient Name: ${patientContext.name || '[Patient Name]'}
DOB: ${patientContext.dob || '[DOB]'}
NHS Number: ${patientContext.nhsNumber || '[NHS Number]'}
Address: ${patientContext.address || '[Address]'}` : '';

    const userContent = `Generate a referral letter for the following:

REFERRAL TYPE: ${suggestion.displayName}
SPECIALTY: ${suggestion.specialty}
PATHWAY: ${suggestion.pathway || 'General'}
PRIORITY: ${suggestion.priority}

TRIGGER EVIDENCE (from consultation):
${suggestion.triggerEvidence?.map((e: any) => `- ${e.type}: "${e.text}"`).join('\n') || 'None provided'}

EXTRACTED CLINICAL FACTS:
Symptoms: ${extractedFacts?.symptoms?.join(', ') || 'Not specified'}
Risk Factors: ${extractedFacts?.riskFactors?.join(', ') || 'None stated'}
Negatives: ${extractedFacts?.negatives?.join(', ') || 'Not documented'}
Medications: ${extractedFacts?.medications?.join(', ') || 'Not stated'}
Investigations: ${extractedFacts?.investigations?.join(', ') || 'None documented'}
Clinician Plan Statements: ${extractedFacts?.planStatements?.join(', ') || 'None'}

MISSING INFORMATION (flag in letter):
${suggestion.contraFlags?.join(', ') || 'None flagged'}

${practiceInfo}
${gpInfo}
${patientInfo}

Generate the complete referral letter. Include clear placeholders [in brackets] for any missing critical information.`;

    console.log('Generating referral draft for:', suggestion.displayName);

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
          { role: 'user', content: userContent }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const letterContent = data.choices[0].message.content;

    const draft = {
      id: `draft-${Date.now()}`,
      suggestionId: suggestion.id,
      recipientService: suggestion.displayName,
      specialty: suggestion.specialty,
      urgency: suggestion.priority,
      reasonForReferral: suggestion.triggerEvidence?.[0]?.text || 'As discussed',
      clinicalDetails: {
        symptoms: extractedFacts?.symptoms?.join(', ') || '',
        riskFactors: extractedFacts?.riskFactors?.join(', ') || '',
        negatives: extractedFacts?.negatives?.join(', ') || '',
        medications: extractedFacts?.medications?.join(', ') || '',
        investigations: extractedFacts?.investigations?.join(', ') || '',
      },
      requestedAction: `Please assess via ${suggestion.pathway || suggestion.specialty}`,
      safetyNettingGiven: false,
      toneVersion: 'neutral',
      letterContent,
      clinicianConfirmed: false,
    };

    console.log('Referral draft generated successfully');

    return new Response(JSON.stringify({ draft, letterContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-referral-draft:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
