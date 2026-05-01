import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  filePaths: string[]; // storage paths in nres-claim-evidence bucket
  fileNames?: string[]; // optional original names matching filePaths
  recipientEmail?: string; // optional override; default = caller's email
  subject?: string;
  message?: string;
  claimLabel?: string; // for subject/body context, e.g. "April 2026 — NRES Management"
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Identify caller via their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: RequestBody = await req.json();
    const filePaths = Array.isArray(body.filePaths) ? body.filePaths.filter(Boolean) : [];
    if (filePaths.length === 0) {
      return new Response(JSON.stringify({ error: "filePaths is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipient = body.recipientEmail || user.email;
    const subject = body.subject || `Supporting evidence${body.claimLabel ? ` — ${body.claimLabel}` : ""}`;

    // Service-role client to read storage regardless of RLS scoping for admin/approver flows
    const adminClient = createClient(supabaseUrl, serviceKey);

    const attachments: Array<{ filename: string; content: string }> = [];
    for (let i = 0; i < filePaths.length; i++) {
      const path = filePaths[i];
      const providedName = body.fileNames?.[i];
      const filename = providedName || path.split("/").pop() || `evidence-${i + 1}`;
      const { data, error } = await adminClient.storage.from("nres-claim-evidence").download(path);
      if (error || !data) {
        console.error("download failed", path, error);
        continue;
      }
      const buf = await data.arrayBuffer();
      attachments.push({ filename, content: arrayBufferToBase64(buf) });
    }

    if (attachments.length === 0) {
      return new Response(JSON.stringify({ error: "No files could be attached" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fileList = attachments.map(a => `<li>${a.filename}</li>`).join("");
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937;">
        <p>${body.message ? body.message.replace(/\n/g, "<br/>") : "Please find the requested supporting evidence attached."}</p>
        ${body.claimLabel ? `<p style=\"color:#475569\"><strong>Claim:</strong> ${body.claimLabel}</p>` : ""}
        <p><strong>${attachments.length}</strong> file${attachments.length === 1 ? "" : "s"} attached:</p>
        <ul>${fileList}</ul>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent from Notewell AI — SDA Claims</p>
      </div>`;

    const resend = new Resend(resendKey);
    const sendRes = await resend.emails.send({
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: [recipient],
      subject,
      html,
      attachments,
    });

    if ((sendRes as any).error) {
      console.error("Resend error:", (sendRes as any).error);
      return new Response(JSON.stringify({ error: (sendRes as any).error.message || "Email send failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, attached: attachments.length, recipient }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("send-evidence-email error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
