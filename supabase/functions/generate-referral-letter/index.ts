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
  gpSummary: string;
  fullNote: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, gpSummary, fullNote, userId }: RequestBody = await req.json();

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
          gpSignature = `\n\n**Referring GP:**\n${signatureData.gp_name}${signatureData.qualifications ? `, ${signatureData.qualifications}` : ''}${signatureData.gmc_number ? `\nGMC Number: ${signatureData.gmc_number}` : ''}${signatureData.job_title ? `\n${signatureData.job_title}` : ''}`;
        }

        // Get user's practice assignment first
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('practice_id')
          .eq('user_id', userId)
          .single();

        let practiceData = null;
        if (userRole?.practice_id) {
          // Fetch practice details by practice_id from user role
          const { data } = await supabase
            .from('practice_details')
            .select('*')
            .eq('id', userRole.practice_id)
            .single();
          practiceData = data;
        } else {
          // Fallback: fetch practice details by user_id
          const { data } = await supabase
            .from('practice_details')
            .select('*')
            .eq('user_id', userId)
            .eq('is_default', true)
            .single();
          practiceData = data;
        }

        if (practiceData) {
          practiceDetails = `\n\n**Referring Practice:**\n${practiceData.practice_name}${practiceData.address ? `\n${practiceData.address}` : ''}${practiceData.phone ? `\nTel: ${practiceData.phone}` : ''}${practiceData.email ? `\nEmail: ${practiceData.email}` : ''}${practiceData.website ? `\nWebsite: ${practiceData.website}` : ''}`;
        }
      } catch (error) {
        console.warn('Could not fetch user settings:', error);
        // Continue without settings
      }
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
        model: 'openai/gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are an NHS GP writing a referral letter to a specialist service. Generate a professional, comprehensive referral letter with proper formatting and spacing.

**Essential Components:**
- Patient demographics (use placeholder if not in transcript)
- Specialist service being referred to (determine from consultation)
- Clear reason for referral
- Relevant clinical history
- Current medications (if mentioned)
- Examination findings
- Investigation results (if any)
- Specific questions for the specialist
- Urgency level

**Format Requirements:**
- Use formal NHS referral letter format with proper spacing
- Professional medical language
- Clear, structured layout with headings
- Use **bold** formatting for section headings
- Add proper line breaks between sections
- Use bullet points for lists where appropriate
- Ensure proper paragraph spacing
- Start with "Dear [Specialty] Team" or "Dear [Specialist Name]"
- End with "Thank you for seeing this patient"

**Template Structure:**
Dear [Specialty] Team,

**Patient Details:**
[Patient information]

**Reason for Referral:**
[Clear statement of why patient is being referred]

**Clinical History:**
[Relevant background and history]

**Current Symptoms:**
[Presenting complaints and duration]

**Examination Findings:**
[Physical examination results]

**Investigations:**
[Any tests performed and results]

**Current Management:**
[Current medications and treatments]

**Specific Questions:**
[What you want the specialist to address]

**Urgency:**
[Routine/Urgent/2WW etc.]

Thank you for seeing this patient.

Yours sincerely,

**What NOT to include:**
- Patient address or contact details
- Referring GP details (name, qualifications, GMC number)
- Practice contact information (name, address, phone, email)
- Date of referral fields
- Patient advice sections (e.g., "Important Advice", "If patient experiences...")
- Emergency instructions or "call 999" advice
- Patient education content

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