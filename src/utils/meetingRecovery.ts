import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility to recover stuck meetings that failed to transition to completed status
 */
export const recoverStuckMeeting = async (meetingId: string) => {
  try {
    console.log(`🔄 Starting recovery process for meeting: ${meetingId}`);
    
    // Get current user first
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Authentication error:', userError);
      toast.error('Authentication required');
      return false;
    }
    console.log('👤 Current user:', user.id);

    // Get meeting details with user filter to ensure RLS compliance
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, status, user_id, created_at')
      .eq('id', meetingId)
      .eq('user_id', user.id)  // Add user filter for RLS
      .single();

    console.log('📊 Meeting data:', meeting);
    console.log('📊 Meeting error:', meetingError);

    if (meetingError) {
      console.error('❌ Failed to fetch meeting:', meetingError);
      toast.error(`Meeting error: ${meetingError.message}`);
      return false;
    }

    if (!meeting) {
      console.error('❌ Meeting not found or not accessible');
      toast.error('Meeting not found or you do not have permission to access it');
      return false;
    }

    // Check if meeting is not already completed
    if (meeting.status === 'completed') {
      console.log('ℹ️ Meeting is already completed');
      toast.info('Meeting is already completed');
      return false;
    }

    console.log(`📊 Meeting current status: ${meeting.status} - proceeding with completion...`);

    // Update meeting status with user context for RLS
    console.log('🔄 Updating meeting status to completed...');
    const { data: updateData, error: updateError } = await supabase
      .from('meetings')
      .update({ status: 'completed' })
      .eq('id', meetingId)
      .eq('user_id', user.id)  // Include user filter in update for RLS
      .select('id, status');

    console.log('📊 Update result data:', updateData);
    console.log('📊 Update result error:', updateError);

    if (updateError) {
      console.error('❌ Failed to update meeting status:', updateError);
      toast.error(`Failed to update meeting: ${updateError.message || 'Unknown error'}`);
      return false;
    }

    if (!updateData || updateData.length === 0) {
      console.error('❌ No meeting was updated');
      toast.error('No meeting was updated - check permissions');
      return false;
    }

    console.log('✅ Successfully updated meeting status:', updateData[0]);
    toast.success('Meeting marked as completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Critical error in meeting recovery:', error);
    toast.error(`Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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