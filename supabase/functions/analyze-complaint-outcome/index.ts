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

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Initialise Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch complaint details with all related information
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        practice_details!inner(practice_name),
        complaint_notes(note, is_internal, created_at),
        complaint_involved_parties(staff_name, staff_role, response_text, response_submitted_at)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
    }

    const systemPrompt = `You are an expert NHS complaints analyst with deep knowledge of:
- NHS Constitution standards
- Parliamentary and Health Service Ombudsman guidelines
- CQC compliance requirements
- NHS England complaints procedure
- Good Medical Practice standards
- Patient rights and expectations

Analyse the complaint and provide:
1. RECOMMENDED OUTCOME: rejected, upheld, or partially_upheld
2. DETAILED REASONING: Clear, evidence-based justification
3. KEY FACTORS: List specific elements that influenced the decision
4. REGULATORY COMPLIANCE: How this aligns with NHS/CQC standards
5. LEARNING OPPORTUNITIES: Suggestions for service improvement
6. RISK ASSESSMENT: Potential clinical or reputational risks

⚠️ CRITICAL: Base your analysis ONLY on the information provided. DO NOT invent or assume medical conditions, emergencies, clinical details, or events not explicitly mentioned in the complaint details, staff responses, or investigation notes.

Be objective, thorough, and focus on patient safety and quality of care.`;

    const staffResponses = complaint.complaint_involved_parties
      ?.filter(party => party.response_text)
      ?.map(party => `${party.staff_name} (${party.staff_role}): ${party.response_text}`)
      ?.join('\n\n') || 'No staff responses received yet';

    const internalNotes = complaint.complaint_notes
      ?.filter(note => note.is_internal)
      ?.map(note => note.note)
      ?.join('\n\n') || 'No internal notes';

    const userPrompt = `Analyse this NHS complaint and recommend an outcome:

COMPLAINT DETAILS:
Reference: ${complaint.reference_number}
Category: ${complaint.category}
Priority: ${complaint.priority}
Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}
Staff Mentioned: ${complaint.staff_mentioned?.join(', ') || 'None specifically mentioned'}

STAFF RESPONSES:
${staffResponses}

INTERNAL INVESTIGATION NOTES:
${internalNotes}

PATIENT INFORMATION:
- Complaint made on behalf of patient: ${complaint.complaint_on_behalf ? 'Yes' : 'No'}
- Consent given: ${complaint.consent_given ? 'Yes' : 'No'}

Please provide a comprehensive analysis with recommended outcome and clear reasoning that would satisfy CQC inspection and NHS England standards.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
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
      details: 'Failed to analyse complaint outcome' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
