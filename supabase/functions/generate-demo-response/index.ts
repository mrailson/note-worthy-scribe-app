import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'demo';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // ===== EVIDENCE MODE =====
    if (action === 'evidence') {
      const { complaintId } = body;
      if (!complaintId) {
        throw new Error('complaintId is required for evidence mode');
      }

      console.log('Generating evidence-based questionnaire fields for complaint:', complaintId);

      // Initialise Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch complaint details
      const { data: complaint, error: complaintError } = await supabase
        .from('complaints')
        .select('complaint_description, category, patient_name, reference_number')
        .eq('id', complaintId)
        .single();

      if (complaintError || !complaint) {
        throw new Error(`Failed to fetch complaint: ${complaintError?.message || 'Not found'}`);
      }

      // Fetch all evidence in parallel
      const [findingsRes, decisionsRes, evidenceRes, transcriptsRes, partiesRes, notesRes] = await Promise.all([
        supabase
          .from('complaint_investigation_findings')
          .select('investigation_summary, findings_text, evidence_notes, critical_friend_review')
          .eq('complaint_id', complaintId),
        supabase
          .from('complaint_investigation_decisions')
          .select('decision_type, decision_reasoning, corrective_actions, lessons_learned')
          .eq('complaint_id', complaintId),
        supabase
          .from('complaint_investigation_evidence')
          .select('file_name, evidence_type, description, ai_summary')
          .eq('complaint_id', complaintId)
          .limit(20),
        supabase
          .from('complaint_investigation_transcripts')
          .select('transcript_text, audio_duration_seconds')
          .eq('complaint_id', complaintId)
          .limit(10),
        supabase
          .from('complaint_involved_parties')
          .select('staff_name, staff_role, response_text')
          .eq('complaint_id', complaintId),
        supabase
          .from('complaint_notes')
          .select('note, is_internal, created_at')
          .eq('complaint_id', complaintId)
          .order('created_at', { ascending: true }),
      ]);

      // Build evidence context with truncation
      let evidenceContext = '';

      // Complaint details
      evidenceContext += `ORIGINAL COMPLAINT:\nCategory: ${complaint.category}\nPatient: ${complaint.patient_name || 'Not specified'}\nDescription: ${complaint.complaint_description}\n\n`;

      // Investigation findings
      if (findingsRes.data && findingsRes.data.length > 0) {
        evidenceContext += 'INVESTIGATION FINDINGS:\n';
        for (const f of findingsRes.data) {
          if (f.investigation_summary) evidenceContext += `Summary: ${f.investigation_summary}\n`;
          if (f.findings_text) evidenceContext += `Findings: ${f.findings_text}\n`;
          if (f.evidence_notes) evidenceContext += `Evidence Notes: ${f.evidence_notes}\n`;
          if (f.critical_friend_review) evidenceContext += `Critical Friend Review: ${f.critical_friend_review}\n`;
        }
        evidenceContext += '\n';
      }

      // Investigation decisions
      if (decisionsRes.data && decisionsRes.data.length > 0) {
        evidenceContext += 'INVESTIGATION DECISIONS:\n';
        for (const d of decisionsRes.data) {
          evidenceContext += `Decision Type: ${d.decision_type}\n`;
          if (d.decision_reasoning) evidenceContext += `Reasoning: ${d.decision_reasoning}\n`;
          if (d.corrective_actions) evidenceContext += `Corrective Actions: ${d.corrective_actions}\n`;
          if (d.lessons_learned) evidenceContext += `Lessons Learned: ${d.lessons_learned}\n`;
        }
        evidenceContext += '\n';
      }

      // Evidence files (with truncation)
      const evidenceFiles = (evidenceRes.data || []).filter(e => e.description || e.ai_summary);
      if (evidenceFiles.length > 0) {
        evidenceContext += 'EVIDENCE FILES AND SUMMARIES:\n';
        for (const e of evidenceFiles) {
          evidenceContext += `- ${e.file_name} (${e.evidence_type})`;
          if (e.description) evidenceContext += `: ${e.description}`;
          evidenceContext += '\n';
          if (e.ai_summary) {
            const truncatedSummary = e.ai_summary.length > 1000 ? e.ai_summary.substring(0, 1000) + '...' : e.ai_summary;
            evidenceContext += `  AI Summary: ${truncatedSummary}\n`;
          }
        }
        evidenceContext += '\n';
      }

      // Transcripts (with truncation)
      const transcripts = (transcriptsRes.data || []).filter(t => t.transcript_text);
      if (transcripts.length > 0) {
        evidenceContext += 'AUDIO TRANSCRIPTS FROM INVESTIGATION:\n';
        for (const t of transcripts) {
          const duration = t.audio_duration_seconds ? `${Math.round(t.audio_duration_seconds / 60)} min` : 'unknown duration';
          const truncatedText = t.transcript_text.length > 2000 ? t.transcript_text.substring(0, 2000) + '...' : t.transcript_text;
          evidenceContext += `- Recording (${duration}): ${truncatedText}\n`;
        }
        evidenceContext += '\n';
      }

      // Staff responses
      if (partiesRes.data && partiesRes.data.length > 0) {
        evidenceContext += 'STAFF RESPONSES:\n';
        for (const p of partiesRes.data) {
          evidenceContext += `- ${p.staff_name}${p.staff_role ? ` (${p.staff_role})` : ''}`;
          if (p.response_text) {
            evidenceContext += `: ${p.response_text}`;
          } else {
            evidenceContext += ': No response submitted';
          }
          evidenceContext += '\n';
        }
        evidenceContext += '\n';
      }

      // Internal notes
      if (notesRes.data && notesRes.data.length > 0) {
        evidenceContext += 'INTERNAL NOTES:\n';
        for (const n of notesRes.data) {
          evidenceContext += `- ${n.note}\n`;
        }
        evidenceContext += '\n';
      }

      console.log('Evidence context built, length:', evidenceContext.length);

      const evidenceSystemPrompt = `You are an NHS complaints investigation analyst generating questionnaire field answers based strictly on provided evidence.

CRITICAL RULES:
- Generate content based STRICTLY on the provided evidence — never fabricate facts not present in the evidence.
- If there is insufficient evidence for a field, state what is available and note the gap.
- Use British English throughout.
- Keep each field concise (50-150 words).
- Write in a professional, factual NHS tone.

FIELD GUIDELINES:
- key_findings: Summarise the main investigation findings and what was established from the evidence.
- actions_taken: Describe corrective actions identified in the evidence, decisions, and staff responses.
- improvements_made: Describe service improvements and lessons learned from the investigation.
- additional_context: Provide relevant background context, staff perspectives, and mitigating factors from the evidence.`;

      const evidenceUserPrompt = `Based on the following investigation evidence, generate accurate answers for all four questionnaire fields.

${evidenceContext}

Generate the four fields based strictly on this evidence.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: evidenceSystemPrompt },
            { role: 'user', content: evidenceUserPrompt }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'generate_questionnaire_fields',
                description: 'Return the four questionnaire fields based on investigation evidence.',
                parameters: {
                  type: 'object',
                  properties: {
                    key_findings: { type: 'string', description: 'Brief summary of key investigation findings (50-150 words)' },
                    actions_taken: { type: 'string', description: 'Actions already taken or planned (50-150 words)' },
                    improvements_made: { type: 'string', description: 'Service improvements made or planned (50-150 words)' },
                    additional_context: { type: 'string', description: 'Additional context, staff perspectives, mitigating factors (50-150 words)' },
                  },
                  required: ['key_findings', 'actions_taken', 'improvements_made', 'additional_context'],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: 'generate_questionnaire_fields' } },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: 'Rate limits exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to your Lovable workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      console.log('AI response received for evidence mode');

      // Extract tool call arguments
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'generate_questionnaire_fields') {
        // Fallback: try parsing content as JSON
        const content = aiData.choices?.[0]?.message?.content;
        if (content) {
          try {
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            return new Response(
              JSON.stringify({ success: true, demoResponse: parsed }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          } catch {
            throw new Error('AI did not return structured output');
          }
        }
        throw new Error('AI did not return tool call or parseable content');
      }

      let parsedArgs;
      try {
        parsedArgs = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch (parseError) {
        console.error('Failed to parse tool call arguments:', parseError);
        throw new Error('Failed to parse AI tool call response');
      }

      // Validate all four fields exist
      const requiredFields = ['key_findings', 'actions_taken', 'improvements_made', 'additional_context'];
      for (const field of requiredFields) {
        if (!parsedArgs[field]) {
          parsedArgs[field] = 'Insufficient evidence available for this field.';
        }
      }

      return new Response(
        JSON.stringify({ success: true, demoResponse: parsedArgs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ===== DEMO MODE (existing logic, unchanged) =====
    const { complaintReference, complaintDescription, category, patientName } = body;
    
    console.log('Generating demo response for:', { complaintReference, category });

    const systemPrompt = `You are a GP practice complaints officer generating a realistic practice response to a patient complaint for demonstration purposes. 

Generate believable, professional responses that a typical NHS GP practice would provide. Each response should:
- Be up to 100 words
- Use appropriate NHS tone (professional, empathetic, factual)
- Reference realistic actions a GP practice would take
- Be specific to the complaint category and details provided

Return ONLY a JSON object with these four fields (no markdown, no code blocks):
{
  "key_findings": "Brief summary of investigation findings",
  "actions_taken": "Immediate actions taken in response",
  "improvements_made": "Process improvements implemented",
  "additional_context": "Relevant context or mitigating circumstances"
}`;

    const userPrompt = `Generate a realistic GP practice response for this complaint:

Complaint Reference: ${complaintReference}
Category: ${category}
Patient: ${patientName || 'Not specified'}
Description: ${complaintDescription}

Provide a believable response that a real GP practice would give, including investigation findings, actions taken, improvements made, and any relevant context.`;

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
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limits exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedContent = aiData.choices[0].message.content;
    
    console.log('AI generated content:', generatedContent);

    // Parse the JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const cleanContent = generatedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsedResponse = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Content:', generatedContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate response structure
    const requiredFields = ['key_findings', 'actions_taken', 'improvements_made', 'additional_context'];
    for (const field of requiredFields) {
      if (!parsedResponse[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        demoResponse: parsedResponse
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating response:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
