import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RemoveUserRequest {
  user_id: string;
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
      throw new Error("Only practice managers can remove users");
    }

    // Get the practice manager's practice ID
    const { data: practiceId, error: practiceError } = await supabase
      .rpc('get_practice_manager_practice_id', { _user_id: user.id });

    if (practiceError || !practiceId) {
      throw new Error("Practice manager must be assigned to a practice");
    }

    // Parse the request body
    const { user_id }: RemoveUserRequest = await req.json();

    // Verify the user being removed belongs to the practice manager's practice
    const { data: userInPractice, error: verifyError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .eq('practice_id', practiceId)
      .single();

    if (verifyError || !userInPractice) {
      throw new Error("User not found in your practice");
    }

    // Prevent removal of practice managers and system admins by practice managers
    if (userInPractice.role === 'practice_manager' || userInPractice.role === 'system_admin') {
      throw new Error("Cannot remove practice managers or system administrators");
    }

    // Check if user has assignments to other practices
    const { data: otherPractices, error: otherPracticesError } = await supabase
      .from('user_roles')
      .select('practice_id')
      .eq('user_id', user_id)
      .neq('practice_id', practiceId);

    if (otherPracticesError) {
      throw new Error("Error checking user's other practice assignments");
    }

    // Remove user from this practice
    const { error: removeError } = await supabase
      .rpc('remove_user_from_practice', {
        p_user_id: user_id,
        p_practice_id: practiceId,
        p_role: null
      });

    if (removeError) {
      throw new Error(`Failed to remove user from practice: ${removeError.message}`);
    }

    const hasOtherPractices = otherPractices && otherPractices.length > 0;
    const message = hasOtherPractices 
      ? "User removed from your practice. They remain assigned to other practices."
      : "User removed from your practice. They are no longer assigned to any practice.";

    return new Response(JSON.stringify({
      success: true,
      message,
      has_other_practices: hasOtherPractices
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in remove-user-practice-manager function:", error);
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