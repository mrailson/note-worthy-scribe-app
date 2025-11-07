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

    // Generate comprehensive review note using Lovable AI
    const systemPrompt = `You are an NHS governance expert. Generate a professional, comprehensive review note from this complaint review conversation. Use British English spelling and terminology.

The note should include:
1. Executive Summary (2-3 sentences)
2. Key Challenges Identified (bullet points with severity indicators)
3. Responses & Justifications (what was explained)
4. AI Recommendations (constructive suggestions with priority levels)
5. Learning Points (areas for improvement)
6. Overall Assessment (balanced, supportive critique)

Format the output in clear markdown with proper headings and structure.`;

    const userPrompt = `Please analyse this complaint review conversation and generate a professional review note:

CONVERSATION TRANSCRIPT:
${transcript}

CHALLENGES IDENTIFIED:
${JSON.stringify(challenges, null, 2)}

RESPONSES GIVEN:
${JSON.stringify(responses, null, 2)}

RECOMMENDATIONS:
${JSON.stringify(recommendations, null, 2)}

CONVERSATION METADATA:
- Duration: ${Math.floor(duration / 60)} minutes ${duration % 60} seconds
- Started: ${new Date(startedAt).toLocaleString('en-GB')}
- Ended: ${new Date(endedAt).toLocaleString('en-GB')}

Generate a comprehensive but concise review note that will serve as evidence of a thorough review process.`;

    console.log('Calling Lovable AI to generate review note...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
