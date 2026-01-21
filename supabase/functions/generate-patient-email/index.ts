import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientEmailRequest {
  transcript: string;
  consultationType?: string;
}

interface GPProfile {
  full_name: string;
  email: string;
}

interface PracticeDetails {
  practice_name: string;
  email: string;
  phone: string;
  address: string;
}

serve(async (req) => {
  console.log('🚀 Generate patient email function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Parsing request body...');
    const { transcript, consultationType = "General Consultation" }: PatientEmailRequest = await req.json();
    console.log('✅ Request parsed:', { transcriptLength: transcript?.length, consultationType });

    console.log('🔐 Checking authorization header...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      throw new Error('No authorization header provided');
    }
    console.log('✅ Authorization header found:', authHeader.substring(0, 20) + '...');

    console.log('🔧 Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Set the auth session manually from the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('👤 Getting current user...');
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      console.error('❌ User:', user);
      throw new Error('User not authenticated');
    }
    console.log('✅ User authenticated:', user.id);

    console.log('📋 Getting GP profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();
    
    console.log('Profile result:', { profile, profileError });

    console.log('🏥 Getting practice details...');
    const { data: practiceDetails, error: practiceError } = await supabase
      .from('practice_details')
      .select('practice_name, email, phone, address')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    console.log('Practice details result:', { practiceDetails, practiceError });

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }
    console.log('✅ OpenAI API key found');

    // Scribe-Safe Patient Summary Letter System Prompt
    const systemPrompt = `You are an AI scribe generating a draft patient summary letter based only on what was explicitly discussed during a clinical consultation.

Your role is to reflect, not interpret.

This letter must support the clinician and patient without providing diagnosis, explanation, reassurance, or independent clinical judgement.

CORE ROLE AND BOUNDARY
- You are not a clinician.
- You must not diagnose, suggest diagnoses, explain conditions, or provide clinical advice.
- You must not add information that was not explicitly stated in the consultation.
- You must not interpret symptoms or explain what they might mean.
- You must not sound like a doctor giving reassurance, judgement, or recommendations.

Your task is to generate a neutral, factual summary of what was discussed, written in plain English for the patient.

MANDATORY POSITIONING
The letter must clearly read as: "A summary of what was discussed during your consultation"
It must NOT read as: a diagnosis letter, a treatment plan, a clinical explanation, a reassurance letter, or a health education leaflet.

CONTENT RULES (STRICT)

❌ YOU MUST NEVER:
- State or suggest a diagnosis (including "could be", "may indicate", "suggestive of", "likely")
- Name possible conditions (e.g. angina, cancer, anxiety)
- Explain diseases or symptoms
- Use judgement phrases such as: "cause for concern", "important to investigate", "this means that", "reassuring"
- Add advice not explicitly spoken by the clinician
- Invent, infer, or complete missing information
- Reassure the patient beyond what was said verbatim

If it was not said aloud in the consultation, it must not appear.

✅ WHAT YOU MAY INCLUDE (ONLY IF DISCUSSED):

1. Symptoms discussed - State factually, without interpretation.
   Example: "We discussed your symptoms of chest tightness during physical activity and ongoing fatigue."

2. Tests and referrals (INTENT-BASED ONLY) - Use neutral, non-committal wording that reflects discussion, not completion.
   Correct: "As discussed, further tests are planned, including an ECG and blood tests."
   Correct: "A referral to cardiology via the chest pain pathway was discussed."
   Incorrect: "I have arranged…" / "You have been referred…" / "These tests will confirm…"

3. Follow-up - "A follow-up appointment has been arranged to review the results." No promises, no reassurance.

4. Safety-netting (ONLY if explicitly stated) - Include only safety-netting that was clearly spoken in the consultation, using near-verbatim language.
   Example: "As discussed, if you develop chest pain at rest, pain lasting more than 15 minutes, or feel very unwell, you should seek urgent medical help by calling 999."
   Do not add or expand advice.

5. Medications (REFLECTIVE ONLY) - You may repeat what the patient said they take.
   Correct: "You mentioned that you are taking Ramipril for blood pressure."
   Incorrect: "Continue taking…" / "Try to remember…" / "You should…"

TONE AND STYLE REQUIREMENTS:
- Neutral
- Factual
- Calm
- Non-emotive
- No empathy scripts
- No reassurance language
- No judgement
- Plain English

This is a record of discussion, not a message of care.

FALLBACK RULE:
If you cannot generate a safe, compliant summary from this transcript, output ONLY: "Unable to generate a safe patient summary from this consultation."`;

    const userPrompt = `Based on the consultation transcript below, generate a patient summary letter body.

CRITICAL REMINDERS:
1. ONLY include what was explicitly discussed
2. NO diagnoses, NO explanations, NO advice, NO reassurance
3. Use neutral, reflective language ("we discussed", "as discussed", "you mentioned")
4. If in doubt, leave it out

Consultation Transcript:
${transcript}

Generate ONLY the main letter body content. Do not include greetings, signatures, or closings.`;

    console.log('🤖 Calling OpenAI API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      console.error('❌ OpenAI API error:', openaiResponse.status, openaiResponse.statusText);
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenAI response received');
    const generatedContent = openaiData.choices[0]?.message?.content || '';

    // Format the complete email with GP and practice details
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Clean up any residual content from AI response - remove clichéd openings
    let cleanedContent = generatedContent
      .replace(/^Subject:.*$/gm, '') // Remove any subject lines
      .replace(/^Dear (Patient|Mrs\.?|Mr\.?|Ms\.?).*$/gm, '') // Remove any greetings
      .replace(/Kind regards,[\s\S]*$/i, '') // Remove any "Kind regards" and everything after
      .replace(/Best regards,[\s\S]*$/i, '') // Remove any "Best regards" and everything after
      .replace(/Sincerely,[\s\S]*$/i, '') // Remove any "Sincerely" and everything after
      .replace(/\[Your Name\]/g, '') // Remove placeholder names
      .replace(/\[Your Position\]/g, '') // Remove placeholder positions
      // Remove clichéd opening statements
      .replace(/^I hope (you are well|this finds you|this email finds you|all is well).*?\./gi, '')
      .replace(/^I trust (this email finds you|you are).*?\./gi, '')
      .replace(/^Thank you for (attending|coming in|your visit).*?\./gi, '')
      .replace(/^It was (a pleasure|lovely|great) to (see|meet).*?\./gi, '')
      .replace(/^Following (our|your) (recent )?consultation.*?\./gi, '')
      .replace(/^[\s\n]*/, '') // Remove leading whitespace/newlines
      .trim();

    const emailContent = `Subject: Your Recent Consultation - ${consultationType}

Dear Patient,

${cleanedContent}

If you have any questions or concerns, please don't hesitate to contact our practice.

Kind regards,

${profile?.full_name || 'Dr. [Name]'}
${practiceDetails?.practice_name || '[Practice Name]'}

Practice Contact Details:
Email: ${practiceDetails?.email || '[practice@email.com]'}
Phone: ${practiceDetails?.phone || '[Practice Phone]'}
Address: ${practiceDetails?.address || '[Practice Address]'}

This email was generated on ${currentDate}

---
Please note: This email contains confidential medical information. If you have received this email in error, please contact our practice immediately and delete this message.`;

    console.log('✅ Email content generated, length:', emailContent.length);
    
    return new Response(
      JSON.stringify({ 
        emailContent,
        success: true 
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error generating patient email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
        status: 500,
      }
    );
  }
});