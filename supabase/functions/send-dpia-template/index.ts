import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const TEMPLATE_B64 = "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";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(
      (r: any) => ["super_admin", "management_lead", "system_admin"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipientEmail, recipientName, practiceName, practiceOds } = await req.json();

    if (!recipientEmail || !recipientName) {
      return new Response(
        JSON.stringify({ error: "recipientEmail and recipientName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const practiceLabel = practiceName ? ` for ${practiceName}` : "";
    const practiceOdsLabel = practiceOds ? ` (ODS: ${practiceOds})` : "";
    const practiceFullLabel = practiceName ? ` for <strong>${practiceName}</strong>${practiceOdsLabel}` : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:#003087;padding:28px 32px;">
<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Notewell AI</h1>
<p style="color:#8bb8e8;margin:6px 0 0;font-size:14px;">DPIA Practice Data Collection Template</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
<p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 16px;">Dear ${recipientName},</p>

<p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 16px;">
Following formal approval from the NHS Northamptonshire ICB DDaT Delivery Group, your practice has been approved as a pilot site for <strong>Notewell AI</strong> \u2013 an MHRA Class I registered medical device platform designed for NHS primary care.
</p>

<p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 16px;">
To prepare a custom <strong>Data Protection Impact Assessment (DPIA)</strong>${practiceFullLabel}, along with a suggested Privacy Notice update, we need to collect some key information from you.
</p>

<!-- Action Card -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f6ff;border-radius:8px;border-left:4px solid #005EB8;margin:20px 0;">
<tr><td style="padding:20px;">
<p style="color:#003087;font-size:15px;font-weight:700;margin:0 0 8px;">\u2709\ufe0f What we need from you</p>
<p style="color:#333;font-size:14px;line-height:1.6;margin:0;">
Please complete the attached <strong>DPIA Practice Data Collection Template</strong> and return it to:
</p>
<p style="margin:12px 0 0;">
<a href="mailto:Malcolm.railson@nhs.net" style="color:#005EB8;font-weight:700;font-size:15px;text-decoration:none;">Malcolm.railson@nhs.net</a>
</p>
</td></tr>
</table>

<p style="color:#333;font-size:14px;line-height:1.7;margin:16px 0;">
The template asks for standard practice details including:
</p>
<ul style="color:#333;font-size:14px;line-height:1.8;margin:0 0 16px;padding-left:20px;">
<li>Practice name, address, and ODS code</li>
<li>Practice Manager contact details</li>
<li>Information Governance details (ICO registration, DSPT status)</li>
<li>Caldicott Guardian and DPO information</li>
</ul>

<p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 16px;">
Once we receive the completed template, we will generate your practice-specific DPIA and set up your Notewell AI account with access to all approved modules.
</p>

<!-- Governance Box -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf8;border-radius:8px;border:1px solid #e0e8e0;margin:20px 0;">
<tr><td style="padding:16px;">
<p style="color:#2e7d32;font-size:13px;font-weight:700;margin:0 0 6px;">\u2705 Governance & Compliance</p>
<p style="color:#555;font-size:13px;line-height:1.6;margin:0;">
All clinical safety documentation (DCB0129, DCB0160, DTAC) has been completed and is available on request. Notewell AI is registered as an MHRA Class I Medical Device with CSO sign-off.
</p>
</td></tr>
</table>

<p style="color:#333;font-size:14px;line-height:1.7;margin:16px 0 0;">
If you have any questions, please don\u2019t hesitate to get in touch.
</p>

<p style="color:#333;font-size:14px;line-height:1.7;margin:24px 0 0;">
Kind regards,<br><br>
<strong>Malcolm Railson</strong><br>
<span style="color:#666;font-size:13px;">PCN Manager and Notewell Developer<br>
Primary Care Northamptonshire GP Practices</span>
</p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f8f9fb;padding:20px 32px;border-top:1px solid #e8ecf1;">
<p style="color:#888;font-size:11px;margin:0;text-align:center;">
This email was sent by Notewell AI on behalf of Northamptonshire Rural PCN.<br>
Confidential \u2013 intended for the named recipient only.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const emailPayload = {
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: [recipientEmail],
      subject: `Notewell AI \u2013 DPIA Practice Data Collection Template${practiceLabel}`,
      html: htmlBody,
      attachments: [
        {
          filename: "Notewell_AI_DPIA_Practice_Data_Template_V1.1.docx",
          content: TEMPLATE_B64,
        },
      ],
    };

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResp.json();

    if (!resendResp.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
