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

const GENERIC_TITLES = [
  "mobile recording",
  "meeting",
  "new meeting",
  "untitled meeting",
  "untitled",
  "general meeting",
  "general discussion",
  "general update",
  "team meeting",
  "weekly meeting",
  "monthly meeting"
];

const GENERIC_TITLE_PATTERNS = [
  /^Meeting \d{1,2} \w{3} \d{1,2}:\d{2}$/i,           // "Meeting 20 Apr 18:50"
  /^Mobile Recording\b/i,                               // "Mobile Recording 20 Apr"
  /^Meeting\s*-\s*\w{3},/i,                             // "Meeting - Mon, 14th..."
  /^Meeting\s*-\s*\w+day/i,                             // "Meeting - Monday..."
  /^Meeting\s*-\s*\d{1,2}(st|nd|rd|th)/i,              // "Meeting - 14th..."
  /^Meeting\s+\d+$/i,                                   // "Meeting 1"
];

const isGenericTitle = (title: string | null | undefined) =>
  !title || GENERIC_TITLES.includes(title.toLowerCase().trim()) || GENERIC_TITLE_PATTERNS.some(p => p.test(title.trim()));

const cleanMeetingTitle = (title: string | null | undefined) =>
  title?.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim() || "";

const humanizeEmailLocalPart = (email: string | null | undefined) => {
  const localPart = email?.split("@")[0]?.trim() || "";
  if (!localPart) return "";

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

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
  // Retry up to 4 times (≈30s total) waiting for AI title generation to commit.
  // Mobile syncs can take longer for the title-generator edge function to finish.
  const waitsMs = [4000, 6000, 8000, 12000];
  for (const waitMs of waitsMs) {
    if (!isGenericTitle(meeting?.title)) break;
    console.log(`⏳ Title still generic ("${meeting?.title}") — waiting ${waitMs}ms for AI title…`);
    await new Promise(r => setTimeout(r, waitMs));
    const { data: refreshed } = await supabase
      .from("meetings")
      .select("title, start_time, duration_minutes, participants, meeting_format, meeting_location, overview, word_count")
      .eq("id", meetingId)
      .maybeSingle();
    if (refreshed) meeting = refreshed;
  }
  if (isGenericTitle(meeting?.title)) {
    try {
      const { data: generatedTitleResult, error: generatedTitleError } = await supabase.functions.invoke<{ title?: string }>(
        "generate-meeting-title",
        {
          body: {
            meetingId,
            currentTitle: cleanMeetingTitle(meeting?.title) || "Meeting",
          },
        }
      );

      const generatedTitle = cleanMeetingTitle(generatedTitleResult?.title);
      if (generatedTitleError) {
        console.warn("⚠️ Explicit title generation failed:", generatedTitleError);
      } else if (generatedTitle && !isGenericTitle(generatedTitle)) {
        meeting = meeting ? { ...meeting, title: generatedTitle } : { title: generatedTitle } as typeof meeting;
        await supabase.from("meetings").update({ title: generatedTitle }).eq("id", meetingId);
        console.log(`✅ Generated specific meeting title for email: "${generatedTitle}"`);
      }
    } catch (titleErr) {
      console.warn("⚠️ Could not generate a better meeting title before email send:", titleErr);
    }
  }
  if (isGenericTitle(meeting?.title)) {
    console.warn(`⚠️ Title still generic after retries — sending with "${meeting?.title}"`);
  }

  const meetingTitle = cleanMeetingTitle(meeting?.title) || "Meeting Notes";
  console.log(`📧 [sendMeetingNotesEmail] Title before email: "${meetingTitle}" | isGeneric: ${isGenericTitle(meeting?.title)} | codePath: client-shared-helper`);

  // 2. Fetch summary
  const { data: summary } = await supabase
    .from("meeting_summaries")
    .select("summary")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!summary?.summary) {
    throw new Error("No meeting summary found — cannot send email");
  }

  // 3. Resolve sender name — prefer the currently authenticated user's profile
  //    (looked up by user_id), NOT a profile that happens to share the
  //    recipient's email address. The recipientEmail is just where the notes
  //    are being delivered; the "from name" must reflect the logged-in user.
  let senderName = opts.senderName;
  if (!senderName) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile?.full_name) {
          senderName = profile.full_name;
        } else {
          const metadata = user.user_metadata as Record<string, unknown> | undefined;
          const metadataName = [metadata?.full_name, metadata?.name, metadata?.display_name].find(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          );
          if (metadataName) {
            senderName = metadataName.trim();
          }
        }

        if (!senderName && user.email) {
          senderName = humanizeEmailLocalPart(user.email);
        }

        if (!senderName && user.email) {
          senderName = user.email.split("@")[0];
        }
      }
    } catch (e) {
      console.warn("Could not resolve sender from auth user:", e);
    }
    if (!senderName) {
      senderName = humanizeEmailLocalPart(recipientEmail) || recipientEmail.split("@")[0] || "Notewell AI";
    }
  }

  // 4. Build dates
  const meetingDate = meeting?.start_time
    ? new Date(meeting.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const meetingTime = meeting?.start_time
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(meeting.start_time))
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
    const cleanTitle = cleanMeetingTitle(meetingTitle);
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
