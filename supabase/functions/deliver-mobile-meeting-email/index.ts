import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

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

    // 1. Fetch meeting row
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .select("id, user_id, title, import_source, notes_email_sent_at")
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

    // 5. Build meeting metadata
    const { data: meetingFull } = await supabase
      .from("meetings")
      .select("start_time, duration_minutes, meeting_format, meeting_location, overview, word_count, participants")
      .eq("id", meetingId)
      .maybeSingle();

    const meetingDate = meetingFull?.start_time
      ? new Date(meetingFull.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const meetingTime = meetingFull?.start_time
      ? new Date(meetingFull.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " GMT"
      : undefined;

    const meetingTitle = meeting.title || "Mobile Recording";
    const subject = `Notewell AI | ${meetingTitle} — ${meetingDate}`;

    // 6. Build simple but professional HTML email
    const htmlContent = buildEmailHtml(summary.summary, senderName, meetingTitle, {
      date: meetingDate,
      time: meetingTime,
      duration: meetingFull?.duration_minutes,
      format: meetingFull?.meeting_format,
      wordCount: meetingFull?.word_count,
    });

    // 7. Invoke send-meeting-email-resend
    const { data: emailResult, error: emailErr } = await supabase.functions.invoke(
      "send-meeting-email-resend",
      {
        body: {
          to_email: userEmail,
          cc_emails: [],
          subject,
          html_content: htmlContent,
          from_name: senderName,
        },
      }
    );

    if (emailErr) {
      throw new Error(`Email send failed: ${emailErr.message}`);
    }

    if (emailResult && !emailResult.success) {
      throw new Error(`Email send returned failure: ${emailResult.error || "unknown"}`);
    }

    // 8. Mark as sent (idempotency)
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

/** Builds a professional HTML email for meeting notes */
function buildEmailHtml(
  summaryMarkdown: string,
  senderName: string,
  meetingTitle: string,
  meta: { date?: string; time?: string; duration?: number; format?: string; wordCount?: number }
): string {
  const metaRows: string[] = [];
  if (meta.date) metaRows.push(`<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Date</td><td>${meta.date}</td></tr>`);
  if (meta.time) metaRows.push(`<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Time</td><td>${meta.time}</td></tr>`);
  if (meta.duration) metaRows.push(`<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Duration</td><td>${meta.duration} mins</td></tr>`);
  if (meta.format) metaRows.push(`<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Format</td><td>${meta.format}</td></tr>`);
  if (meta.wordCount) metaRows.push(`<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Word Count</td><td>${meta.wordCount.toLocaleString()}</td></tr>`);

  const metaTable = metaRows.length > 0
    ? `<table style="margin:16px 0;font-size:14px">${metaRows.join("")}</table>`
    : "";

  // Basic markdown-to-html: headings, bold, lists
  const htmlBody = summaryMarkdown
    .replace(/^### (.+)$/gm, '<h3 style="color:#1e3a5f;margin:20px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#1e3a5f;margin:24px 0 10px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#003087;margin:24px 0 12px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:0;background:#f3f4f6">
  <div style="background:linear-gradient(135deg,#003087 0%,#005eb8 100%);color:white;padding:32px 24px;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">📋</div>
    <h1 style="margin:0;font-size:22px;color:white">${meetingTitle}</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px">Your meeting notes are ready</p>
  </div>
  <div style="background:white;padding:28px 24px;border:1px solid #e5e7eb;border-top:none">
    ${metaTable}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <div style="font-size:15px">${htmlBody}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:13px;color:#6b7280">Sent by <strong>${senderName}</strong> via Notewell AI</p>
  </div>
  <div style="text-align:center;padding:16px;font-size:11px;color:#9ca3af">
    <p>This email was generated automatically by Notewell AI from a mobile recording.</p>
  </div>
</body></html>`;
}
