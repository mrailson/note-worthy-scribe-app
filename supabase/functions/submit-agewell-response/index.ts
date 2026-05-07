import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATING_SET = new Set([1, 2, 3, 4, 5]);
const YN_UNS = new Set(["yes", "no", "unsure"]);
const YN = new Set(["yes", "no"]);
const YN_UNS_NA = new Set(["yes", "no", "unsure", "not_applicable"]);
const AGREE_SET = new Set(["agree", "neutral", "disagree"]);
const COMPLETED_SET = new Set(["with_support_worker", "on_my_own", "phone_with_automated_assistant"]);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_TO = ["malcolm.railson@nhs.net"];
const NOTIFY_FROM = Deno.env.get("AGEWELL_FROM_EMAIL") ||
  "Ageing Well Feedback <noreply@gpnotewell.co.uk>";
const SALT_BASE = Deno.env.get("PPG_DAILY_SALT_BASE") || "agewell-default-salt-2026";

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
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", hour12: false,
  }).format(d) + " UK time";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

const YN_LABEL: Record<string, string> = { yes: "Yes", no: "No", unsure: "Unsure", not_applicable: "Not applicable" };
const AGREE_LABEL: Record<string, string> = { agree: "Agree", neutral: "Neutral / Don't know", disagree: "Disagree" };
const COMPLETED_LABEL: Record<string, string> = {
  with_support_worker: "With support worker",
  on_my_own: "On my own",
  phone_with_automated_assistant: "Phone (automated)",
};
const CHANNEL_LABEL: Record<string, string> = { web: "Web", paper: "Paper", telephony: "Phone (automated)" };

function ratingColour(r: number | null): string {
  if (r == null) return "#64748B";
  if (r >= 4) return "#2A9D8F";
  if (r === 3) return "#ED8B00";
  return "#E76F51";
}

function agreeColour(v: string | null): string {
  if (v === "agree") return "#2A9D8F";
  if (v === "disagree") return "#E76F51";
  return "#64748B";
}

function ynColour(v: string | null): string {
  if (v === "yes") return "#2A9D8F";
  if (v === "no") return "#E76F51";
  return "#64748B";
}

