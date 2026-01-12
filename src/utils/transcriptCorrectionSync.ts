import { supabase } from "@/integrations/supabase/client";

/**
 * Silently sync find/replace corrections to all backend transcription tables
 * for a given meeting. Runs in background without blocking UI.
 */
export async function syncTranscriptCorrections(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<{ success: boolean; tablesUpdated: number; recordsUpdated: number }> {
  if (!meetingId || !finds.length || !replaceWith) {
    return { success: false, tablesUpdated: 0, recordsUpdated: 0 };
  }

  console.log(`[TranscriptSync] Starting sync for meeting ${meetingId}`, { finds, replaceWith });

  const results = await Promise.allSettled([
    updateMeetingTranscripts(meetingId, finds, replaceWith),
    updateMeetingTranscriptionChunks(meetingId, finds, replaceWith),
    updateDeepgramTranscriptions(meetingId, finds, replaceWith),
    updateRawTranscriptChunks(meetingId, finds, replaceWith),
    updateTranscriptionChunks(meetingId, finds, replaceWith),
  ]);

  const successResults = results.filter(r => r.status === 'fulfilled' && (r.value as number) > 0);
  const totalRecords = results
    .filter(r => r.status === 'fulfilled')
    .reduce((sum, r) => sum + ((r as PromiseFulfilledResult<number>).value || 0), 0);

  console.log(`[TranscriptSync] Completed: ${successResults.length} tables updated, ${totalRecords} records modified`);

  return {
    success: successResults.length > 0,
    tablesUpdated: successResults.length,
    recordsUpdated: totalRecords
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyReplacements(text: string, finds: string[], replaceWith: string): string {
  let result = text;
  for (const find of finds) {
    const pattern = new RegExp(`\\b${escapeRegex(find)}\\b`, 'gi');
    result = result.replace(pattern, replaceWith);
  }
  return result;
}

/**
 * Update meeting_transcripts table
 */
async function updateMeetingTranscripts(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('meeting_transcripts')
      .select('id, content')
      .eq('meeting_id', meetingId);

    if (error || !data?.length) return 0;

    let updatedCount = 0;
    for (const record of data) {
      if (!record.content) continue;
      
      const updatedContent = applyReplacements(record.content, finds, replaceWith);
      if (updatedContent !== record.content) {
        const { error: updateError } = await supabase
          .from('meeting_transcripts')
          .update({ content: updatedContent })
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[TranscriptSync] meeting_transcripts: ${updatedCount} records updated`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[TranscriptSync] meeting_transcripts error:', err);
    return 0;
  }
}

/**
 * Update meeting_transcription_chunks table (transcription_text and cleaned_text)
 */
async function updateMeetingTranscriptionChunks(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('meeting_transcription_chunks')
      .select('id, transcription_text, cleaned_text')
      .eq('meeting_id', meetingId);

    if (error || !data?.length) return 0;

    let updatedCount = 0;
    for (const record of data) {
      const updates: Record<string, string> = {};
      
      if (record.transcription_text) {
        const updated = applyReplacements(record.transcription_text, finds, replaceWith);
        if (updated !== record.transcription_text) {
          updates.transcription_text = updated;
        }
      }
      
      if (record.cleaned_text) {
        const updated = applyReplacements(record.cleaned_text, finds, replaceWith);
        if (updated !== record.cleaned_text) {
          updates.cleaned_text = updated;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('meeting_transcription_chunks')
          .update(updates)
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[TranscriptSync] meeting_transcription_chunks: ${updatedCount} records updated`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[TranscriptSync] meeting_transcription_chunks error:', err);
    return 0;
  }
}

/**
 * Update deepgram_transcriptions table
 */
async function updateDeepgramTranscriptions(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('deepgram_transcriptions')
      .select('id, transcription_text')
      .eq('meeting_id', meetingId);

    if (error || !data?.length) return 0;

    let updatedCount = 0;
    for (const record of data) {
      if (!record.transcription_text) continue;
      
      const updated = applyReplacements(record.transcription_text, finds, replaceWith);
      if (updated !== record.transcription_text) {
        const { error: updateError } = await supabase
          .from('deepgram_transcriptions')
          .update({ transcription_text: updated })
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[TranscriptSync] deepgram_transcriptions: ${updatedCount} records updated`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[TranscriptSync] deepgram_transcriptions error:', err);
    return 0;
  }
}

/**
 * Update raw_transcript_chunks table
 */
async function updateRawTranscriptChunks(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('raw_transcript_chunks')
      .select('id, text')
      .eq('meeting_id', meetingId);

    if (error || !data?.length) return 0;

    let updatedCount = 0;
    for (const record of data) {
      if (!record.text) continue;
      
      const updated = applyReplacements(record.text, finds, replaceWith);
      if (updated !== record.text) {
        const { error: updateError } = await supabase
          .from('raw_transcript_chunks')
          .update({ text: updated })
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[TranscriptSync] raw_transcript_chunks: ${updatedCount} records updated`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[TranscriptSync] raw_transcript_chunks error:', err);
    return 0;
  }
}

/**
 * Update transcription_chunks table
 */
async function updateTranscriptionChunks(
  meetingId: string,
  finds: string[],
  replaceWith: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('transcription_chunks')
      .select('id, transcript_text')
      .eq('meeting_id', meetingId);

    if (error || !data?.length) return 0;

    let updatedCount = 0;
    for (const record of data) {
      if (!record.transcript_text) continue;
      
      const updated = applyReplacements(record.transcript_text, finds, replaceWith);
      if (updated !== record.transcript_text) {
        const { error: updateError } = await supabase
          .from('transcription_chunks')
          .update({ transcript_text: updated })
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[TranscriptSync] transcription_chunks: ${updatedCount} records updated`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[TranscriptSync] transcription_chunks error:', err);
    return 0;
  }
}
