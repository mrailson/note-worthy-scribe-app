import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { meetingIds } = await req.json();

    if (!Array.isArray(meetingIds) || meetingIds.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 meetings are required for merging' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Starting merge process for meetings:', meetingIds);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set auth for subsequent requests
    const token = authHeader.replace('Bearer ', '');
    supabase.auth.setSession({ access_token: token, refresh_token: '' });

    // Fetch all meetings to merge (with user validation)
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .in('id', meetingIds)
      .order('start_time', { ascending: true });

    if (meetingsError) {
      console.error('❌ Error fetching meetings:', meetingsError);
      throw meetingsError;
    }

    if (!meetings || meetings.length !== meetingIds.length) {
      throw new Error('Some meetings not found or not accessible');
    }

    // Ensure all meetings belong to the same user
    const userIds = [...new Set(meetings.map(m => m.user_id))];
    if (userIds.length > 1) {
      throw new Error('All meetings must belong to the same user');
    }

    console.log('✅ Found meetings to merge:', meetings.map(m => m.title));

    // Determine primary meeting (earliest start_time)
    const primaryMeeting = meetings[0];
    const secondaryMeetings = meetings.slice(1);

    console.log('📋 Primary meeting:', primaryMeeting.title);
    console.log('📋 Secondary meetings:', secondaryMeetings.map(m => m.title));

    // Fetch transcripts for all meetings using the get_meeting_full_transcript function
    const transcripts: Array<{ meeting: any, transcript: string, source: string }> = [];
    
    for (const meeting of meetings) {
      const { data: transcriptData, error: transcriptError } = await supabase
        .rpc('get_meeting_full_transcript', { p_meeting_id: meeting.id });

      if (transcriptError) {
        console.error(`❌ Error fetching transcript for meeting ${meeting.id}:`, transcriptError);
        continue;
      }

      if (transcriptData && transcriptData.length > 0) {
        const transcript = transcriptData[0].transcript || '';
        const source = transcriptData[0].source || 'unknown';
        
        if (transcript.trim()) {
          transcripts.push({ meeting, transcript, source });
          console.log(`📄 Found transcript for "${meeting.title}" (${transcript.split(' ').length} words) from ${source}`);
        }
      }
    }

    if (transcripts.length === 0) {
      throw new Error('No transcripts found for any of the meetings to merge');
    }

    // Merge transcripts chronologically with meeting separators
    const mergedTranscript = transcripts
      .map(({ meeting, transcript }) => {
        const meetingDate = new Date(meeting.start_time).toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return `=== ${meeting.title} - ${meetingDate} ===\n\n${transcript.trim()}`;
      })
      .join('\n\n---\n\n');

    // Calculate merged metadata
    const totalWordCount = transcripts.reduce((sum, { transcript }) => 
      sum + transcript.split(' ').filter(word => word.trim()).length, 0
    );
    
    const totalDuration = meetings.reduce((sum, meeting) => 
      sum + (meeting.duration_minutes || 0), 0
    );

    const latestEndTime = meetings.reduce((latest, meeting) => {
      const endTime = meeting.end_time || meeting.start_time;
      return !latest || new Date(endTime) > new Date(latest) ? endTime : latest;
    }, null);

    console.log('🔢 Merged stats:', { totalWordCount, totalDuration, transcriptLength: mergedTranscript.length });

    // Move documents from secondary meetings to primary meeting
    for (const secondaryMeeting of secondaryMeetings) {
      const { error: moveDocsError } = await supabase
        .from('meeting_documents')
        .update({ meeting_id: primaryMeeting.id })
        .eq('meeting_id', secondaryMeeting.id);

      if (moveDocsError) {
        console.error(`⚠️ Error moving documents from meeting ${secondaryMeeting.id}:`, moveDocsError);
      } else {
        console.log(`📎 Moved documents from "${secondaryMeeting.title}" to primary meeting`);
      }
    }

    // Update primary meeting with merged data
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        word_count: totalWordCount,
        duration_minutes: totalDuration,
        end_time: latestEndTime,
        status: 'completed',
        notes_generation_status: 'pending', // Will trigger note regeneration
        updated_at: new Date().toISOString()
      })
      .eq('id', primaryMeeting.id);

    if (updateError) {
      console.error('❌ Error updating primary meeting:', updateError);
      throw updateError;
    }

    // Store merged transcript by creating new transcript chunks
    // First, clear existing chunks for primary meeting
    const { error: clearChunksError } = await supabase
      .from('meeting_transcription_chunks')
      .delete()
      .eq('meeting_id', primaryMeeting.id);

    if (clearChunksError) {
      console.error('⚠️ Error clearing existing transcript chunks:', clearChunksError);
    }

    // Create new transcript chunk with merged content
    const sessionId = `merged-${Date.now()}`;
    const { error: insertChunkError } = await supabase
      .from('meeting_transcription_chunks')
      .insert({
        meeting_id: primaryMeeting.id,
        user_id: primaryMeeting.user_id,
        session_id: sessionId,
        chunk_number: 1,
        transcription_text: mergedTranscript,
        word_count: totalWordCount,
        validation_status: 'validated'
      });

    if (insertChunkError) {
      console.error('❌ Error inserting merged transcript:', insertChunkError);
      throw insertChunkError;
    }

    console.log('💾 Stored merged transcript in database');

    // Delete secondary meetings and their associated data
    for (const secondaryMeeting of secondaryMeetings) {
      console.log(`🗑️ Deleting secondary meeting: "${secondaryMeeting.title}"`);

      // Delete associated data first
      const deleteOperations = [
        supabase.from('meeting_transcription_chunks').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('transcription_chunks').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_transcripts').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_summaries').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_notes_multi').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_notes_queue').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_audio_backups').delete().eq('meeting_id', secondaryMeeting.id),
        supabase.from('meeting_shares').delete().eq('meeting_id', secondaryMeeting.id)
      ];

      await Promise.all(deleteOperations);

      // Finally delete the meeting itself
      const { error: deleteMeetingError } = await supabase
        .from('meetings')
        .delete()
        .eq('id', secondaryMeeting.id);

      if (deleteMeetingError) {
        console.error(`❌ Error deleting meeting ${secondaryMeeting.id}:`, deleteMeetingError);
      } else {
        console.log(`✅ Deleted secondary meeting: "${secondaryMeeting.title}"`);
      }
    }

    // Queue note types for regeneration (only the types we actually use)
    const noteTypes = ['brief', 'executive', 'limerick'];
    const queueInserts = noteTypes.map(noteType => ({
      meeting_id: primaryMeeting.id,
      status: 'pending',
      note_type: noteType,
      batch_id: batchId,
      detail_level: noteType
    }));

    const { error: queueError } = await supabase
      .from('meeting_notes_queue')
      .insert(queueInserts);

    if (queueError) {
      console.error('⚠️ Error queuing note regeneration:', queueError);
    } else {
      console.log('📝 Queued note regeneration for merged meeting');
    }

    // Trigger background processing
    try {
      const { error: notifyError } = await supabase.functions.invoke('process-meeting-notes-queue');
      if (notifyError) {
        console.error('⚠️ Error triggering note processing:', notifyError);
      }
    } catch (notifyErr) {
      console.error('⚠️ Error invoking note processing function:', notifyErr);
    }

    console.log('🎉 Meeting merge completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        primaryMeetingId: primaryMeeting.id,
        mergedTitle: primaryMeeting.title,
        totalWordCount,
        totalDuration,
        deletedMeetings: secondaryMeetings.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Merge meetings error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});