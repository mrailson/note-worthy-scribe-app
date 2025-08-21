import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-generate meeting notes function started');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    console.log('Processing meeting:', meetingId);

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update status to processing
    await supabase
      .from('meeting_auto_notes')
      .update({ 
        status: 'processing',
        generation_started_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    // Get meeting details and full transcript using the existing function
    const { data: transcriptData, error: transcriptError } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    if (transcriptError || !transcriptData?.[0]?.transcript) {
      throw new Error(`Failed to get transcript: ${transcriptError?.message || 'No transcript found'}`);
    }

    const transcript = transcriptData[0].transcript;
    const wordCount = transcript.split(/\s+/).length;

    console.log(`Got transcript with ${wordCount} words from source: ${transcriptData[0].source}`);

    // Get meeting details for context
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .select('title, description, start_time, meeting_type')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('Error fetching meeting details:', meetingError);
    }

    // Generate meeting notes using OpenAI (using similar logic to existing functions)
    const systemPrompt = `You are an expert meeting note-taker. Create comprehensive, well-structured meeting minutes from the provided transcript.

Structure the minutes with these sections:
# Meeting Minutes: ${meetingData?.title || 'Meeting'}

## Meeting Details
- **Date:** ${meetingData?.start_time ? new Date(meetingData.start_time).toLocaleDateString('en-GB') : 'Not specified'}
- **Type:** ${meetingData?.meeting_type || 'Meeting'}

## Attendees
[List attendees mentioned in the transcript]

## Agenda Items
[Extract main discussion topics]

## Key Discussion Points
[Summarize main discussions and decisions]

## Action Items
[List specific tasks and responsibilities with owners where mentioned]

## Decisions Made
[Document key decisions and outcomes]

## Next Steps
[Outline follow-up actions and next meeting plans]

Focus on:
- Clear, concise summaries
- Actionable items with responsible parties where mentioned
- Key decisions and their rationale
- Important dates and deadlines
- Use British English spelling and grammar`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate comprehensive meeting minutes from this transcript:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiResult = await response.json();
    const generatedNotes = aiResult.choices?.[0]?.message?.content;

    if (!generatedNotes) {
      throw new Error('No notes generated from OpenAI');
    }

    console.log('Successfully generated notes, length:', generatedNotes.length);

    // Update the auto-notes record with success
    const { error: updateError } = await supabase
      .from('meeting_auto_notes')
      .update({
        status: 'completed',
        generated_notes: generatedNotes,
        generation_completed_at: new Date().toISOString(),
        word_count: wordCount
      })
      .eq('meeting_id', meetingId);

    if (updateError) {
      console.error('Error updating auto-notes record:', updateError);
      throw updateError;
    }

    console.log('Auto-generation completed successfully for meeting:', meetingId);

    return new Response(JSON.stringify({
      success: true,
      meetingId: meetingId,
      notesLength: generatedNotes.length,
      wordCount: wordCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-generate-meeting-notes:', error);

    // Try to update the record with error status if we have meetingId
    try {
      const { meetingId } = await req.json().catch(() => ({}));
      if (meetingId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabase
          .from('meeting_auto_notes')
          .update({
            status: 'failed',
            error_message: error.message,
            generation_completed_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});