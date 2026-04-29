import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
      .select("id, title, notes_generation_status, notes_email_sent_at, word_count, user_id, start_time, duration_minutes, best_of_all_transcript, live_transcript_text, assembly_transcript_text, whisper_transcript_text")
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

    const { data: existingSummary } = await supabase
      .from("meeting_summaries")
      .select("summary")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    let transcript =
      meeting.best_of_all_transcript ||
      meeting.live_transcript_text ||
      meeting.assembly_transcript_text ||
      meeting.whisper_transcript_text ||
      "";

    if (!transcript.trim()) {
      const { data: chunks, error: chunkError } = await supabase
        .from("meeting_transcription_chunks")
        .select("chunk_number, cleaned_text, cleaning_status, transcription_text, word_count")
        .eq("meeting_id", meetingId)
        .order("chunk_number");

      if (chunkError) {
        console.warn("⚠️ Could not fetch transcript chunks:", chunkError);
      }

      const chunkTexts = (chunks || [])
        .map((chunk: any) => {
          if (chunk.cleaned_text && chunk.cleaning_status === "completed") return chunk.cleaned_text;
          try {
            const parsed = JSON.parse(chunk.transcription_text || "");
            if (Array.isArray(parsed)) return parsed.map((seg: any) => seg.text || "").join(" ");
            return typeof parsed === "string" ? parsed : chunk.transcription_text;
          } catch {
            return chunk.transcription_text || "";
          }
        })
        .map((text: string) => text.trim())
        .filter(Boolean);

      if (chunkTexts.length > 0) {
        transcript = chunkTexts.join("\n\n");
        const wordCount = transcript.split(/\s+/).filter(Boolean).length;
        await supabase
          .from("meetings")
          .update({
            whisper_transcript_text: transcript,
            word_count: wordCount,
            primary_transcript_source: "consolidated",
            updated_at: new Date().toISOString(),
          })
          .eq("id", meetingId);
        steps.push("chunks_consolidated");
      }
    }

    // Step 1: Generate title + notes if missing or stuck mid-generation
    const needsNotes =
      !existingSummary?.summary ||
      meeting.notes_generation_status !== "completed";

    const hasDefaultTitle = /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i.test(meeting.title || "");
    const needsTitle = !meeting.title || hasDefaultTitle;

    if (needsNotes || needsTitle) {
      console.log(`📝 Generating notes/title for ${meetingId} (needsNotes=${needsNotes}, needsTitle=${needsTitle})`);
      if (!transcript.trim()) {
        return new Response(JSON.stringify({ error: "No transcript available for notes generation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("meetings")
        .update({ notes_generation_status: "generating", updated_at: new Date().toISOString() })
        .eq("id", meetingId);

      const notesResp = await fetch(`${supabaseUrl}/functions/v1/generate-meeting-notes-claude`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({
          meetingId,
          transcript,
          meetingTitle: meeting.title,
          meetingDate: meeting.start_time ? new Date(meeting.start_time).toLocaleDateString("en-GB") : undefined,
          meetingTime: meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : undefined,
          meetingDuration: meeting.duration_minutes,
          modelOverride: "claude-sonnet-4-6",
          skipQc: true,
        }),
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

      // Wait for title + notes to fully settle in DB before proceeding to email
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify the title was actually updated
      const { data: postNotes } = await supabase
        .from("meetings")
        .select("title")
        .eq("id", meetingId)
        .single();
      console.log(`📋 Post-generation title: "${postNotes?.title}"`);
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

    const { error: queueUpdateError } = await supabase
      .from("meeting_notes_queue")
      .update({ status: "completed", error_message: null, updated_at: new Date().toISOString() })
      .eq("meeting_id", meetingId)
      .in("status", ["pending", "processing"]);

    if (queueUpdateError) {
      console.warn("⚠️ Could not mark queue entries completed:", queueUpdateError);
    } else {
      steps.push("queue_marked_completed");
    }

    const { error: meetingUpdateError } = await supabase
      .from("meetings")
      .update({
        status: "completed",
        notes_generation_status: "completed",
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", meetingId);

    if (meetingUpdateError) {
      console.warn("⚠️ Could not finalise meeting status:", meetingUpdateError);
    } else {
      steps.push("meeting_marked_completed");
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
