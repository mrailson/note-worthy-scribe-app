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
    console.log('generate-complaint-outcome-letter request', {
      complaintId,
      hasOutcomeType: !!outcomeType,
      hasOutcomeSummary: !!outcomeSummary,
    });
    if (!complaintId || !outcomeType || !outcomeSummary) {
      throw new Error('Complaint ID, outcome type, and summary are required');
    }

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars', { hasUrl: !!SUPABASE_URL, hasService: !!SUPABASE_SERVICE_ROLE_KEY });
      throw new Error('Server misconfiguration: Supabase credentials missing');
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch complaint details with related investigation data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (complaintError || !complaint) {
      console.error('Complaint fetch error:', complaintError);
      throw new Error('Complaint not found');
    }

    // Get practice details - try practice_details first, then gp_practices as fallback
    let practiceDetails = null;
    let signatureDetails = null;

    console.log('Fetching practice details');

    // First, get the practice_id from user_roles
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('practice_id')
      .eq('user_id', complaint.created_by)
      .not('practice_id', 'is', null)
      .limit(1)
      .maybeSingle();

    console.log('User role query result:', { userRole });

    // Determine which practice_id to use
    const practiceId = userRole?.practice_id || complaint.practice_id;

    if (practiceId) {
      // Try practice_details table first
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
        .eq('id', practiceId)
        .maybeSingle();
      
      if (practice) {
        practiceDetails = practice;
        console.log('Retrieved practice details from practice_details table:', practiceDetails);
      } else {
        // Fallback to gp_practices table
        console.log('No practice_details found, trying gp_practices table');
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('name, address, phone, email')
          .eq('id', practiceId)
          .maybeSingle();
        
        if (gpPractice) {
          practiceDetails = {
            practice_name: gpPractice.name,
            address: gpPractice.address,
            phone: gpPractice.phone,
            email: gpPractice.email,
            logo_url: null,
            practice_logo_url: null,
            footer_text: null,
            website: null,
            show_page_numbers: false
          };
          console.log('Retrieved practice details from gp_practices table:', practiceDetails);
        }
      }
    }
    
    if (!practiceDetails) {
      console.log('No practice details found for practice_id:', practiceId);
    }

    // Get signature details for the user who created the complaint
    const { data: signature } = await supabase
      .from('complaint_signatures')
      .select('*')
      .eq('user_id', complaint.created_by)
      .eq('use_for_outcome_letters', true)
      .maybeSingle();
    
    if (signature) {
      signatureDetails = signature;
      console.log('Found signature details:', signatureDetails?.name);
    } else {
      // Fallback: get user name from auth.users metadata (same approach as acknowledgement letter)
      console.log('No signature found, fetching user details from auth');
      const { data: authUser } = await supabase.auth.admin.getUserById(complaint.created_by);
      
      if (authUser?.user) {
        const signatoryName = authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'Complaints Manager';
        
        // Check if they have GP Partner role or similar
        const { data: userRoleData } = await supabase
          .from('user_roles')
          .select('role, practice_role')
          .eq('user_id', complaint.created_by)
          .maybeSingle();
        
        // Determine title based on role
        let signatoryTitle = 'Complaints Manager';
        if (userRoleData?.practice_role) {
          signatoryTitle = userRoleData.practice_role;
        } else if (userRoleData?.role === 'practice_manager') {
          signatoryTitle = 'Practice Manager';
        } else {
          signatoryTitle = 'GP Partner'; // Default for clinical users
        }
        
        signatureDetails = {
          name: signatoryName,
          job_title: signatoryTitle,
          qualifications: null,
          signature_text: null,
          email: practiceDetails?.email || null
        };
        console.log('Using auth user details for signature:', signatureDetails.name, signatureDetails.job_title);
      } else {
        // Final fallback
        signatureDetails = {
          name: 'The Complaints Team',
          job_title: 'Complaints Manager',
          qualifications: null,
          signature_text: null
        };
        console.log('Using fallback signature:', signatureDetails.name, signatureDetails.job_title);
      }
    }

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

⚠️ CRITICAL - BRITISH ENGLISH ONLY:
- Use ONLY British English spellings throughout (e.g., "apologise" NOT "apologize", "recognise" NOT "recognize", "organisation" NOT "organization")
- Use British date formats: DD Month YYYY (e.g., "15 January 2025")
- Use British terminology and phrasing
- Double-check all spellings to ensure they follow British English conventions

⚠️ CRITICAL - NO FABRICATION RULES:
- DO NOT invent, fabricate, or assume ANY events, medical details, or circumstances not explicitly provided below
- DO NOT add specific medical conditions, emergencies, or clinical details unless stated in the complaint description or investigation findings
- ONLY reference information explicitly provided in: complaint description, investigation findings, staff responses, and questionnaire data
- If a detail is vague or missing, keep it vague - DO NOT add specificity or invent examples
- Do NOT elaborate with scenarios, examples, or "what might have happened"
- Use ONLY the exact facts provided - nothing more, nothing less
- When explaining your reasoning, base it ONLY on the information provided below

