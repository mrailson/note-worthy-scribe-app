import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const { complaint_id, request_type } = await req.json();

    if (!complaint_id || !request_type) {
      throw new Error('Missing complaint_id or request_type');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaint_id)
      .single();

    if (complaintError) throw complaintError;

    // Get staff responses if available
    const { data: staffResponses } = await supabase
      .from('complaint_involved_parties')
      .select('*')
      .eq('complaint_id', complaint_id);

    // Get investigation evidence if available
    const { data: evidence } = await supabase
      .from('complaint_investigation_evidence')
      .select('*')
      .eq('complaint_id', complaint_id);

    let systemPrompt = '';
    let userPrompt = '';

    const complaintContext = `
Complaint Reference: ${complaint.reference_number}
Category: ${complaint.category}
Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Patient: ${complaint.patient_name}
Incident Date: ${complaint.incident_date}
Location: ${complaint.location_service}
Staff Mentioned: ${complaint.staff_mentioned?.join(', ') || 'None'}
`;

    const staffResponsesContext = staffResponses && staffResponses.length > 0 ? `
Staff Responses:
${staffResponses.map(response => `
- ${response.staff_name} (${response.staff_role}): ${response.response_text || 'No response yet'}
`).join('')}
` : '';

    const evidenceContext = evidence && evidence.length > 0 ? `
Investigation Evidence:
${evidence.map(item => `
- ${item.evidence_type}: ${item.description}
`).join('')}
` : '';

    switch (request_type) {
      case 'investigation_summary':
        systemPrompt = `You are an NHS complaint investigation specialist. Generate a professional investigation summary that explains how the investigation was conducted, what sources were reviewed, and the methodology used.`;
        userPrompt = `Based on the following complaint details, staff responses, and evidence, write a concise investigation summary that explains how the investigation was conducted:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

The summary should:
- Explain the investigation methodology
- Reference sources reviewed (staff responses, evidence, policies)
- Be professional and factual
- Be 2-3 paragraphs maximum`;
        break;

      case 'detailed_findings':
        systemPrompt = `You are an NHS complaint investigation specialist. Generate detailed findings that analyze the evidence, identify what happened, and determine whether processes were followed correctly.`;
        userPrompt = `Based on the following complaint details, staff responses, and evidence, write detailed investigation findings:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

The findings should:
- Analyze what actually happened
- Compare actions against NHS standards and policies
- Identify any process failures or successes
- Reference specific evidence and staff responses
- Be objective and evidence-based
- Be detailed but clear`;
        break;

      case 'decision_recommendation':
        systemPrompt = `You are an NHS complaint investigation specialist. Based on the evidence and findings, recommend whether the complaint should be upheld, rejected, or partially upheld, along with clear reasoning.`;
        userPrompt = `Based on the following complaint details, staff responses, and evidence, recommend a decision:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

Provide:
1. Recommended decision (uphold/reject/partially_uphold)
2. Clear reasoning for the decision
3. Reference to specific evidence supporting the decision
4. Consider NHS standards, patient rights, and duty of candour

Format as JSON:
{
  "decision": "uphold|reject|partially_uphold",
  "reasoning": "detailed reasoning..."
}`;
        break;

      case 'decision_reasoning':
        systemPrompt = `You are an NHS complaint investigation specialist writing decision reasoning that would satisfy a CQC audit. The reasoning must be thorough, evidence-based, and demonstrate compliance with NHS standards.

IMPORTANT: Return ONLY plain text, do NOT format as JSON or use any structured format.`;
        userPrompt = `Based on the following complaint details and recommended decision, write comprehensive decision reasoning suitable for CQC audit:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

The reasoning should:
- Reference specific NHS standards and regulations
- Explain how the decision aligns with duty of candour
- Reference specific evidence and staff responses
- Demonstrate thorough consideration of patient rights
- Be audit-ready and defensible
- Show professional judgment and fairness

CRITICAL: Provide the response as a single, well-formatted paragraph or multiple paragraphs of plain text only. Do NOT use JSON, bullet points, or any structured format.`;
        break;

      case 'lessons_learned':
        systemPrompt = `You are an NHS quality improvement specialist. Identify key lessons learned and improvement opportunities from this complaint investigation.`;
        userPrompt = `Based on the following complaint investigation, identify lessons learned and improvement opportunities:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

Provide:
- Key lessons learned from this incident
- Specific improvement opportunities
- Process changes to prevent recurrence
- Training needs identified
- System improvements needed
- Focus on prevention and quality improvement`;
        break;

      case 'critical_friend_review':
        systemPrompt = `You are a supportive NHS improvement advisor acting as a "Critical Friend" for GP practices handling complaints. Your role is to help practices prepare for potential external scrutiny (such as CQC inspections or independent reviews) by highlighting areas that might benefit from additional consideration.

IMPORTANT GUIDELINES:
- Be supportive and constructive, never accusatory or harsh
- Frame observations as opportunities for improvement, not failures
- Use phrases like "You might consider...", "An external reviewer may ask about...", "A strength of this investigation is..."
- Acknowledge what has been done well before suggesting improvements
- Remember the practice retains full authority over all decisions
- This is advisory guidance only, not a formal review or determination`;

        userPrompt = `Please review the following complaint investigation as a supportive "Critical Friend" and provide constructive feedback:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

Please provide your review in the following format:

**Strengths Identified**
Highlight what has been done well in the investigation process.

**Areas for Consideration**
Identify any gaps or areas that might benefit from additional clarification or documentation. Frame these as questions an external reviewer (such as CQC or an independent investigator) might ask.

**Suggestions for Enhancement**
Provide helpful suggestions that could strengthen the investigation, while being mindful that the practice may have good reasons for their current approach.

**Summary**
A brief, supportive summary acknowledging the practice's efforts and encouraging continued good practice.

REMINDER: This is AI-generated advisory feedback designed to help the practice understand the types of questions an independent review might raise. The practice retains full responsibility for all complaint decisions and outcomes.`;
        break;

      default:
        throw new Error('Invalid request type');
    }

    console.log('Making OpenAI request for:', request_type);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('Generated content for', request_type, ':', generatedContent.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      success: true, 
      content: generatedContent,
      type: request_type 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-investigation-assistant function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});