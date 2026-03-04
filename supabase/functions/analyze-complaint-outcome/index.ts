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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Initialize Supabase client (prefer service key, but honour caller auth for RLS if provided)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    );

    // Fetch complaint base details first (avoid failing embeds)
    const baseSelect = `id, reference_number, category, priority, complaint_title, complaint_description, incident_date, location_service, staff_mentioned, complaint_on_behalf, consent_given, created_at, submitted_at, acknowledged_at, closed_at`;

    let { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(baseSelect)
      .eq('id', complaintId)
      .single();

    // Fallback: if UUID not found, try by reference number (for demos)
    if ((complaintError || !complaint) && typeof complaintId === 'string' && complaintId.startsWith('COMP')) {
      const res2 = await supabase
        .from('complaints')
        .select(baseSelect)
        .eq('reference_number', complaintId)
        .single();
      complaint = res2.data as any;
      complaintError = res2.error as any;
    }

    if (complaintError || !complaint) {
      console.error('Complaint fetch failed:', complaintError, 'for id:', complaintId);
      throw new Error('Complaint not found');
    }

    // Related data fetched separately to avoid join permission issues
    const [
      { data: notes }, 
      { data: parties }, 
      { data: questionnaire },
      { data: outcome }
    ] = await Promise.all([
      supabase.from('complaint_notes')
        .select('note, is_internal, created_at')
        .eq('complaint_id', complaint.id)
        .order('created_at', { ascending: true }),
      supabase.from('complaint_involved_parties')
        .select('staff_name, staff_role, response_text, response_submitted_at')
        .eq('complaint_id', complaint.id)
        .order('response_submitted_at', { ascending: true }),
      supabase.from('complaint_outcome_questionnaires')
        .select('questionnaire_data')
        .eq('complaint_id', complaint.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('complaint_outcomes')
        .select('created_at, decided_at, sent_at')
        .eq('complaint_id', complaint.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const systemPrompt = `IMPORTANT: This analysis is advisory only. The final decision must be made by qualified practice staff based on thorough evidence review and professional judgement.

You are a factual NHS complaints documentation reviewer. Your role is to summarise the evidence provided and suggest an outcome classification based ONLY on documented facts.

⚠️ ABSOLUTE RULES — VALUE JUDGEMENTS PROHIBITED:
- Do NOT assess, critique, or comment on the GP's clinical judgement, communication style, or professionalism
- Do NOT use evaluative words like "excellent", "good", "concerning", "impressive", "thorough", "strong", "weak", "poor", "inadequate", "lacking", "deficient", "dismissive", "unprofessional"
- Do NOT comment on tone, empathy, warmth, or manner of any staff member
- Do NOT infer issues that are not explicitly documented in the evidence
- Do NOT speculate about what "should have" or "could have" happened
- ONLY describe what IS documented and what IS NOT documented
- If audio transcripts are provided, describe ONLY what was discussed and what information was exchanged — NOT how it was said or the manner in which it was delivered
- NEVER criticise individual staff members, even implicitly
- Use neutral, descriptive language throughout

⚠️ CRITICAL LANGUAGE RULES:
- NEVER say "the complaint IS upheld/not upheld" as a definitive statement
- ALWAYS use conditional/advisory language: "suggests", "indicates", "could support", "would recommend", "appears to"
- Use ONLY advisory language throughout - NEVER definitive statements
- NEVER claim dates or information are "missing" or "not recorded" if they ARE provided in the prompt
- NEVER say there is a "lack of recorded dates" when dates ARE clearly shown in TIMELINE COMPLIANCE section

⚠️ CRITICAL TIMELINE ANALYSIS RULES:
- The TIMELINE COMPLIANCE section shows ALL recorded dates - use these dates in your analysis
- If dates ARE shown in TIMELINE COMPLIANCE, acknowledge them and assess compliance
- Do NOT claim dates are missing when they are clearly provided
- Focus on whether deadlines were MET, not whether dates exist

Provide a BRIEF, FOCUSED analysis in plain text format (NO markdown, NO asterisks, NO special formatting).

Your response must be under 200 words and structured exactly as:

SUGGESTED OUTCOME (GUIDANCE ONLY): [upheld/partially_upheld/not_upheld]

EVIDENCE SUMMARY:
[2-3 sentences summarising what evidence has been documented. State factually what the investigation found. Use advisory language: "the evidence indicates", "documentation shows", "the investigation records"]

DOCUMENTATION GAPS:
• [Factual gap 1 — state what is absent, not whether it is good or bad — maximum 15 words]
• [Factual gap 2 — maximum 15 words]
• [Optional: Factual gap 3 — maximum 15 words]

COMPLIANCE NOTE:
[Single sentence on timeline compliance based on dates provided]

⚠️ CRITICAL RULES:
- NO markdown formatting (no **, ##, etc.)
- Use plain bullet points (•) only
- Keep total response under 200 words
- Base analysis ONLY on provided information
- Use ONLY advisory language - never definitive statements
- NEVER claim information is missing when it IS provided in the prompt
- NEVER assess GP performance, tone, or clinical judgement

DISCLAIMER: This analysis is provided as guidance to support decision-making. It should not be relied upon as the sole basis for determining complaint outcomes. Human oversight and professional judgement are essential.`;

    const staffResponses = (parties || [])
      .filter(p => p.response_text)
      .map(p => `${p.staff_name} (${p.staff_role}): ${p.response_text}`)
      .join('\n\n') || 'No staff responses received yet';

    const internalNotes = (notes || [])
      .filter(n => n.is_internal)
      .map(n => n.note)
      .join('\n\n') || 'No internal notes';

    // Extract questionnaire data from the practice's investigation
    const questionnaireData = questionnaire?.questionnaire_data || {};
    const practiceFindings = questionnaireData.key_findings || '';
    const actionsTaken = questionnaireData.actions_taken || '';
    const improvementsMade = questionnaireData.improvements_made || '';
    const additionalContext = questionnaireData.additional_context || '';
    
    const practiceInvestigationSection = (practiceFindings || actionsTaken || improvementsMade || additionalContext) 
      ? `
PRACTICE INVESTIGATION FINDINGS (Sections 2 & 3):

Key Findings:
${practiceFindings || 'Not documented'}

Actions Taken:
${actionsTaken || 'Not documented'}

Improvements Made:
${improvementsMade || 'Not documented'}

Additional Context:
${additionalContext || 'Not documented'}
` 
      : '';

    // Calculate working days for timeline compliance
    const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
      let count = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++; // Exclude weekends
        current.setDate(current.getDate() + 1);
      }
      return count;
    };

    const submittedDate = complaint.submitted_at || complaint.created_at;
    const ackWorkingDays = complaint.acknowledged_at 
      ? calculateWorkingDays(new Date(submittedDate), new Date(complaint.acknowledged_at))
      : null;
    const closedWorkingDays = complaint.closed_at 
      ? calculateWorkingDays(new Date(submittedDate), new Date(complaint.closed_at))
      : null;

    // Determine response date from outcomes (sent_at preferred, then decided_at, then created_at)
    const responseDateStr = (outcome?.sent_at || outcome?.decided_at || outcome?.created_at) as string | null;
    const responseWorkingDays = responseDateStr 
      ? calculateWorkingDays(new Date(submittedDate), new Date(responseDateStr))
      : null;

    const timelineSection = `
TIMELINE COMPLIANCE:
- Complaint Received: ${new Date(submittedDate).toLocaleDateString('en-GB')}
- Acknowledgement: ${complaint.acknowledged_at ? new Date(complaint.acknowledged_at).toLocaleDateString('en-GB') : 'Not yet acknowledged'} ${ackWorkingDays !== null ? `(${ackWorkingDays} working days - target: 3)` : ''}
- Response Issued: ${responseDateStr ? new Date(responseDateStr).toLocaleDateString('en-GB') : 'Not yet responded'} ${responseWorkingDays !== null ? `(${responseWorkingDays} working days - target: 20)` : ''}
- Closed: ${complaint.closed_at ? new Date(complaint.closed_at).toLocaleDateString('en-GB') : 'Not yet closed'} ${closedWorkingDays !== null ? `(${closedWorkingDays} working days - target: 20)` : ''}
- Acknowledgement Deadline Met: ${ackWorkingDays !== null ? (ackWorkingDays <= 3 ? 'Yes ✓' : 'No - Missed') : 'Pending'}
- Response Deadline Met: ${responseWorkingDays !== null ? (responseWorkingDays <= 20 ? 'Yes ✓' : 'No - Missed') : 'Pending'}
- Investigation Deadline Met: ${closedWorkingDays !== null ? (closedWorkingDays <= 20 ? 'Yes ✓' : 'No - Missed') : 'Pending'}
`;

    const userPrompt = `Analyze this NHS complaint and recommend an outcome:

COMPLAINT DETAILS:
Reference: ${complaint.reference_number}
Category: ${complaint.category}
Priority: ${complaint.priority}
Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}
Staff Mentioned: ${complaint.staff_mentioned?.join(', ') || 'None specifically mentioned'}
${timelineSection}${practiceInvestigationSection}
STAFF RESPONSES:
${staffResponses}

INTERNAL INVESTIGATION NOTES:
${internalNotes}

PATIENT INFORMATION:
- Complaint made on behalf of patient: ${complaint.complaint_on_behalf ? 'Yes' : 'No'}
- Consent given: ${complaint.consent_given ? 'Yes' : 'No'}

⚠️ CRITICAL REQUIREMENTS FOR YOUR ANALYSIS:
1. You MUST explicitly reference the practice's documented investigation findings (sections 2 & 3) in your analysis
2. Acknowledge specific actions the practice has already taken to address the complaint
3. If the practice has documented improvements made, mention them in your reasoning
4. Balance the patient's concerns against the practice's documented response and actions
5. Use ONLY advisory, suggestive language - NEVER definitive statements about the outcome
6. Start your REASONING section with "Based on the evidence provided, this SUGGESTS..." or similar conditional phrasing
7. Recognise and mention any positive steps or good practice demonstrated

Please provide a comprehensive, balanced analysis with recommended outcome and clear reasoning that would satisfy CQC inspection and NHS England standards.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const analysisResult = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      analysis: analysisResult,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-complaint-outcome function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to analyze complaint outcome' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});