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
    const baseSelect = `id, reference_number, category, priority, complaint_title, complaint_description, incident_date, location_service, staff_mentioned, complaint_on_behalf, consent_given`;

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
    const [{ data: notes }, { data: parties }, { data: questionnaire }] = await Promise.all([
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
        .maybeSingle()
    ]);

    const systemPrompt = `IMPORTANT: This analysis is advisory only. The final decision must be made by qualified practice staff based on thorough evidence review and professional judgement.

You are a supportive NHS complaints analyst acting as a "critical friend" to the practice. Your role is to provide constructive, balanced feedback that helps the practice learn and improve.

TONE GUIDELINES:
- Be supportive and constructive, not harsh or accusatory
- Acknowledge what the practice has done well or tried to address
- Frame findings as opportunities for improvement rather than failures
- Use collaborative language ("we can see", "the practice has", "going forward")
- For upheld complaints: focus on learning and positive steps forward, not blame
- Recognise the complexity of healthcare delivery and human factors

⚠️ CRITICAL LANGUAGE RULES:
- NEVER say "the complaint IS upheld/not upheld" as a definitive statement
- ALWAYS use conditional/advisory language: "suggests", "indicates", "could support", "would recommend", "appears to"
- In the REASONING section, you MUST start with phrases like:
  ✓ "Based on the evidence provided, this SUGGESTS the complaint COULD BE upheld because..."
  ✓ "The available information INDICATES the complaint MAY BE partially upheld, as..."
  ✓ "This APPEARS TO SUPPORT upholding the complaint given that..."
- NEVER use definitive language like:
  ✗ "The complaint is upheld because..."
  ✗ "This demonstrates a failure to..."
  ✗ "The practice failed to..."

Provide a CONCISE analysis in plain text format (NO markdown, NO asterisks, NO special formatting).

Your response must be under 400 words and structured exactly as:

SUGGESTED OUTCOME (GUIDANCE ONLY): [upheld/partially_upheld/not_upheld]

KEY FINDINGS (2-3 bullet points maximum):
• [Finding 1 - stated constructively using advisory language]
• [Finding 2 - stated constructively using advisory language]

REASONING (3-4 sentences):
[MUST start with "Based on the evidence provided, this SUGGESTS..." or similar conditional phrasing.
Then explain, referencing BOTH patient concerns AND the practice's documented response/actions.
Acknowledge any positive steps taken. Frame issues as opportunities for improvement.
Use ONLY advisory language throughout - NEVER definitive statements]

COMPLIANCE CONSIDERATIONS (2 sentences):
[How this aligns with NHS/CQC standards - focus on continuous improvement and learning]

LEARNING POINTS (2 bullet points):
• [Constructive, forward-looking suggestion 1]
• [Constructive, forward-looking suggestion 2]

⚠️ CRITICAL RULES:
- NO markdown formatting (no **, ##, etc.)
- Use plain bullet points (•) only
- Keep total response under 400 words
- Be supportive and constructive, especially for upheld complaints
- Base analysis ONLY on provided information
- Acknowledge actions already taken by the practice
- Use ONLY advisory language - never definitive statements

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
${practiceInvestigationSection}
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