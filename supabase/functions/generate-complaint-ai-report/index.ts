import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId } = await req.json();

    if (!complaintId) {
      return new Response(JSON.stringify({ error: 'Missing complaintId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch comprehensive complaint data
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_outcomes (*),
        complaint_acknowledgements (*),
        complaint_notes (*),
        complaint_involved_parties (*)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError) throw complaintError;

    // Calculate timeline compliance using correct date fields
    const receivedDate = complaint.received_at ? new Date(complaint.received_at) : new Date(complaint.created_at);
    
    // Acknowledgement date: prefer sent_at, fall back to created_at on the record, then complaint.acknowledged_at
    const ackRecord = complaint.complaint_acknowledgements?.[0];
    const acknowledgedDate = ackRecord?.sent_at 
      ? new Date(ackRecord.sent_at)
      : ackRecord?.created_at
        ? new Date(ackRecord.created_at)
        : complaint.acknowledged_at
          ? new Date(complaint.acknowledged_at)
          : null;
    
    // Outcome date: prefer sent_at, fall back to decided_at, then created_at
    const outcomeRecord = complaint.complaint_outcomes?.[0];
    const outcomeDate = outcomeRecord?.sent_at 
      ? new Date(outcomeRecord.sent_at)
      : outcomeRecord?.decided_at
        ? new Date(outcomeRecord.decided_at)
        : outcomeRecord?.created_at
          ? new Date(outcomeRecord.created_at)
          : null;

    const daysToAcknowledge = acknowledgedDate 
      ? Math.floor((acknowledgedDate.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const daysToOutcome = outcomeDate
      ? Math.floor((outcomeDate.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Prepare data for AI
    const notesContext = complaint.complaint_notes
      ?.map((note: any) => `- ${note.created_at}: ${note.note_text}`)
      .join('\n') || 'No notes recorded';

    const involvedPartiesContext = complaint.complaint_involved_parties
      ?.map((party: any) => `- ${party.name} (${party.role}): ${party.involvement_description || 'No description'}`)
      .join('\n') || 'No involved parties recorded';

    const questionnaireContext = 'No questionnaire responses';

    const systemPrompt = `You are an expert NHS complaints reviewer generating a comprehensive but concise complaint review report. 

Your task is to analyze the complaint data and provide:
1. A clear overview of what happened and how it was handled
2. Timeline compliance assessment
3. Key learnings identified
4. What the practice did well (be genuine and specific)
5. Supportive suggestions for quality improvement (not critical, but helpful)
6. Clear rationale for the outcome decision

IMPORTANT TONE GUIDELINES:
- Be friendly, supportive, and constructive
- Highlight strengths genuinely - don't just list generic positives
- Frame suggestions as opportunities for enhancement, not failures
- Use "consider", "might", "could explore" rather than "should" or "must"
- Acknowledge the complexity of healthcare delivery
- Be specific with evidence from the case
- Remember: we're looking for improvement, not perfection

IMPROVEMENT SUGGESTIONS REQUIREMENTS (CRITICAL):
- You MUST provide EXACTLY 3 suggestions or fewer - NEVER MORE THAN 3
- Select only the most important and impactful suggestions
- Word each suggestion gently and supportively
- Frame as possibilities and opportunities, not instructions or demands
- Use phrases like "It might be helpful to consider...", "One approach could be...", "Teams sometimes find it useful to..."
- Avoid prescriptive language that could stress or annoy the practice
- Quality over quantity - better to have 2 excellent suggestions than 4 mediocre ones

Return ONLY valid JSON in this exact structure:
{
  "complaintOverview": "2-3 paragraph narrative summary of the complaint and how it was handled",
  "timelineCompliance": {
    "acknowledged": {
      "date": "ISO date or null",
      "status": "on-time|late|pending",
      "daysFromReceived": number
    },
    "outcome": {
      "date": "ISO date or null",
      "status": "on-time|late|pending",
      "daysFromReceived": number
    }
  },
  "keyLearnings": [
    {
      "learning": "Specific learning point",
      "category": "Communication|Process|Clinical|Documentation|etc",
      "impact": "high|medium|low"
    }
  ],
  "practiceStrengths": [
    "Specific thing the practice did well with evidence from the case"
  ],
  "improvementSuggestions": [
    {
      "suggestion": "Brief, gently worded suggestion (maximum 3 total)",
      "rationale": "Why this might help, framed as an opportunity not a requirement",
      "priority": "high|medium|low"
    }
  ],
  "outcomeRationale": "Clear explanation of why the outcome decision was appropriate based on the investigation"
}`;

    const userPrompt = `Analyze this NHS complaint and generate a comprehensive review report:

COMPLAINT DETAILS:
Reference: ${complaint.reference_number}
Category: ${complaint.category}
Priority: ${complaint.priority}
Patient: ${complaint.patient_name}
Date Received: ${receivedDate.toLocaleDateString('en-GB')}
Acknowledged: ${acknowledgedDate ? acknowledgedDate.toLocaleDateString('en-GB') + ` (${daysToAcknowledge} days)` : 'Not yet acknowledged'}
Outcome Date: ${outcomeDate ? outcomeDate.toLocaleDateString('en-GB') + ` (${daysToOutcome} days)` : 'Not yet completed'}

COMPLAINT DESCRIPTION:
${complaint.complaint_description}

OUTCOME DECISION:
Type: ${complaint.complaint_outcomes?.[0]?.outcome_type || 'Not yet decided'}
Summary: ${complaint.complaint_outcomes?.[0]?.outcome_summary || 'No summary available'}

INVESTIGATION NOTES:
${notesContext}

INVOLVED PARTIES:
${involvedPartiesContext}

QUESTIONNAIRE RESPONSES:
${questionnaireContext}

NHS GUIDELINES:
- Acknowledgement: Within 3 working days
- Resolution: Aim for within 35 days, can extend to 6 months with agreement

Generate the report JSON now:`;

    // Call Lovable AI Gateway with retry logic
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let aiResponse;
    let lastError;
    
    // Try up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Attempt ${attempt} to call AI Gateway...`);
        
        aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

        if (aiResponse.ok) {
          break; // Success, exit retry loop
        }

        const errorText = await aiResponse.text();
        console.error(`AI Gateway error (attempt ${attempt}):`, aiResponse.status, errorText);
        
        // Handle specific error codes
        if (aiResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Lovable AI credits exhausted. Please add credits in your workspace settings.');
        }
        
        lastError = new Error(`AI Gateway returned ${aiResponse.status}: ${errorText}`);
        
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      } catch (fetchError) {
        console.error(`Network error (attempt ${attempt}):`, fetchError);
        lastError = fetchError;
        
        // Wait before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    // If we got here and aiResponse is still not ok, throw the last error
    if (!aiResponse || !aiResponse.ok) {
      throw lastError || new Error('Failed to connect to AI Gateway after 3 attempts');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse JSON from response
    let reportData;
    try {
      // Remove any markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reportData = JSON.parse(cleanContent);
      
      // CRITICAL: Enforce maximum of 3 improvement suggestions
      if (reportData.improvementSuggestions && reportData.improvementSuggestions.length > 3) {
        console.log(`Trimming ${reportData.improvementSuggestions.length} suggestions down to 3`);
        reportData.improvementSuggestions = reportData.improvementSuggestions.slice(0, 3);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-complaint-ai-report:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to generate AI report'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
