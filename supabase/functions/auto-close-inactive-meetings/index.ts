import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Meeting {
  id: string;
  user_id: string;
  title: string;
  status: string;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
  last_transcript_at?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting auto-close check for inactive meetings...');

    // Calculate cutoff time (3 minutes ago - increased from 2 for better reliability)
    // This gives more buffer time for:
    // - Slow network connections
    // - Large audio chunks being processed
    // - Browser tab being backgrounded (which can slow timers)
    // - Reconnection attempts after transient failures
    const INACTIVITY_THRESHOLD_MINUTES = 3;
    const cutoffTime = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    console.log(`⏰ Checking for meetings inactive since: ${cutoffTime} (${INACTIVITY_THRESHOLD_MINUTES} min threshold)`);

    // Also compute a 5-minute window reference used elsewhere
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find meetings that are in recording status and not paused
    const { data: recordingMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        user_id,
        title,
        status,
        is_paused,
        created_at,
        updated_at
      `)
      .eq('status', 'recording')
      .eq('is_paused', false);

    if (meetingsError) {
      console.error('❌ Error fetching recording meetings:', meetingsError);
      throw meetingsError;
    }

    console.log(`📋 Found ${recordingMeetings?.length || 0} active recording meetings`);

    if (!recordingMeetings || recordingMeetings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active recording meetings found',
        closed_meetings: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const meetingsToClose: Meeting[] = [];

    // Check each meeting for recent transcript activity
    for (const meeting of recordingMeetings) {
      console.log(`🔍 Checking meeting ${meeting.id} (${meeting.title})`);

      // Check for recent transcript chunks
      const { data: recentChunks, error: chunksError } = await supabase
        .from('meeting_transcription_chunks')
        .select('created_at')
        .eq('meeting_id', meeting.id)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(1);

      if (chunksError) {
        console.error(`❌ Error checking transcript chunks for meeting ${meeting.id}:`, chunksError);
        continue;
      }

      // If no recent chunks, check legacy transcript tables
      let hasRecentActivity = recentChunks && recentChunks.length > 0;

      if (!hasRecentActivity) {
        const { data: recentTranscripts, error: transcriptsError } = await supabase
          .from('meeting_transcripts')
          .select('created_at')
          .eq('meeting_id', meeting.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(1);

        if (transcriptsError) {
          console.error(`❌ Error checking transcripts for meeting ${meeting.id}:`, transcriptsError);
          continue;
        }

        hasRecentActivity = recentTranscripts && recentTranscripts.length > 0;
      }

      // If still no recent activity, check legacy transcription_chunks
      if (!hasRecentActivity) {
        const { data: legacyChunks, error: legacyError } = await supabase
          .from('transcription_chunks')
          .select('created_at')
          .eq('meeting_id', meeting.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(1);

        if (legacyError) {
          console.error(`❌ Error checking legacy chunks for meeting ${meeting.id}:`, legacyError);
          continue;
        }

        hasRecentActivity = legacyChunks && legacyChunks.length > 0;
      }

      // Check if meeting itself was updated recently (user interaction)
      const meetingUpdatedRecently = new Date(meeting.updated_at) > new Date(fiveMinutesAgo);

      if (!hasRecentActivity && !meetingUpdatedRecently) {
        // Additional check: meeting must be at least 5 minutes old to avoid closing brand new meetings
        const meetingAge = Date.now() - new Date(meeting.created_at).getTime();
        const fiveMinutesInMs = 5 * 60 * 1000;

        if (meetingAge > fiveMinutesInMs) {
          console.log(`⚠️ Meeting ${meeting.id} (${meeting.title}) has no recent activity - marking for closure`);
          meetingsToClose.push(meeting);
        } else {
          console.log(`⏳ Meeting ${meeting.id} is too new (${Math.round(meetingAge / 1000)}s old) - skipping`);
        }
      } else {
        console.log(`✅ Meeting ${meeting.id} has recent activity - keeping active`);
      }
    }

    console.log(`🎯 Found ${meetingsToClose.length} meetings to auto-close`);

    const closedMeetings: string[] = [];
    const errors: string[] = [];

    // Close inactive meetings
    for (const meeting of meetingsToClose) {
      try {
        console.log(`🔄 Auto-closing meeting ${meeting.id} (${meeting.title})`);

        // Update meeting status to completed
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            status: 'completed',
            end_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            notes_generation_status: 'queued'
          })
          .eq('id', meeting.id);

        if (updateError) {
          console.error(`❌ Error updating meeting ${meeting.id}:`, updateError);
          errors.push(`Failed to update meeting ${meeting.id}: ${updateError.message}`);
          continue;
        }

        // Broadcast kill signal to any connected clients
        try {
          const channel = supabase.channel(`meeting-kill:${meeting.id}`);
          await channel.send({
            type: 'broadcast',
            event: 'force_stop',
            payload: { 
              reason: 'server_inactivity_timeout', 
              meeting_id: meeting.id,
              timestamp: new Date().toISOString()
            }
          });
          await supabase.removeChannel(channel);
          console.log(`📡 Sent kill signal for meeting ${meeting.id}`);
        } catch (broadcastError) {
          console.error(`⚠️ Failed to broadcast kill signal for ${meeting.id}:`, broadcastError);
          // Don't fail the whole operation if broadcast fails
        }

        // Queue notes generation if there's transcript content
        const { data: hasContent } = await supabase
          .from('meeting_transcription_chunks')
          .select('id')
          .eq('meeting_id', meeting.id)
          .limit(1);

        if (hasContent && hasContent.length > 0) {
          console.log(`📝 Queueing notes generation for meeting ${meeting.id}`);
          
          const { error: queueError } = await supabase
            .from('meeting_notes_queue')
            .upsert({
              meeting_id: meeting.id,
              status: 'pending',
              note_type: 'standard',
              detail_level: 'standard',
              updated_at: new Date().toISOString(),
              retry_count: 0,
              error_message: null
            });

          if (queueError) {
            console.error(`❌ Error queueing notes for meeting ${meeting.id}:`, queueError);
          }
        }

        // Log the auto-closure
        const { error: logError } = await supabase
          .from('system_audit_log')
          .insert({
            table_name: 'meetings',
            operation: 'AUTO_CLOSE_INACTIVE',
            record_id: meeting.id,
            user_id: meeting.user_id,
            old_values: { status: 'recording' },
            new_values: { 
              status: 'completed', 
              reason: 'auto_closed_inactive',
              inactive_since: fiveMinutesAgo
            },
            timestamp: new Date().toISOString()
          });

        if (logError) {
          console.error(`⚠️ Error logging auto-closure for meeting ${meeting.id}:`, logError);
        }

        closedMeetings.push(meeting.id);
        console.log(`✅ Successfully auto-closed meeting ${meeting.id}`);

      } catch (error) {
        console.error(`❌ Error processing meeting ${meeting.id}:`, error);
        errors.push(`Failed to process meeting ${meeting.id}: ${error.message}`);
      }
    }

    const response = {
      success: true,
      message: `Auto-close check completed. Closed ${closedMeetings.length} inactive meetings.`,
      closed_meetings: closedMeetings.length,
      closed_meeting_ids: closedMeetings,
      errors: errors.length > 0 ? errors : undefined,
      checked_meetings: recordingMeetings.length,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Auto-close check completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Fatal error in auto-close service:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});