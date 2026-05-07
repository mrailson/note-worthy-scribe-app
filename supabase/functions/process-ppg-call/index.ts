import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-source",
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
const ALLOWED_BRANCHES = new Set([
  "Grange Park", "Blisworth", "Roade", "Hanslope", "Silverstone", "Paulerspury",
]);

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

const admin = createClient(supabaseUrl, serviceKey);

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
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", hour12: false,
  });
  return f.format(d) + " UK time";
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s} sec`;
  return `${m} min ${s} sec`;
}

function formatOffset(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildEmail(opts: {
  practiceLabel: string;
  branchSite: string | null;
  rating: string;
  followupLabel: string | null;
  comment: string | null;
  endedAt: string;
  durationSeconds: number;
  transcript: Array<{ role: string; message: string; time_offset_s: number }>;
}) {
  const ratingLabel = RATING_LABEL[opts.rating];
  const ratingColour = RATING_COLOUR[opts.rating];
  const branchSuffix = opts.branchSite ? ` (${opts.branchSite})` : "";
  const subjectBase = `[Phone] NRES PPG — ${opts.practiceLabel}${branchSuffix} — ${ratingLabel}`;
  const subject = opts.rating === "worse" && opts.followupLabel
    ? `${subjectBase} — ${opts.followupLabel}`
    : subjectBase;

  const submittedFmt = formatUkDate(opts.endedAt);
  const durationFmt = formatDuration(opts.durationSeconds);

  const commentHtml = opts.comment
    ? `<blockquote style="margin:0;padding:10px 14px;background:#F1F5F9;border-left:4px solid #1A3A5C;color:#1E293B;font-size:14px;font-style:italic;border-radius:6px">${escapeHtml(opts.comment)}</blockquote>`
    : "—";

  const rows: Array<[string, string]> = [
    ["Practice", escapeHtml(opts.practiceLabel)],
    ["Branch", opts.branchSite ? escapeHtml(opts.branchSite) : "—"],
    ["Rating", `<span style="display:inline-block;padding:4px 12px;border-radius:100px;background:${ratingColour}20;color:${ratingColour};font-weight:700">${ratingLabel}</span>`],
    ["Main issue", opts.followupLabel ? escapeHtml(opts.followupLabel) : "—"],
    ["Comment", commentHtml],
    ["Submitted", escapeHtml(submittedFmt)],
    ["Channel", "Phone (ElevenLabs voice agent)"],
    ["Call duration", escapeHtml(durationFmt)],
  ];
  const tableRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#64748B;font-size:13px;font-weight:600;vertical-align:top;width:140px">${k}:</td>
      <td style="padding:8px 0;color:#1E293B;font-size:14px;vertical-align:top">${v}</td>
    </tr>`).join("");

  const transcriptHtml = opts.transcript.map((t) => {
    const isAgent = t.role === "agent";
    const speakerColour = isAgent ? "#2A9D8F" : "#1A3A5C";
    const speakerLabel = isAgent ? "Agent" : "Caller";
    const weight = isAgent ? "600" : "700";
    const indent = isAgent ? "16px" : "0";
    const bodyColour = isAgent ? "#334155" : "#1A3A5C";
    return `
      <div style="margin:10px 0 10px ${indent}">
        <div style="color:${speakerColour};font-weight:${weight};font-size:13px">${speakerLabel} (${formatOffset(t.time_offset_s)})</div>
        <div style="margin:4px 0 0 16px;font-family:Consolas,'SF Mono',Menlo,monospace;font-size:13px;color:${bodyColour};white-space:pre-wrap">${escapeHtml(t.message || "")}</div>
      </div>`;
  }).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
        <tr><td style="background:#1A3A5C;color:#FFFFFF;padding:20px 28px;font-weight:700;font-size:16px;letter-spacing:0.3px">
          NRES Patient Feedback — New Phone Response
        </td></tr>
        <tr><td style="padding:20px 28px">
          <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
        </td></tr>
        <tr><td style="padding:8px 28px 4px;border-top:1px solid #E2E8F0">
          <div style="color:#1A3A5C;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px">Full Call Transcript</div>
          ${transcriptHtml || '<div style="color:#64748B;font-size:13px">(no transcript)</div>'}
        </td></tr>
        <tr><td style="padding:18px 28px 24px;color:#64748B;font-size:12px;line-height:1.6;border-top:1px solid #E2E8F0">
          View all responses (admin only): <a href="https://gpnotewell.co.uk/admin/nres-responses" style="color:#1F7A6F">https://gpnotewell.co.uk/admin/nres-responses</a><br>
          Anonymous submission. No patient identifiers stored.<br>
          Sent automatically by the NRES Patient Feedback service.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const textLines = [
    `[Phone] NRES PPG — New Phone Response`,
    "",
    `Practice: ${opts.practiceLabel}`,
    `Branch: ${opts.branchSite || "—"}`,
    `Rating: ${ratingLabel}`,
    `Main issue: ${opts.followupLabel || "—"}`,
    `Comment: ${opts.comment || "—"}`,
    `Submitted: ${submittedFmt}`,
    `Channel: Phone (ElevenLabs voice agent)`,
    `Call duration: ${durationFmt}`,
    "",
    "FULL CALL TRANSCRIPT",
    "",
    ...opts.transcript.map((t) => {
      const speaker = t.role === "agent" ? "Agent" : "Caller";
      return `${speaker} (${formatOffset(t.time_offset_s)}): ${t.message || ""}`;
    }),
    "",
    "View all responses (admin only): https://gpnotewell.co.uk/admin/nres-responses",
    "Anonymous submission. No patient identifiers stored.",
    "Sent automatically by the NRES Patient Feedback service.",
  ];

  return { subject, html, text: textLines.join("\n") };
}

