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
  ai4gp_access?: boolean;
  module_access?: {
    meeting_notes_access: boolean;
    gp_scribe_access: boolean;
    complaints_manager_access: boolean;
    complaints_admin_access: boolean;
    replywell_access: boolean;
    enhanced_access: boolean;
    cqc_compliance_access: boolean;
    shared_drive_access: boolean;
    mic_test_service_access: boolean;
    api_testing_service_access: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =====================================================
    // CRITICAL: Authorisation check - only system admins can create users
    // =====================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: 'Unauthorised: Missing authentication', success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create a client with the user's token to verify their identity
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT verification failed:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorised: Invalid token', success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const callerId = claimsData.claims.sub;
    if (!callerId) {
      console.error("No user ID in token claims");
      return new Response(
        JSON.stringify({ error: 'Unauthorised: Invalid user', success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Authorisation check for user:", callerId);

    // Create admin client with service role key for authorisation check
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

    // Check if the caller is a system admin using the is_system_admin RPC
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
      .rpc('is_system_admin', { user_uuid: callerId });

    if (adminCheckError) {
      console.error("Error checking admin status:", adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Authorisation check failed', success: false }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isAdmin) {
      console.error("Unauthorised: User is not a system admin:", callerId);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only system administrators can create users', success: false }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Authorisation confirmed: User is system admin");

    // =====================================================
    // Proceed with user creation (caller is authorised)
    // =====================================================
    const userData: CreateUserRequest = await req.json();

    // Input validation
    if (!userData.email || !userData.password || !userData.name || !userData.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, role', success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format', success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password length
    if (userData.password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters', success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Creating user with admin privileges:", userData.email);

    // Create the user with admin privileges
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
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
        replywell_access: userData.module_access?.replywell_access ?? false,
        enhanced_access: userData.module_access?.enhanced_access ?? false,
        cqc_compliance_access: userData.module_access?.cqc_compliance_access ?? false,
        shared_drive_access: userData.module_access?.shared_drive_access ?? false,
        mic_test_service_access: userData.module_access?.mic_test_service_access ?? false,
        api_testing_service_access: userData.module_access?.api_testing_service_access ?? false
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      throw roleError;
    }

    console.log("Role assigned successfully");

    // Update AI4GP access if specified
    if (userData.ai4gp_access !== undefined) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ ai4gp_access: userData.ai4gp_access })
        .eq('user_id', authData.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }

      console.log("AI4GP access updated:", userData.ai4gp_access);
    }

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
