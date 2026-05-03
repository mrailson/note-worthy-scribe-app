import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserToCreate {
  email: string;
  name: string;
  organization: string;
  practice_id: string;
}

// Practice ID mappings
const PRACTICE_IDS = {
  OAK_LANE: "c800c954-3928-4a37-a5c4-c4ff3e680333", // Demo practice for PML, ICB, SNVB, Voluntary Impact
  BRACKLEY: "ca27fdcb-2a61-4a22-9c6f-9a8b92a6fbbe",
  TOWCESTER: "669ec9ca-6d24-43fc-9dc1-a34a8e20965e",
  SPRINGFIELD: "09c7d726-5cc5-49a4-8f3d-a65c2993aac5",
  BROOK: "ebb2bf2c-1d20-42d9-8572-ce07a4dae3de",
  BUGBROOKE: "85cd140c-2980-40df-8e19-0ffc8a9346d5",
  DENTON: "b2cbe569-30e3-4a66-838a-c2ad54b41ff2",
  DANES_CAMP: "fd00dd07-c07d-4e6d-a087-d99a57bd3423",
  PARKS: "cbbb5976-f7a7-4a02-899d-71b18e357e05",
};

// 23 new users (excluding 5 existing: malcolm.railson, chloe.lamont1, anita.carter5, alexander.whitehead, amanda.taylor75)
const NRES_USERS: UserToCreate[] = [
  // PML users
  { email: "m.green28@nhs.net", name: "Maureen Green", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  { email: "mark.gray1@nhs.net", name: "Mark Gray", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  { email: "carolyn.abbisogni@nhs.net", name: "Carolyn Abbisoni", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  { email: "claire.garbett3@nhs.net", name: "Claire Garbett", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  { email: "chloe.thorpe15@nhs.net", name: "Chloe Thorpe", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  { email: "a.pratyush@nhs.net", name: "Anshal Pratyush", organization: "Principal Medical Limited (PML)", practice_id: PRACTICE_IDS.OAK_LANE },
  
  // NHS ICB users
  { email: "michael.chapman13@nhs.net", name: "Michael Chapman", organization: "NHS Northamptonshire ICB", practice_id: PRACTICE_IDS.OAK_LANE },
  
  // Brackley Medical Centre
  { email: "sandra.easton2@nhs.net", name: "Sandra Easton", organization: "Brackley Medical Centre", practice_id: PRACTICE_IDS.BRACKLEY },
  { email: "tbeardsworth@nhs.net", name: "Tina Beardsworth", organization: "Brackley Medical Centre", practice_id: PRACTICE_IDS.BRACKLEY },
  
  // Towcester Medical Centre
  { email: "simon.ellis7@nhs.net", name: "Simon Ellis", organization: "Towcester Medical Centre", practice_id: PRACTICE_IDS.TOWCESTER },
  
  // Springfield Surgery
  { email: "dal.samra@nhs.net", name: "Dal Samra", organization: "Springfield Surgery", practice_id: PRACTICE_IDS.SPRINGFIELD },
  { email: "hayley.willingham1@nhs.net", name: "Hayley Willingham", organization: "Springfield Surgery", practice_id: PRACTICE_IDS.SPRINGFIELD },
  
  // The Brook Health Centre
  { email: "arif.supple@nhs.net", name: "Arif Supple", organization: "The Brook Health Centre", practice_id: PRACTICE_IDS.BROOK },
  { email: "lesley.driscoll@nhs.net", name: "Lesley Driscoll", organization: "The Brook Health Centre", practice_id: PRACTICE_IDS.BROOK },
  
  // Bugbrooke Medical Practice
  { email: "rachel.parry2@nhs.net", name: "Rachel Parry", organization: "Bugbrooke Medical Practice", practice_id: PRACTICE_IDS.BUGBROOKE },
  { email: "lorraine.spicer@nhs.net", name: "Lorraine Spicer", organization: "Bugbrooke Medical Practice", practice_id: PRACTICE_IDS.BUGBROOKE },
  
  // Denton Village Surgery
  { email: "davidwade@nhs.net", name: "David Wade", organization: "Denton Village Surgery", practice_id: PRACTICE_IDS.DENTON },
  { email: "nicola.draper3@nhs.net", name: "Nicola Draper", organization: "Denton Village Surgery", practice_id: PRACTICE_IDS.DENTON },
  { email: "amy.amin1@nhs.net", name: "Amy Amin", organization: "Denton Village Surgery", practice_id: PRACTICE_IDS.DENTON },
  
  // Danes Camp Medical Centre
  { email: "muhammad.chishti@nhs.net", name: "Muhammad Chishti", organization: "Danes Camp Medical Centre", practice_id: PRACTICE_IDS.DANES_CAMP },
  
  // The Parks Medical Practice
  { email: "charlotte.barnell1@nhs.net", name: "Charlotte Barnell", organization: "The Parks Medical Practice", practice_id: PRACTICE_IDS.PARKS },
  
  // SNVB
  { email: "helen.barrett@snvb.org.uk", name: "Helen Barrett", organization: "SNVB", practice_id: PRACTICE_IDS.OAK_LANE },
  
  // Voluntary Impact
  { email: "russell.rolph@voluntaryimpact.org.uk", name: "Russell Rolph", organization: "Voluntary Impact", practice_id: PRACTICE_IDS.OAK_LANE },
];

const DEFAULT_PASSWORD = "Letmein1!";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD: must be system_admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "system_admin",
    });
    if (adminCheckError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: system_admin role required", success: false }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    // ---- /AUTH GUARD ----

    const body = await req.json().catch(() => ({} as any));
    const assignedByUserId: string = body?.assigned_by || caller.id;
    // Password must be supplied per request — never hardcode credentials in source.
    const requestedPassword: string | undefined = body?.password;
    if (!requestedPassword || typeof requestedPassword !== "string" || requestedPassword.length < 12) {
      return new Response(
        JSON.stringify({ error: "A password (min 12 chars) must be supplied in the request body", success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const DEFAULT_PASSWORD = requestedPassword;

    const results: { success: string[]; failed: { email: string; error: string }[] } = {
      success: [],
      failed: []
    };

    console.log(`Starting bulk creation of ${NRES_USERS.length} users (password redacted)`);


    for (const user of NRES_USERS) {
      try {
        console.log(`Creating user: ${user.email}`);

        // Create the user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: user.name
          }
        });

        if (authError) {
          console.error(`Auth error for ${user.email}:`, authError);
          results.failed.push({ email: user.email, error: authError.message });
          continue;
        }

        if (!authData.user) {
          results.failed.push({ email: user.email, error: "No user data returned" });
          continue;
        }

        console.log(`User created: ${authData.user.id}`);

        // Create user role with practice_manager role and module access
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'practice_manager',
            practice_id: user.practice_id,
            assigned_by: assignedByUserId,
            meeting_notes_access: true,
            gp_scribe_access: false,
            complaints_manager_access: false,
            complaints_admin_access: false,
            replywell_access: false,
            enhanced_access: false,
            cqc_compliance_access: false,
            shared_drive_access: false,
            mic_test_service_access: false,
            api_testing_service_access: false,
            bp_service_access: true
          });

        if (roleError) {
          console.error(`Role error for ${user.email}:`, roleError);
          results.failed.push({ email: user.email, error: `Role assignment failed: ${roleError.message}` });
          continue;
        }

        // Add NRES service activation
        const { error: serviceError } = await supabaseAdmin
          .from('user_service_activations')
          .insert({
            user_id: authData.user.id,
            service: 'nres'
          });

        if (serviceError) {
          console.error(`Service activation error for ${user.email}:`, serviceError);
          // Don't fail the user creation, just log the error
        }

        results.success.push(user.email);
        console.log(`Successfully created user: ${user.email}`);

      } catch (userError: any) {
        console.error(`Error creating user ${user.email}:`, userError);
        results.failed.push({ email: user.email, error: userError.message || "Unknown error" });
      }
    }

    console.log(`Bulk creation complete. Success: ${results.success.length}, Failed: ${results.failed.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary: {
        total: NRES_USERS.length,
        created: results.success.length,
        failed: results.failed.length
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in bulk-create-nres-users function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
