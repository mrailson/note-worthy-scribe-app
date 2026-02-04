import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  role: string;
  practice_role?: string;
  password?: string;
  module_access: {
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
    policy_service_access?: boolean;
  };
  send_welcome_email?: boolean;
  practice_name?: string;
}

// Generate a secure random password as fallback
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

// Validate password: min 8 chars, at least 1 number
function validatePassword(password: string): { valid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least 1 number' };
  }
  return { valid: true, message: '' };
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
      throw new Error("Only practice managers can create users");
    }

    // Get the practice manager's practice ID
    const { data: practiceId, error: practiceError } = await supabase
      .rpc('get_practice_manager_practice_id', { _user_id: user.id });

    if (practiceError || !practiceId) {
      throw new Error("Practice manager must be assigned to a practice");
    }

    // Parse the request body
    const { email, full_name, role, practice_role, password, module_access, send_welcome_email, practice_name }: CreateUserRequest = await req.json();
    
    // Use provided password or generate one
    let userPassword: string;
    if (password) {
      const validation = validatePassword(password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      userPassword = password;
    } else {
      userPassword = generateSecurePassword();
    }

    // Validate role is allowed for practice managers (everything except super_admin)
    const blockedRoles = ['super_admin', 'admin'];
    if (blockedRoles.includes(role.toLowerCase())) {
      throw new Error(`Practice managers cannot assign admin-level roles`);
    }

    // Check if user already exists and their practice assignment
    const { data: existingUserCheck, error: checkError } = await supabase
      .rpc('check_user_practice_assignment', { p_email: email, p_practice_id: practiceId });

    if (checkError) {
      throw new Error("Error checking existing user");
    }

    if (existingUserCheck?.exists) {
      if (existingUserCheck.already_assigned_to_practice) {
        throw new Error("User is already assigned to your practice");
      } else {
        // User exists but not assigned to this practice - assign them
        const existingUserId = existingUserCheck.user_id;
        
        // Assign to practice
        const { error: assignError } = await supabase
          .rpc('assign_user_to_practice', {
            p_user_id: existingUserId,
            p_practice_id: practiceId,
            p_role: role,
            p_assigned_by: user.id
          });

        if (assignError) {
          throw new Error("Failed to assign existing user to practice");
        }

        // Update module access and practice role
        const { error: moduleError } = await supabase
          .from('user_roles')
          .update({
            practice_role: practice_role || null,
            meeting_notes_access: module_access.meeting_notes_access || false,
            gp_scribe_access: module_access.gp_scribe_access || false,
            complaints_manager_access: module_access.complaints_manager_access || false,
            enhanced_access: module_access.enhanced_access || false,
            cqc_compliance_access: module_access.cqc_compliance_access || false,
            shared_drive_access: module_access.shared_drive_access || false,
            mic_test_service_access: module_access.mic_test_service_access || false,
            api_testing_service_access: module_access.api_testing_service_access || false,
            survey_manager_access: module_access.survey_manager_access || false
          })
          .eq('user_id', existingUserId)
          .eq('practice_id', practiceId);

        if (moduleError) {
          console.warn("Failed to update module access:", moduleError);
        }

        // Update AI4GP access in profiles table
        if (module_access.ai4gp_access !== undefined) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ ai4gp_access: module_access.ai4gp_access })
            .eq('user_id', existingUserId);

          if (profileError) {
            console.warn("Failed to update AI4GP access:", profileError);
          }
        }

        // Handle policy_service activation
        if (module_access.policy_service_access) {
          const { error: policyError } = await supabase
            .from('user_service_activations')
            .upsert({
              user_id: existingUserId,
              service: 'policy_service',
              activated_by: user.id,
              activated_at: new Date().toISOString()
            }, { onConflict: 'user_id,service' });

          if (policyError) {
            console.warn("Failed to activate policy service:", policyError);
          }
        }

        const otherPractices = existingUserCheck.other_practices || [];
        const practiceList = otherPractices.map((p: any) => p.practice_name).join(', ');
        
        return new Response(JSON.stringify({
          success: true,
          message: `User was already registered and assigned to other practices (${practiceList}). They have now been assigned to your practice as well.`,
          user_existed: true
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    // Create new user with the password
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user?.id) {
      throw new Error("No user ID returned from user creation");
    }

    // Create profile
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        email: email,
        full_name: full_name,
        ai4gp_access: module_access.ai4gp_access || false
      });

    if (profileInsertError) {
      console.error("Failed to create profile:", profileInsertError);
      // Don't throw here, continue with role assignment
    }

    // Assign user to practice with role and module access
    const { error: roleInsertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        practice_id: practiceId,
        role: role,
        practice_role: practice_role || null,
        assigned_by: user.id,
        meeting_notes_access: module_access.meeting_notes_access || false,
        gp_scribe_access: module_access.gp_scribe_access || false,
        complaints_manager_access: module_access.complaints_manager_access || false,
        enhanced_access: module_access.enhanced_access || false,
        cqc_compliance_access: module_access.cqc_compliance_access || false,
        shared_drive_access: module_access.shared_drive_access || false,
        mic_test_service_access: module_access.mic_test_service_access || false,
        api_testing_service_access: module_access.api_testing_service_access || false,
        survey_manager_access: module_access.survey_manager_access || false
      });

    if (roleInsertError) {
      throw new Error(`Failed to assign role: ${roleInsertError.message}`);
    }

    // Handle policy_service activation
    if (module_access.policy_service_access) {
      const { error: policyError } = await supabase
        .from('user_service_activations')
        .insert({
          user_id: newUser.user.id,
          service: 'policy_service',
          activated_by: user.id,
          activated_at: new Date().toISOString()
        });

      if (policyError) {
        console.warn("Failed to activate policy service:", policyError);
      }
    }

    // Generate password reset link for the user
    let passwordResetLink = null;
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: 'https://gpnotewell.co.uk/reset-password'
        }
      });
      
      if (!linkError && linkData?.properties?.action_link) {
        passwordResetLink = linkData.properties.action_link;
        console.log("Generated password reset link for user:", email);
      } else {
        console.warn("Could not generate password reset link:", linkError);
      }
    } catch (linkErr) {
      console.warn("Error generating password reset link:", linkErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "User created successfully and assigned to your practice",
      user_existed: false,
      password_reset_link: passwordResetLink,
      user_id: newUser.user.id,
      module_access: module_access,
      practice_name: practice_name
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in create-user-practice-manager function:", error);
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
