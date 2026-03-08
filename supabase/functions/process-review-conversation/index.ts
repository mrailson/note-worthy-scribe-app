import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { 
      complaintId, 
      transcript, 
      challenges, 
      responses, 
      recommendations,
      duration,
      startedAt,
      endedAt
    } = await req.json();

    console.log('Processing review conversation for complaint:', complaintId);

    // Get user ID from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorised');
    }

    // Fetch comprehensive complaint details
    console.log('Fetching complaint details...');
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaintId)
      .maybeSingle();

    if (complaintError || !complaint) {
      console.error('Error fetching complaint:', complaintError);
      throw new Error('Failed to fetch complaint details');
    }

    console.log('Complaint details fetched successfully');

    // Fetch related data separately to avoid relationship issues
    const [
      { data: questionnaires },
      { data: evidence },
      { data: staffResponses },
      { data: outcomes }
    ] = await Promise.all([
      supabase.from('complaint_outcome_questionnaires')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false }),
      supabase.from('complaint_evidence')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false }),
      supabase.from('complaint_responses')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('response_date', { ascending: false }),
      supabase.from('complaint_outcomes')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
    ]);

    // Build comprehensive context
    const timelineInfo = `
- Date Received: ${complaint.date_received ? new Date(complaint.date_received).toLocaleDateString('en-GB') : 'Not recorded'}
- Acknowledgement Date: ${complaint.acknowledgement_date ? new Date(complaint.acknowledgement_date).toLocaleDateString('en-GB') : 'Not recorded'}
- Response Due Date: ${complaint.response_due_date ? new Date(complaint.response_due_date).toLocaleDateString('en-GB') : 'Not recorded'}
- Date Responded: ${complaint.date_responded ? new Date(complaint.date_responded).toLocaleDateString('en-GB') : 'Not yet responded'}
- Days to Respond: ${complaint.days_to_respond || 'Calculating...'}
- Status: ${complaint.status}
- Severity: ${complaint.severity || 'Not specified'}`;

    const questionnaireInfo = questionnaires && questionnaires.length > 0
      ? questionnaires.map((q: any) => `
Practice Investigation Findings:
- Staff Involved: ${q.staff_involved || 'Not specified'}
- Actions Taken: ${q.actions_taken || 'Not specified'}
- Learning Points: ${q.learning_points || 'Not specified'}
- Follow-up Required: ${q.follow_up_required ? 'Yes' : 'No'}
- Completed By: ${q.completed_by || 'Not specified'}
- Completed Date: ${q.completed_at ? new Date(q.completed_at).toLocaleDateString('en-GB') : 'Not completed'}
`).join('\n')
      : 'No questionnaire data available';

    const evidenceInfo = evidence && evidence.length > 0
      ? evidence.map((e: any) => `- ${e.evidence_type}: ${e.file_name} (${e.description || 'No description'})`).join('\n')
      : 'No supporting evidence uploaded';

    const responsesInfo = staffResponses && staffResponses.length > 0
      ? staffResponses.map((r: any) => `
Response from ${r.responder_name || 'Unknown'} (${r.responder_role || 'Unknown role'}):
Date: ${r.response_date ? new Date(r.response_date).toLocaleDateString('en-GB') : 'Not dated'}
Summary: ${r.response_summary || r.response_text || 'No summary'}
`).join('\n')
      : 'No staff responses recorded';

    const outcomeInfo = outcomes && outcomes.length > 0
      ? outcomes[0]
      : null;

    // Generate comprehensive review note using Lovable AI
    const systemPrompt = `You are an NHS governance and CQC compliance expert. Generate a professional, supportive compliance review that demonstrates the practice's efforts to meet CQC and NHS complaint management requirements.

This report should be suitable for CQC inspections and demonstrate:
- Compliance with NHS Complaint Standards
- Adherence to CQC regulations on complaint handling
- Thorough investigation and learning culture
- Patient-centred approach
- Appropriate timelines and documentation

The note should include:
1. **Executive Summary** - Highlight compliance achievements and process strengths (2-3 sentences)
2. **Complaint Handling Process Review** - Evidence of proper procedures followed
3. **Timeline Compliance** - Assessment of response times against NHS standards
4. **Investigation Quality** - Depth and thoroughness of investigation
5. **Evidence & Documentation** - Quality of supporting evidence gathered
6. **Key Strengths Identified** - What the practice did well
7. **Areas of Excellence** - Practices that exceed minimum standards
8. **Recommendations for Enhancement** - Constructive suggestions with CQC alignment
9. **Learning & Improvement Culture** - Evidence of reflective practice
10. **CQC/NHS Compliance Statement** - Overall assessment of regulatory compliance

Use British English. Format in clear markdown. Be supportive and balanced while maintaining professional objectivity.`;

    const userPrompt = `Please analyse this complaint review and generate a comprehensive compliance-focused review that supports the practice's efforts and demonstrates regulatory adherence:

COMPLAINT DETAILS:
- Reference: ${complaint.reference_number}
- Type: ${complaint.complaint_type || 'Not specified'}
- Description: ${complaint.complaint_description || 'No description'}

TIMELINE INFORMATION:
${timelineInfo}

PRACTICE INVESTIGATION:
${questionnaireInfo}

SUPPORTING EVIDENCE:
${evidenceInfo}

STAFF RESPONSES:
${responsesInfo}

${outcomeInfo ? `OUTCOME RECORDED:
- Type: ${outcomeInfo.outcome_type}
- Summary: ${outcomeInfo.outcome_summary}
- Decided: ${outcomeInfo.decided_at ? new Date(outcomeInfo.decided_at).toLocaleDateString('en-GB') : 'Not dated'}
` : ''}

AI REVIEW CONVERSATION:
Transcript: ${transcript}

Challenges Identified:
${JSON.stringify(challenges, null, 2)}

Responses Given:
${JSON.stringify(responses, null, 2)}

Recommendations:
${JSON.stringify(recommendations, null, 2)}

Conversation Metadata:
- Duration: ${Math.floor(duration / 60)} minutes ${duration % 60} seconds
- Started: ${new Date(startedAt).toLocaleString('en-GB')}
- Ended: ${new Date(endedAt).toLocaleString('en-GB')}

Generate a comprehensive, supportive compliance review that demonstrates the practice's adherence to CQC and NHS complaint management requirements. This should be suitable for inspection evidence and show the practice acted reasonably and professionally.`;

    console.log('Calling Lovable AI to generate review note...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to generate review note');
    }

    const aiData = await aiResponse.json();
    const reviewNote = aiData.choices[0].message.content;

    console.log('Review note generated successfully');

    // Save to database
    const { data: conversation, error: insertError } = await supabase
      .from('complaint_review_conversations')
      .insert({
        complaint_id: complaintId,
        conversation_transcript: transcript,
        conversation_summary: reviewNote,
        challenges_identified: challenges,
        responses_given: responses,
        recommendations: recommendations,
        conversation_duration: duration,
        conversation_started_at: startedAt,
        conversation_ended_at: endedAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving conversation:', insertError);
      throw new Error('Failed to save conversation');
    }

    console.log('Conversation saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversation.id,
        review_note: reviewNote,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in process-review-conversation:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
