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

    const { complaintId, outcomeType, outcomeSummary, questionnaireData } = await req.json();
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
        .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
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

    // Build tone instruction based on questionnaire
    const toneInstruction = questionnaireData?.tone ? `
Tone: ${questionnaireData.tone === 'professional' ? 'Professional and balanced' :
         questionnaireData.tone === 'empathetic' ? 'Warm and empathetic, showing understanding' :
         questionnaireData.tone === 'apologetic' ? 'Apologetic and acknowledging concerns' :
         questionnaireData.tone === 'factual' ? 'Strictly factual and objective' :
         questionnaireData.tone === 'strong' ? 'Firm and assertive, appropriate for vexatious complaints' :
         questionnaireData.tone === 'firm' ? 'Firm but fair, addressing unreasonable behaviour' :
         'Professional'}` : '';

    const systemPrompt = `You are a professional NHS complaints officer writing outcome letters. Generate a formal outcome letter for a patient complaint that:

1. References the original complaint and investigation
2. Clearly states the outcome (rejected, upheld, or partially upheld)
3. Provides detailed reasoning for the decision
4. Includes any actions taken or improvements made
5. Explains the escalation process to Parliamentary and Health Service Ombudsman
6. Provides contact information for queries
7. Is empathetic, professional, and clear${toneInstruction}

⚠️ CRITICAL - NO FABRICATION RULES:
- DO NOT invent, fabricate, or assume ANY events, medical details, or circumstances not explicitly provided
- DO NOT add specific medical conditions, emergencies, or clinical details unless stated in the complaint description
- ONLY use information explicitly provided in the complaint details, outcome summary, and questionnaire data
- If information is missing, acknowledge it generically without inventing specifics
- Keep descriptions factual and based ONLY on provided information
- Do NOT elaborate beyond what is given - stick to the facts provided

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

    // Build additional context from questionnaire
    const questionnaireContext = questionnaireData ? `

INVESTIGATION VALIDATION (CQC Compliance):
- All complaint items thoroughly investigated: ${questionnaireData.investigation_complete ? 'Yes' : 'No'}
- All parties consulted: ${questionnaireData.parties_consulted ? 'Yes' : 'No'}
- Fair consideration confirmed: ${questionnaireData.fair_consideration ? 'Yes - CQC compliant' : 'No'}
${questionnaireData.is_vexatious ? '\n⚠️ Note: This complaint has been identified as vexatious or unreasonable' : ''}

KEY DETAILS PROVIDED:
${questionnaireData.actions_taken ? `Actions Taken: ${questionnaireData.actions_taken}` : ''}
${questionnaireData.improvements_made ? `Improvements Made: ${questionnaireData.improvements_made}` : ''}
${questionnaireData.additional_context ? `Additional Context: ${questionnaireData.additional_context}` : ''}
` : '';

    const userPrompt = `Generate an outcome letter for this complaint:

Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Patient Address: ${complaint.patient_address || 'Not provided'}
Original Complaint: ${complaint.complaint_description}
Outcome: ${outcomeType}
Outcome Summary: ${outcomeSummary}
Date: ${currentDate}
${questionnaireContext}

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

⚠️ CRITICAL REMINDER - DO NOT FABRICATE:
- Use ONLY the information provided above
- DO NOT invent medical emergencies, specific conditions, clinical details, or events
- DO NOT add specifics that weren't explicitly mentioned in the complaint description
- Keep your response based strictly on the facts provided
- If details are vague, keep them vague - do not add specificity

IMPORTANT: If patient address is provided, include it in the letter header after "Private & Confidential". Use the practice and signature details provided to create appropriate formatting and signature blocks. If practice phone number is available, include it in the practice contact details.

CRITICAL: Never include personal email addresses or direct contact details in the signature. ${practiceDetails?.email ? `Use the practice email: ${practiceDetails.email}` : 'Use a generic practice email'} ${practiceDetails?.phone ? `and practice phone number: ${practiceDetails.phone}` : ''} for contact information.`;

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
        temperature: 0.2,  // Low temperature to prevent fabrication/hallucination
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    let outcomeLetter = data.choices[0].message.content;
    
    // Add logo URL as HTML comment if available
    if (practiceDetails?.logo_url || practiceDetails?.practice_logo_url) {
      const logoUrl = practiceDetails.practice_logo_url || practiceDetails.logo_url;
      outcomeLetter = `<!-- logo_url: ${logoUrl} -->\n${outcomeLetter}`;
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