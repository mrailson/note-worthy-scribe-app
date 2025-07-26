import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { complaintId, outcomeType, outcomeSummary } = await req.json();
    if (!complaintId || !outcomeType || !outcomeSummary) {
      throw new Error('Complaint ID, outcome type, and summary are required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
    }

    // Get practice details if practice_id exists
    let practiceDetails = null;
    let signatureDetails = null;
    
    if (complaint.practice_id) {
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email, logo_url, footer_text, website, show_page_numbers')
        .eq('id', complaint.practice_id)
        .single();
      practiceDetails = practice;
    }

    // Get signature details for the user who created the complaint
    const { data: signature } = await supabase
      .from('complaint_signatures')
      .select('*')
      .eq('user_id', complaint.created_by)
      .eq('use_for_outcome_letters', true)
      .single();
    signatureDetails = signature;

    const systemPrompt = `You are a professional NHS complaints officer writing outcome letters. Generate a formal outcome letter for a patient complaint that:

1. References the original complaint and investigation
2. Clearly states the outcome (rejected, upheld, or partially upheld)
3. Provides detailed reasoning for the decision
4. Includes any actions taken or improvements made
5. Explains the escalation process to Parliamentary and Health Service Ombudsman
6. Provides contact information for queries
7. Is empathetic, professional, and clear

IMPORTANT FORMATTING REQUIREMENTS:
- Start directly with the date, do NOT include any practice headers, letterhead references, or "---NHS Practice" at the top
- Do NOT include any blank lines at the beginning of the letter
- Begin immediately with the date in format "DD Month YYYY"
- Follow with "Private & Confidential" and then the patient details
- Use practice branding and footer information provided
- DO NOT include practice details in a footer format with dashes (---)
- Include practice contact details naturally within the letter content or signature area only
- End with the signature block - do NOT include "*Signature*" or any signature placeholders
- Include a blank line before the signature block, then "Yours sincerely," followed by two blank lines, then list the signatory details directly
- NEVER include personal email addresses or phone numbers in contact details
- Only use practice-wide email and phone numbers

Format as a clean formal letter incorporating the configured practice and signature settings.`;

    const escalationText = outcomeType === 'rejected' || outcomeType === 'partially_upheld' 
      ? `If you remain dissatisfied with our response, you have the right to take your complaint to the Parliamentary and Health Service Ombudsman. They provide a free service for people who have a complaint about NHS care that cannot be resolved locally.

You can contact them at:
Parliamentary and Health Service Ombudsman
Millbank Tower
Millbank
London SW1P 4QP
Phone: 0345 015 4033
Website: www.ombudsman.org.uk

You should contact the Ombudsman within one year of the events you want to complain about, or within one year of when you first became aware of the problem.`
      : '';

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const userPrompt = `Generate an outcome letter for this complaint:

Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Patient Address: ${complaint.patient_address || 'Not provided'}
Original Complaint: ${complaint.complaint_description}
Outcome: ${outcomeType}
Outcome Summary: ${outcomeSummary}
Date: ${currentDate}

Signature Details:
${signatureDetails ? `
Name: ${signatureDetails.name}
Title: ${signatureDetails.job_title}
Qualifications: ${signatureDetails.qualifications || ''}
Signature Text: ${signatureDetails.signature_text || ''}
` : ''}

Practice Details:
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Address: ${practiceDetails.address || ''}
Phone: ${practiceDetails.phone || ''}
Email: ${practiceDetails.email || ''}
Website: ${practiceDetails.website || ''}
Footer Text: ${practiceDetails.footer_text || ''}
Show Page Numbers: ${practiceDetails.show_page_numbers ? 'Yes' : 'No'}
` : ''}

Include escalation information: ${escalationText}

Generate a professional outcome letter that clearly explains the decision and next steps. Include the date at the top of the letter as "${currentDate}". 

IMPORTANT: If patient address is provided, include it in the letter header after "Private & Confidential". Use the practice and signature details provided to create appropriate formatting and signature blocks. If practice phone number is available, include it in the practice contact details.

CRITICAL: Never include personal email addresses or direct contact details in the signature. Only use the practice email (${practiceDetails?.email || 'info@practice.nhs.uk'}) and practice phone number (${practiceDetails?.phone || ''}) for contact information.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    let outcomeLetter = data.choices[0].message.content;
    
    // Add practice logo information as metadata if available
    if (practiceDetails?.logo_url) {
      outcomeLetter = `<!-- logo_url: ${practiceDetails.logo_url} -->\n\n${outcomeLetter}`;
    }

    return new Response(JSON.stringify({ 
      outcomeLetter,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-complaint-outcome-letter function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate outcome letter' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});