import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  user_id: string;
  full_name?: string;
  role?: string;
  practice_role?: string;
  module_access?: {
    meeting_notes_access?: boolean;
    gp_scribe_access?: boolean;
    complaints_manager_access?: boolean;
    ai4gp_access?: boolean;
    enhanced_access?: boolean;
    cqc_compliance_access?: boolean;
    shared_drive_access?: boolean;
    mic_test_service_access?: boolean;
    api_testing_service_access?: boolean;
    fridge_monitoring_access?: boolean;
    survey_manager_access?: boolean;
  };
  policy_service_access?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    // Extract the JWT token
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      console.error("No token in authorization header");
      throw new Error("No token provided");
    }

    // Create Supabase client with the user's session
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://dphcnbricafkbtizkoal.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseServiceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Missing service role key");
    }

    if (!supabaseAnonKey) {
      console.error("Missing SUPABASE_ANON_KEY");
      throw new Error("Missing anon key");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use service role client to get user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error("Auth error:", userError.message);
      throw new Error("Unauthorized: " + userError.message);
    }
    if (!user) {
      console.error("No user found from auth token");
      throw new Error("Unauthorized");
    }
    
    console.log("Authenticated user:", user.id);

    // Verify the user is a practice manager
    const { data: practiceManagerData, error: pmError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'practice_manager' });

    if (pmError || !practiceManagerData) {
      throw new Error("Only practice managers can update users");
    }

    // Get the practice manager's practice ID
    const { data: practiceId, error: practiceError } = await supabase
      .rpc('get_practice_manager_practice_id', { _user_id: user.id });

    if (practiceError || !practiceId) {
      throw new Error("Practice manager must be assigned to a practice");
    }

    // Parse the request body
    const { user_id, full_name, role, practice_role, module_access, policy_service_access }: UpdateUserRequest = await req.json();

    // Verify the user being updated belongs to the practice manager's practice
    const { data: userInPractice, error: verifyError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .eq('practice_id', practiceId)
      .single();

    if (verifyError || !userInPractice) {
      throw new Error("User not found in your practice");
    }

    // Validate role changes - only if role is actually being changed
    if (role && role !== userInPractice.role) {
      // Prevent elevation to higher privileges
      if (role === 'practice_manager' || role === 'system_admin') {
        throw new Error("Cannot elevate user to practice manager or system admin role");
      }
      
      // Only allow setting to practice_user role
      const allowedRoles = ['practice_user', 'user'];
      if (!allowedRoles.includes(role)) {
        throw new Error(`Practice managers can only assign these roles: ${allowedRoles.join(', ')}`);
      }
    }

    // Update profile if full_name is provided
    if (full_name) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name })
        .eq('user_id', user_id);

      if (profileError) {
        console.warn("Failed to update profile:", profileError);
      }
    }

    // Update user role and module access
    const roleUpdate: any = {};
    if (role) roleUpdate.role = role;
    if (practice_role !== undefined) roleUpdate.practice_role = practice_role || null;
    if (module_access) {
      if (module_access.meeting_notes_access !== undefined) roleUpdate.meeting_notes_access = module_access.meeting_notes_access;
      if (module_access.gp_scribe_access !== undefined) roleUpdate.gp_scribe_access = module_access.gp_scribe_access;
      if (module_access.complaints_manager_access !== undefined) roleUpdate.complaints_manager_access = module_access.complaints_manager_access;
      if (module_access.enhanced_access !== undefined) roleUpdate.enhanced_access = module_access.enhanced_access;
      if (module_access.cqc_compliance_access !== undefined) roleUpdate.cqc_compliance_access = module_access.cqc_compliance_access;
      if (module_access.shared_drive_access !== undefined) roleUpdate.shared_drive_access = module_access.shared_drive_access;
      if (module_access.mic_test_service_access !== undefined) roleUpdate.mic_test_service_access = module_access.mic_test_service_access;
      if (module_access.api_testing_service_access !== undefined) roleUpdate.api_testing_service_access = module_access.api_testing_service_access;
      if (module_access.fridge_monitoring_access !== undefined) roleUpdate.fridge_monitoring_access = module_access.fridge_monitoring_access;
      if (module_access.survey_manager_access !== undefined) roleUpdate.survey_manager_access = module_access.survey_manager_access;
    }

    if (Object.keys(roleUpdate).length > 0) {
      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update(roleUpdate)
        .eq('user_id', user_id)
        .eq('practice_id', practiceId);

      if (roleUpdateError) {
        throw new Error(`Failed to update user role: ${roleUpdateError.message}`);
      }
    }

    // Update AI4GP access in profiles table
    if (module_access?.ai4gp_access !== undefined) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ai4gp_access: module_access.ai4gp_access })
        .eq('user_id', user_id);

      if (profileError) {
        console.warn("Failed to update AI4GP access:", profileError);
      }
    }

    // Handle policy_service activation/deactivation
    if (policy_service_access !== undefined) {
      if (policy_service_access) {
        // Grant policy_service access
        const { error: policyError } = await supabase
          .from('user_service_activations')
          .upsert({
            user_id: user_id,
            service: 'policy_service',
            activated_by: user.id,
            activated_at: new Date().toISOString()
          }, { onConflict: 'user_id,service' });

        if (policyError) {
          console.warn("Failed to activate policy service:", policyError);
        }
      } else {
        // Revoke policy_service access
        const { error: policyError } = await supabase
          .from('user_service_activations')
          .delete()
          .eq('user_id', user_id)
          .eq('service', 'policy_service');

        if (policyError) {
          console.warn("Failed to revoke policy service:", policyError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "User updated successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in update-user-practice-manager function:", error);
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
