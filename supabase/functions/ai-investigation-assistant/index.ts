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
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
      });
      if (!__vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ---- /AUTH GUARD ----

    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const { complaint_id, request_type, include_value_judgements = true } = await req.json();

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
        if (include_value_judgements) {
          systemPrompt = `You are a warm, supportive NHS improvement advisor acting as a "Critical Friend" for GP practices handling complaints. Your role is to help practices feel confident and well-prepared, while gently highlighting areas that might benefit from additional consideration.

IMPORTANT GUIDELINES:
- Be genuinely warm, encouraging, and supportive throughout — your tone should feel like a trusted colleague offering helpful advice over a cup of tea
- ALWAYS start with generous recognition of what the practice has done well — be specific and celebratory
- NEVER criticise individual staff members, even implicitly
- NEVER use words like "failed", "inadequate", "poor", "lacking", or "deficient"
- Frame ALL observations as gentle opportunities, not problems: use "You might wish to consider...", "An area worth reflecting on could be...", "Some practices find it helpful to..."
- NEVER use directive language like "must", "should", "need to"
- Acknowledge the significant pressures practices work under — staff shortages, time constraints, emotional demands
- Remember the practice retains full authority over all decisions
- This is advisory guidance only, not a formal review or determination`;

          userPrompt = `Please review the following complaint investigation as a supportive "Critical Friend" and provide warm, constructive feedback:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

Please provide your review in the following format:

**Strengths Identified**
This is the most important section. Be generous and specific about what has been done well in the investigation process. Highlight thoroughness, professionalism, compassion, good documentation, or any other positive aspects. Celebrate the effort the team has put in.

**Areas for Reflection**
Gently identify any areas that might benefit from additional thought or documentation. Frame these as questions an external reviewer might raise, using supportive language like "You might wish to consider whether..." or "It could be helpful to reflect on...". Keep these constructive and empowering.

**Optional Suggestions for Enhancement**
Provide 2-3 gentle, forward-looking suggestions that could further strengthen the investigation. Frame these as optional opportunities using phrases like "Some practices find it valuable to...", "One approach worth exploring might be...", or "The practice may wish to consider...". These should feel like helpful tips from a supportive colleague.

**Summary**
A brief, warm summary that acknowledges the practice's hard work and dedication. Recognise the emotional demands of complaint handling on staff and encourage the team to continue their good practice. End on a positive, supportive note.

REMINDER: This is AI-generated advisory feedback designed to help the practice feel prepared and supported. The practice retains full responsibility for all complaint decisions and outcomes.`;
        } else {
          systemPrompt = `You are an NHS complaint investigation document reviewer. Your role is to provide a factual summary of the investigation documentation — what evidence has been gathered, what has been documented, and what factual gaps exist.

CRITICAL RULES:
- Do NOT express opinions or value judgements
- Do NOT assess tone, attitude, or communication quality
- Do NOT use words like "excellent", "good", "concerning", "impressive", "thorough", "strong", "weak", "poor"
- Do NOT comment on the emotional or interpersonal aspects of phone calls or consultations
- Do NOT assess whether communication was warm, professional, empathetic, or compassionate
- ONLY describe what is factually documented and what is not
- Use neutral, descriptive language throughout
- When referencing phone call transcripts or consultations, describe ONLY what was discussed and what information was exchanged — not how it was said`;

          userPrompt = `Review the following complaint investigation documentation and provide a factual-only summary of what has been documented and what gaps exist. Do NOT include any opinions, assessments of quality, or value judgements:

${complaintContext}
${staffResponsesContext}
${evidenceContext}

Provide your review using this structure:

**Evidence Summary**
List what documentation and evidence has been collected for this investigation. State what each document or response contains factually.

**Process Observations**
Factual description of the investigation steps that have been taken. What was done, by whom, and when — without assessing quality.

**Documentation Gaps**
Identify any factual gaps where evidence or documentation appears to be absent. State what is missing without commenting on whether this is good or bad.

**Regulatory Checklist**
State whether key NHS complaint-handling process steps are documented as having occurred (acknowledgement, consent, timeframes, staff involvement, etc.). Simply note present or absent — do not assess adequacy.

REMINDER: This is a factual document review only. No opinions, no value judgements, no assessments of tone or quality. The practice retains full responsibility for all complaint decisions.`;
        }
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