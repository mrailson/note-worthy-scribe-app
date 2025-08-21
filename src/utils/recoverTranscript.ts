import { supabase } from "@/integrations/supabase/client";

export async function recoverMeetingTranscript(meetingId: string) {
  try {
    console.log('🔄 Calling recovery function for meeting:', meetingId);
    
    const { data, error } = await supabase.functions.invoke('recover-meeting-transcript', {
      body: { meetingId }
    });

    if (error) {
      console.error('Recovery function error:', error);
      throw error;
    }

    console.log('✅ Recovery result:', data);
    return data;
    
  } catch (error) {
    console.error('Error calling recovery function:', error);
    throw error;
  }
}