EXAMPLES OF WHAT NOT TO DO:
❌ "The patient experienced a medical emergency..." (unless explicitly stated)
❌ "During the consultation, the doctor failed to..." (unless explicitly stated)
❌ "The patient was left waiting in severe pain..." (unless explicitly stated)
✅ "Based on the complaint received regarding appointment delays..."
✅ "The investigation found that..." (only if in investigation findings)
✅ "As stated in the original complaint..."

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

    // Build investigation data context (fetch related data separately to avoid relationship issues)
    const { data: findings } = await supabase
      .from('complaint_investigation_findings')
      .select('investigation_summary, findings_text, evidence_notes, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: decisionData } = await supabase
      .from('complaint_investigation_decisions')
      .select('decision_reasoning, corrective_actions, lessons_learned, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: parties } = await supabase
      .from('complaint_involved_parties')
      .select('staff_name, staff_role, response_text')
      .eq('complaint_id', complaintId);

    const { data: notes } = await supabase
      .from('complaint_notes')
      .select('note, is_internal')
      .eq('complaint_id', complaintId);

    const investigationFindings = findings || null;
    const investigationDecision = decisionData || null;
    const staffResponses = (parties || [])
      .filter((p: any) => p.response_text)
      .map((p: any) => `${p.staff_name} (${p.staff_role}): ${p.response_text}`)
      .join('\n\n');
    const internalNotes = (notes || [])
      .filter((n: any) => n.is_internal)
      .map((n: any) => n.note)
      .join('\n\n');

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

    const investigationContext = `
${investigationFindings ? `
INVESTIGATION FINDINGS:
${investigationFindings.investigation_summary || ''}
${investigationFindings.findings_text || ''}
${investigationFindings.evidence_notes ? `Evidence: ${investigationFindings.evidence_notes}` : ''}
` : ''}

${investigationDecision ? `
INVESTIGATION DECISION:
Reasoning: ${investigationDecision.decision_reasoning || ''}
${investigationDecision.corrective_actions ? `Corrective Actions: ${investigationDecision.corrective_actions}` : ''}
${investigationDecision.lessons_learned ? `Lessons Learned: ${investigationDecision.lessons_learned}` : ''}
` : ''}

${staffResponses ? `
STAFF RESPONSES:
${staffResponses}
` : ''}

${internalNotes ? `
INTERNAL INVESTIGATION NOTES:
${internalNotes}
` : ''}
`;

    const userPrompt = `Generate an outcome letter for this complaint using ONLY the information provided below:

========== COMPLAINT INFORMATION ==========
Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Patient Address: ${complaint.patient_address || 'Not provided'}
Incident Date: ${complaint.incident_date}
Category: ${complaint.category}
${complaint.subcategory ? `Subcategory: ${complaint.subcategory}` : ''}
${complaint.location_service ? `Location/Service: ${complaint.location_service}` : ''}
${complaint.staff_mentioned?.length ? `Staff Mentioned: ${complaint.staff_mentioned.join(', ')}` : ''}

ORIGINAL COMPLAINT DESCRIPTION (USE EXACT WORDING):
${complaint.complaint_description}

========== OUTCOME DECISION ==========
Outcome: ${outcomeType}
Outcome Summary: ${outcomeSummary}
Date: ${currentDate}

========== INVESTIGATION INFORMATION ==========
${investigationContext}

${questionnaireContext}

========== PRACTICE & SIGNATURE DETAILS ==========

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

========== LETTER GENERATION INSTRUCTIONS ==========
Generate a professional outcome letter that:
1. Uses ONLY the facts provided in the sections above
2. References the original complaint description verbatim where appropriate
3. Clearly states the outcome decision
4. Explains the reasoning based ONLY on investigation findings and questionnaire data provided
5. Includes escalation information if applicable

Include the date at the top of the letter as "${currentDate}". 

⚠️ FINAL REMINDER - ABSOLUTE TRUTH ONLY:
- Every statement in the letter must be traceable to information provided above
- If you don't have specific information, use general language
- DO NOT assume, imagine, or infer details not explicitly stated
- When in doubt, be more vague rather than more specific
- Quote or paraphrase from the complaint description rather than inventing new details

IMPORTANT: If patient address is provided, include it in the letter header after "Private & Confidential". Use the practice and signature details provided to create appropriate formatting and signature blocks.

CRITICAL: Never include personal email addresses or direct contact details in the signature. ${practiceDetails?.email ? `Use the practice email: ${practiceDetails.email}` : 'Use a generic practice email'} ${practiceDetails?.phone ? `and practice phone number: ${practiceDetails.phone}` : ''} for contact information.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    let outcomeLetter = data.choices[0].message.content
      .replace(/```[\s\S]*?$/g, '') // Remove markdown code blocks at the end
      .replace(/```/g, '') // Remove any stray backticks
      .trim();
    
    // Add logo URL as HTML comment if available
    if (practiceDetails?.logo_url || practiceDetails?.practice_logo_url) {
      const logoUrl = practiceDetails.practice_logo_url || practiceDetails.logo_url;
      outcomeLetter = `<!-- logo_url: ${logoUrl} -->\n${outcomeLetter}`;
    }
    
    // Add practice address at the end if available
    if (practiceDetails?.address) {
      outcomeLetter += `\n\n${practiceDetails.address}`;
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