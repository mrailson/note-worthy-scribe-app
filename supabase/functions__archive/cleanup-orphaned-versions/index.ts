import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting cleanup of orphaned meeting note versions...');

    // Delete versions older than 24 hours for meetings that are completed or failed
    const { data: deletedVersions, error: deleteError } = await supabase
      .from('live_meeting_notes_versions')
      .delete()
      .in('meeting_id', 
        supabase
          .from('meetings')
          .select('id')
          .in('status', ['completed', 'failed'])
      )
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (deleteError) {
      console.error('Error deleting completed meeting versions:', deleteError);
      throw deleteError;
    }

    // Also cleanup very old versions (7+ days) regardless of meeting status
    const { data: oldVersions, error: oldError } = await supabase
      .from('live_meeting_notes_versions')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (oldError) {
      console.error('Error deleting old versions:', oldError);
      throw oldError;
    }

    const totalCleaned = (deletedVersions?.length || 0) + (oldVersions?.length || 0);

    console.log(`Cleanup completed. Removed ${totalCleaned} orphaned versions.`);

    return new Response(JSON.stringify({
      success: true,
      cleanedVersions: totalCleaned,
      completedMeetingVersions: deletedVersions?.length || 0,
      oldVersions: oldVersions?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in cleanup-orphaned-versions:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});