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

You are an expert NHS complaints analyst. Provide a CONCISE analysis in plain text format (NO markdown, NO asterisks, NO special formatting).

Your response must be under 400 words and structured exactly as:

SUGGESTED OUTCOME (GUIDANCE ONLY): [upheld/partially_upheld/not_upheld]

KEY FINDINGS (2-3 bullet points maximum):
• [Finding 1]
• [Finding 2]

REASONING (3-4 sentences):
[Brief justification based on evidence]

COMPLIANCE CONSIDERATIONS (2 sentences):
[How this aligns with NHS/CQC standards]

LEARNING POINTS (2 bullet points):
• [Point 1]
• [Point 2]

⚠️ CRITICAL RULES:
- NO markdown formatting (no **, ##, etc.)
- Use plain bullet points (•) only
- Keep total response under 400 words
- Base analysis ONLY on provided information
- Be direct and professional

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

IMPORTANT: Base your analysis on BOTH the original complaint AND the practice's documented investigation findings (sections 2 & 3). Consider what actions the practice has already taken and improvements made when determining the outcome.

Please provide a comprehensive analysis with recommended outcome and clear reasoning that would satisfy CQC inspection and NHS England standards.`;

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