function buildEmail(opts: {
  practiceLabel: string;
  branchSite: string | null;
  channel: string;
  submittedAt: string;
  data: Record<string, any>;
  transcript?: any[];
}) {
  const d = opts.data;
  const subjectPrefix = opts.channel === "telephony" ? "[Phone] " : "";
  const branchSuffix = opts.branchSite ? ` (${opts.branchSite})` : "";
  const overall = d.overall_rating ?? "—";
  const subject = `${subjectPrefix}AgeWell — ${opts.practiceLabel}${branchSuffix} — Overall ${overall}/5`;

  const submittedFmt = formatUkDate(opts.submittedAt);

  const row = (label: string, value: string, colour?: string) => `
    <tr>
      <td style="padding:7px 12px 7px 0;color:#64748B;font-size:13px;width:42%;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:7px 0;font-size:14px;color:#1E293B;font-weight:600">${
        colour
          ? `<span style="display:inline-block;padding:3px 10px;border-radius:100px;background:${colour}20;color:${colour}">${escapeHtml(value)}</span>`
          : escapeHtml(value)
      }</td>
    </tr>`;

  const ratingCell = (r: number | null) => r == null
    ? "—"
    : `${r} / 5`;

  const tableRows = [
    row("Practice", `${opts.practiceLabel}${branchSuffix}`),
    row("Channel", CHANNEL_LABEL[opts.channel] || opts.channel),
    row("Submitted", submittedFmt),
    row("Support worker rating", ratingCell(d.support_worker_rating), ratingColour(d.support_worker_rating)),
    row("Equipment provided", YN_LABEL[d.equipment_provided] || "—", ynColour(d.equipment_provided)),
    row("Signposted", YN_LABEL[d.signposted] || "—", ynColour(d.signposted)),
    row("Online meeting — needs discussed", YN_LABEL[d.online_meeting_concerns_discussed] || "—"),
    row("Medicine review beneficial", YN_LABEL[d.medicine_review_beneficial] || "—"),
    row("Felt listened to", AGREE_LABEL[d.listened_to_concerns] || "—", agreeColour(d.listened_to_concerns)),
    row("Feels more independent", AGREE_LABEL[d.more_independent] || "—", agreeColour(d.more_independent)),
    row("Overall rating", ratingCell(d.overall_rating), ratingColour(d.overall_rating)),
    row("Would recommend", YN_LABEL[d.would_recommend] || "—", ynColour(d.would_recommend)),
    row("Completed", COMPLETED_LABEL[d.completed_with_support] || "—"),
  ].join("");

  const quoteBlock = (label: string, text: string | null) => `
    <div style="margin-top:18px">
      <div style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">${escapeHtml(label)}</div>
      <blockquote style="margin:0;padding:12px 16px;background:#F1F5F9;border-left:4px solid #4DB6A6;color:#1E293B;font-size:14px;line-height:1.55;border-radius:6px;font-style:italic">
        ${text ? escapeHtml(text).replace(/\n/g, "<br>") : "<span style='color:#94A3B8'>(none provided)</span>"}
      </blockquote>
    </div>`;

  let transcriptBlock = "";
  if (opts.transcript && Array.isArray(opts.transcript) && opts.transcript.length > 0) {
    const lines = opts.transcript.map((t: any) => {
      const speaker = escapeHtml(String(t?.speaker ?? "Speaker"));
      const ts = t?.t_seconds != null ? `[${Math.floor(Number(t.t_seconds) / 60)}:${String(Math.floor(Number(t.t_seconds) % 60)).padStart(2, "0")}] ` : "";
      const text = escapeHtml(String(t?.text ?? ""));
      return `<div style="margin-bottom:6px"><strong>${speaker}</strong> <span style="color:#94A3B8;font-size:12px">${ts}</span><br>${text}</div>`;
    }).join("");
    transcriptBlock = `
      <div style="margin-top:22px">
        <div style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">Call transcript</div>
        <div style="padding:14px 16px;background:#F8FAFC;border-radius:8px;font-size:13px;line-height:1.5;color:#1E293B;max-height:none">${lines}</div>
      </div>`;
  }

  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
      <tr><td style="background:#4DB6A6;color:#FFFFFF;padding:20px 28px;font-weight:700;font-size:17px;letter-spacing:0.3px">
        Ageing Well — New Feedback
      </td></tr>
      <tr><td style="padding:22px 28px 6px">
        <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
        ${quoteBlock("Most significant difference", d.most_significant_difference || null)}
        ${quoteBlock("Suggestions / concerns", d.suggestions_concerns || null)}
        ${transcriptBlock}
      </td></tr>
      <tr><td style="padding:18px 28px 24px;color:#64748B;font-size:12px;line-height:1.6;border-top:1px solid #E2E8F0;margin-top:14px">
        Anonymous submission. No patient identifiers stored.<br>
        View all responses: <a href="https://gpnotewell.co.uk/admin/agewell-responses" style="color:#1F7A6F">https://gpnotewell.co.uk/admin/agewell-responses</a> (admin only)<br>
        Sent automatically by gpnotewell.co.uk/agewell/feedback
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

  const textParts = [
    `Ageing Well — New Feedback`,
    "",
    `Practice: ${opts.practiceLabel}${branchSuffix}`,
    `Channel: ${CHANNEL_LABEL[opts.channel] || opts.channel}`,
    `Submitted: ${submittedFmt}`,
    "",
    `Support worker rating: ${ratingCell(d.support_worker_rating)}`,
    `Equipment provided: ${YN_LABEL[d.equipment_provided] || "—"}`,
    `Signposted: ${YN_LABEL[d.signposted] || "—"}`,
    `Online meeting — needs discussed: ${YN_LABEL[d.online_meeting_concerns_discussed] || "—"}`,
    `Medicine review beneficial: ${YN_LABEL[d.medicine_review_beneficial] || "—"}`,
    `Felt listened to: ${AGREE_LABEL[d.listened_to_concerns] || "—"}`,
    `Feels more independent: ${AGREE_LABEL[d.more_independent] || "—"}`,
    `Overall rating: ${ratingCell(d.overall_rating)}`,
    `Would recommend: ${YN_LABEL[d.would_recommend] || "—"}`,
    `Completed: ${COMPLETED_LABEL[d.completed_with_support] || "—"}`,
    "",
    `Most significant difference: ${d.most_significant_difference || "(none provided)"}`,
    "",
    `Suggestions / concerns: ${d.suggestions_concerns || "(none provided)"}`,
    "",
    "Anonymous submission. No patient identifiers stored.",
    "View all responses: https://gpnotewell.co.uk/admin/agewell-responses (admin only)",
  ];

  return { subject, html, text: textParts.join("\n") };
}

