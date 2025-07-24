import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id }: DeleteUserRequest = await req.json();

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

    console.log("Deleting user with admin privileges:", user_id);

    // Delete all related records first to avoid foreign key constraints
    console.log("Deleting complaint templates...");
    const { error: templatesError } = await supabaseAdmin
      .from('complaint_templates')
      .delete()
      .eq('created_by', user_id);

    if (templatesError) {
      console.error("Error deleting complaint templates:", templatesError);
      throw templatesError;
    }

    console.log("Deleting complaint audit logs...");
    const { error: auditError } = await supabaseAdmin
      .from('complaint_audit_log')
      .delete()
      .eq('performed_by', user_id);

    if (auditError) {
      console.error("Error deleting complaint audit logs:", auditError);
      throw auditError;
    }

    console.log("Deleting complaint notes...");
    const { error: notesError } = await supabaseAdmin
      .from('complaint_notes')
      .delete()
      .eq('created_by', user_id);

    if (notesError) {
      console.error("Error deleting complaint notes:", notesError);
      throw notesError;
    }

    console.log("Deleting complaint responses...");
    const { error: responsesError } = await supabaseAdmin
      .from('complaint_responses')
      .delete()
      .eq('sent_by', user_id);

    if (responsesError) {
      console.error("Error deleting complaint responses:", responsesError);
      throw responsesError;
    }

    console.log("Deleting complaint documents...");
    const { error: documentsError } = await supabaseAdmin
      .from('complaint_documents')
      .delete()
      .eq('uploaded_by', user_id);

    if (documentsError) {
      console.error("Error deleting complaint documents:", documentsError);
      throw documentsError;
    }

    console.log("Updating complaints assigned to user...");
    const { error: assignedError } = await supabaseAdmin
      .from('complaints')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id);

    if (assignedError) {
      console.error("Error updating assigned complaints:", assignedError);
      throw assignedError;
    }

    console.log("Deleting PCN manager practice assignments...");
    const { error: pcnError } = await supabaseAdmin
      .from('pcn_manager_practices')
      .delete()
      .eq('user_id', user_id);

    if (pcnError) {
      console.error("Error deleting PCN manager practices:", pcnError);
      throw pcnError;
    }

    console.log("Deleting user roles...");
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    if (rolesError) {
      console.error("Error deleting user roles:", rolesError);
      throw rolesError;
    }

    console.log("Deleting profile...");
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', user_id);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
      throw profileError;
    }

    console.log("Deleting user from auth...");
    // Delete the user from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (authError) {
      console.error("Auth deletion error:", authError);
      throw authError;
    }

    console.log("User deleted successfully from auth:", user_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "User deleted successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in delete-user-admin function:", error);
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