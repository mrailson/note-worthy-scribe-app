import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔧 complete-stuck-meeting: processing ${meetingId}`);

    // Fetch meeting state
    const { data: meeting, error: fetchErr } = await supabase
      .from("meetings")
      .select("id, title, notes_generation_status, notes_email_sent_at, word_count, user_id")
      .eq("id", meetingId)
      .single();

    if (fetchErr || !meeting) {
      console.error("Meeting not found:", fetchErr);
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const steps: string[] = [];

    // Step 1: Generate title + notes if missing
    const needsNotes =
      !meeting.notes_generation_status ||
      meeting.notes_generation_status === "not_started" ||
      meeting.notes_generation_status === "failed";

    const hasDefaultTitle = /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i.test(meeting.title || "");
    const needsTitle = !meeting.title || hasDefaultTitle;

    if (needsNotes || needsTitle) {
      console.log(`📝 Generating notes/title for ${meetingId}`);
      const notesResp = await fetch(`${supabaseUrl}/functions/v1/auto-generate-meeting-notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({ meetingId }),
      });

      const notesText = await notesResp.text();
      if (!notesResp.ok) {
        console.error(`auto-generate-meeting-notes failed (${notesResp.status}): ${notesText}`);
        return new Response(JSON.stringify({ error: "Notes generation failed", detail: notesText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      steps.push("notes_generated");
      console.log(`✅ Notes generated for ${meetingId}`);

      // Wait for notes to settle
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      steps.push("notes_already_complete");
    }

    // Step 2: Send email via deliver-mobile-meeting-email (the proper branded email with Word attachment)
    // Re-check notes_email_sent_at right before sending (dedup guard)
    const { data: updated } = await supabase
      .from("meetings")
      .select("notes_email_sent_at")
      .eq("id", meetingId)
      .single();

    if (updated?.notes_email_sent_at) {
      console.log(`⏭️ Email already sent at ${updated.notes_email_sent_at}, skipping`);
      steps.push("email_already_sent");
    } else {
      // Set notes_email_sent_at BEFORE sending to prevent race condition duplicates
      const lockTime = new Date().toISOString();
      await supabase
        .from("meetings")
        .update({ notes_email_sent_at: lockTime })
        .eq("id", meetingId);

      console.log(`📧 Calling deliver-mobile-meeting-email for ${meetingId}`);

      try {
        const emailResp = await fetch(`${supabaseUrl}/functions/v1/deliver-mobile-meeting-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            apikey: serviceKey,
          },
          body: JSON.stringify({ meetingId }),
        });

        const emailResult = await emailResp.text();
        if (!emailResp.ok) {
          console.warn(`deliver-mobile-meeting-email failed (${emailResp.status}): ${emailResult}`);
          // Clear the lock so it can be retried
          await supabase
            .from("meetings")
            .update({ notes_email_sent_at: null })
            .eq("id", meetingId);
          steps.push("email_failed");
        } else {
          steps.push("email_sent");
          console.log(`✅ Branded email sent for ${meetingId}`);
        }
      } catch (emailErr) {
        console.error(`❌ Email send crashed:`, emailErr);
        // Clear the lock so it can be retried
        await supabase
          .from("meetings")
          .update({ notes_email_sent_at: null })
          .eq("id", meetingId);
        steps.push("email_failed");
      }
    }

    return new Response(JSON.stringify({ success: true, meetingId, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ complete-stuck-meeting error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
