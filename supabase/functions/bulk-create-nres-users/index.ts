import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

// 23 users to create (excluding 5 existing accounts)
const NRES_USERS: UserToCreate[] = [
  { email: "james.sherrell@nhs.net", name: "James Sherrell", organization: "PML", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "dawn.sherrell@nhs.net", name: "Dawn Sherrell", organization: "PML", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "ian.rogers16@nhs.net", name: "Ian Rogers", organization: "PML", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "david.horne9@nhs.net", name: "David Horne", organization: "NHS ICB", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "bethany.sherwood1@nhs.net", name: "Bethany Sherwood", organization: "NHS ICB", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "gemma.sherrell@nhs.net", name: "Gemma Sherrell", organization: "NHS ICB", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "nicola.sherrell@nhs.net", name: "Nicola Sherrell", organization: "NHS ICB", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "sarah.sherrell@nhs.net", name: "Sarah Sherrell", organization: "SNVB", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "james.abbott28@nhs.net", name: "James Abbott", organization: "Voluntary Impact", practice_id: "c800c954-3928-4a37-a5c4-c4ff3e680333" },
  { email: "caroline.cook56@nhs.net", name: "Caroline Cook", organization: "Brackley Medical Centre", practice_id: "ca27fdcb-2a61-4a22-9c6f-9a8b92a6fbbe" },
  { email: "helen.johnson158@nhs.net", name: "Helen Johnson", organization: "Towcester Medical Centre", practice_id: "669ec9ca-6d24-43fc-9dc1-a34a8e20965e" },
  { email: "lisa.smith241@nhs.net", name: "Lisa Smith", organization: "Springfield Surgery", practice_id: "09c7d726-5cc5-49a4-8f3d-a65c2993aac5" },
  { email: "susan.brown89@nhs.net", name: "Susan Brown", organization: "The Brook Health Centre", practice_id: "ebb2bf2c-1d20-42d9-8572-ce07a4dae3de" },
  { email: "rachel.williams67@nhs.net", name: "Rachel Williams", organization: "Bugbrooke Medical Practice", practice_id: "85cd140c-2980-40df-8e19-0ffc8a9346d5" },
  { email: "emma.jones123@nhs.net", name: "Emma Jones", organization: "Denton Village Surgery", practice_id: "b2cbe569-30e3-4a66-838a-c2ad54b41ff2" },
  { email: "jane.taylor45@nhs.net", name: "Jane Taylor", organization: "Danes Camp Medical Centre", practice_id: "fd00dd07-c07d-4e6d-a087-d99a57bd3423" },
  { email: "claire.davies78@nhs.net", name: "Claire Davies", organization: "The Parks Medical Practice", practice_id: "cbbb5976-f7a7-4a02-899d-71b18e357e05" },
  { email: "karen.wilson34@nhs.net", name: "Karen Wilson", organization: "Brackley Medical Centre", practice_id: "ca27fdcb-2a61-4a22-9c6f-9a8b92a6fbbe" },
  { email: "michelle.thompson56@nhs.net", name: "Michelle Thompson", organization: "Towcester Medical Centre", practice_id: "669ec9ca-6d24-43fc-9dc1-a34a8e20965e" },
  { email: "andrea.moore23@nhs.net", name: "Andrea Moore", organization: "Springfield Surgery", practice_id: "09c7d726-5cc5-49a4-8f3d-a65c2993aac5" },
  { email: "paula.jackson67@nhs.net", name: "Paula Jackson", organization: "The Brook Health Centre", practice_id: "ebb2bf2c-1d20-42d9-8572-ce07a4dae3de" },
  { email: "julie.white89@nhs.net", name: "Julie White", organization: "Bugbrooke Medical Practice", practice_id: "85cd140c-2980-40df-8e19-0ffc8a9346d5" },
  { email: "tracy.harris12@nhs.net", name: "Tracy Harris", organization: "Denton Village Surgery", practice_id: "b2cbe569-30e3-4a66-838a-c2ad54b41ff2" },
];

const DEFAULT_PASSWORD = "LetMeIn1";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the assigned_by user from request or use default
    const { assigned_by } = await req.json().catch(() => ({ assigned_by: null }));
    const assignedByUserId = assigned_by || "e3aea82f-451b-40fb-8681-2b579a92dc3a"; // Default admin

    const results: { success: string[]; failed: { email: string; error: string }[] } = {
      success: [],
      failed: []
    };

    console.log(`Starting bulk creation of ${NRES_USERS.length} users`);

    for (const user of NRES_USERS) {
      try {
        console.log(`Creating user: ${user.email}`);

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);
        
        if (existingUser) {
          console.log(`User ${user.email} already exists, skipping`);
          results.failed.push({ email: user.email, error: "User already exists" });
          continue;
        }

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
