// ElevenLabs AgeWell post-call webhook — DEBUG MODE
// HMAC-verified, ALWAYS inserts + emails (regardless of survey_completed).
import { createClient } from "npm:@supabase/supabase-js@2";

const LOG = "[submit-agewell-response]";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, elevenlabs-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const HMAC_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
const FROM_EMAIL = Deno.env.get("AGEWELL_FROM_EMAIL") ||
  "Notewell AI <noreply@bluepcn.co.uk>";

const DEFAULT_TO_EMAILS = ["malcolm.railson@nhs.net"];

const admin = createClient(supabaseUrl, serviceKey);

async function loadNotificationSettings(): Promise<{ recipients: string[]; mode: "all" | "completed_only" }> {
  try {
    const { data, error } = await admin
      .from("agewell_notification_settings")
      .select("recipients, mode")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(`${LOG} settings load error:`, error.message);
      return { recipients: DEFAULT_TO_EMAILS, mode: "all" };
    }
    const recipients = (data?.recipients ?? []).filter((e: string) => typeof e === "string" && e.includes("@"));
    const mode = (data?.mode === "completed_only" ? "completed_only" : "all") as "all" | "completed_only";
    return {
      recipients: recipients.length > 0 ? recipients : DEFAULT_TO_EMAILS,
      mode,
    };
  } catch (e) {
    console.error(`${LOG} settings load exception:`, (e as Error).message);
    return { recipients: DEFAULT_TO_EMAILS, mode: "all" };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

function formatUkDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", hour12: false,
  }).format(new Date(iso)) + " UK time";
}

function fmtDuration(secs: number | null): string {
  if (secs == null || !Number.isFinite(secs)) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ElevenLabs sends header like: t=<unix>,v0=<hex>
async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!HMAC_SECRET) {
    console.error(`${LOG} ELEVENLABS_WEBHOOK_SECRET not configured`);
    return false;
  }
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const ts = parts["t"];
  const sig = parts["v0"];
  if (!ts || !sig) return false;
  const expected = await hmacSha256Hex(HMAC_SECRET, `${ts}.${rawBody}`);
  return timingSafeEqual(expected, sig);
}

const NOT_CAPTURED = `<em style="color:#94A3B8">(not captured)</em>`;

