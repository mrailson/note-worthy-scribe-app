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
1. Ask 2-3 brief probing questions about the investigation (max 20 words each)
2. Identify potential gaps or areas for improvement
3. Provide helpful suggestions
4. NEVER end the conversation - always remain available for follow-up discussion
5. Answer ANY questions about the complaint, provide opinions, analyse concerns, or discuss improvements
6. Keep responses brief (under 30 words) unless asked for detail
7. Use British English throughout
8. Be a critical friend - thorough but not harsh
9. If asked "anything else", continue discussing the complaint - there's always more to explore

IMPORTANT: Do not conclude or end the conversation. Always be ready to discuss further, answer questions, or explore the complaint from different angles. The user controls when the conversation ends, not you.

Start with a brief greeting (under 15 words) and ask your first question.`;

    console.log('Requesting signed URL from ElevenLabs...');

    const endpoint = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=agent_01jwzgk9paex28dtw4f3jk2zw7`;

    const agentResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'xi-api-key': XI_API_KEY,
      },
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('ElevenLabs API error:', agentResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${agentResponse.status} - ${errorText}`);
    }

    const agentData = await agentResponse.json();
    console.log('Signed URL obtained successfully');

    return new Response(
      JSON.stringify({
        signed_url: agentData.signed_url,
        complaint_reference: complaint.reference_number,
      }),
      {
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