async function logEmailFailure(responseId: string | null, msg: string, payload: any) {
  try {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "submit-agewell-response",
      error_message: msg.slice(0, 1000),
      payload,
    });
  } catch (_e) {
    // swallow — never block submission
  }
}

async function sendEmail(opts: {
  practiceLabel: string;
  branchSite: string | null;
  channel: string;
  submittedAt: string;
  data: Record<string, any>;
  transcript?: any[];
  responseId: string | null;
}) {
  if (!RESEND_API_KEY) {
    await logEmailFailure(opts.responseId, "RESEND_API_KEY missing", opts.data);
    return false;
  }
  const { subject, html, text } = buildEmail(opts);
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: NOTIFY_FROM, to: NOTIFY_TO, subject, html, text }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      await logEmailFailure(opts.responseId, `Resend ${resp.status}: ${errBody.slice(0, 800)}`, opts.data);
      return false;
    }
    return true;
  } catch (e) {
    await logEmailFailure(opts.responseId, `Resend exception: ${(e as Error).message}`, opts.data);
    return false;
  }
}

function strOr<T extends string>(v: any, allowed: Set<T> | null = null, max = 200): T | null {
  if (v == null) return null;
  const s = String(v).slice(0, max);
  if (allowed && !allowed.has(s as T)) return null;
  return s as T;
}

