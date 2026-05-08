// Publish a Mandatory Read: create assignments + send initial emails
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Notewell AI <noreply@bluepcn.co.uk>";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://gpnotewell.co.uk";

const admin = createClient(supabaseUrl, serviceKey);

interface Assignee {
  email: string;
  full_name: string;
  user_id?: string | null;
  role?: string | null;
}

interface PublishBody {
  mandatory_read_id: string;
  assignees: Assignee[];
  send_initial_email?: boolean;
  is_update?: boolean; // true when re-publishing a new version
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

function emailHtml(opts: { name: string; title: string; due: string; url: string; isUpdate: boolean }) {
  const intro = opts.isUpdate
    ? `An updated version of <strong>${escapeHtml(opts.title)}</strong> has been published. Please re-read and acknowledge.`
    : `You have been assigned a mandatory policy to read: <strong>${escapeHtml(opts.title)}</strong>.`;
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="color:#0f3460;margin:0 0 16px">Mandatory read</h2>
    <p>Hi ${escapeHtml(opts.name)},</p>
    <p>${intro}</p>
    <p><strong>Due by:</strong> ${escapeHtml(opts.due)}</p>
    <p style="margin:24px 0">
      <a href="${opts.url}" style="background:#0f3460;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">Read &amp; acknowledge</a>
    </p>
    <p style="font-size:12px;color:#666;margin-top:32px">This is an automated message from Notewell AI. Acknowledgements are recorded for audit purposes (CQC inspector log).</p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  if (!RESEND_API_KEY) {
    console.log("[mandatory-reads-publish] No RESEND_API_KEY, skipping email to", to);
    return null;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!resp.ok) {
    console.error("[mandatory-reads-publish] resend error", resp.status, await resp.text());
    return null;
  }
  const j = await resp.json();
  return j.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body: PublishBody = await req.json();
    if (!body.mandatory_read_id || !Array.isArray(body.assignees)) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: policy, error: pErr } = await admin
      .from("mandatory_reads")
      .select("*")
      .eq("id", body.mandatory_read_id)
      .single();
    if (pErr || !policy) {
      return new Response(JSON.stringify({ error: "policy not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dueAt = new Date(Date.now() + (policy.due_days || 14) * 86400_000).toISOString();
    const dueDisplay = new Date(dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    let created = 0;
    let emailed = 0;

    for (const a of body.assignees) {
      if (!a.email || !a.full_name) continue;
      const token = genToken();
      const tokenHash = await hashToken(token);
      const tokenExpires = new Date(Date.now() + 90 * 86400_000).toISOString();

      // upsert reset for the same person
      const { data: assignment, error: aErr } = await admin
        .from("mandatory_read_assignments")
        .upsert({
          mandatory_read_id: policy.id,
          email: a.email.toLowerCase(),
          full_name: a.full_name,
          user_id: a.user_id ?? null,
          role_snapshot: a.role ?? null,
          practice_id: policy.practice_id,
          due_at: dueAt,
          status: "outstanding",
          reminder_count: 0,
          last_reminder_at: null,
          next_reminder_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
          magic_token_hash: tokenHash,
          magic_token_expires_at: tokenExpires,
          acknowledged_at: null,
          paused: false,
        }, { onConflict: "mandatory_read_id,email" })
        .select("id")
        .single();
      if (aErr) {
        console.error("[mandatory-reads-publish] assignment err:", aErr.message);
        continue;
      }
      created++;

      if (body.send_initial_email !== false) {
        const url = `${APP_BASE_URL}/mandatory-reads/${policy.id}?token=${token}`;
        const html = emailHtml({ name: a.full_name, title: policy.title, due: dueDisplay, url, isUpdate: !!body.is_update });
        const subject = body.is_update
          ? `Updated mandatory read: ${policy.title}`
          : `Mandatory read: ${policy.title}`;
        const messageId = await sendEmail(a.email, subject, html);
        if (messageId) emailed++;
        await admin.from("mandatory_read_reminder_log").insert({
          assignment_id: assignment.id,
          kind: body.is_update ? "updated" : "initial",
          message_id: messageId,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, created, emailed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[mandatory-reads-publish] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
