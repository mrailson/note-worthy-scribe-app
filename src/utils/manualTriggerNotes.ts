import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Manually trigger auto note generation for a meeting that got stuck
 * This is useful when the automatic trigger fails during recording stop
 */
export async function manualTriggerAutoNotes(meetingId: string) {
  try {
    console.log(`🔄 Manually triggering auto-note generation for meeting: ${meetingId}`);
    
    // Call the auto-generate-meeting-notes edge function directly
    const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
      body: { 
        meetingId: meetingId,
        forceRegenerate: false // Don't force if notes already exist
      }
    });

    if (error) {
      console.error('❌ Manual note generation failed:', error);
      toast.error(`Failed to generate notes: ${error.message || 'Unknown error'}`);
      return false;
    }

    console.log('✅ Manual note generation successful:', data);
    toast.success('Meeting notes generation started successfully!');
    return true;
  } catch (error) {
    console.error('❌ Critical error in manual note trigger:', error);
    toast.error('Failed to trigger note generation manually');
    return false;
  }
}