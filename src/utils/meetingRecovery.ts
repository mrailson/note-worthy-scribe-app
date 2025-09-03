import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility to recover stuck meetings that failed to transition to completed status
 */
export const recoverStuckMeeting = async (meetingId: string) => {
  try {
    console.log(`🔄 Starting recovery process for meeting: ${meetingId}`);
    
    // Use the new database function for safe completion
    const { data, error } = await supabase.rpc('complete_meeting', {
      meeting_id: meetingId
    });

    console.log('📊 Complete meeting result:', { data, error });

    if (error) {
      console.error('❌ RPC function error:', error);
      toast.error(`Database error: ${error.message}`);
      return false;
    }

    // Type assertion for the JSON response from our database function
    const result = data as { success: boolean; error?: string; meeting?: any } | null;

    if (!result || !result.success) {
      console.error('❌ Meeting completion failed:', result?.error);
      toast.error(result?.error || 'Unknown error completing meeting');
      return false;
    }

    console.log('✅ Successfully completed meeting:', result.meeting);
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