import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Monitor meeting length and trigger appropriate processing
async function monitorMeetingLength(meetingId: string, userId: string, currentDuration: number) {
  const LONG_MEETING_THRESHOLD = 45; // minutes
  const VERY_LONG_MEETING_THRESHOLD = 90; // minutes
  
  try {
    // Check if this is a long meeting
    if (currentDuration >= LONG_MEETING_THRESHOLD) {
      console.log(`Long meeting detected: ${currentDuration} minutes`);
      
      // Create alert for monitoring
      const { error: alertError } = await supabase
        .from('system_audit_log')
        .insert({
          table_name: 'meetings',
          operation: 'LONG_MEETING_ALERT',
          record_id: meetingId,
          user_id: userId,
          new_values: {
            duration_minutes: currentDuration,
            alert_type: currentDuration >= VERY_LONG_MEETING_THRESHOLD ? 'very_long' : 'long',
            triggered_at: new Date().toISOString(),
            recommendation: currentDuration >= VERY_LONG_MEETING_THRESHOLD 
              ? 'Consider splitting into multiple sessions or use chunked processing'
              : 'Monitor for potential transcription issues'
          }
        });
      
      if (alertError) console.error('Alert creation error:', alertError);
      
      // Check transcript completeness
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('created_at, title')
        .eq('id', meetingId)
        .single();
      
      if (!meetingError && meeting) {
        const { data: transcripts, error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .select('content')
          .eq('meeting_id', meetingId);
        
        if (!transcriptError && transcripts && transcripts.length > 0) {
          const transcriptLength = transcripts[0].content?.length || 0;
          const expectedMinLength = currentDuration * 150; // ~150 chars per minute estimate
          
          if (transcriptLength < expectedMinLength * 0.7) {
            console.log(`Potential transcript truncation detected for meeting ${meetingId}`);
            
            // Create truncation alert
            const { error: truncationError } = await supabase
              .from('system_audit_log')
              .insert({
                table_name: 'meeting_transcripts',
                operation: 'TRANSCRIPT_TRUNCATION_ALERT',
                record_id: meetingId,
                user_id: userId,
                new_values: {
                  actual_length: transcriptLength,
                  expected_min_length: expectedMinLength,
                  duration_minutes: currentDuration,
                  truncation_ratio: transcriptLength / expectedMinLength,
                  requires_reprocessing: true
                }
              });
            
            if (truncationError) console.error('Truncation alert error:', truncationError);
          }
        }
      }
    }
    
    return {
      success: true,
      isLongMeeting: currentDuration >= LONG_MEETING_THRESHOLD,
      isVeryLongMeeting: currentDuration >= VERY_LONG_MEETING_THRESHOLD,
      recommendation: currentDuration >= VERY_LONG_MEETING_THRESHOLD 
        ? 'chunked_processing' 
        : currentDuration >= LONG_MEETING_THRESHOLD 
        ? 'monitor_closely' 
        : 'normal_processing'
    };
    
  } catch (error) {
    console.error('Error monitoring meeting length:', error);
    throw error;
  }
}

// Check for stuck or failed transcriptions
async function checkStuckTranscriptions() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Find meetings that should have transcripts but don't
    const { data: meetingsWithoutTranscripts, error: queryError } = await supabase
      .from('meetings')
      .select(`
        id, 
        user_id, 
        title, 
        duration_minutes, 
        created_at,
        meeting_transcripts!left(meeting_id)
      `)
      .is('meeting_transcripts.meeting_id', null)
      .gte('duration_minutes', 5)
      .lt('created_at', thirtyMinutesAgo);
    
    if (queryError) throw queryError;
    
    for (const meeting of meetingsWithoutTranscripts || []) {
      console.log(`Found meeting without transcript: ${meeting.id}`);
      
      // Check if there's an audio backup
      const { data: audioBackup, error: backupError } = await supabase
        .from('meeting_audio_backups')
        .select('file_path, file_size')
        .eq('meeting_id', meeting.id)
        .single();
      
      if (!backupError && audioBackup) {
        // Create reprocessing alert
        const { error: alertError } = await supabase
          .from('system_audit_log')
          .insert({
            table_name: 'meetings',
            operation: 'REPROCESSING_REQUIRED',
            record_id: meeting.id,
            user_id: meeting.user_id,
            new_values: {
              issue_type: 'missing_transcript',
              audio_backup_available: true,
              file_path: audioBackup.file_path,
              file_size: audioBackup.file_size,
              duration_minutes: meeting.duration_minutes,
              detected_at: new Date().toISOString()
            }
          });
        
        if (alertError) console.error('Reprocessing alert error:', alertError);
      }
    }
    
    return {
      success: true,
      meetingsFound: meetingsWithoutTranscripts?.length || 0
    };
    
  } catch (error) {
    console.error('Error checking stuck transcriptions:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, meetingId, userId, currentDuration } = await req.json();
    
    let result;
    
    switch (action) {
      case 'monitor_length':
        if (!meetingId || !userId || !currentDuration) {
          throw new Error('Missing required parameters for monitor_length');
        }
        result = await monitorMeetingLength(meetingId, userId, currentDuration);
        break;
        
      case 'check_stuck':
        result = await checkStuckTranscriptions();
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in meeting-length-monitor function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});