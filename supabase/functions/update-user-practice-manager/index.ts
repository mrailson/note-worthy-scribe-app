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
  };
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
      throw new Error("No authorization header");
    }

    // Create Supabase client with the user's session
    const supabaseUrl = "https://dphcnbricafkbtizkoal.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseServiceKey) {
      throw new Error("Missing service role key");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user from the authorization header
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

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
    const { user_id, full_name, role, practice_role, module_access }: UpdateUserRequest = await req.json();

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

    // Validate role is allowed for practice managers
    if (role) {
      // Get current user's role to check if they're system admin
      const { data: isSystemAdmin, error: adminCheckError } = await supabase
        .rpc('is_system_admin', { _user_id: user.id });
      
      // If current user is system admin, allow more flexibility
      if (isSystemAdmin) {
        // System admins can assign most roles except they can't elevate others to system_admin
        if (role === 'system_admin' && user_id !== user.id) {
          throw new Error("Only existing system admins can maintain system admin role");
        }
      } else {
        // Regular practice managers have limited role assignment
        const allowedRoles = ['user'];
        if (!allowedRoles.includes(role)) {
          throw new Error(`Practice managers can only assign these roles: ${allowedRoles.join(', ')}`);
        }

        // Prevent elevation to higher privileges
        if (role === 'practice_manager' || role === 'system_admin') {
          throw new Error("Cannot elevate user to practice manager or system admin role");
        }
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

    // Get current user's admin status for safe updates
    const { data: isCurrentUserSystemAdmin, error: adminCheckError2 } = await supabase
      .rpc('is_system_admin', { _user_id: user.id });

    // Get all existing roles for the user being updated
    const { data: existingRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user_id);

    if (rolesError) {
      throw new Error(`Failed to fetch existing roles: ${rolesError.message}`);
    }

    console.log(`Existing roles for user ${user_id}:`, existingRoles);

    // Update module access for ALL roles of the user, preserving their role types
    if (module_access && Object.keys(module_access).length > 0) {
      const moduleUpdate: any = {};
      
      // Only include module access fields that are explicitly provided
      if (module_access.meeting_notes_access !== undefined) moduleUpdate.meeting_notes_access = module_access.meeting_notes_access;
      if (module_access.gp_scribe_access !== undefined) moduleUpdate.gp_scribe_access = module_access.gp_scribe_access;
      if (module_access.complaints_manager_access !== undefined) moduleUpdate.complaints_manager_access = module_access.complaints_manager_access;
      if (module_access.enhanced_access !== undefined) moduleUpdate.enhanced_access = module_access.enhanced_access;
      if (module_access.cqc_compliance_access !== undefined) moduleUpdate.cqc_compliance_access = module_access.cqc_compliance_access;
      if (module_access.shared_drive_access !== undefined) moduleUpdate.shared_drive_access = module_access.shared_drive_access;
      if (module_access.mic_test_service_access !== undefined) moduleUpdate.mic_test_service_access = module_access.mic_test_service_access;
      if (module_access.api_testing_service_access !== undefined) moduleUpdate.api_testing_service_access = module_access.api_testing_service_access;

      if (Object.keys(moduleUpdate).length > 0) {
        // Update module access for ALL roles of this user
        const { error: moduleUpdateError } = await supabase
          .from('user_roles')
          .update(moduleUpdate)
          .eq('user_id', user_id);

        if (moduleUpdateError) {
          console.error("Module update error:", moduleUpdateError);
          throw new Error(`Failed to update module access: ${moduleUpdateError.message}`);
        }

        console.log(`Updated module access for user ${user_id}:`, moduleUpdate);
      }
    }

    // Handle role updates only if a specific role is provided
    if (role) {
      // Find the practice-specific role to update
      const practiceRole = existingRoles?.find(r => r.practice_id === practiceId);
      
      if (practiceRole) {
        const { error: roleUpdateError } = await supabase
          .from('user_roles')
          .update({ 
            role: role,
            practice_role: practice_role !== undefined ? (practice_role || null) : practiceRole.practice_role
          })
          .eq('user_id', user_id)
          .eq('practice_id', practiceId);

        if (roleUpdateError) {
          throw new Error(`Failed to update practice role: ${roleUpdateError.message}`);
        }

        console.log(`Updated practice role for user ${user_id} to ${role}`);
      }
    }

    // Update practice_role only if provided (without changing the main role)
    if (practice_role !== undefined && !role) {
      const { error: practiceRoleUpdateError } = await supabase
        .from('user_roles')
        .update({ practice_role: practice_role || null })
        .eq('user_id', user_id)
        .eq('practice_id', practiceId);

      if (practiceRoleUpdateError) {
        throw new Error(`Failed to update practice role: ${practiceRoleUpdateError.message}`);
      }

      console.log(`Updated practice_role for user ${user_id} to ${practice_role}`);
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