function buildEmail(opts: {
  practiceLabel: string;
  branchSite: string | null;
  rating: string;
  callDuration: number | null;
  conversationId: string | null;
  submittedAt: string;
  transcript: any;
  dataCollection: Record<string, any>;
  isComplete: boolean;
}) {
  const branchSuffix = opts.branchSite ? ` (${opts.branchSite})` : "";
  const subject = opts.isComplete
    ? `[Phone] AgeWell — ${opts.practiceLabel} — ${opts.rating}`
    : `[Phone DEBUG — INCOMPLETE] AgeWell — ${opts.practiceLabel || "no practice"} — ${opts.rating || "no rating"} — call ${opts.conversationId ?? "unknown"}`;
  const submittedFmt = formatUkDate(opts.submittedAt);

  const row = (label: string, valueHtml: string) => `
    <tr>
      <td style="padding:8px 14px 8px 0;color:#64748B;font-size:13px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;color:#1E293B;font-weight:600">${valueHtml}</td>
    </tr>`;

  const surveyKeys = [
    "practice_id", "practice_label", "branch_site",
    "rating", "comment", "anything_else", "survey_completed",
  ];
  const allKeys = Array.from(new Set([...surveyKeys, ...Object.keys(opts.dataCollection || {})]));

  const surveyRows = allKeys.map((k) => {
    const v = opts.dataCollection?.[k];
    const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (v == null || v === "") return row(label, NOT_CAPTURED);
    let display: string;
    if (typeof v === "boolean") display = v ? "Yes" : "No";
    else if (typeof v === "object") display = JSON.stringify(v);
    else display = String(v);
    return row(label, escapeHtml(display));
  }).join("");

  const transcriptHtml = (() => {
    const arr = Array.isArray(opts.transcript) ? opts.transcript : [];
    if (!arr.length) {
      return `<div style="padding:14px 16px;background:#F8FAFC;border-radius:8px;font-size:13px;color:#94A3B8;font-style:italic">(no transcript captured)</div>`;
    }
    const lines = arr.map((t: any) => {
      const role = escapeHtml(String(t?.role ?? t?.speaker ?? "Speaker"));
      const text = escapeHtml(String(t?.message ?? t?.text ?? ""));
      const ts = t?.time_in_call_secs != null
        ? `[${Math.floor(Number(t.time_in_call_secs) / 60)}:${String(Math.floor(Number(t.time_in_call_secs) % 60)).padStart(2, "0")}] `
        : "";
      return `<div style="margin-bottom:6px"><strong>${role}</strong> <span style="color:#94A3B8;font-size:12px">${ts}</span><br>${text}</div>`;
    }).join("");
    return `<div style="padding:14px 16px;background:#F8FAFC;border-radius:8px;font-size:13px;line-height:1.5;color:#1E293B">${lines}</div>`;
  })();

  const sectionHeader = (label: string) =>
    `<div style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:22px 0 8px">${escapeHtml(label)}</div>`;

  const bannerColour = opts.isComplete ? "#4DB6A6" : "#D97706";
  const bannerLabel = opts.isComplete
    ? "AgeWell — New Phone Feedback"
    : "AgeWell — Incomplete Call (DEBUG)";

  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
      <tr><td style="background:${bannerColour};color:#FFFFFF;padding:20px 28px;font-weight:700;font-size:17px;letter-spacing:0.3px">
        ${escapeHtml(bannerLabel)}
      </td></tr>
      <tr><td style="padding:22px 28px 6px">
        ${sectionHeader("Survey answers")}
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;padding:8px 14px">
          ${surveyRows}
        </table>

        ${sectionHeader("Call metadata")}
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;padding:8px 14px">
          ${row("Conversation ID", escapeHtml(opts.conversationId ?? "—"))}
          ${row("Call duration", escapeHtml(fmtDuration(opts.callDuration)))}
          ${row("Completion status", opts.isComplete ? "Yes" : "No")}
          ${row("Timestamp", escapeHtml(submittedFmt))}
        </table>

        ${sectionHeader("Full transcript")}
        ${transcriptHtml}
      </td></tr>
      <tr><td style="padding:18px 28px 24px;color:#64748B;font-size:12px;line-height:1.6;border-top:1px solid #E2E8F0">
        Sent automatically from the AgeWell phone line.<br>
        View all responses: <a href="https://gpnotewell.co.uk/admin/agewell-responses" style="color:#1F7A6F">https://gpnotewell.co.uk/admin/agewell-responses</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

  const text = [
    bannerLabel,
    ``,
    `Conversation ID: ${opts.conversationId ?? "—"}`,
    `Duration: ${fmtDuration(opts.callDuration)}`,
    `Completed: ${opts.isComplete ? "Yes" : "No"}`,
    `Timestamp: ${submittedFmt}`,
    ``,
    `Survey answers:`,
    ...allKeys.map((k) => {
      const v = opts.dataCollection?.[k];
      const display = (v == null || v === "")
        ? "(not captured)"
        : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `  ${k}: ${display}`;
    }),
  ].join("\n");

  return { subject, html, text };
}

async function logEmailFailure(responseId: string | null, msg: string, payload: any) {
  try {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "submit-agewell-response",
      error_message: msg.slice(0, 1000),
      payload,
    });
  } catch (e) {
    console.error(`${LOG} failed to log email_failures:`, (e as Error).message);
  }
}