function intRating(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  if (typeof n === "number" && RATING_SET.has(n)) return n;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  // Honeypot — silent success
  if (typeof body?.honeypot === "string" && body.honeypot.trim().length > 0) {
    return jsonResponse({ success: true });
  }

  // Determine channel: telephony if `transcript` present
  const isTelephony = Array.isArray(body?.transcript);
  const channel: "web" | "telephony" = isTelephony ? "telephony" : "web";

  // Telephony abandoned-call handling
  if (isTelephony && body?.data_collection?.survey_completed === false) {
    await logEmailFailure(null, "abandoned_call", { call_id: body?.call_id ?? null });
    return jsonResponse({ success: true });
  }

  const src = isTelephony ? (body?.data_collection ?? {}) : body;

  const practice_canonical = src.practice_canonical ? String(src.practice_canonical).slice(0, 200) : null;
  const practice_label_freeform = src.practice_label_freeform ? String(src.practice_label_freeform).slice(0, 200) : null;
  const branch_site = src.branch_site ? String(src.branch_site).slice(0, 120) : null;

  const support_worker_rating = intRating(src.support_worker_rating);
  const overall_rating = intRating(src.overall_rating);
  const equipment_provided = strOr<string>(src.equipment_provided, YN_UNS, 30);
  const signposted = strOr<string>(src.signposted, YN, 30);
  const online_meeting_concerns_discussed = strOr<string>(src.online_meeting_concerns_discussed, YN_UNS_NA, 30);
  const medicine_review_beneficial = strOr<string>(src.medicine_review_beneficial, YN_UNS_NA, 30);
  const listened_to_concerns = strOr<string>(src.listened_to_concerns, AGREE_SET, 30);
  const more_independent = strOr<string>(src.more_independent, AGREE_SET, 30);
  const most_significant_difference = src.most_significant_difference ? String(src.most_significant_difference).slice(0, 1000) : null;
  const suggestions_concerns = src.suggestions_concerns ? String(src.suggestions_concerns).slice(0, 1000) : null;
  const would_recommend = strOr<string>(src.would_recommend, YN_UNS, 30);
  const completed_with_support = strOr<string>(
    src.completed_with_support ?? (isTelephony ? "phone_with_automated_assistant" : null),
    COMPLETED_SET, 50,
  );

  // Required-field validation
  const practiceLabel = practice_canonical || practice_label_freeform;
  if (!practiceLabel) return jsonResponse({ error: "Practice required" }, 400);

  if (!isTelephony) {
    const missing: string[] = [];
    if (!support_worker_rating) missing.push("support_worker_rating");
    if (!equipment_provided) missing.push("equipment_provided");
    if (!signposted) missing.push("signposted");
    if (!online_meeting_concerns_discussed) missing.push("online_meeting_concerns_discussed");
    if (!medicine_review_beneficial) missing.push("medicine_review_beneficial");
    if (!listened_to_concerns) missing.push("listened_to_concerns");
    if (!more_independent) missing.push("more_independent");
    if (!most_significant_difference) missing.push("most_significant_difference");
    if (!overall_rating) missing.push("overall_rating");
    if (!would_recommend) missing.push("would_recommend");
    if (!completed_with_support) missing.push("completed_with_support");
    if (missing.length) return jsonResponse({ error: "Missing required fields", missing }, 400);
  } else {
    if (!overall_rating) return jsonResponse({ error: "Telephony submission missing overall_rating" }, 400);
  }

  // Anonymous submission token (do NOT store IP)
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || "unknown";
  const userAgent = String(body?.user_agent ?? req.headers.get("user-agent") ?? "").slice(0, 500);
  const today = new Date().toISOString().slice(0, 10);
  const submission_token = await sha256Hex(`${ip}|${SALT_BASE}|${today}|${userAgent}`);

  // Rate limit (web only)
  if (!isTelephony) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: tokenCount } = await admin
      .from("agewell_responses")
      .select("id", { count: "exact", head: true })
      .eq("submission_token", submission_token)
      .gte("submitted_at", oneHourAgo);
    if ((tokenCount ?? 0) >= 5) {
      return jsonResponse({ error: "Too many submissions, please try again later." }, 429);
    }
    const { count: globalCount } = await admin
      .from("agewell_responses")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", oneHourAgo);
    if ((globalCount ?? 0) >= 200) {
      return jsonResponse({ error: "Service is busy, please try again shortly." }, 429);
    }
  }

  const insertRow: Record<string, any> = {
    channel,
    practice_canonical,
    practice_label_freeform,
    branch_site,
    support_worker_rating,
    equipment_provided,
    signposted,
    online_meeting_concerns_discussed,
    medicine_review_beneficial,
    listened_to_concerns,
    more_independent,
    most_significant_difference,
    overall_rating,
    would_recommend,
    suggestions_concerns,
    completed_with_support,
    user_agent: userAgent || null,
    submission_token,
  };
  if (isTelephony) {
    insertRow.call_duration_seconds = typeof body?.duration_seconds === "number" ? body.duration_seconds : null;
    insertRow.transcript_json = body?.transcript ?? null;
  }

  const { data: inserted, error: insertErr } = await admin
    .from("agewell_responses")
    .insert(insertRow)
    .select("id, submitted_at")
    .single();

  if (insertErr) {
    console.error("Insert error", insertErr);
    return jsonResponse({ error: "Could not save response" }, 500);
  }

  // Fire-and-forget email
  const emailOk = await sendEmail({
    practiceLabel,
    branchSite: branch_site,
    channel,
    submittedAt: inserted.submitted_at,
    data: insertRow,
    transcript: insertRow.transcript_json ?? undefined,
    responseId: inserted.id,
  });

  if (emailOk) {
    await admin.from("agewell_responses").update({ email_sent_at: new Date().toISOString() }).eq("id", inserted.id);
  }

  return jsonResponse({ success: true, id: inserted.id });
});
