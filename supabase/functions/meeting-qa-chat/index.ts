import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const { meetingId, question, conversationHistory = [] } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Meeting ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);
    console.log('Looking for meeting:', meetingId);

    // Fetch meeting data - first check if meeting exists at all
    const { data: meetingCheck, error: checkError } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('id', meetingId)
      .single();

    if (checkError || !meetingCheck) {
      console.error('Meeting does not exist:', meetingId, checkError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has access
    if (meetingCheck.user_id !== user.id) {
      console.error('Access denied - user:', user.id, 'meeting owner:', meetingCheck.user_id);
      return new Response(
        JSON.stringify({ error: 'Access denied to this meeting' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch full meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, assembly_transcript_text, whisper_transcript_text, best_of_all_transcript, primary_transcript_source, created_at, start_time, meeting_type, overview')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('Error fetching meeting details:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch meeting details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meeting found:', meeting.title);

    // Determine which transcript to use — prefer best_of_all when available
    const transcript = meeting.best_of_all_transcript
      || (meeting.primary_transcript_source === 'assembly' 
        ? meeting.assembly_transcript_text 
        : meeting.whisper_transcript_text || meeting.assembly_transcript_text);

    // Build context from meeting data
    const meetingDate = meeting.created_at ? new Date(meeting.created_at).toLocaleDateString('en-GB') : 'N/A';
    const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    let context = `Meeting Title: ${meeting.title}\n`;
    context += `Meeting Date: ${meetingDate}\n`;
    context += `Meeting Time: ${meetingTime}\n`;
    if (meeting.meeting_type) context += `Meeting Type: ${meeting.meeting_type}\n`;
    context += `\n---\n\n`;
    
    if (transcript) {
      context += `Meeting Transcript:\n${transcript}\n\n---\n\n`;
    }
    
    if (meeting.overview) {
      context += `Meeting Notes/Overview:\n${meeting.overview}\n`;
    }

    // Build messages for AI
    const systemPrompt = `You are a helpful AI assistant that answers questions about meetings based on the meeting transcript and notes.

FORMATTING GUIDELINES:
- Use proper markdown formatting
- Put each bullet point or numbered item on its OWN LINE
- Use a blank line between different sections
- Format headings with ## or ### 
- Use **bold** for emphasis on key terms
- Keep paragraphs well-spaced with blank lines between them

RESPONSE STYLE:
- Be concise, accurate, and helpful
- Use British English
- Reference specific parts of the meeting when relevant

Meeting Information:
${context}

Answer questions based solely on the meeting content provided above.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: question }
    ];

    // Call Lovable AI API
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits exhausted. Please contact support.');
      }
      
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meeting-qa-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});