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
      .select("id, title, notes_generation_status, notes_email_sent_at, word_count, user_id, created_at, duration_minutes, notes_style_3")
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

    // Step 2: Send email if not yet sent
    // Re-fetch to get latest state after notes generation
    const { data: updated } = await supabase
      .from("meetings")
      .select("notes_email_sent_at, user_id, title, created_at, duration_minutes, word_count, notes_style_3")
      .eq("id", meetingId)
      .single();

    if (!updated?.notes_email_sent_at) {
      console.log(`📧 Composing and sending email for ${meetingId}`);

      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", updated?.user_id || meeting.user_id)
        .single();

      const userEmail = profileData?.email;
      const userName = profileData?.full_name || "there";

      if (!userEmail) {
        // Fallback to auth
        const { data: userData } = await supabase.auth.admin.getUserById(updated?.user_id || meeting.user_id);
        const fallbackEmail = userData?.user?.email;
        if (!fallbackEmail) {
          console.warn(`No email found for user ${meeting.user_id}`);
          steps.push("no_user_email");
          return new Response(JSON.stringify({ success: true, meetingId, steps }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const emailTo = userEmail || (await (async () => {
        const { data: u } = await supabase.auth.admin.getUserById(updated?.user_id || meeting.user_id);
        return u?.user?.email || "";
      })());

      if (!emailTo) {
        steps.push("no_user_email");
        return new Response(JSON.stringify({ success: true, meetingId, steps }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch notes content
      const { data: summaryData } = await supabase
        .from("meeting_summaries")
        .select("summary")
        .eq("meeting_id", meetingId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const notesContent = summaryData?.summary || updated?.notes_style_3 || "";
      const cleanedNotesContent = notesContent
        .replace(/\\\*/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*\*/g, "")
        .replace(/═+/g, "")
        .trim();

      const meetingTitle = updated?.title || meeting.title || "Untitled Meeting";
      const meetingDate = new Date(updated?.created_at || meeting.created_at).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const durMins = updated?.duration_minutes || meeting.duration_minutes || 0;
      const durationText = durMins
        ? `${Math.floor(durMins / 60)}h ${durMins % 60}m`
        : "Unknown duration";

      const wordCount = updated?.word_count || meeting.word_count || 0;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: #1a56db; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Your Meeting Notes Are Ready</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; margin: 0 0 16px;">Hi ${userName},</p>
            <p style="color: #374151; margin: 0 0 16px;">
              Your meeting <strong>"${meetingTitle}"</strong> has been completed and your AI-generated minutes are ready.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">📅 ${meetingDate}</p>
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">⏱️ Duration: ${durationText}</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">📝 Words: ${wordCount.toLocaleString()}</p>
            </div>
            ${cleanedNotesContent ? `
              <div style="margin: 24px 0;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 12px;">Meeting Minutes</h2>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #374151;">
${cleanedNotesContent}
                </div>
              </div>
            ` : `
              <p style="color: #6b7280; font-style: italic;">Notes are still being generated. Please check the app in a few minutes.</p>
            `}
            <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
              This email was sent by Notewell AI. You can view and edit your meeting notes in the app.
            </p>
          </div>
        </div>
      `;

      const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-meeting-email-resend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          apikey: serviceKey,
        },
        body: JSON.stringify({
          to_email: emailTo,
          subject: `Meeting Notes: ${meetingTitle} — ${meetingDate}`,
          html_content: htmlContent,
        }),
      });

      const emailText = await emailResp.text();
      if (!emailResp.ok) {
        console.warn(`send-meeting-email-resend failed (${emailResp.status}): ${emailText}`);
        steps.push("email_failed");
      } else {
        // Mark email as sent
        await supabase
          .from("meetings")
          .update({ notes_email_sent_at: new Date().toISOString() })
          .eq("id", meetingId);

        steps.push("email_sent");
        console.log(`✅ Email sent for ${meetingId} to ${emailTo}`);
      }
    } else {
      steps.push("email_already_sent");
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
