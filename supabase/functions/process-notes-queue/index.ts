import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * process-notes-queue
 * 
 * Server-side queue processor that runs on a cron schedule (every 2 minutes).
 * Picks up pending entries from meeting_notes_queue and triggers
 * auto-generate-meeting-notes for each one.
 * 
 * This is the critical fix: the existing DB trigger inserts into the queue
 * and sends pg_notify, but nothing was listening. This function IS the listener.
 * 
 * It also handles:
 * - Stale "generating" entries (stuck for >10 minutes → reset to pending)
 * - Retry logic (max 3 attempts)
 * - Meetings with status='completed' but notes_generation_status='not_started'
 *   (the "fallen through the cracks" case)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = {
    processed: 0,
    skipped: 0,
    failed: 0,
    recovered: 0,
    orphans_queued: 0,
    details: [] as string[],
  };

  try {
    // ─── PHASE 1: Reset stale "generating" entries ───────────────────
    // If a meeting has been stuck in "processing" for >10 minutes,
    // the edge function probably timed out or crashed. Reset it.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: staleEntries, error: staleError } = await supabase
      .from('meeting_notes_queue')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString(),
        error_message: 'Reset by queue processor — previous attempt stale (>10min)'
      })
      .eq('status', 'processing')
      .lt('updated_at', tenMinutesAgo)
      .select('meeting_id');

    if (!staleError && staleEntries && staleEntries.length > 0) {
      results.recovered = staleEntries.length;
      results.details.push(`Reset ${staleEntries.length} stale entries`);
      
      // Also reset the meeting status
      for (const entry of staleEntries) {
        await supabase
          .from('meetings')
          .update({ notes_generation_status: 'queued' })
          .eq('id', entry.meeting_id);
      }
    }

    // ─── PHASE 2: Find orphan meetings ───────────────────────────────
    // Meetings that are completed but have no notes and no queue entry.
    // These fell through the cracks (client died before backgroundProcessing ran).
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: orphanMeetings, error: orphanError } = await supabase
      .from('meetings')
      .select('id, title, notes_generation_status')
      .eq('status', 'completed')
      .in('notes_generation_status', ['not_started', 'queued', 'failed'])
      .lt('updated_at', fiveMinutesAgo)  // Give the client 5 min to handle it
      .order('updated_at', { ascending: true })
      .limit(5);  // Process max 5 orphans per run to avoid overloading

    if (!orphanError && orphanMeetings && orphanMeetings.length > 0) {
      for (const meeting of orphanMeetings) {
        // Check if notes already exist (edge case: status not updated)
        const { data: existingNotes } = await supabase
          .from('meeting_summaries')
          .select('id')
          .eq('meeting_id', meeting.id)
          .maybeSingle();

        if (existingNotes) {
          // Notes exist but status wasn't updated — fix it
          await supabase
            .from('meetings')
            .update({ notes_generation_status: 'completed' })
            .eq('id', meeting.id);
          results.details.push(`Fixed status for ${meeting.id} (notes existed)`);
          continue;
        }

        // Check if there's transcript content
        const { count: chunkCount } = await supabase
          .from('meeting_transcription_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_id', meeting.id);

        if (!chunkCount || chunkCount === 0) {
          // Also check meeting_transcripts
          const { count: transcriptCount } = await supabase
            .from('meeting_transcripts')
            .select('*', { count: 'exact', head: true })
            .eq('meeting_id', meeting.id);

          if (!transcriptCount || transcriptCount === 0) {
            results.details.push(`Skipped orphan ${meeting.id} — no transcript`);
            continue;
          }
        }

        // Queue this orphan for processing
        await supabase
          .from('meeting_notes_queue')
          .upsert({
            meeting_id: meeting.id,
            status: 'pending',
            detail_level: 'standard',
            priority: 0,
            error_message: 'Queued by queue processor — orphan recovery',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'meeting_id' });

        await supabase
          .from('meetings')
          .update({ notes_generation_status: 'queued' })
          .eq('id', meeting.id);

        results.orphans_queued++;
        results.details.push(`Queued orphan: ${meeting.id} (${meeting.title})`);
      }
    }

    // ─── PHASE 3: Process pending queue entries ──────────────────────
    const { data: pendingEntries, error: queueError } = await supabase
      .from('meeting_notes_queue')
      .select('id, meeting_id, detail_level, retry_count, note_type')
      .eq('status', 'pending')
      .lt('retry_count', 3)  // Max 3 retries
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(3);  // Process max 3 per run (edge functions have time limits)

    if (queueError) {
      console.error('❌ Error fetching queue:', queueError);
      throw queueError;
    }

    if (!pendingEntries || pendingEntries.length === 0) {
      console.log('ℹ️ No pending entries in queue');
      return new Response(
        JSON.stringify({ ...results, message: 'No pending entries' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processing ${pendingEntries.length} queue entries`);

    for (const entry of pendingEntries) {
      try {
        // Mark as processing
        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            retry_count: (entry.retry_count || 0) + 1,
          })
          .eq('id', entry.id);

        console.log(`🔄 Processing meeting: ${entry.meeting_id}`);

        // Call auto-generate-meeting-notes (the same edge function the client calls)
        const response = await fetch(`${supabaseUrl}/functions/v1/auto-generate-meeting-notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId: entry.meeting_id,
            forceRegenerate: false,
            modelOverride: 'claude-sonnet-4-6',
            skipQc: false,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || `HTTP ${response.status}`);
        }

        if (responseData.skipped) {
          console.log(`⏭️ Skipped ${entry.meeting_id}: ${responseData.message}`);
          results.skipped++;
          results.details.push(`Skipped ${entry.meeting_id}: ${responseData.message}`);
          
          // Mark as completed (notes already exist or no transcript yet)
          await supabase
            .from('meeting_notes_queue')
            .update({ 
              status: responseData.message?.includes('no transcript') ? 'pending' : 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id);
        } else {
          console.log(`✅ Generated notes for ${entry.meeting_id}`);
          results.processed++;
          results.details.push(`Generated notes for ${entry.meeting_id}`);

          // Mark as completed
          await supabase
            .from('meeting_notes_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id);
        }

      } catch (entryError: any) {
        console.error(`❌ Failed to process ${entry.meeting_id}:`, entryError.message);
        results.failed++;
        results.details.push(`Failed ${entry.meeting_id}: ${entryError.message}`);

        // Mark as failed (will be retried if under max_attempts)
        const newRetryCount = (entry.retry_count || 0) + 1;
        await supabase
          .from('meeting_notes_queue')
          .update({
            status: newRetryCount >= 3 ? 'failed' : 'pending',
            error_message: entryError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        // Update meeting status to failed if max retries reached
        if (newRetryCount >= 3) {
          await supabase
            .from('meetings')
            .update({ notes_generation_status: 'failed' })
            .eq('id', entry.meeting_id);
        }
      }
    }

    console.log('✅ Queue processing complete:', results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Queue processor error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, ...results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
