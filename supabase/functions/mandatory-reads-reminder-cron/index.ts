// Cron-driven reminder dispatcher for Mandatory Reads
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Notewell AI <noreply@bluepcn.co.uk>";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://gpnotewell.co.uk";
const admin = createClient(supabaseUrl, serviceKey);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

function genToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function reminderHtml(opts: { name: string; title: string; due: string; url: string; overdue: boolean }) {
  const heading = opts.overdue ? "Mandatory read OVERDUE" : "Reminder: mandatory read";
  const colour = opts.overdue ? "#c0392b" : "#0f3460";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="color:${colour};margin:0 0 16px">${heading}</h2>
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>${opts.overdue ? "This policy is now overdue." : "This is a reminder that you have a mandatory policy to read:"}</p>
    <p style="font-size:16px;font-weight:600;background:#f5f7fa;padding:12px 16px;border-radius:6px">${escapeHtml(opts.title)}</p>
    <p><strong>${opts.overdue ? "Was due:" : "Due by:"}</strong> ${escapeHtml(opts.due)}</p>
    <p style="margin:24px 0">
      <a href="${opts.url}" style="background:${colour};color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">Read &amp; acknowledge</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:32px">Notewell AI — automated reminder.</p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  if (!RESEND_API_KEY) return null;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!resp.ok) {
    console.error("[mandatory-reads-reminder-cron] resend err", resp.status, await resp.text());
    return null;
  }
  const j = await resp.json();
  return j.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Mark overdue first
    await admin.rpc("mark_mandatory_read_overdue");

    // Pull assignments due for reminder (next_reminder_at <= now & not acknowledged & not paused)
    const { data: due, error } = await admin
      .from("mandatory_read_assignments")
      .select("*, mandatory_reads!inner(id,title,due_days,reminder_schedule,paused,archived)")
      .lte("next_reminder_at", new Date().toISOString())
      .in("status", ["outstanding", "overdue"])
      .eq("paused", false)
      .limit(200);

    if (error) {
      console.error("[mandatory-reads-reminder-cron] query err", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    for (const a of due || []) {
      const policy: any = a.mandatory_reads;
      if (!policy || policy.paused || policy.archived) continue;

      // Refresh magic token if missing/expired
      let tokenForLink = "";
      if (!a.magic_token_hash || (a.magic_token_expires_at && new Date(a.magic_token_expires_at) < new Date())) {
        const t = genToken();
        const th = await hashToken(t);
        await admin.from("mandatory_read_assignments").update({
          magic_token_hash: th,
          magic_token_expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
        }).eq("id", a.id);
        tokenForLink = t;
      }
      // Note: if existing token is valid, we cannot recover the plaintext.
      // The link will still work for signed-in users; magic-link recipients
      // get a fresh token only when their token expires (above).

      const url = tokenForLink
        ? `${APP_BASE_URL}/mandatory-reads/${policy.id}?token=${tokenForLink}`
        : `${APP_BASE_URL}/mandatory-reads/${policy.id}`;
      const dueDisplay = new Date(a.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const overdue = a.status === "overdue";
      const html = reminderHtml({ name: a.full_name, title: policy.title, due: dueDisplay, url, overdue });
      const subject = overdue
        ? `OVERDUE — please read: ${policy.title}`
        : `Reminder: please read ${policy.title}`;
      const messageId = await sendEmail(a.email, subject, html);
      if (messageId) sent++;

      // Schedule next reminder
      const schedule = policy.reminder_schedule || { days: [3, 7, 14], weekly_after: true };
      const count = (a.reminder_count || 0) + 1;
      let nextOffsetDays = 7;
      if (schedule.days && schedule.days[count]) {
        nextOffsetDays = schedule.days[count] - (schedule.days[count - 1] || 0);
      } else if (schedule.weekly_after) {
        nextOffsetDays = 7;
      }
      await admin.from("mandatory_read_assignments").update({
        reminder_count: count,
        last_reminder_at: new Date().toISOString(),
        next_reminder_at: new Date(Date.now() + nextOffsetDays * 86400_000).toISOString(),
      }).eq("id", a.id);

      await admin.from("mandatory_read_reminder_log").insert({
        assignment_id: a.id,
        kind: overdue ? "overdue" : "reminder",
        message_id: messageId,
      });
    }

    return new Response(JSON.stringify({ ok: true, processed: due?.length || 0, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[mandatory-reads-reminder-cron] err", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
