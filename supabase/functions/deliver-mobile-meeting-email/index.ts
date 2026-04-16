import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { buildProfessionalMeetingEmail } from "../_shared/meetingEmailBuilder.ts";
import { generateMeetingDocxBase64, generateMeetingFilename } from "../_shared/generateMeetingDocx.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { meetingId } = await req.json();

    if (!meetingId || typeof meetingId !== "string") {
      return new Response(
        JSON.stringify({ error: "meetingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 deliver-mobile-meeting-email: processing meeting ${meetingId}`);

    // 1. Fetch meeting row (all fields needed for email)
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .select("id, user_id, title, import_source, notes_email_sent_at, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingErr) throw meetingErr;
    if (!meeting) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "meeting_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: skip if already sent
    if (meeting.notes_email_sent_at) {
      console.log(`⏭️ Email already sent at ${meeting.notes_email_sent_at}, skipping`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Look up user email from auth.users (service role)
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(meeting.user_id);

    if (authErr) {
      console.warn(`⚠️ Could not look up auth user: ${authErr.message}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = authUser?.user?.email;
    if (!userEmail) {
      console.warn(`⚠️ No email found for user ${meeting.user_id}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 Delivering notes to ${userEmail} for meeting "${meeting.title}"`);

    // 3. Fetch meeting summary
    const { data: summary } = await supabase
      .from("meeting_summaries")
      .select("summary")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!summary?.summary) {
      console.warn("⚠️ No summary found for meeting");
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_summary" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch sender name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", meeting.user_id)
      .maybeSingle();

    const senderName = profile?.full_name || userEmail.split("@")[0] || "Notewell AI";

    // 5. Build dates (matching desktop flow exactly)
    // If the title is still a generic placeholder, try to generate one from the transcript
    let meetingTitle = meeting.title || "Meeting Notes";
    const GENERIC_TITLES = ["mobile recording", "meeting", "new meeting", "untitled meeting", "untitled"];
    if (GENERIC_TITLES.includes(meetingTitle.toLowerCase().trim())) {
      console.log("⚠️ Title is generic, attempting AI title generation...");
      try {
        const { data: titleResult } = await supabase.functions.invoke("generate-meeting-title", {
          body: { meetingId: meeting.id, currentTitle: meetingTitle },
        });
        if (titleResult?.title && !GENERIC_TITLES.includes(titleResult.title.toLowerCase().trim())) {
          meetingTitle = titleResult.title;
          await supabase.from("meetings").update({ title: meetingTitle }).eq("id", meeting.id);
          console.log("✅ Generated title for email:", meetingTitle);
        }
      } catch (titleErr) {
        console.warn("⚠️ Title generation failed, using fallback:", titleErr);
      }
    }

    const meetingDate = meeting.start_time
      ? new Date(meeting.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const meetingTime = meeting.start_time
      ? new Date(meeting.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " GMT"
      : undefined;

    const subject = `Notewell AI | ${meetingTitle} — ${meetingDate}`;

    // 6. Build HTML email (identical to desktop via buildProfessionalMeetingEmail)
    const htmlContent = buildProfessionalMeetingEmail(
      summary.summary,
      senderName,
      meetingTitle,
      {
        date: meetingDate,
        time: meetingTime,
        duration: meeting.duration_minutes,
        format: meeting.meeting_format,
        location: meeting.meeting_location,
        overview: meeting.overview,
        wordCount: meeting.word_count,
        attendees: Array.isArray(meeting.participants) ? meeting.participants : [],
      }
    );

    // 7. Generate Word attachment (with graceful fallback)
    let wordAttachment: { content: string; filename: string; type: string } | null = null;
    try {
      // Fetch action items for the Word doc
      let actionItems: any[] = [];
      try {
        const { data: actionItemsData } = await supabase
          .from("meeting_action_items")
          .select("action_text, assignee_name, due_date, priority, status")
          .eq("meeting_id", meetingId);
        if (actionItemsData && actionItemsData.length > 0) {
          actionItems = actionItemsData.map((item: any) => ({
            action: item.action_text,
            owner: item.assignee_name || "Unassigned",
            deadline: item.due_date || undefined,
            priority: item.priority || "medium",
            status: item.status || "open",
            isCompleted: item.status === "completed",
          }));
        }
      } catch {
        // action items are optional
      }

      const cleanTitle = meetingTitle.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim();

      const base64Content = await generateMeetingDocxBase64({
        summaryContent: summary.summary,
        title: cleanTitle,
        details: {
          date: meetingDate || undefined,
          time: meetingTime,
          location: meeting.meeting_format || meeting.meeting_location || undefined,
          attendees: Array.isArray(meeting.participants) && meeting.participants.length > 0
            ? meeting.participants.join(", ")
            : undefined,
        },
        actionItems,
      });

      const filename = generateMeetingFilename(
        meetingTitle,
        meeting.start_time ? new Date(meeting.start_time) : new Date(),
        "docx"
      );

      wordAttachment = {
        content: base64Content,
        filename,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };

      console.log("📎 Word attachment generated for mobile meeting email");
    } catch (docErr) {
      console.warn("⚠️ Word attachment generation failed (non-critical):", docErr);
      // Continue without attachment — email body is more important
    }

    // 8. Invoke send-meeting-email-resend (matching desktop payload exactly)
    const { data: emailResult, error: emailErr } = await supabase.functions.invoke(
      "send-meeting-email-resend",
      {
        body: {
          to_email: userEmail,
          cc_emails: [],
          subject,
          html_content: htmlContent,
          from_name: senderName,
          word_attachment: wordAttachment,
        },
      }
    );

    if (emailErr) {
      throw new Error(`Email send failed: ${emailErr.message}`);
    }

    if (emailResult && !emailResult.success) {
      throw new Error(`Email send returned failure: ${emailResult.error || "unknown"}`);
    }

    // 9. Mark as sent (idempotency)
    await supabase
      .from("meetings")
      .update({ notes_email_sent_at: new Date().toISOString() })
      .eq("id", meetingId);

    console.log(`✅ Mobile meeting email delivered to ${userEmail}`);

    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ deliver-mobile-meeting-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
