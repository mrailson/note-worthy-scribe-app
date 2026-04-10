import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePassword(): string {
  const words = [
    "run", "let", "set", "map", "sun", "red", "top", "big", "hot", "new",
    "sky", "oak", "pen", "cup", "hat", "box", "fox", "bay", "key", "jam",
    "ice", "dew", "elm", "fog", "gem", "hop", "ink", "joy", "kit", "log",
    "mud", "net", "owl", "pip", "ram", "tap", "vet", "win", "zip", "ace",
    "bear", "cake", "dawn", "east", "farm", "gate", "hill", "iron", "jade",
    "lake", "mint", "nest", "pine", "rain", "sage", "tree", "vine", "wave",
    "blue", "calm", "dark", "fern", "gold", "haze", "leaf", "moon", "palm",
    "rose", "sand", "wind", "bell", "cord", "drum", "fish", "glow", "hive",
  ];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 9) + 1; // 1-9
  return `${w1}${num}${w2}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header present");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Caller:", caller.email);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is super_admin or management_lead
    const { data: roleData, error: roleError } = await adminClient
      .from("nres_system_roles")
      .select("role")
      .eq("user_email", caller.email)
      .in("role", ["super_admin", "management_lead"])
      .limit(1)
      .maybeSingle();
    
    if (roleError) {
      console.error("Role check error:", roleError.message);
    }
    if (!roleData) {
      console.error("User not SDA:", caller.id);
      return new Response(JSON.stringify({ error: "Not authorised — system admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pmEmail, pmName, practiceName, practiceId: dpiaRecordId, odsCode, dpiaBase64, dpiaFileName, testMode } = body;
    const TEST_RECIPIENT = "malcolm.railson@nhs.net";
    const isTest = testMode === true;
    console.log("Onboarding:", pmEmail, practiceName, "ODS:", odsCode, "testMode:", isTest);

    if (!pmEmail || !pmName || !practiceName || !dpiaBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the actual gp_practices ID from ODS code
    let gpPracticeId: string | null = null;
    if (odsCode) {
      const { data: gpMatch } = await adminClient
        .from("gp_practices")
        .select("id")
        .eq("practice_code", odsCode)
        .maybeSingle();
      if (gpMatch) {
        gpPracticeId = gpMatch.id;
        console.log(`Resolved ODS ${odsCode} to gp_practices ID: ${gpPracticeId}`);
      } else {
        console.warn(`No gp_practices match for ODS code: ${odsCode}`);
      }
    }

    // Step 1: Check if user already exists — use admin API with email filter
    let alreadyExisted = false;
    let userId: string | null = null;
    let tempPassword: string | null = null;

    // Try to find by email using the admin API
    const { data: { users: matchedUsers }, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Search across all users by fetching with a filter approach
    // Use the Supabase REST API to check auth.users by email
    const { data: profileMatch } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", pmEmail.toLowerCase())
      .maybeSingle();

    let existingUser = null;
    if (profileMatch) {
      // Verify user exists in auth
      const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(profileMatch.id);
      if (authUser) {
        existingUser = authUser;
      }
    }

    if (!existingUser) {
      // Also try creating — if email exists, createUser will fail with a specific error
      // But first, let's try a direct lookup
      try {
        const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        existingUser = allUsers?.find(
          (u: any) => u.email?.toLowerCase() === pmEmail.toLowerCase()
        ) || null;
      } catch (listErr) {
        console.error("listUsers error (non-fatal):", listErr);
      }
    }

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
        console.error("Create user error:", createError.message);
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
        practice_id: gpPracticeId || null,
        practice_name: practiceName,
        k_code: odsCode || null,
        modules: ["ai4gp", "complaints", "meetings", "translation", "survey", "cqc_compliance"],
        created_by: "dpia_onboarding",
      }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile upsert error:", profileError.message);
      }

      // Step 2b: Create user_roles record with default PM module access
      const { error: roleError2 } = await adminClient.from("user_roles").insert({
        user_id: userId,
        practice_id: gpPracticeId || null,
        role: "practice_manager",
        practice_role: "Practice Manager",
        assigned_by: caller.id,
        meeting_notes_access: true,
        complaints_manager_access: true,
        translation_service_access: true,
        survey_manager_access: true,
        gp_scribe_access: false,
        enhanced_access: false,
        cqc_compliance_access: true,
        shared_drive_access: false,
        mic_test_service_access: false,
        api_testing_service_access: false,
        document_signoff_access: false,
      });

      if (roleError2) {
        console.error("User roles insert error:", roleError2.message);
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
          from: "Notewell AI <noreply@bluepcn.co.uk>",
          to: [pmEmail],
          bcc: ["malcolm.railson@nhs.net"],
          subject: `Notewell AI – DPIA for ${practiceName}`,
          html: dpiaEmailBody,
          attachments: [{
            filename: dpiaFileName || `DPIA_Notewell_AI_${practiceName.replace(/\s+/g, "_")}.doc`,
            content: dpiaBase64,
            content_type: "application/msword",
          }],
        }),
      });
      const dpiaResult = await dpiaResp.text();
      console.log("DPIA email response:", dpiaResp.status, dpiaResult);
      dpiaEmailSent = dpiaResp.ok;
      if (!dpiaResp.ok) {
        console.error("DPIA email failed:", dpiaResult);
      }
    } catch (emailErr) {
      console.error("DPIA email error:", emailErr);
    }

    // Step 4: Send Welcome/Credentials email via send-user-welcome-email (only for new users)
    let welcomeEmailSent = false;
    if (!alreadyExisted && tempPassword) {
      try {
        const welcomeResp = await fetch(
          `${supabaseUrl}/functions/v1/send-user-welcome-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({
              user_email: pmEmail,
              user_name: pmName,
              user_password: tempPassword,
              user_role: "practice_manager",
              practice_name: practiceName,
              module_access: {
                ai4gp_access: true,
                complaints_manager_access: true,
                meeting_notes_access: true,
                translation_service_access: true,
                survey_manager_access: true,
                gp_scribe_access: false,
                enhanced_access: false,
                cqc_compliance_access: false,
                shared_drive_access: false,
                mic_test_service_access: false,
                api_testing_service_access: false,
                fridge_monitoring_access: false,
                cso_governance_access: false,
                lg_capture_access: false,
                bp_service_access: false,
                policy_service_access: false,
              },
            }),
          }
        );
        const welcomeResult = await welcomeResp.text();
        console.log("Welcome email response:", welcomeResp.status, welcomeResult);
        welcomeEmailSent = welcomeResp.ok;
      } catch (emailErr) {
        console.error("Welcome email error:", emailErr);
      }
    }

    // Update onboarded_at
    if (body.dpiaRecordId) {
      const { error: updateErr } = await adminClient.from("dpia_practices").update({
        onboarded_at: new Date().toISOString(),
      }).eq("id", body.dpiaRecordId);
      if (updateErr) console.error("Update onboarded_at error:", updateErr.message);
    }

    console.log("Onboarding complete:", { alreadyExisted, userId, dpiaEmailSent, welcomeEmailSent });

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
    console.error("Onboard practice error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
