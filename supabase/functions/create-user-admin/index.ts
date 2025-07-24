import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: string;
  practice_id?: string;
  assigned_by: string;
  module_access?: {
    meeting_notes_access: boolean;
    gp_scribe_access: boolean;
    complaints_manager_access: boolean;
    complaints_admin_access: boolean;
    replywell_access: boolean;
    ai_4_pm_access: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userData: CreateUserRequest = await req.json();

    // Create admin client with service role key
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

    console.log("Creating user with admin privileges:", userData.email);

    // Create the user with admin privileges
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        full_name: userData.name
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error("No user data returned");
    }

    console.log("User created successfully:", authData.user.id);

    // Profile is automatically created by trigger, so we skip manual creation
    
    // Create user role with admin privileges and module access settings
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: userData.role,
        practice_id: userData.practice_id || null,
        assigned_by: userData.assigned_by,
        meeting_notes_access: userData.module_access?.meeting_notes_access ?? true,
        gp_scribe_access: userData.module_access?.gp_scribe_access ?? false,
        complaints_manager_access: userData.module_access?.complaints_manager_access ?? false,
        complaints_admin_access: userData.module_access?.complaints_admin_access ?? false,
        replywell_access: userData.module_access?.replywell_access ?? false
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      throw roleError;
    }

    console.log("Role assigned successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      user: authData.user,
      message: "User created successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in create-user-admin function:", error);
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