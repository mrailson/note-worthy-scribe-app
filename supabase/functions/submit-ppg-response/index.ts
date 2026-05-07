import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PRACTICES = new Set([
  "brackley", "brook", "bugbrooke", "denton",
  "parks", "springfield", "towcester", "unsure",
]);
const ALLOWED_RATINGS = new Set(["better", "same", "worse"]);
const ALLOWED_REASONS = new Set([
  "couldnt-get-through", "no-appointment", "wait-too-long", "other",
]);

const REASON_LABELS: Record<string, string> = {
  "couldnt-get-through": "I couldn't get through on the phone",
  "no-appointment": "No appointment was offered",
  "wait-too-long": "I had to wait too long",
  "other": "Something else",
};

const RATING_LABEL: Record<string, string> = {
  better: "Better",
  same: "The same",
  worse: "Worse",
};

const RATING_COLOUR: Record<string, string> = {
  better: "#2A9D8F",
  same: "#64748B",
  worse: "#E76F51",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_TO = "malcolm.railson@nhs.net";
const NOTIFY_FROM = Deno.env.get("NRES_FROM_EMAIL") ||
  "NRES Patient Feedback <noreply@gpnotewell.co.uk>";
const SALT_BASE = Deno.env.get("PPG_DAILY_SALT_BASE") || "ppg-default-salt-2026";

const admin = createClient(supabaseUrl, serviceKey);

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatUkDate(iso: string): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    hour12: false,
  });
  return formatter.format(d) + " UK time";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

