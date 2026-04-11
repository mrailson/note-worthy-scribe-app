const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscriptionSegment {
  speaker: string;
  timestamp: string;
  text: string;
}

interface PatientSessionData {
  sessionId: string;
  userEmail: string;
  userName: string;
  practiceName: string;
  sessionType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  languageUsed: string;
  transcription: TranscriptionSegment[];
  summary?: string;
  triageFlags?: string[];
  gpActions?: string[];
  complaintsRaised?: string[];
  userBrowser: string;
  userIPAddress: string;
}

function formatDateGB(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildHTML(data: PatientSessionData): string {
  const generatedAt = new Date().toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isNonEnglish = data.languageUsed && data.languageUsed.toLowerCase() !== "english";
  const languageDisplay = isNonEnglish
    ? `&#127760; ${data.languageUsed}`
    : data.languageUsed || "English";

  // Triage flags — prominent red section
  const triageFlagsSection =
    data.triageFlags && data.triageFlags.length > 0
      ? `<tr><td colspan="2" style="padding:16px 20px;"><div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:14px 16px;"><h3 style="color:#dc2626;margin:0 0 8px;font-size:15px;">&#9888;&#65039; Clinical Flags</h3><ul style="margin:0;padding-left:18px;color:#991b1b;font-size:13px;line-height:1.8;">${data.triageFlags.map((f) => `<li>${f}</li>`).join("")}</ul></div></td></tr>`
      : "";

  // GP actions — amber section
  const gpActionsSection =
    data.gpActions && data.gpActions.length > 0
      ? `<tr><td colspan="2" style="padding:0 20px 16px;"><div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;"><h3 style="color:#92400e;margin:0 0 8px;font-size:15px;">&#128203; Flagged for GP Review</h3><ul style="margin:0;padding-left:18px;color:#78350f;font-size:13px;line-height:1.8;">${data.gpActions.map((a) => `<li>${a}</li>`).join("")}</ul></div></td></tr>`
      : "";

  // Complaints section
  const complaintsSection =
    data.complaintsRaised && data.complaintsRaised.length > 0
      ? `<tr><td colspan="2" style="padding:0 20px 16px;"><div style="background:#f9fafb;border-left:4px solid #9ca3af;border-radius:6px;padding:14px 16px;"><h3 style="color:#374151;margin:0 0 8px;font-size:15px;">Complaints &amp; Feedback</h3><ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.8;">${data.complaintsRaised.map((c) => `<li>${c}</li>`).join("")}</ul></div></td></tr>`
      : "";

  const summarySection = data.summary
    ? `<tr><td colspan="2" style="padding:16px 20px;"><h3 style="color:#047857;margin:0 0 8px;font-size:15px;">Session Summary</h3><p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">${data.summary}</p></td></tr>`
    : "";

  const languageNote = isNonEnglish
    ? `<p style="margin:0 0 12px;font-size:12px;color:#6b7280;font-style:italic;background:#f0fdf4;padding:8px 12px;border-radius:6px;">&#127760; This conversation was conducted in ${data.languageUsed}. The transcription below is in the original language.</p>`
    : "";

  const transcriptionRows = data.transcription
    .map(
      (t, i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};"><td style="padding:8px 12px;font-size:12px;color:#6b7280;white-space:nowrap;vertical-align:top;">${t.timestamp}</td><td style="padding:8px 12px;font-size:12px;color:#047857;font-weight:600;white-space:nowrap;vertical-align:top;">${t.speaker}</td><td style="padding:8px 12px;font-size:12px;color:#374151;line-height:1.5;">${t.text}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#047857 0%,#059669 100%);padding:32px 24px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Patient Session Summary</h1>
<p style="color:rgba(255,255,255,0.85);margin:6px 0 12px;font-size:13px;">GP Practice Assistant &mdash; Notewell AI</p>
<span style="display:inline-block;background:rgba(255,255,255,0.2);color:#ffffff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.5px;">${data.sessionType}</span>
</td></tr>

<!-- Metadata -->
<tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:12px;color:#6b7280;width:140px;">User Name</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:500;">${data.userName}</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Practice</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">${data.practiceName}</td></tr>
<tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Session Type</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">${data.sessionType}</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Language Used</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;${isNonEnglish ? "font-weight:600;" : ""}">${languageDisplay}</td></tr>
<tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Started</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">${formatDateGB(data.startTime)}</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Ended</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">${formatDateGB(data.endTime)}</td></tr>
<tr style="background:#f9fafb;"><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Duration</td><td style="padding:10px 16px;font-size:13px;color:#111827;border-top:1px solid #f3f4f6;">${data.durationMinutes} minutes</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Session ID</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-family:monospace;border-top:1px solid #f3f4f6;">${data.sessionId}</td></tr>
</table>
</td></tr>

<!-- Device metadata -->
<tr><td style="padding:0 20px 16px;">
<div style="background:#f3f4f6;border-radius:6px;padding:10px 14px;">
<p style="margin:0 0 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Recorded from</p>
<p style="margin:0;font-size:11px;color:#9ca3af;">Browser: ${data.userBrowser} &nbsp;|&nbsp; IP: ${data.userIPAddress} &nbsp;|&nbsp; Generated: ${generatedAt}</p>
</div>
</td></tr>

${triageFlagsSection}
${gpActionsSection}
${complaintsSection}
${summarySection}

<!-- Transcription -->
<tr><td style="padding:16px 20px;">
<h3 style="color:#047857;margin:0 0 12px;font-size:15px;">Full Transcription</h3>
${languageNote}
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<tr style="background:#047857;"><td style="padding:8px 12px;font-size:11px;color:#ffffff;font-weight:600;">Time</td><td style="padding:8px 12px;font-size:11px;color:#ffffff;font-weight:600;">Speaker</td><td style="padding:8px 12px;font-size:11px;color:#ffffff;font-weight:600;">Content</td></tr>
${transcriptionRows}
</table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 20px;background:#f9fafb;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 12px;font-size:11px;color:#6b7280;line-height:1.6;text-align:center;">This is an automated summary generated by Notewell AI's Patient Assistant. This transcript was generated using AI-assisted transcription and should be reviewed for accuracy. The Patient Assistant is not a replacement for professional medical advice &mdash; any clinical flags or GP actions identified should be reviewed by a qualified clinician. Notewell AI is an MHRA Class I registered medical device.</p>
<p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">&copy; 2026 Notewell AI &mdash; PCN Services Ltd</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const data: PatientSessionData = await req.json();

    const required = ["sessionId", "userEmail", "userName", "practiceName", "sessionType", "startTime", "endTime", "durationMinutes", "transcription"] as const;
    for (const field of required) {
      if (!data[field] && data[field] !== 0) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!Array.isArray(data.transcription) || data.transcription.length === 0) {
      return new Response(
        JSON.stringify({ error: "transcription must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const fromEmail = Deno.env.get("NRES_FROM_EMAIL") || "nres@notewell.ai";
    const hasTriageFlags = data.triageFlags && data.triageFlags.length > 0;
    const subjectPrefix = hasTriageFlags ? "⚠️ " : "";
    const subjectLine = `${subjectPrefix}Patient Session — ${data.sessionType} — ${data.practiceName} — ${formatDateGB(data.startTime)}`;
    const html = buildHTML(data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Notewell Patient Assistant <${fromEmail}>`,
        to: [data.userEmail],
        subject: subjectLine,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Patient summary email sent:", result.id);
    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-patient-summary error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
