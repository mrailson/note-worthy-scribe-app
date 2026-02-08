import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId } = await req.json();
    console.log('🔔 Processing meeting completion for:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Validate meeting exists and is completed
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError) {
      console.error('❌ Error fetching meeting:', meetingError);
      throw new Error(`Database error: ${meetingError.message}`);
    }

    if (!meeting) {
      console.error('❌ Meeting not found:', meetingId);
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    if (meeting.status !== 'completed') {
      console.log('ℹ️ Meeting is not completed yet, skipping notes generation');
      return new Response(
        JSON.stringify({ message: 'Meeting not completed yet', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if notes already exist
    const { data: existingNotes } = await supabase
      .from('meeting_summaries')
      .select('id')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    if (existingNotes) {
      console.log('📝 Notes already exist, skipping generation');
      return new Response(
        JSON.stringify({ message: 'Notes already exist', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transcript data exists
    const { data: transcriptData } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    const hasTranscript = transcriptData?.[0]?.transcript && 
                         transcriptData[0].transcript.trim().length > 0;

    if (!hasTranscript) {
      console.log('⚠️ No transcript available for notes generation');
      return new Response(
        JSON.stringify({ message: 'No transcript available', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ All checks passed, calling auto-generate-meeting-notes...');

    // Call the auto-generate-meeting-notes function with a small delay to ensure data consistency
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: result, error: generateError } = await supabase.functions.invoke(
      'auto-generate-meeting-notes',
      {
        body: { 
          meetingId,
          forceRegenerate: false 
        }
      }
    );

    if (generateError) {
      console.error('❌ Error generating notes:', generateError);
      throw generateError;
    }

    console.log('🎉 Successfully triggered note generation');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Note generation triggered successfully',
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in meeting-completion-handler:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});