async function logEmailFailure(conversationId: string, errorMessage: string, responseId: string | null, payload: unknown) {
  console.error(`[process-ppg-call] Email FAILED: ${errorMessage}`);
  try {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "process-ppg-call",
      error_message: `[${conversationId}] ${errorMessage}`.slice(0, 2000),
      payload: payload as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[process-ppg-call] Could not log email_failures:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Auth
  const authHeader = req.headers.get("authorization") || "";
  const xSource = req.headers.get("x-source") || "";
  const expected = `Bearer ${serviceKey}`;
  if (authHeader !== expected || xSource !== "elevenlabs") {
    return jsonResponse({ error: "Unauthorised" }, 401);
  }

  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Normalise payload — accept either the ElevenLabs post-call webhook format
  // (nested under .data with type="post_call_transcription") or the flat test format.
  let body: any;
  if (raw?.type === "post_call_transcription" && raw?.data && typeof raw.data === "object") {
    const d = raw.data;
    const meta = d.metadata ?? {};
    const startUnix = Number(meta.start_time_unix_secs ?? 0);
    const durSecs = Number(meta.call_duration_secs ?? 0);
    const startedAtIso = startUnix ? new Date(startUnix * 1000).toISOString() : null;
    const endedAtIso = startUnix ? new Date((startUnix + durSecs) * 1000).toISOString() : null;

    const dcrRaw = d.analysis?.data_collection_results;
    let data_collection: Record<string, unknown> = {};
    if (!dcrRaw || typeof dcrRaw !== "object") {
      console.warn(`[process-ppg-call] No data_collection_results in payload, conversation_id=${d.conversation_id}`);
    } else {
      for (const [k, v] of Object.entries(dcrRaw as Record<string, any>)) {
        data_collection[k] = v && typeof v === "object" && "value" in v ? v.value : v;
      }
    }

    const transcriptArr = Array.isArray(d.transcript)
      ? d.transcript.map((t: any) => ({
          role: t.role,
          message: t.message,
          time_offset_s: Number(t.time_in_call_secs ?? 0),
        }))
      : [];

    body = {
      conversation_id: d.conversation_id,
      agent_id: d.agent_id,
      duration_seconds: durSecs,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      data_collection,
      transcript: transcriptArr,
    };
  } else {
    body = raw;
  }

  const conversation_id = body?.conversation_id;
  const data_collection = body?.data_collection;
  const transcript = body?.transcript;
  const ended_at = body?.ended_at;
  const duration_seconds = Number(body?.duration_seconds ?? 0);

  if (!conversation_id || typeof conversation_id !== "string") {
    return jsonResponse({ error: "Missing conversation_id" }, 400);
  }
  if (!data_collection || typeof data_collection !== "object") {
    return jsonResponse({ error: "Missing data_collection" }, 400);
  }
  if (!Array.isArray(transcript)) {
    return jsonResponse({ error: "Missing transcript" }, 400);
  }

  const surveyCompleted = data_collection.survey_completed === true;
  console.log(`[process-ppg-call] Received call ${conversation_id}, completed=${surveyCompleted}, duration=${duration_seconds}s`);

  // Idempotency
  const { data: existing } = await admin
    .from("nres_ppg_responses")
    .select("id")
    .eq("elevenlabs_conversation_id", conversation_id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({ success: true, duplicate: true });
  }

  if (!surveyCompleted) {
    console.log(`[process-ppg-call] Incomplete call ${conversation_id} — discarded`);
    return jsonResponse({ success: true, discarded: true });
  }

  // Validate
  const practice_id = String(data_collection.practice_id ?? "");
  const practice_label = String(data_collection.practice_label ?? "").slice(0, 200);
  const rating = String(data_collection.rating ?? "");
  const branch_site_raw = data_collection.branch_site ?? null;
  const branch_site: string | null = branch_site_raw ? String(branch_site_raw) : null;
  let followup_reason: string | null = data_collection.followup_reason ? String(data_collection.followup_reason) : null;
  let followup_label: string | null = data_collection.followup_label ? String(data_collection.followup_label).slice(0, 200) : null;
  const comment_raw = typeof data_collection.comment === "string" ? data_collection.comment : null;
  const comment = comment_raw ? comment_raw.slice(0, 400) : null;

  if (!ALLOWED_PRACTICES.has(practice_id)) {
    return jsonResponse({ error: "Validation failed", details: "Invalid practice_id" }, 400);
  }
  if (!practice_label) {
    return jsonResponse({ error: "Validation failed", details: "Missing practice_label" }, 400);
  }
  if (!ALLOWED_RATINGS.has(rating)) {
    return jsonResponse({ error: "Validation failed", details: "Invalid rating" }, 400);
  }
  if (rating === "worse") {
    if (!followup_reason || !ALLOWED_REASONS.has(followup_reason)) {
      return jsonResponse({ error: "Validation failed", details: "followup_reason required for worse rating" }, 400);
    }
  } else {
    followup_reason = null;
    followup_label = null;
  }
  if (branch_site && !ALLOWED_BRANCHES.has(branch_site)) {
    return jsonResponse({ error: "Validation failed", details: "Invalid branch_site" }, 400);
  }
  if (!ended_at) {
    return jsonResponse({ error: "Validation failed", details: "Missing ended_at" }, 400);
  }

  // Insert
  const { data: inserted, error: insertErr } = await admin
    .from("nres_ppg_responses")
    .insert({
      practice_id,
      practice_label,
      branch_site,
      rating,
      followup_reason,
      followup_label,
      comment,
      channel: "telephony",
      user_agent: "ElevenLabs Voice Agent v1",
      call_duration_seconds: Math.round(duration_seconds) || null,
      transcript_json: transcript,
      elevenlabs_conversation_id: conversation_id,
      submitted_at: ended_at,
      submission_token: `el:${conversation_id}`,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[process-ppg-call] Insert error", insertErr);
    return jsonResponse({ error: "Could not save response", details: insertErr.message }, 500);
  }

  console.log(`[process-ppg-call] Inserted row ${inserted.id} for ${practice_label}, rating=${rating}`);

  // Email
  if (!RESEND_API_KEY) {
    await logEmailFailure(conversation_id, "RESEND_API_KEY missing", inserted.id, { conversation_id });
  } else {
    try {
      const { subject, html, text } = buildEmail({
        practiceLabel: practice_label,
        branchSite: branch_site,
        rating,
        followupLabel: followup_label,
        comment,
        endedAt: ended_at,
        durationSeconds: Math.round(duration_seconds),
        transcript: transcript as Array<{ role: string; message: string; time_offset_s: number }>,
      });
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
        await logEmailFailure(conversation_id, `Resend ${resp.status}: ${errBody.slice(0, 800)}`, inserted.id, { conversation_id });
      } else {
        console.log(`[process-ppg-call] Email sent to ${NOTIFY_TO}`);
      }
    } catch (e) {
      await logEmailFailure(conversation_id, `Resend exception: ${(e as Error).message}`, inserted.id, { conversation_id });
    }
  }

  return jsonResponse({ success: true, id: inserted.id });
});
