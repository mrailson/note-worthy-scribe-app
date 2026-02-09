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

    // Normalise "rejected" to "not_upheld" so the LLM never sees adversarial terminology
    const outcomeForLetter = outcomeType === 'rejected' ? 'not_upheld' : outcomeType;

    // Read the formal labels toggle (default YES per NoteWell spec)
    const useFormalLabels = questionnaireData?.use_formal_outcome_labels === false ? 'NO' : 'YES';

    console.log('generate-complaint-outcome-letter request', {
      complaintId,
      hasOutcomeType: !!outcomeType,
      outcomeForLetter,
      useFormalLabels,
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

    // Get practice details - matches the acknowledgement letter's priority-based lookup
    let practiceDetails = null;
    let signatureDetails = null;

    console.log('Fetching practice details for user:', complaint.created_by);

    // PRIORITY 1: Check practice_details by user_id (user's own practice settings from My Profile)
    const { data: userPracticeDetails, error: userPracticeError } = await supabase
      .from('practice_details')
      .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
      .eq('user_id', complaint.created_by)
      .not('practice_name', 'is', null)
      .neq('practice_name', '')
      .neq('practice_name', 'Default Practice')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('User practice_details query result:', { userPracticeDetails, error: userPracticeError?.message });

    if (userPracticeDetails) {
      practiceDetails = userPracticeDetails;
      console.log('✅ Using user-specific practice_details (highest priority):', practiceDetails.practice_name);
    } else {
      // PRIORITY 2: Fallback via user_roles → gp_practices
      console.log('Fallback: Checking user_roles for practice assignment');
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', complaint.created_by)
        .not('practice_id', 'is', null)
        .limit(1)
        .maybeSingle();

      const practiceId = userRole?.practice_id || complaint.practice_id;

      if (practiceId) {
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('id, name, address, phone, email, website')
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
            website: gpPractice.website,
            show_page_numbers: false
          };
          console.log('✅ Retrieved practice from gp_practices via user_roles:', practiceDetails.practice_name);
        }
      }
    }

    // PRIORITY 3: Final fallback from complaint's practice_id
    if (!practiceDetails && complaint.practice_id) {
      console.log('Final fallback: Getting practice from complaint.practice_id');
      const { data: complaintPractice } = await supabase
        .from('gp_practices')
        .select('id, name, address, phone, email, website')
        .eq('id', complaint.practice_id)
        .maybeSingle();

      if (complaintPractice) {
        practiceDetails = {
          practice_name: complaintPractice.name,
          address: complaintPractice.address,
          phone: complaintPractice.phone,
          email: complaintPractice.email,
          logo_url: null,
          practice_logo_url: null,
          footer_text: null,
          website: complaintPractice.website,
          show_page_numbers: false
        };
        console.log('✅ Retrieved practice from complaint practice_id:', practiceDetails.practice_name);
      }
    }

    if (!practiceDetails) {
      console.log('❌ No practice details found for complaint:', complaintId);
    }

    // Fetch user profile (title, role, full_name, letter_signature) from My Profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('title, full_name, role, letter_signature')
      .eq('user_id', complaint.created_by)
      .maybeSingle();
    
    console.log('User profile data:', { 
      title: userProfile?.title, 
      full_name: userProfile?.full_name, 
      role: userProfile?.role,
      has_letter_signature: !!userProfile?.letter_signature 
    });

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
      // Build from profile + auth data (same as acknowledgement letter)
      console.log('No signature found, building from profile and auth data');
      const { data: authUser } = await supabase.auth.admin.getUserById(complaint.created_by);
      
      if (authUser?.user) {
        const baseName = userProfile?.full_name || authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'Complaints Manager';
        const signatoryName = userProfile?.title ? `${userProfile.title} ${baseName}` : baseName;
        
        // Determine role: prefer profile.role from My Profile, then user_roles
        let signatoryTitle = 'Complaints Manager';
        if (userProfile?.role) {
          signatoryTitle = userProfile.role;
          console.log('Using role from My Profile:', signatoryTitle);
        } else {
          const { data: userRoleData } = await supabase
            .from('user_roles')
            .select('role, practice_role')
            .eq('user_id', complaint.created_by)
            .maybeSingle();
          
          if (userRoleData?.practice_role) {
            signatoryTitle = userRoleData.practice_role;
          } else if (userRoleData?.role === 'practice_manager') {
            signatoryTitle = 'Practice Manager';
          } else if (userRoleData?.role === 'practice_user' || userRoleData?.role === 'gp' || userRoleData?.role === 'clinical') {
            signatoryTitle = 'GP Partner';
          } else {
            signatoryTitle = 'GP Partner';
          }
        }
        
        // Use letter_signature from My Profile if available
        const letterSignatureText = userProfile?.letter_signature || null;
        
        signatureDetails = {
          name: signatoryName,
          job_title: signatoryTitle,
          qualifications: null,
          signature_text: letterSignatureText,
          email: practiceDetails?.email || null
        };
        console.log('Built signature from profile:', { name: signatoryName, title: signatoryTitle, hasLetterSignature: !!letterSignatureText });
      } else {
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

    const systemPrompt = `You are generating a final NHS complaint outcome letter on behalf of a GP practice in England, following a completed local complaint investigation.

The letter must comply with:
- NHS Complaints Regulations (England)
- Parliamentary and Health Service Ombudsman (PHSO) principles
- CQC "Well-Led" and "Responsive" standards
- NoteWell AI governance rules (administrative only, human review required)

The output is a formal written outcome letter to the complainant.

--- SECTION 1: INPUTS ---
You will be provided with:
- A completed complaint investigation report
- Practice details and signatory
- Patient details
- A structured questionnaireData object including use_formal_outcome_labels (boolean) and final_outcome

--- SECTION 2: OUTCOME WORDING RULES (CRITICAL) ---

A. Formal Outcome Labels (DEFAULT = ON)
If "Use formal outcome labels in patient letters" = YES (default):
- You must explicitly state the outcome using one of the following exact phrases:
  "Your complaint has been upheld."
  "Your complaint has been partially upheld."
  "Your complaint has not been upheld."
- This outcome must appear clearly and unambiguously in the letter body, following the investigation summary.
- Never use the word "Rejected" — use "Not upheld" instead.
- Immediately follow the label with a plain-English explanation.

B. Patient-Centred Outcome Wording (TOGGLE = OFF)
If "Use formal outcome labels in patient letters" = NO:
- Do NOT use the words upheld, partially upheld, not upheld, or rejected.
- Instead use plain, empathetic, patient-centred language.
- Clearly explain what was found without formal labels.
- Avoid defensive or dismissive phrasing.
- When labels are OFF, select the narrative outcome paragraph that corresponds exactly to the internal outcome decision provided — do not let tone override the paragraph selection.
- Use the appropriate paragraph:
  * Not upheld: "Following a careful review of the information provided, the consultation record, and the investigation findings, we did not find evidence that the care provided fell below the expected standard based on the information available to us."
  * Partially upheld: "Our review found that while some aspects of care met appropriate standards, there were areas where improvements were needed, particularly in relation to the issues identified during the investigation."
  * Upheld: "Our review identified that aspects of care and/or process did not meet the standard we expect, and we are sorry for this."
- Even when the toggle is OFF, the substance of the outcome must still match the investigation findings.

--- SECTION 3: MANDATORY LETTER CONTENT (INTERNAL GUIDANCE ONLY) ---
The letter must cover this content in order:

1. Header: Date, "PRIVATE & CONFIDENTIAL", Patient name and address, Complaint reference number
2. Opening Acknowledgement: Thank the complainant, clear apology for their experience (where appropriate), professional and empathetic tone
3. Summary of Investigation: Brief explanation of what was investigated, confirm key facts that were established, reflect the investigation report accurately (no new facts)
4. Outcome Statement: Apply the toggle rules above, outcome must be clear, fair, and proportionate
5. Learning & Improvements: Describe specific actions the practice has taken or will take, focus on systems, processes, and learning, avoid vague promises
6. Individual Resolution (If Appropriate): Acknowledge impact on the patient, do not promise preferential or guaranteed clinical access, use safe phrasing such as "We have asked the clinical team to review…" or "Where appropriate, further steps will be considered…"
7. Escalation Rights (MANDATORY): Always include the PHSO escalation paragraph (see Section 4)
8. Professional Closing: Offer a point of contact for clarification, signed by the appropriate practice representative

These are internal content sections for your guidance only. Do NOT include section titles, headings, or labels in the letter. The letter must flow naturally as a single continuous professional document, with smooth paragraph transitions. No bold headings, no numbered sections, no titled blocks.

--- SECTION 4: ESCALATION WORDING (USE THIS EXACTLY) ---
Include the following paragraph verbatim or near-verbatim:
"If you remain dissatisfied with this response, you may refer your complaint to the Parliamentary and Health Service Ombudsman, an independent body. This should normally be done within 12 months of this response. Further information is available at www.ombudsman.org.uk or by calling 0345 015 4033. This letter constitutes our final response under the NHS complaints procedure."

--- SECTION 5: SAFETY AND GOVERNANCE RULES ---
- Do not introduce new clinical facts
- Do not contradict the investigation report
- Do not minimise or dismiss patient experience
- Do not assign individual blame
- Do not use legalistic or adversarial language
- NEVER fabricate medical facts, events, clinical reasoning, actions, or examples
- If information is not explicitly provided, do not invent it
- If required information is missing, state that it was not available in the provided materials
- Every statement must be traceable to supplied complaint, investigation, or questionnaire data
- Assume the letter may be reviewed by PHSO, CQC, ICB, or legal advisors
- The tone must always be: Respectful, Transparent, Accountable, Proportionate

TONE CONTROL:
${toneInstruction || 'Tone: Professional'}
- Always remain respectful, calm, and patient-centred
- Never sound dismissive, defensive, or adversarial

--- SECTION 6: OUTPUT REQUIREMENTS ---
- British English (spellings and grammar)
- UK date format: DD Month YYYY
- Formal letter format with clear paragraphs
- No bullet points in the final letter
- No internal system references
- No AI disclaimers
- No decorative formatting or emojis
- No section headings, titles, or labels — the letter must read as a flowing, natural professional letter
- Start directly with the date, do NOT include any practice headers or letterhead references
- Do not include "*Letterhead/Logo Here*" or similar placeholder text

FORMATTING:
- Start directly with the date in format "DD Month YYYY"
- Follow with "Private & Confidential" and then the patient details
- Do not duplicate addresses
- End with "Yours sincerely" signature block
- Do not include "*Signature*" or signature placeholders
- Include practice contact details naturally within the letter content or signature area only
- Never include personal email addresses or phone numbers
- Only use practice-wide email and phone numbers

FINAL QUALITY CHECK:
- No invented facts or assumptions
- Outcome is clear and consistent with the internal decision
- Tone matches questionnaire setting
- Letter reads as calm, respectful, and proportionate
- Language is suitable for CQC inspection and Ombudsman review`;

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

    const userPrompt = `Generate an outcome letter for this complaint using ONLY the information provided below. Ensure the letter covers all required content areas (opening acknowledgement, investigation summary, outcome, learning and improvements, individual resolution if appropriate, escalation rights, closing) but present them as a single flowing letter without any section headings or titles. Do not use bullet points anywhere in the letter.

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
Outcome: ${outcomeForLetter}
Patient Letter Style:
Use formal outcome labels in patient letters: ${useFormalLabels}
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
3. Clearly states the outcome decision following the toggle rules
4. Explains the reasoning based ONLY on investigation findings and questionnaire data provided
5. Includes the mandatory PHSO escalation paragraph
6. Does not use bullet points anywhere in the letter
7. Does not include any AI disclaimers or internal system references

Include the date at the top of the letter as "${currentDate}".

⚠️ FINAL REMINDER - ABSOLUTE TRUTH ONLY:
- Every statement in the letter must be traceable to information provided above
- If you don't have specific information, use general language
- DO NOT assume, imagine, or infer details not explicitly stated
- When in doubt, be more vague rather than more specific
- Quote or paraphrase from the complaint description rather than inventing new details

IMPORTANT: If patient address is provided, include it in the letter header after "Private & Confidential". Use the practice and signature details provided to create appropriate formatting and signature blocks.

CRITICAL SIGNATURE FORMATTING:
- The letter must contain EXACTLY ONE "Yours sincerely" signature block. Do not repeat the signatory name, practice details, or address after the signature.
- The signature block should include: "Yours sincerely," then the signatory name, then their title, then the practice name
- DO NOT include the practice address in the signature block - it should only appear ONCE in the letter header
- Never duplicate the address - if you include it at the top of the letter, do NOT repeat it in the signature
- Never include personal email addresses or direct contact details in the signature
- Do not include "*Letterhead/Logo Here*" or similar placeholder text anywhere in the letter
- ${practiceDetails?.email ? `Use the practice email: ${practiceDetails.email}` : 'Use a generic practice email'} ${practiceDetails?.phone ? `and practice phone number: ${practiceDetails.phone}` : ''} for contact information.`;

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
    
    // NOTE: Do NOT append practice address here — it causes duplicate address blocks.
    // The prompt already instructs the AI to include the address once in the letter header.
    
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