/**
 * Shared helper: send meeting notes email with Word attachment.
 * Used by desktop PostMeetingActionsModal, mobile NoteWellRecorderMobile,
 * and mobile MobileExportSheet to ensure consistent behaviour.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildProfessionalMeetingEmail } from "@/utils/meetingEmailBuilder";

interface SendMeetingNotesEmailOpts {
  meetingId: string;
  recipientEmail: string;
  /** Already-known sender name to avoid an extra profile lookup */
  senderName?: string;
}

/**
 * Fetches meeting data + summary, builds HTML + Word attachment,
 * and sends via the send-meeting-email-resend edge function.
 *
 * Returns `true` on success, throws on failure.
 */
export async function sendMeetingNotesEmail(opts: SendMeetingNotesEmailOpts): Promise<boolean> {
  const { meetingId, recipientEmail } = opts;

  // 1. Fetch meeting metadata
  let { data: meeting } = await supabase
    .from("meetings")
    .select("title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count")
    .eq("id", meetingId)
    .maybeSingle();

  // If title is still a generic placeholder, wait briefly and re-fetch —
  // the AI title generation may not have committed yet
  const GENERIC_TITLES = ["mobile recording", "meeting", "new meeting", "untitled meeting", "untitled"];
  const isDefaultTimestamp = (t: string) => /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i.test(t.trim());
  const isGenericTitle = (t: string | null | undefined) =>
    !t || GENERIC_TITLES.includes(t.toLowerCase().trim()) || isDefaultTimestamp(t);

  if (isGenericTitle(meeting?.title)) {
    console.log("⏳ Title appears generic, waiting for AI title generation...");
    await new Promise(r => setTimeout(r, 5000));
    const { data: refreshed } = await supabase
      .from("meetings")
      .select("title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count")
      .eq("id", meetingId)
      .maybeSingle();
    if (refreshed) meeting = refreshed;

    // If still generic after waiting, try one more time
    if (isGenericTitle(meeting?.title)) {
      console.log("⏳ Still generic, waiting another 5s...");
      await new Promise(r => setTimeout(r, 5000));
      const { data: refreshed2 } = await supabase
        .from("meetings")
        .select("title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count")
        .eq("id", meetingId)
        .maybeSingle();
      if (refreshed2) meeting = refreshed2;
    }
  }

  const meetingTitle = meeting?.title || "Meeting Notes";

  // 2. Fetch summary
  const { data: summary } = await supabase
    .from("meeting_summaries")
    .select("summary")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!summary?.summary) {
    throw new Error("No meeting summary found — cannot send email");
  }

  // 3. Resolve sender name
  let senderName = opts.senderName;
  if (!senderName) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", recipientEmail)
      .maybeSingle();
    senderName = profile?.full_name || recipientEmail.split("@")[0] || "Notewell AI";
  }

  // 4. Build dates
  const meetingDate = meeting?.start_time
    ? new Date(meeting.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const meetingTime = meeting?.start_time
    ? new Date(meeting.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " GMT"
    : undefined;

  const subject = `Notewell AI | ${meetingTitle} — ${meetingDate}`;

  // 5. Build HTML
  const htmlContent = buildProfessionalMeetingEmail(
    summary.summary,
    senderName,
    meetingTitle,
    {
      date: meetingDate,
      time: meetingTime,
      duration: meeting?.duration_minutes,
      format: meeting?.meeting_format,
      location: meeting?.meeting_location,
      overview: meeting?.overview,
      wordCount: meeting?.word_count,
      attendees: Array.isArray(meeting?.participants) ? meeting.participants : [],
    }
  );

  // 6. Generate Word attachment (with fallback)
  let wordAttachment: { content: string; filename: string; type: string } | null = null;
  try {
    const { generateProfessionalWordBlob } = await import("@/utils/generateProfessionalMeetingDocx");
    const cleanTitle = meetingTitle.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim();
    const parsedDetails = {
      title: cleanTitle,
      date: meetingDate || undefined,
      time: meetingTime,
      location: meeting?.meeting_format || meeting?.meeting_location || undefined,
      attendees: Array.isArray(meeting?.participants) && meeting.participants.length > 0
        ? meeting.participants.join(", ")
        : undefined,
    };

    let parsedActionItems: any[] = [];
    try {
      const { data: actionItemsData } = await supabase
        .from("meeting_action_items")
        .select("action_text, assignee_name, due_date, priority, status")
        .eq("meeting_id", meetingId);
      if (actionItemsData && actionItemsData.length > 0) {
        parsedActionItems = actionItemsData.map((item: any) => ({
          action: item.action_text,
          owner: item.assignee_name || "Unassigned",
          deadline: item.due_date || undefined,
          priority: item.priority || "medium",
          status: item.status === "completed" ? "Completed" : item.status === "in_progress" ? "In Progress" : "Open",
          isCompleted: item.status === "completed",
        }));
      }
    } catch {
      // action items are optional
    }

    const blob = await generateProfessionalWordBlob(summary.summary, cleanTitle, parsedDetails, parsedActionItems);
    const base64Content: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string | null;
        if (result) resolve(result.split(",")[1]);
        else reject(new Error("FileReader returned empty"));
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });

    const { generateMeetingFilename } = await import("@/utils/meetingFilename");
    wordAttachment = {
      content: base64Content,
      filename: generateMeetingFilename(meetingTitle, meeting?.start_time ? new Date(meeting.start_time) : new Date(), "docx"),
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    console.log("📎 Word attachment generated for meeting email");
  } catch (docErr) {
    console.warn("Word attachment generation failed (non-critical):", docErr);
  }

  // 7. Send email — validate result
  const { data, error } = await supabase.functions.invoke("send-meeting-email-resend", {
    body: {
      to_email: recipientEmail,
      cc_emails: [],
      subject,
      html_content: htmlContent,
      from_name: senderName,
      word_attachment: wordAttachment,
    },
  });

  if (error) {
    throw new Error(error.message || "Edge function error sending email");
  }
  if (data && !data.success) {
    throw new Error(data.error || "Email send returned failure");
  }

  console.log("✅ Meeting notes email sent to:", recipientEmail);
  return true;
}
