import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility to recover stuck meetings that failed to transition to completed status
 */
export const recoverStuckMeeting = async (meetingId: string) => {
  try {
    console.log(`🔄 Starting recovery process for meeting: ${meetingId}`);
    
    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, status, user_id, created_at')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('❌ Failed to fetch meeting:', meetingError);
      toast.error('Meeting not found');
      return false;
    }

    // Verify user owns this meeting
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== meeting.user_id) {
      console.error('❌ User not authorized for this meeting');
      toast.error('Not authorized to recover this meeting');
      return false;
    }

    // Check if meeting is not already completed
    if (meeting.status === 'completed') {
      console.log('ℹ️ Meeting is already completed');
      toast.info('Meeting is already completed');
      return false;
    }

    console.log(`📊 Meeting current status: ${meeting.status} - proceeding with completion...`);

    // Check for existing transcript chunks
    const { data: transcriptChunks, error: chunksError } = await supabase
      .from('meeting_transcription_chunks')
      .select('id')
      .eq('meeting_id', meetingId)
      .limit(1);

    if (chunksError) {
      console.error('❌ Failed to check transcript chunks:', chunksError);
    }

    const hasTranscriptData = transcriptChunks && transcriptChunks.length > 0;
    console.log(`📊 Transcript data available: ${hasTranscriptData}`);

    // Update meeting status to completed
    const endTime = new Date();
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        status: 'completed',
        end_time: endTime.toISOString(),
        updated_at: endTime.toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('❌ Failed to update meeting status:', updateError);
      toast.error('Failed to recover meeting');
      return false;
    }

    console.log('✅ Successfully recovered meeting and updated status to completed');
    
    if (hasTranscriptData) {
      toast.success('Meeting recovered successfully! Notes generation will begin automatically.');
    } else {
      toast.success('Meeting recovered successfully! No transcript data available for notes generation.');
    }

    return true;
  } catch (error) {
    console.error('❌ Critical error in meeting recovery:', error);
    toast.error('Failed to recover meeting due to unexpected error');
    return false;
  }
};

/**
 * Get list of stuck meetings for current user
 */
export const getStuckMeetings = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: stuckMeetings, error } = await supabase
      .from('meetings')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'recording')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch stuck meetings:', error);
      return [];
    }

    // Filter meetings that are likely stuck (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const reallyStuckMeetings = stuckMeetings?.filter(meeting => 
      new Date(meeting.created_at) < oneHourAgo
    ) || [];

    console.log(`Found ${reallyStuckMeetings.length} potentially stuck meetings`);
    return reallyStuckMeetings;
  } catch (error) {
    console.error('❌ Error checking for stuck meetings:', error);
    return [];
  }
};