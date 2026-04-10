import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 10; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    // Verify caller is system admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is sda
    const { data: roleData } = await adminClient
      .from("nres_system_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "sda")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not authorised — system admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      pmEmail, pmName, practiceName, practiceId, odsCode, dpiaBase64, dpiaFileName,
    } = body;

    if (!pmEmail || !pmName || !practiceName || !dpiaBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Check if user already exists
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.find(
      (u: any) => u.email?.toLowerCase() === pmEmail.toLowerCase()
    );

    let alreadyExisted = false;
    let userId: string | null = null;
    let tempPassword: string | null = null;

    if (existingUser) {
      alreadyExisted = true;
      userId = existingUser.id;
      console.log(`User already exists: ${pmEmail} (${userId})`);
    } else {
      // Create new user
      tempPassword = generatePassword();
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: pmEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: pmName, role: "practice_manager" },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(JSON.stringify({ error: `Failed to create account: ${createError.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      console.log(`Created new user: ${pmEmail} (${userId})`);

      // Step 2: Create profile
      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: userId,
        full_name: pmName,
        email: pmEmail,
        role: "practice_manager",
        practice_id: practiceId || null,
        practice_name: practiceName,
        k_code: odsCode || null,
        modules: ["ai4gp", "complaints", "meetings", "translation"],
        created_by: "dpia_onboarding",
      }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
        // Non-fatal — continue with emails
      }
    }

    // Step 3: Send DPIA email (always)
    const dpiaEmailBody = alreadyExisted
      ? `<div style="font-family:Arial,sans-serif;color:#212b32;line-height:1.6;max-width:600px;margin:0 auto;">
          <div style="background:#005EB8;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">Notewell AI — DPIA</h1>
          </div>
          <div style="padding:25px 30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
            <p>Dear ${pmName},</p>
            <p>Please find attached the completed Data Protection Impact Assessment (DPIA) for Notewell AI at <strong>${practiceName}</strong>.</p>
            <p>You already have an existing Notewell AI account — please use your current login details at <a href="https://notewell.dialai.co.uk" style="color:#005EB8;">https://notewell.dialai.co.uk</a>.</p>
            <p style="margin-top:20px;">Kind regards,<br/><strong>Malcolm Railson</strong><br/>PCN Manager and Notewell Developer<br/>Primary Care Northamptonshire GP Practices</p>
          </div>
        </div>`
      : `<div style="font-family:Arial,sans-serif;color:#212b32;line-height:1.6;max-width:600px;margin:0 auto;">
          <div style="background:#005EB8;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:22px;">Notewell AI — DPIA</h1>
          </div>
          <div style="padding:25px 30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
            <p>Dear ${pmName},</p>
            <p>Please find attached the completed Data Protection Impact Assessment (DPIA) for Notewell AI at <strong>${practiceName}</strong>.</p>
            <p>Your login details for the Notewell AI platform will follow in a separate email shortly.</p>
            <p style="margin-top:20px;">Kind regards,<br/><strong>Malcolm Railson</strong><br/>PCN Manager and Notewell Developer<br/>Primary Care Northamptonshire GP Practices</p>
          </div>
        </div>`;

    let dpiaEmailSent = false;
    try {
      const dpiaResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: "Notewell AI <noreply@gpnotewell.co.uk>",
          to: [pmEmail],
          bcc: ["malcolm.railson@nhs.net"],
          subject: `Notewell AI – DPIA for ${practiceName}`,
          html: dpiaEmailBody,
          attachments: [{
            filename: dpiaFileName || `DPIA_Notewell_AI_${practiceName.replace(/\s+/g, "_")}.pdf`,
            content: dpiaBase64,
          }],
        }),
      });
      const dpiaResult = await dpiaResp.text();
      console.log("DPIA email response:", dpiaResp.status, dpiaResult);
      dpiaEmailSent = dpiaResp.ok;
    } catch (emailErr) {
      console.error("DPIA email error:", emailErr);
    }

    // Step 4: Send Welcome/Credentials email (only for new users)
    let welcomeEmailSent = false;
    if (!alreadyExisted && tempPassword) {
      const welcomeHtml = `<div style="font-family:Arial,sans-serif;color:#212b32;line-height:1.6;max-width:600px;margin:0 auto;">
        <div style="background:#005EB8;padding:20px 30px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Welcome to Notewell AI</h1>
        </div>
        <div style="padding:25px 30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Dear ${pmName},</p>
          <p>Your Notewell AI account has been created for <strong>${practiceName}</strong>${odsCode ? ` (${odsCode})` : ""}.</p>
          
          <div style="background:#f0f4f9;border:2px solid #005EB8;border-radius:8px;padding:20px;margin:20px 0;">
            <h3 style="color:#005EB8;margin:0 0 12px 0;font-size:16px;">Your Login Details</h3>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Platform URL:</td><td style="padding:6px 0;"><a href="https://notewell.dialai.co.uk" style="color:#005EB8;">https://notewell.dialai.co.uk</a></td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;">Username:</td><td style="padding:6px 0;">${pmEmail}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;">Temporary Password:</td><td style="padding:6px 0;font-family:monospace;font-size:14px;background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #ddd;">${tempPassword}</td></tr>
            </table>
          </div>
          
          <p style="color:#d4351c;font-weight:bold;">You will be prompted to change your password on first login.</p>
          
          <h3 style="color:#005EB8;margin:20px 0 10px 0;font-size:15px;">Enabled Modules</h3>
          <ul style="padding-left:20px;">
            <li>AI4GP — Clinical Decision Support</li>
            <li>Complaints Management</li>
            <li>Meeting Manager</li>
            <li>Translation Services</li>
          </ul>
          
          <p>Your account is assigned to <strong>${practiceName}</strong>.</p>
          
          <p style="margin-top:25px;">Kind regards,<br/><strong>Malcolm Railson</strong><br/>PCN Manager and Notewell Developer<br/>Primary Care Northamptonshire GP Practices</p>
        </div>
      </div>`;

      try {
        const welcomeResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Notewell AI <noreply@gpnotewell.co.uk>",
            to: [pmEmail],
            bcc: ["malcolm.railson@nhs.net"],
            subject: `Notewell AI – Your Login Details for ${practiceName}`,
            html: welcomeHtml,
          }),
        });
        const welcomeResult = await welcomeResp.text();
        console.log("Welcome email response:", welcomeResp.status, welcomeResult);
        welcomeEmailSent = welcomeResp.ok;
      } catch (emailErr) {
        console.error("Welcome email error:", emailErr);
      }
    }

    // Update onboarded_at
    if (body.dpiaRecordId) {
      await adminClient.from("dpia_practices").update({
        onboarded_at: new Date().toISOString(),
      }).eq("id", body.dpiaRecordId);
    }

    return new Response(JSON.stringify({
      success: true,
      alreadyExisted,
      userId,
      dpiaEmailSent,
      welcomeEmailSent,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Onboard practice error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
