// AgeWell web feedback form submission (public, no HMAC).
// Inserts a row into agewell_responses (channel='web') and emails via Resend.
import { createClient } from "npm:@supabase/supabase-js@2";

const LOG = "[submit-agewell-feedback]";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("AGEWELL_FROM_EMAIL") ||
  "Ageing Well Feedback <noreply@gpnotewell.co.uk>";
const TO_EMAILS = (Deno.env.get("AGEWELL_TO_EMAILS") || "")
  .split(",").map((e) => e.trim()).filter(Boolean);

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
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", hour12: false,
  }).format(new Date(iso)) + " UK time";
}

async function logEmailFailure(responseId: string | null, msg: string, payload: any) {
  try {
    await admin.from("email_failures").insert({
      response_id: responseId,
      source: "submit-agewell-feedback",
      error_message: msg.slice(0, 1000),
      payload,
    });
  } catch (e) {
    console.error(`${LOG} failed to log email_failures:`, (e as Error).message);
  }
}

const ALLOWED_YN = new Set(["yes", "no"]);
const ALLOWED_YNU = new Set(["yes", "no", "unsure"]);
const ALLOWED_YNUNA = new Set(["yes", "no", "unsure", "not_applicable"]);
const ALLOWED_AGREE = new Set(["agree", "neutral", "disagree"]);
const ALLOWED_COMPLETED = new Set(["with_support_worker", "on_my_own", "phone_with_automated_assistant"]);

