import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

/**
 * Utility to recover stuck meetings that failed to transition to completed status
 */
export const recoverStuckMeeting = async (meetingId: string) => {
  try {
    console.log(`🔄 Starting recovery process for meeting: ${meetingId}`);
    
    // Check if user is authenticated first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast.error('User not authenticated');
      return false;
    }

    console.log(`👤 User authenticated: ${user.id}`);
    
    // Direct update approach with better error handling
    const { data, error } = await supabase
      .from('meetings')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString(),
        end_time: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', user.id) // Ensure user can only update their own meetings
      .select()
      .single();

    console.log('📊 Direct update result:', { data, error });

    if (error) {
      console.error('❌ Direct update error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // If RLS is blocking, try a different approach - call an edge function
      console.log('🔄 Trying alternative approach via edge function...');
      
      const { data: funcData, error: funcError } = await supabase.functions.invoke('force-complete-meeting', {
        body: { meetingId, userId: user.id }
      });
      
      if (funcError) {
        console.error('❌ Edge function error:', funcError);
        showToast.error(`Failed to complete meeting: ${error.message}`);
        return false;
      }
      
      if (funcData?.success) {
        console.log('✅ Meeting completed via edge function');
        showToast.success('Meeting marked as completed successfully!', { section: 'meeting_manager' });
        return true;
      } else {
        showToast.error(funcData?.error || 'Failed to complete meeting');
        return false;
      }
    }

    if (!data) {
      console.error('❌ No meeting found to update or access denied');
      showToast.error('Meeting not found or access denied');
      return false;
    }

    console.log('✅ Successfully completed meeting:', data);
    showToast.success('Meeting marked as completed successfully!', { section: 'meeting_manager' });
    return true;

  } catch (error) {
    console.error('❌ Critical error in meeting recovery:', error);
    showToast.error(`Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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