import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Manually trigger auto note generation for a meeting that got stuck.
 * This is useful when the automatic trigger fails during recording stop.
 * 
 * Enhanced: Also triggers title generation if the meeting still has a
 * generic default title (e.g. "Meeting - Mon, 14th April 2026 (2:30pm)").
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
    
    // Safety net: explicitly trigger title generation if still generic
    await ensureMeetingTitle(meetingId);
    
    toast.success('Meeting notes generation started successfully!');
    return true;
  } catch (error) {
    console.error('❌ Critical error in manual note trigger:', error);
    toast.error('Failed to trigger note generation manually');
    return false;
  }
}

/**
 * Check if a meeting still has a generic/default title and regenerate if so.
 * The auto-generate-meeting-notes edge function calls generate-meeting-title
 * internally, but this acts as a safety net if that step fails silently.
 */
export async function ensureMeetingTitle(meetingId: string) {
  try {
    // Fetch current title
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('title')
      .eq('id', meetingId)
      .single();

    if (fetchError || !meeting) {
      console.warn('⚠️ Could not fetch meeting for title check:', fetchError?.message);
      return;
    }

    // Check if title is still a generic default
    const genericPatterns = [
      /^Meeting\s*-\s*\w{3},/i,                    // "Meeting - Mon, 14th..."
      /^Meeting\s*-\s*\w+day/i,                     // "Meeting - Monday..."
      /^Meeting\s*-\s*\d{1,2}(st|nd|rd|th)/i,      // "Meeting - 14th..."
      /^New\s+Meeting/i,
      /^Untitled/i,
      /^Meeting\s+\d+$/i,
      /^Meeting$/i,
    ];

    const isGeneric = genericPatterns.some(p => p.test(meeting.title?.trim() || ''));

    if (!isGeneric) {
      console.log('✅ Meeting already has a descriptive title:', meeting.title);
      return;
    }

    console.log('🏷️ Title is generic, triggering title generation:', meeting.title);

    // Get transcript for title generation
    const { data: transcriptData } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    const transcript = transcriptData?.[0]?.transcript;
    if (!transcript || transcript.trim().length < 50) {
      console.warn('⚠️ No transcript available for title generation');
      return;
    }

    // Call generate-meeting-title
    const { data: titleResult, error: titleError } = await supabase.functions.invoke(
      'generate-meeting-title',
      {
        body: {
          transcript: transcript.substring(0, 10000), // First 10K chars is enough
          currentTitle: meeting.title,
          meetingId: meetingId
        }
      }
    );

    if (titleError) {
      console.warn('⚠️ Title generation failed:', titleError.message);
      return;
    }

    if (titleResult?.title && titleResult.title !== meeting.title) {
      // Update the meeting title
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ title: titleResult.title })
        .eq('id', meetingId);

      if (updateError) {
        console.warn('⚠️ Failed to update meeting title:', updateError.message);
      } else {
        console.log('✅ Meeting title updated:', titleResult.title);
      }
    }
  } catch (err) {
    console.warn('⚠️ ensureMeetingTitle error (non-fatal):', err);
  }
}
