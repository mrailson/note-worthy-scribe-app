import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility to recover stuck meetings that failed to transition to completed status
 */
export const recoverStuckMeeting = async (meetingId: string) => {
  try {
    console.log(`🔄 Starting recovery process for meeting: ${meetingId}`);
    
    // Direct update approach - bypass the problematic RPC function
    const { data, error } = await supabase
      .from('meetings')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString(),
        end_time: new Date().toISOString()
      })
      .eq('id', meetingId)
      .select()
      .single();

    console.log('📊 Direct update result:', { data, error });

    if (error) {
      console.error('❌ Direct update error:', error);
      toast.error(`Database error: ${error.message}`);
      return false;
    }

    if (!data) {
      console.error('❌ No meeting found to update');
      toast.error('Meeting not found or access denied');
      return false;
    }

    console.log('✅ Successfully completed meeting:', data);
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