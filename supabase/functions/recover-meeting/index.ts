import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { meeting_id } = await req.json();
    
    if (!meeting_id) {
      throw new Error('meeting_id is required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get orphaned transcript chunks
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('meeting_transcription_chunks')
      .select('user_id, transcription_text, created_at')
      .eq('meeting_id', meeting_id)
      .order('created_at', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No transcript chunks found for this meeting');
    }

    // Calculate word count from plain text chunks (skip JSON formatted ones)
    let totalWords = 0;
    let fullTranscript = '';
    
    for (const chunk of chunks) {
      const text = chunk.transcription_text || '';
      // Skip JSON formatted chunks (they're duplicates with timing info)
      if (!text.startsWith('[{')) {
        fullTranscript += text + ' ';
        totalWords += text.split(/\s+/).filter(Boolean).length;
      }
    }

    const userId = chunks[0].user_id;
    const createdAt = chunks[0].created_at;

    // Check if meeting already exists
    const { data: existingMeeting } = await supabaseAdmin
      .from('meetings')
      .select('id')
      .eq('id', meeting_id)
      .single();

    if (existingMeeting) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meeting already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the meeting record
    const { data: meeting, error: insertError } = await supabaseAdmin
      .from('meetings')
      .insert({
        id: meeting_id,
        user_id: userId,
        title: 'Recovered Meeting - 2 Feb 2026',
        status: 'completed',
        meeting_type: 'General Meeting',
        word_count: totalWords,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to create meeting: ${insertError.message}`);
    }

    console.log('✅ Recovered meeting:', meeting_id, 'with', totalWords, 'words');

    // Optionally trigger notes generation
    try {
      await supabaseAdmin.functions.invoke('generate-meeting-notes', {
        body: { meetingId: meeting_id }
      });
      console.log('📝 Triggered notes generation for recovered meeting');
    } catch (notesErr) {
      console.warn('Could not trigger notes generation:', notesErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        meeting_id: meeting_id,
        word_count: totalWords,
        message: 'Meeting recovered successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recovery error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
