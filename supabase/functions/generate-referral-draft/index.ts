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
      
      // Fetch practice details - try default first, then any practice for user
      let practice = null;
      const { data: defaultPractice } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (defaultPractice) {
        practice = defaultPractice;
      } else {
        // Fallback to most recent practice for user
        const { data: anyPractice } = await supabase
          .from('practice_details')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        practice = anyPractice;
      }
      
      if (practice) {
        practiceDetails = practice;
        console.log('Found practice details:', practice.practice_name, practice.address);
      } else {
        console.log('No practice details found for user:', userId);
      }
    }

    // Format today's date in UK format
    const today = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = today.toLocaleDateString('en-GB', dateOptions);

    const systemPrompt = `You are a UK NHS GP referral letter drafting assistant. Generate a professional referral letter based on the provided information.

CRITICAL RULES (Scribe-Safe):
1. ONLY use facts explicitly provided - never fabricate examination findings, test results, or history
2. Use intent-based language: "Please assess..." not "I have diagnosed..."
3. If information is missing, mark placeholders with [[MISSING: description]] format so they are clearly visible
4. Never state diagnoses unless the clinician explicitly confirmed one
5. Frame clinical concerns as "concerning for" or "to exclude" not definitive statements

LETTER FORMAT:
The letter should follow this structure:

**[PRACTICE NAME]**
[Practice Address Line 1]
[Practice Address Line 2 if applicable]
Tel: [Phone]
Email: [Email]

[Date]

[Recipient Department]
[Recipient Service Address if known, otherwise leave blank]

Dear Colleague,

Re: [Urgency] Referral for [[MISSING: Patient Name]], [[MISSING: Date of Birth]]

[Body of letter - clinical details, reason for referral, what you're asking them to do]

Thank you for your attention to this [urgency] matter. Please feel free to contact me at [Phone] or [Email] should you require any further information.

Yours sincerely,

[Clinician Name]
[Job Title]
GMC: [GMC Number]
[Practice Name]
[Practice Address]

IMPORTANT FORMATTING RULES:
- Do NOT include qualifications like MBBS, MBChB etc after the clinician name
- Include Practice Name and Address in the signature block
- Use [[MISSING: description]] format for any information that is not provided
- Use the actual date provided, not a placeholder
- Keep the letter concise and professional - UK NHS style

URGENCY WORDING:
- routine: "I would be grateful if you could see..."
- urgent: "I would be grateful for an urgent review..."
- 2ww: "I am referring under the 2 week wait pathway..."
- same-day: "I am requesting same-day assessment..."`;


    // Build info for the prompt - use actual values or MISSING markers
    const practiceName = practiceDetails?.practice_name || '[[MISSING: Practice Name]]';
    const practiceAddress = practiceDetails?.address || '[[MISSING: Practice Address]]';
    const practicePhone = practiceDetails?.phone || '[[MISSING: Phone Number]]';
    const practiceEmail = practiceDetails?.email || '[[MISSING: Email Address]]';
    
    // Build GP info - prefer GP signature settings, fall back to profile
    const gpName = gpDetails?.full_name || profileDetails?.full_name || '[[MISSING: Clinician Name]]';
    const gpJobTitle = gpDetails?.job_title || profileDetails?.role || profileDetails?.title || '[[MISSING: Job Title]]';
    const gpGmc = gpDetails?.gmc_number || '[[MISSING: GMC Number]]';

    const practiceInfo = `
Practice Name: ${practiceName}
Practice Address: ${practiceAddress}
Practice Phone: ${practicePhone}
Practice Email: ${practiceEmail}`;

    const gpInfo = `
Clinician Name: ${gpName}
Job Title: ${gpJobTitle}
GMC Number: ${gpGmc}`;

    // Build patient phone number for contact
    let patientPhone = '';
    if (patientContext?.phoneNumbers) {
      const phones = patientContext.phoneNumbers;
      if (phones.preferred && phones[phones.preferred]) {
        patientPhone = phones[phones.preferred];
      } else {
        patientPhone = phones.mobile || phones.home || phones.work || '';
      }
    }

    const patientInfo = patientContext ? `
Patient Name: ${patientContext.name || '[[MISSING: Patient Name]]'}
DOB: ${patientContext.dob || '[[MISSING: Date of Birth]]'}
Sex: ${patientContext.gender === 'M' ? 'Male' : patientContext.gender === 'F' ? 'Female' : ''}
NHS Number: ${patientContext.nhsNumber || '[[MISSING: NHS Number]]'}
Address: ${patientContext.address || ''}
Contact Number: ${patientPhone}` : `
Patient Name: [[MISSING: Patient Name]]
DOB: [[MISSING: Date of Birth]]
NHS Number: [[MISSING: NHS Number]]`;

    const userContent = `Generate a referral letter for the following:

TODAY'S DATE: ${formattedDate}

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

MISSING INFORMATION TO FLAG:
${suggestion.contraFlags?.join(', ') || 'None flagged'}

PRACTICE AND CLINICIAN DETAILS:
${practiceInfo}
${gpInfo}

PATIENT DETAILS:
${patientInfo}

Generate the complete referral letter using the exact details provided. Use [[MISSING: description]] format for any information that was not provided.`;

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
