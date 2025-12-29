import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  deleted_count: number;
  deleted_meeting_ids: string[];
  criteria: {
    min_age_hours: number;
    max_word_threshold: number;
  };
  timestamp: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional config from request body
    let minAgeHours = 24; // Default: 24 hours old
    let maxWordThreshold = 50; // Default: less than 50 words
    let dryRun = false;
    
    try {
      const body = await req.json();
      if (body.min_age_hours !== undefined) minAgeHours = body.min_age_hours;
      if (body.max_word_threshold !== undefined) maxWordThreshold = body.max_word_threshold;
      if (body.dry_run !== undefined) dryRun = body.dry_run;
    } catch {
      // No body or invalid JSON - use defaults
    }

    const minAgeMinutes = minAgeHours * 60;

    console.log(`🧹 Auto-cleanup starting with config:`, {
      minAgeHours,
      minAgeMinutes,
      maxWordThreshold,
      dryRun
    });

    // Find all users with potentially empty meetings
    const cutoffTime = new Date(Date.now() - minAgeMinutes * 60 * 1000).toISOString();
    
    // Get meetings that meet the criteria
    const { data: candidateMeetings, error: fetchError } = await supabase
      .from('meetings')
      .select('id, user_id, title, created_at, word_count, status')
      .lt('created_at', cutoffTime)
      .neq('status', 'recording')
      .or(`word_count.is.null,word_count.lte.${maxWordThreshold}`);

    if (fetchError) {
      console.error('Error fetching candidate meetings:', fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${candidateMeetings?.length || 0} candidate meetings to check`);

    const meetingsToDelete: string[] = [];
    const meetingsWithContent: string[] = [];

    // Check each meeting for actual transcript content
    for (const meeting of candidateMeetings || []) {
      // Get actual word count from transcript chunks
      const { data: actualWordCount, error: countError } = await supabase
        .rpc('get_actual_meeting_word_count', { p_meeting_id: meeting.id });

      if (countError) {
        console.error(`Error checking word count for ${meeting.id}:`, countError);
        continue;
      }

      const actualWords = actualWordCount || 0;
      
      if (actualWords <= maxWordThreshold) {
        meetingsToDelete.push(meeting.id);
        console.log(`🗑️ Marking for deletion: ${meeting.id} (${meeting.title}) - ${actualWords} actual words`);
      } else {
        meetingsWithContent.push(meeting.id);
        console.log(`✅ Keeping: ${meeting.id} (${meeting.title}) - ${actualWords} actual words (word_count field was ${meeting.word_count})`);
        
        // Sync the word_count field while we're here
        await supabase.rpc('sync_meeting_word_count', { p_meeting_id: meeting.id });
      }
    }

    let deletedCount = 0;
    const deletedIds: string[] = [];

    if (!dryRun && meetingsToDelete.length > 0) {
      // Delete in batches to avoid timeouts
      const batchSize = 50;
      for (let i = 0; i < meetingsToDelete.length; i += batchSize) {
        const batch = meetingsToDelete.slice(i, i + batchSize);
        
        const { data: deleted, error: deleteError } = await supabase
          .from('meetings')
          .delete()
          .in('id', batch)
          .select('id');

        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError);
          continue;
        }

        deletedCount += deleted?.length || 0;
        deletedIds.push(...(deleted?.map(d => d.id) || []));
      }

      console.log(`✅ Deleted ${deletedCount} empty meetings`);

      // Log the cleanup operation
      await supabase
        .from('system_audit_log')
        .insert({
          table_name: 'meetings',
          operation: 'AUTO_CLEANUP_EMPTY_MEETINGS',
          new_values: {
            deleted_count: deletedCount,
            deleted_ids: deletedIds,
            min_age_hours: minAgeHours,
            max_word_threshold: maxWordThreshold,
            candidates_checked: candidateMeetings?.length || 0,
            meetings_with_content_synced: meetingsWithContent.length
          }
        });
    } else if (dryRun) {
      console.log(`🔍 DRY RUN: Would delete ${meetingsToDelete.length} meetings`);
    }

    const result: CleanupResult = {
      success: true,
      deleted_count: dryRun ? 0 : deletedCount,
      deleted_meeting_ids: dryRun ? [] : deletedIds,
      criteria: {
        min_age_hours: minAgeHours,
        max_word_threshold: maxWordThreshold
      },
      timestamp: new Date().toISOString()
    };

    if (dryRun) {
      (result as any).dry_run = true;
      (result as any).would_delete_count = meetingsToDelete.length;
      (result as any).would_delete_ids = meetingsToDelete;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in auto-cleanup:', error);
    
    const result: CleanupResult = {
      success: false,
      deleted_count: 0,
      deleted_meeting_ids: [],
      criteria: { min_age_hours: 24, max_word_threshold: 50 },
      timestamp: new Date().toISOString(),
      error: error.message
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
