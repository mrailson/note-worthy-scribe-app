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
    const XI_API_KEY = Deno.env.get('XI_API_KEY');
    if (!XI_API_KEY) {
      throw new Error('XI_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { complaintId } = await req.json();
    
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    console.log('Fetching complaint details for:', complaintId);

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        complaint_outcomes (*),
        complaint_responses (*)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError) {
      console.error('Error fetching complaint:', complaintError);
      throw new Error('Failed to fetch complaint details');
    }

    console.log('Complaint fetched successfully');

    // Build context from complaint data
    const outcomeInfo = complaint.complaint_outcomes?.[0];
    const responses = complaint.complaint_responses || [];

    // Create a comprehensive context prompt
    const contextPrompt = `You are an NHS governance expert conducting a critical friend review of a closed complaint.

COMPLAINT DETAILS:
- Reference: ${complaint.reference_number}
- Type: ${complaint.complaint_type || 'Not specified'}
- Date Received: ${new Date(complaint.date_received).toLocaleDateString('en-GB')}
- Status: ${complaint.status}
- Severity: ${complaint.severity || 'Not specified'}

DESCRIPTION:
${complaint.complaint_description || 'No description available'}

${outcomeInfo ? `OUTCOME:
- Type: ${outcomeInfo.outcome_type}
- Summary: ${outcomeInfo.outcome_summary}
- Decision Date: ${new Date(outcomeInfo.decided_at).toLocaleDateString('en-GB')}
` : ''}

${responses.length > 0 ? `STAFF RESPONSES:
${responses.map((r: any) => `- ${r.response_summary || r.response_text}`).join('\n')}
` : ''}

YOUR ROLE:
You are conducting a thorough but supportive review. Your goal is to:
1. Ask probing questions about the investigation process
2. Identify potential gaps or areas for improvement
3. Challenge assumptions constructively
4. Provide helpful suggestions
5. Maintain a professional, supportive tone
6. Keep the conversation focused (1-5 minutes maximum)
7. Use British English throughout
8. Be a critical friend - thorough but not harsh

Start by greeting the user and asking if they're ready to review this complaint case together.`;

    console.log('Generating conversational AI response...');

    // For now, return a placeholder response indicating the feature requires an ElevenLabs agent
    // Users will need to create an agent in the ElevenLabs dashboard and configure it with the agent_id
    console.warn('ElevenLabs conversational AI agent needs to be pre-configured in the ElevenLabs dashboard');

    return new Response(
      JSON.stringify({
        error: 'AI Review Conversation requires an ElevenLabs Conversational AI agent to be configured. Please create an agent in your ElevenLabs dashboard and update the edge function with the agent_id.',
        complaint_reference: complaint.reference_number,
        context: 'The complaint data has been prepared but requires ElevenLabs agent configuration',
      }),
      {
        status: 501, // Not Implemented
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in complaint-review-agent:', error);
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
