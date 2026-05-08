// Acknowledge a Mandatory Read (signed-in user OR magic-link token)
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
const admin = createClient(supabaseUrl, serviceKey);

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { mandatory_read_id, token, typed_name, user_id } = body || {};
    if (!mandatory_read_id || !typed_name) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find assignment
    let assignmentQuery = admin
      .from("mandatory_read_assignments")
      .select("*")
      .eq("mandatory_read_id", mandatory_read_id);

    if (token) {
      const tokenHash = await hashToken(token);
      assignmentQuery = assignmentQuery.eq("magic_token_hash", tokenHash);
    } else if (user_id) {
      assignmentQuery = assignmentQuery.eq("user_id", user_id);
    } else {
      return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: assignment, error: aErr } = await assignmentQuery.maybeSingle();
    if (aErr || !assignment) {
      return new Response(JSON.stringify({ error: "assignment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (token && assignment.magic_token_expires_at && new Date(assignment.magic_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: policy } = await admin
      .from("mandatory_reads")
      .select("id, title, version, version_hash")
      .eq("id", mandatory_read_id)
      .single();

    if (!policy) {
      return new Response(JSON.stringify({ error: "policy not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;
    const ackTs = new Date().toISOString();

    // Insert acknowledgement
    const { error: ackErr } = await admin.from("mandatory_read_acknowledgements").insert({
      assignment_id: assignment.id,
      mandatory_read_id: policy.id,
      version_hash: policy.version_hash,
      version_at_ack: policy.version,
      typed_name,
      acknowledged_at: ackTs,
      ip,
      user_agent: ua,
      user_id: assignment.user_id,
      email: assignment.email,
    });
    if (ackErr) {
      console.error("[mandatory-reads-acknowledge] ack insert err", ackErr);
      return new Response(JSON.stringify({ error: ackErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update assignment status
    await admin
      .from("mandatory_read_assignments")
      .update({
        status: "acknowledged",
        acknowledged_at: ackTs,
        next_reminder_at: null,
      })
      .eq("id", assignment.id);

    // Send receipt email
    if (RESEND_API_KEY) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <h2 style="color:#0f3460;margin:0 0 16px">Acknowledgement received</h2>
        <p>Hi ${escapeHtml(assignment.full_name)},</p>
        <p>Thank you for confirming you have read and understood:</p>
        <p style="font-size:16px;font-weight:600;background:#f5f7fa;padding:12px 16px;border-radius:6px">${escapeHtml(policy.title)} (v${policy.version})</p>
        <p><strong>Acknowledged at:</strong> ${new Date(ackTs).toLocaleString("en-GB", { timeZone: "Europe/London", hour12: false })} UK time</p>
        <p><strong>Signed:</strong> ${escapeHtml(typed_name)}</p>
        <p style="font-size:12px;color:#666;margin-top:32px">This acknowledgement is held in your practice's audit log for inspector review.</p>
      </div>`;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [assignment.email], subject: `Acknowledgement receipt: ${policy.title}`, html }),
        });
      } catch (e) {
        console.error("[mandatory-reads-acknowledge] receipt email failed", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[mandatory-reads-acknowledge] err", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