Deno.serve(async (req) => {
  console.log(`${LOG} Webhook received, will always email during debug mode`);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ===== TEST-MODE BYPASS (?test=1) =====
  const url = new URL(req.url);
  if (url.searchParams.get("test") === "1") {
    const TLOG = "[submit-agewell-response TEST]";
    const timestamp = new Date().toISOString();
    console.log(`${TLOG} Test mode invoked via ?test=1 query param`);
    console.log(`${TLOG} RESEND_API_KEY present: ${!!RESEND_API_KEY}`);
    console.log(`${TLOG} FROM address: ${FROM_EMAIL}`);

    if (!RESEND_API_KEY) {
      return jsonResponse({
        success: false,
        mode: "test",
        resendStatus: 0,
        resendBody: { error: "RESEND_API_KEY missing" },
        timestamp,
      }, 500);
    }

    const subject = `[AgeWell TEST] Resend pipeline check — ${timestamp}`;
    const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
    <tr><td style="background:#4DB6A6;color:#FFFFFF;padding:18px 26px;font-weight:700;font-size:16px">AgeWell — Resend pipeline test</td></tr>
    <tr><td style="padding:22px 26px;font-size:14px;line-height:1.55">
      Resend + bluepcn.co.uk are working. AgeWell email pipeline is operational.
      If real survey calls aren't producing emails, the failure is upstream — check ElevenLabs webhook config and HMAC secret match.
      <div style="margin-top:14px;color:#64748B;font-size:12px">Timestamp: ${escapeHtml(timestamp)}</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

    console.log(`${TLOG} Calling Resend...`);
    let resendStatus = 0;
    let resendBody: any = null;
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, html }),
      });
      resendStatus = resp.status;
      const raw = await resp.text();
      try { resendBody = JSON.parse(raw); } catch { resendBody = { raw }; }
      console.log(`${TLOG} Resend response: status=${resendStatus} body=${JSON.stringify(resendBody)}`);
    } catch (e) {
      resendBody = { error: (e as Error).message };
      console.error(`${TLOG} Resend exception:`, (e as Error).message);
    }

    return jsonResponse({
      success: resendStatus >= 200 && resendStatus < 300,
      mode: "test",
      resendStatus,
      resendBody,
      timestamp,
    });
  }
  // ===== END TEST-MODE BYPASS =====

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("elevenlabs-signature") ||
    req.headers.get("ElevenLabs-Signature");

  const ok = await verifySignature(rawBody, sigHeader);
  if (!ok) {
    console.warn(`${LOG} signature verification failed`);
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch {
    console.error(`${LOG} invalid JSON`);
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // ElevenLabs post-call webhook envelope: { type, data: { ... } }
  const data = payload?.data ?? payload;
  const dataCollection: Record<string, any> = data?.data_collection ?? {};
  const conversationId: string | null = data?.conversation_id ?? null;
  const isComplete = dataCollection?.survey_completed === true;

  console.log(`${LOG} conversation_id=${conversationId} survey_completed=${dataCollection?.survey_completed} -> proceeding (debug always-email)`);

  const practice_id = dataCollection.practice_id ? String(dataCollection.practice_id) : null;
  const practice_label = dataCollection.practice_label ? String(dataCollection.practice_label) : "unspecified";
  const branch_site = dataCollection.branch_site ? String(dataCollection.branch_site) : null;
  const rating = dataCollection.rating ? String(dataCollection.rating) : "unspecified";
  const comment = dataCollection.comment ? String(dataCollection.comment) : null;
  const anything_else = dataCollection.anything_else ? String(dataCollection.anything_else) : null;
  const call_duration_seconds = typeof data?.metadata?.call_duration_secs === "number"
    ? data.metadata.call_duration_secs : null;
  const transcript = data?.transcript ?? null;
  const userAgent = req.headers.get("user-agent") ?? "elevenlabs-webhook";

  const { data: inserted, error: insertErr } = await admin
    .from("agewell_responses")
    .insert({
      practice_id,
      practice_label,
      branch_site,
      rating,
      comment,
      anything_else,
      channel: "telephony",
      user_agent: userAgent,
      call_duration_seconds,
      transcript_json: transcript,
      elevenlabs_call_id: conversationId,
      is_complete: isComplete,
    })
    .select("id, created_at, submitted_at")
    .single();

  if (insertErr) {
    console.error(`${LOG} insert error:`, insertErr);
    await logEmailFailure(null, `insert error: ${insertErr.message}`, { conversationId, dataCollection });
    // Continue — still try to email so we can debug.
  }

  const responseId = inserted?.id ?? null;
  const submittedAt = inserted?.created_at ?? inserted?.submitted_at ?? new Date().toISOString();
  console.log(`${LOG} inserted id=${responseId} is_complete=${isComplete}`);

  if (!RESEND_API_KEY) {
    console.error(`${LOG} RESEND_API_KEY missing`);
    await logEmailFailure(responseId, "RESEND_API_KEY missing", { conversationId });
    return jsonResponse({ success: true, id: responseId, email: "skipped" });
  }

  const { subject, html, text } = buildEmail({
    practiceLabel: practice_label,
    branchSite: branch_site,
    rating,
    callDuration: call_duration_seconds,
    conversationId,
    submittedAt,
    transcript,
    dataCollection,
    isComplete,
  });

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, html, text }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`${LOG} Resend ${resp.status}: ${errBody}`);
      await logEmailFailure(responseId, `Resend ${resp.status}: ${errBody.slice(0, 800)}`, { conversationId, subject });
    } else {
      console.log(`${LOG} email sent for id=${responseId} (complete=${isComplete})`);
    }
  } catch (e) {
    console.error(`${LOG} Resend exception:`, (e as Error).message);
    await logEmailFailure(responseId, `Resend exception: ${(e as Error).message}`, { conversationId, subject });
  }

  return jsonResponse({ success: true, id: responseId, is_complete: isComplete });
});
