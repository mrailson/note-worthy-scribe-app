import { createClient } from "npm:@supabase/supabase-js@2.49.2";
import { buildProfessionalMeetingEmail } from "../_shared/meetingEmailBuilder.ts";
import { generateMeetingDocxBase64, generateMeetingFilename } from "../_shared/generateMeetingDocx.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GENERIC_TITLES = ["mobile recording", "meeting", "new meeting", "untitled meeting", "untitled"];
const UK_TIME_ZONE = "Europe/London";

const GENERIC_TITLE_PATTERNS = [
  /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i,           // "Meeting 20 Apr 18:50"
  /^Mobile Recording\b/i,                               // "Mobile Recording 20 Apr"
  /^Meeting\s*-\s*\w{3},/i,                             // "Meeting - Mon, 14th..."
  /^Meeting\s*-\s*\w+day/i,                             // "Meeting - Monday..."
  /^Meeting\s*-\s*\d{1,2}(st|nd|rd|th)/i,              // "Meeting - 14th..."
  /^Meeting\s+\d+$/i,                                   // "Meeting 1"
];

const cleanMeetingTitle = (title: string | null | undefined) =>
  title?.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim() || "";

const isGenericMeetingTitle = (title: string | null | undefined) => {
  const cleaned = cleanMeetingTitle(title);
  return !cleaned || GENERIC_TITLES.includes(cleaned.toLowerCase()) || GENERIC_TITLE_PATTERNS.some(p => p.test(cleaned));
};

const humanizeEmailLocalPart = (email: string | null | undefined) => {
  const localPart = email?.split("@")[0]?.trim() || "";
  if (!localPart) return "";

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatMeetingDate = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatMeetingTime = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  const fiveMinuteBlock = Math.floor(minute / 5) * 5;
  const roundedTime = `${hour}:${String(fiveMinuteBlock).padStart(2, "0")}`;

  const zone = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    timeZoneName: "short",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "UK time";
  return `${roundedTime} ${zone}`;
};

Deno.serve(async (req: Request) => {
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
    // Always read fresh from DB to pick up the latest AI-generated title
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .select("id, user_id, title, import_source, notes_email_sent_at, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count, notes_model_used")
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
      .eq("user_id", meeting.user_id)
      .maybeSingle();

    const metadata = authUser?.user?.user_metadata as Record<string, unknown> | undefined;
    const metadataName = [metadata?.full_name, metadata?.name, metadata?.display_name].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    const senderName =
      profile?.full_name?.trim() ||
      metadataName?.trim() ||
      humanizeEmailLocalPart(userEmail) ||
      userEmail.split("@")[0] ||
      "Notewell AI";

    // 5. Poll for a non-generic title (auto-generate-meeting-notes may still be running)
    // Wait up to 20 seconds in 4-second intervals for the AI-generated title to land
    const MAX_TITLE_POLL_ATTEMPTS = 5;
    const TITLE_POLL_INTERVAL_MS = 4000;
    let meetingTitle = cleanMeetingTitle(meeting.title) || "Meeting Notes";

    if (isGenericMeetingTitle(meetingTitle)) {
      console.log(`⏳ Title is generic ("${meetingTitle}"), polling for AI-generated title...`);
      for (let attempt = 1; attempt <= MAX_TITLE_POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, TITLE_POLL_INTERVAL_MS));
        const { data: freshMeeting } = await supabase
          .from("meetings")
          .select("title")
          .eq("id", meetingId)
          .single();
        const freshTitle = cleanMeetingTitle(freshMeeting?.title);
        if (freshTitle && !isGenericMeetingTitle(freshTitle)) {
          meetingTitle = freshTitle;
          console.log(`✅ AI title arrived after ${attempt * 4}s: "${meetingTitle}"`);
          break;
        }
        console.log(`⏳ Poll ${attempt}/${MAX_TITLE_POLL_ATTEMPTS}: title still generic`);
      }
    }

    // Final fallback: if still generic after polling, generate a title on the spot
    if (isGenericMeetingTitle(meetingTitle)) {
      console.log(`⚠️ Title still generic after polling, attempting AI title generation...`);
      try {
        const { data: titleResult } = await supabase.functions.invoke("generate-meeting-title", {
          body: { meetingId: meeting.id, currentTitle: meetingTitle },
        });
        const generatedTitle = cleanMeetingTitle(titleResult?.title);
        if (generatedTitle && !isGenericMeetingTitle(generatedTitle)) {
          meetingTitle = generatedTitle;
          await supabase.from("meetings").update({ title: meetingTitle }).eq("id", meeting.id);
          console.log("✅ Generated title for email:", meetingTitle);
        }
      } catch (titleErr) {
        console.warn("⚠️ Title generation failed, using fallback:", titleErr);
      }
    }

    console.log(`📧 [deliver-mobile-meeting-email] Title before email: "${meetingTitle}" | isGeneric: ${isGenericMeetingTitle(meetingTitle)} | codePath: edge-function-deliver`);

    const meetingDate = formatMeetingDate(meeting.start_time);
    const meetingTime = formatMeetingTime(meeting.start_time);

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

      const cleanTitle = cleanMeetingTitle(meetingTitle);

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