function clean(v: unknown, allowed: Set<string>): string | null {
  if (typeof v !== "string") return null;
  return allowed.has(v) ? v : null;
}
function intInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= min && i <= max ? i : null;
}
function strOrNull(v: unknown, max = 1000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Honeypot — silently succeed
  if (typeof body?.honeypot === "string" && body.honeypot.trim().length > 0) {
    console.log(`${LOG} honeypot tripped`);
    return jsonResponse({ success: true });
  }

  const userAgent = req.headers.get("user-agent") ?? body?.user_agent ?? null;

  const row = {
    channel: "web" as const,
    practice_canonical: strOrNull(body?.practice_canonical, 200),
    practice_label_freeform: strOrNull(body?.practice_label_freeform, 200),
    branch_site: strOrNull(body?.branch_site, 200),
    support_worker_rating: intInRange(body?.support_worker_rating, 1, 5),
    equipment_provided: clean(body?.equipment_provided, ALLOWED_YNU),
    signposted: clean(body?.signposted, ALLOWED_YN),
    online_meeting_concerns_discussed: clean(body?.online_meeting_concerns_discussed, ALLOWED_YNUNA),
    medicine_review_beneficial: clean(body?.medicine_review_beneficial, ALLOWED_YNUNA),
    listened_to_concerns: clean(body?.listened_to_concerns, ALLOWED_AGREE),
    more_independent: clean(body?.more_independent, ALLOWED_AGREE),
    most_significant_difference: strOrNull(body?.most_significant_difference, 1000),
    overall_rating: intInRange(body?.overall_rating, 1, 5),
    would_recommend: clean(body?.would_recommend, ALLOWED_YNU),
    suggestions_concerns: strOrNull(body?.suggestions_concerns, 1000),
    completed_with_support: clean(body?.completed_with_support, ALLOWED_COMPLETED),
    user_agent: userAgent,
  };

  console.log(`${LOG} inserting practice=${row.practice_canonical ?? row.practice_label_freeform} rating=${row.overall_rating}`);

  const { data: inserted, error: insertErr } = await admin
    .from("agewell_responses")
    .insert(row)
    .select("id, submitted_at")
    .single();

  if (insertErr) {
    console.error(`${LOG} insert error:`, insertErr);
    return jsonResponse({ success: false, error: insertErr.message }, 400);
  }

  const responseId = inserted?.id ?? null;
  const submittedAt = inserted?.submitted_at ?? new Date().toISOString();
  console.log(`${LOG} inserted id=${responseId}`);

  // Email (best effort)
  if (RESEND_API_KEY && TO_EMAILS.length) {
    const practiceLabel = row.practice_canonical || row.practice_label_freeform || "Unknown practice";
    const branchSuffix = row.branch_site ? ` (${row.branch_site})` : "";
    const ratingStr = row.overall_rating != null ? `${row.overall_rating}/5` : "—";
    const subject = `[Web] AgeWell — ${practiceLabel}${branchSuffix} — ${ratingStr}`;

    const fieldRow = (label: string, value: string | number | null) => {
      if (value == null || value === "") return "";
      return `<tr>
        <td style="padding:8px 14px 8px 0;color:#64748B;font-size:13px;width:42%;vertical-align:top">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;color:#1E293B;font-weight:600">${escapeHtml(String(value))}</td>
      </tr>`;
    };

    const surveyHtml = [
      fieldRow("Support worker rating", row.support_worker_rating),
      fieldRow("Equipment provided", row.equipment_provided),
      fieldRow("Signposted to other services", row.signposted),
      fieldRow("Online meeting concerns discussed", row.online_meeting_concerns_discussed),
      fieldRow("Medicine review beneficial", row.medicine_review_beneficial),
      fieldRow("Listened to concerns", row.listened_to_concerns),
      fieldRow("Feels more independent", row.more_independent),
      fieldRow("Overall rating", row.overall_rating != null ? `${row.overall_rating}/5` : null),
      fieldRow("Would recommend", row.would_recommend),
      fieldRow("Completed with support", row.completed_with_support),
    ].join("");

    const commentBlock = (label: string, text: string | null) => text ? `
      <div style="margin-top:16px">
        <div style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">${escapeHtml(label)}</div>
        <blockquote style="margin:0;padding:12px 16px;background:#F1F5F9;border-left:4px solid #4DB6A6;color:#1E293B;font-size:14px;line-height:1.55;border-radius:6px;font-style:italic">${escapeHtml(text).replace(/\n/g, "<br>")}</blockquote>
      </div>` : "";

    const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1E293B">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,37,64,.08)">
      <tr><td style="background:#4DB6A6;color:#FFFFFF;padding:20px 28px;font-weight:700;font-size:17px;letter-spacing:0.3px">
        AgeWell — New Web Feedback
      </td></tr>
      <tr><td style="padding:22px 28px 6px">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${fieldRow("Practice", `${practiceLabel}${branchSuffix}`)}
          ${fieldRow("Submitted", formatUkDate(submittedAt))}
        </table>
        <div style="margin-top:18px">
          <div style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">Survey answers</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;padding:8px 14px">
            ${surveyHtml || `<tr><td style="padding:8px 0;color:#94A3B8;font-size:13px">(no survey fields)</td></tr>`}
          </table>
        </div>
        ${commentBlock("Most significant difference", row.most_significant_difference)}
        ${commentBlock("Suggestions or concerns", row.suggestions_concerns)}
      </td></tr>
      <tr><td style="padding:18px 28px 24px;color:#64748B;font-size:12px;line-height:1.6;border-top:1px solid #E2E8F0">
        Sent automatically from the AgeWell web feedback form.<br>
        View all responses: <a href="https://gpnotewell.co.uk/admin/agewell-responses" style="color:#1F7A6F">https://gpnotewell.co.uk/admin/agewell-responses</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAILS, subject, html }),
      });
      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`${LOG} Resend ${resp.status}: ${errBody}`);
        await logEmailFailure(responseId, `Resend ${resp.status}: ${errBody.slice(0, 800)}`, { subject });
      } else {
        console.log(`${LOG} email sent for id=${responseId}`);
      }
    } catch (e) {
      console.error(`${LOG} Resend exception:`, (e as Error).message);
      await logEmailFailure(responseId, `Resend exception: ${(e as Error).message}`, { subject });
    }
  } else {
    console.warn(`${LOG} email skipped (RESEND_API_KEY or AGEWELL_TO_EMAILS missing)`);
  }

  return jsonResponse({ success: true, id: responseId });
});