function buildEmail(opts: {
  practiceLabel: string;
  rating: string;
  followupLabel: string | null;
  comment: string | null;
  submittedAt: string;
  isTest?: boolean;
}) {
  const ratingLabel = RATING_LABEL[opts.rating];
  const ratingColour = RATING_COLOUR[opts.rating];
  const subjectBase = `${opts.isTest ? "[TEST] " : ""}NRES PPG — ${opts.practiceLabel} — ${ratingLabel}`;
  const subject = opts.rating === "worse" && opts.followupLabel
    ? `${subjectBase} — ${opts.followupLabel}`
    : subjectBase;

  const submittedFmt = formatUkDate(opts.submittedAt);
  const commentBlock = opts.comment
    ? `<tr><td style="padding:8px 0;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Comment</td></tr>
       <tr><td><blockquote style="margin:0 0 12px;padding:12px 16px;background:#F1F5F9;border-left:4px solid #1A3A5C;color:#1E293B;font-size:14px;line-height:1.5;border-radius:6px">${escapeHtml(opts.comment)}</blockquote></td></tr>`
    : "";
  const issueBlock = opts.rating === "worse" && opts.followupLabel
    ? `<tr><td style="padding:8px 0;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Main issue</td></tr>
       <tr><td style="padding-bottom:10px;color:#1E293B;font-size:15px;font-weight:600">${escapeHtml(opts.followupLabel)}</td></tr>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
        <tr><td style="background:#1A3A5C;color:#FFFFFF;padding:20px 28px;font-weight:700;font-size:16px;letter-spacing:0.3px">
          NRES Patient Feedback Survey — New Response${opts.isTest ? " <span style=\"color:#FBEAE3\">[TEST]</span>" : ""}
        </td></tr>
        <tr><td style="padding:24px 28px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Practice</td></tr>
            <tr><td style="padding-bottom:10px;color:#1A3A5C;font-size:16px;font-weight:700">${escapeHtml(opts.practiceLabel)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Rating</td></tr>
            <tr><td style="padding-bottom:10px"><span style="display:inline-block;padding:6px 14px;border-radius:100px;background:${ratingColour}20;color:${ratingColour};font-size:14px;font-weight:700">${ratingLabel}</span></td></tr>
            ${issueBlock}
            ${commentBlock}
            <tr><td style="padding:14px 0 0;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Submitted</td></tr>
            <tr><td style="padding-bottom:4px;color:#1E293B;font-size:14px">${escapeHtml(submittedFmt)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;color:#64748B;font-size:12px;line-height:1.6;border-top:1px solid #E2E8F0">
          Anonymous submission. No patient identifiers stored.<br>
          View all responses: <a href="https://gpnotewell.co.uk/admin/nres-responses" style="color:#1F7A6F">https://gpnotewell.co.uk/admin/nres-responses</a> (admin only)<br>
          Sent automatically by gpnotewell.co.uk/nres/ppgsurvey
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const textParts = [
    `${opts.isTest ? "[TEST] " : ""}NRES Patient Feedback Survey — New Response`,
    "",
    `Practice: ${opts.practiceLabel}`,
    `Rating: ${ratingLabel}`,
  ];
  if (opts.rating === "worse" && opts.followupLabel) {
    textParts.push(`Main issue: ${opts.followupLabel}`);
  }
  if (opts.comment) {
    textParts.push("", `Comment: ${opts.comment}`);
  }
  textParts.push(
    "",
    `Submitted: ${submittedFmt}`,
    "",
    "Anonymous submission. No patient identifiers stored.",
    "View all responses: https://gpnotewell.co.uk/admin/nres-responses (admin only)",
    "Sent automatically by gpnotewell.co.uk/nres/ppgsurvey",
  );
  return { subject, html, text: textParts.join("\n") };
}

async function sendNotificationEmail(payload: {
  practiceLabel: string;
  rating: string;
  followupLabel: string | null;
  comment: string | null;
  submittedAt: string;
  isTest?: boolean;
}, responseId: string | null) {
  if (!RESEND_API_KEY) {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "submit-ppg-response",
      error_message: "RESEND_API_KEY missing",
      payload: payload as unknown as Record<string, unknown>,
    });
    return;
  }
  const { subject, html, text } = buildEmail(payload);
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        subject,
        html,
        text,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      await admin.from("email_failures").insert({
        response_id: responseId,
        source: "submit-ppg-response",
        error_message: `Resend ${resp.status}: ${errBody.slice(0, 1000)}`,
        payload: payload as unknown as Record<string, unknown>,
      });
    }
  } catch (e) {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "submit-ppg-response",
      error_message: `Resend exception: ${(e as Error).message}`,
      payload: payload as unknown as Record<string, unknown>,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Honeypot — silent success
  if (typeof body?.honeypot === "string" && body.honeypot.trim().length > 0) {
    return jsonResponse({ success: true });
  }

  const practice_id = String(body?.practice_id ?? "");
  const practice_label = String(body?.practice_label ?? "").slice(0, 200);
  const rating = String(body?.rating ?? "");
  const followup_reason: string | null = body?.followup_reason ? String(body.followup_reason) : null;
  const followup_label: string | null = body?.followup_label ? String(body.followup_label).slice(0, 200) : null;
  const commentRaw: string | null = typeof body?.comment === "string" ? body.comment : null;
  const comment = commentRaw ? commentRaw.slice(0, 400) : null;
  const isTest = body?._test === true;

  if (!ALLOWED_PRACTICES.has(practice_id)) {
    return jsonResponse({ error: "Invalid practice" }, 400);
  }
  if (!practice_label) {
    return jsonResponse({ error: "Missing practice label" }, 400);
  }
  if (!ALLOWED_RATINGS.has(rating)) {
    return jsonResponse({ error: "Invalid rating" }, 400);
  }
  if (rating === "worse") {
    if (!followup_reason || !ALLOWED_REASONS.has(followup_reason)) {
      return jsonResponse({ error: "Follow-up reason required" }, 400);
    }
  }

  // Hash IP + UA + daily salt (do not store IP)
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || "unknown";
  const userAgent = String(body?.user_agent ?? req.headers.get("user-agent") ?? "").slice(0, 500);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const submission_token = await sha256Hex(`${ip}|${SALT_BASE}|${today}|${userAgent}`);

  // Rate limit: per token (5/hour) and global (200/hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (!isTest) {
    const { count: tokenCount } = await admin
      .from("nres_ppg_responses")
      .select("id", { count: "exact", head: true })
      .eq("submission_token", submission_token)
      .gte("submitted_at", oneHourAgo);
    if ((tokenCount ?? 0) >= 5) {
      return jsonResponse({ error: "Too many submissions, please try again later." }, 429);
    }
    const { count: globalCount } = await admin
      .from("nres_ppg_responses")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", oneHourAgo);
    if ((globalCount ?? 0) >= 200) {
      return jsonResponse({ error: "Service is busy, please try again shortly." }, 429);
    }
  }

  const { data: inserted, error: insertErr } = await admin
    .from("nres_ppg_responses")
    .insert({
      practice_id,
      practice_label,
      rating,
      followup_reason,
      followup_label,
      comment,
      user_agent: userAgent || null,
      submission_token,
    })
    .select("id, submitted_at")
    .single();

  if (insertErr) {
    console.error("Insert error", insertErr);
    return jsonResponse({ error: "Could not save response" }, 500);
  }

  // Fire-and-forget email; failures logged, never block UX
  await sendNotificationEmail({
    practiceLabel: practice_label,
    rating,
    followupLabel: followup_label,
    comment,
    submittedAt: inserted.submitted_at,
    isTest,
  }, inserted.id);

  return jsonResponse({ success: true });
});
