import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

/**
 * auto-process-stuck-meetings
 * 
 * Batch processor that finds meetings stuck in 'processing' or 'transcribing'
 * state for >15 minutes and invokes complete-stuck-meeting for each one.
 * 
 * Safety: max 50 meetings per run to prevent runaway loops.
 * Scheduled via pg_cron every 10 minutes.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MEETINGS_PER_RUN = 50;
const STUCK_THRESHOLD_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const runTimestamp = new Date().toISOString();
  console.log(`🔍 [${runTimestamp}] auto-process-stuck-meetings: starting scan`);

  try {
    // Find meetings stuck in processing/transcribing for >15 minutes
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: stuckMeetings, error: queryErr } = await supabase
      .from("meetings")
      .select("id, title, status, updated_at")
      .in("status", ["processing", "transcribing"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_MEETINGS_PER_RUN);

    if (queryErr) {
      console.error(`❌ [${runTimestamp}] Query error:`, queryErr.message);
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const found = stuckMeetings?.length ?? 0;

    if (found === 0) {
      console.log(`✅ [${runTimestamp}] No stuck meetings found. Exiting.`);
      return new Response(JSON.stringify({
        timestamp: runTimestamp,
        found: 0,
        processed: 0,
        failed: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`⚠️ [${runTimestamp}] Found ${found} stuck meeting(s)`);

    let processed = 0;
    let failed = 0;

    for (const meeting of stuckMeetings!) {
      try {
        console.log(`  → Processing ${meeting.id} ("${meeting.title}", status=${meeting.status}, updated=${meeting.updated_at})`);

        const resp = await fetch(`${supabaseUrl}/functions/v1/complete-stuck-meeting`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            apikey: serviceKey,
          },
          body: JSON.stringify({ meetingId: meeting.id }),
        });

        if (resp.ok) {
          processed++;
          console.log(`  ✅ ${meeting.id} processed successfully`);
        } else {
          failed++;
          const errText = await resp.text();
          console.error(`  ❌ ${meeting.id} failed (${resp.status}): ${errText}`);
        }
      } catch (err) {
        failed++;
        console.error(`  ❌ ${meeting.id} exception:`, err instanceof Error ? err.message : String(err));
      }
    }

    console.log(`📊 [${runTimestamp}] Run complete — found: ${found}, processed: ${processed}, failed: ${failed}`);

    return new Response(JSON.stringify({
      timestamp: runTimestamp,
      found,
      processed,
      failed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`❌ [${runTimestamp}] Fatal error:`, err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
