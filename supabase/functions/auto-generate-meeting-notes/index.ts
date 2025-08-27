import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId, forceRegenerate = false } = await req.json();
    console.log('🤖 Auto-generating notes for meeting:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Check if notes already exist and we're not forcing regeneration
    if (!forceRegenerate) {
      const { data: existingSummary } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingId)
        .single();

      if (existingSummary) {
        console.log('📝 Notes already exist for meeting, skipping generation');
        return new Response(
          JSON.stringify({ message: 'Notes already exist', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update meeting status to generating
    await supabase
      .from('meetings')
      .update({ notes_generation_status: 'generating' })
      .eq('id', meetingId);

    // Get meeting details and transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('❌ Meeting not found:', meetingError);
      throw new Error('Meeting not found');
    }

    // Get transcript from meeting_transcripts table
    const { data: transcripts, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('content')
      .eq('meeting_id', meetingId)
      .order('timestamp_seconds', { ascending: true });

    if (transcriptError) {
      console.error('❌ Error fetching transcript:', transcriptError);
      throw new Error('Failed to fetch transcript');
    }

    const fullTranscript = transcripts?.map(t => t.content).join(' ') || '';
    
    if (!fullTranscript.trim()) {
      console.log('⚠️ No transcript found for meeting');
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
      
      throw new Error('No transcript available for notes generation');
    }

    console.log('📄 Transcript length:', fullTranscript.length, 'chars');

    // Generate notes using OpenAI
    const systemPrompt = `You are an expert meeting notes assistant. Create comprehensive, professional meeting notes from the provided transcript.

Start with a detailed Meeting Overview that provides substantial context about what this meeting covered. This overview should be comprehensive enough that someone reading it weeks later can immediately understand the main focus, key initiatives discussed, important decisions made, and critical context. Think of it as a rich summary that helps distinguish this meeting from others.

Then format the rest of your response with clear sections using emojis:

📋 Meeting Overview
Write 2-3 substantial paragraphs that capture the essence of the meeting. Include:
- Main focus areas, initiatives, or programs discussed  
- Key decisions made and their context
- Important timelines, deadlines, or milestones mentioned
- Critical issues, concerns, or challenges raised
- Specific details that make this meeting memorable and distinguishable
- Financial, operational, or strategic implications discussed

1️⃣ Attendees
List all attendees mentioned in the meeting

2️⃣ Key Discussion Points  
Detailed breakdown of main topics with context and outcomes

3️⃣ Decisions Made
Specific decisions reached during the meeting with reasoning

4️⃣ Action Items
Specific tasks, assignments, and next steps with responsible parties and deadlines

5️⃣ Next Steps & Follow-up
Any scheduled follow-up meetings, review dates, or important future milestones

Make the overview rich in detail and context. Focus on creating a narrative that captures the meeting's purpose, main discussions, and outcomes in a way that would help someone quickly understand what this meeting was about even months later.`;

    const userPrompt = `Meeting Title: ${meeting.title}
Meeting Date: ${new Date(meeting.created_at).toLocaleDateString()}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

Transcript:
${fullTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedNotes = data.choices[0].message.content;

    console.log('✅ Generated notes length:', generatedNotes.length, 'chars');

    // Save notes to database
    const { error: summaryError } = await supabase
      .from('meeting_summaries')
      .upsert({
        meeting_id: meetingId,
        summary: generatedNotes,
        key_points: [],
        action_items: [],
        decisions: [],
        next_steps: []
      });

    if (summaryError) {
      console.error('❌ Error saving summary:', summaryError);
      throw summaryError;
    }

    // Update meeting status to completed
    await supabase
      .from('meetings')
      .update({ notes_generation_status: 'completed' })
      .eq('id', meetingId);

    // Update queue status if exists
    await supabase
      .from('meeting_notes_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    console.log('🎉 Successfully generated and saved meeting notes');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Meeting notes generated successfully',
        notesLength: generatedNotes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in auto-generate-meeting-notes:', error.message);
    
    // Try to update status to failed if we have meetingId
    try {
      const { meetingId } = await req.json().catch(() => ({}));
      if (meetingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('meetings')
          .update({ notes_generation_status: 'failed' })
          .eq('id', meetingId);

        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId);
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});