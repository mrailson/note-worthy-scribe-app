import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
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

    const { user_id }: DeleteUserRequest = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing user_id", success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Deleting user with admin privileges:", user_id, "by", caller.id);

    // Delete all related records first to avoid foreign key constraints
    console.log("Deleting user sessions...");
    const { error: sessionsError } = await supabaseAdmin
      .from('user_sessions').delete().eq('user_id', user_id);
    if (sessionsError) console.error("Error deleting user sessions:", sessionsError);

    console.log("Deleting system audit logs...");
    const { error: systemAuditError } = await supabaseAdmin
      .from('system_audit_log').delete().eq('user_id', user_id);
    if (systemAuditError) console.error("Error deleting system audit logs:", systemAuditError);

    console.log("Deleting NHS terms...");
    const { error: nhsTermsError } = await supabaseAdmin
      .from('nhs_terms').delete().eq('user_id', user_id);
    if (nhsTermsError) console.error("Error deleting NHS terms:", nhsTermsError);

    console.log("Deleting meeting overviews...");
    const { error: overviewsError } = await supabaseAdmin
      .from('meeting_overviews').delete().eq('created_by', user_id);
    if (overviewsError) console.error("Error deleting meeting overviews:", overviewsError);

    console.log("Deleting meetings...");
    const { error: meetingsError } = await supabaseAdmin
      .from('meetings').delete().eq('user_id', user_id);
    if (meetingsError) console.error("Error deleting meetings:", meetingsError);

    console.log("Deleting complaint templates...");
    const { error: templatesError } = await supabaseAdmin
      .from('complaint_templates').delete().eq('created_by', user_id);
    if (templatesError) { console.error("Error deleting complaint templates:", templatesError); throw templatesError; }

    console.log("Deleting complaint audit logs...");
    const { error: auditError } = await supabaseAdmin
      .from('complaint_audit_log').delete().eq('performed_by', user_id);
    if (auditError) console.error("Error deleting complaint audit logs:", auditError);

    console.log("Deleting complaint notes...");
    const { error: notesError } = await supabaseAdmin
      .from('complaint_notes').delete().eq('created_by', user_id);
    if (notesError) console.error("Error deleting complaint notes:", notesError);

    console.log("Deleting complaint responses...");
    const { error: responsesError } = await supabaseAdmin
      .from('complaint_responses').delete().eq('sent_by', user_id);
    if (responsesError) console.error("Error deleting complaint responses:", responsesError);

    console.log("Deleting complaint documents...");
    const { error: documentsError } = await supabaseAdmin
      .from('complaint_documents').delete().eq('uploaded_by', user_id);
    if (documentsError) console.error("Error deleting complaint documents:", documentsError);

    console.log("Updating complaints assigned to user...");
    const { error: assignedError } = await supabaseAdmin
      .from('complaints').update({ assigned_to: null }).eq('assigned_to', user_id);
    if (assignedError) console.error("Error updating assigned complaints:", assignedError);

    console.log("Deleting complaints created by user...");
    const { error: complaintsError } = await supabaseAdmin
      .from('complaints').delete().eq('created_by', user_id);
    if (complaintsError) console.error("Error deleting complaints:", complaintsError);

    console.log("Deleting PCN manager practice assignments...");
    const { error: pcnError } = await supabaseAdmin
      .from('pcn_manager_practices').delete().eq('user_id', user_id);
    if (pcnError) console.error("Error deleting PCN manager practices:", pcnError);

    console.log("Updating user_roles assigned_by references...");
    const { error: assignedByError } = await supabaseAdmin
      .from('user_roles').update({ assigned_by: null }).eq('assigned_by', user_id);
    if (assignedByError) console.error("Error updating user roles assigned_by:", assignedByError);

    console.log("Deleting user roles...");
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles').delete().eq('user_id', user_id);
    if (rolesError) { console.error("Error deleting user roles:", rolesError); throw rolesError; }

    console.log("Deleting profile...");
    const { error: profileError } = await supabaseAdmin
      .from('profiles').delete().eq('user_id', user_id);
    if (profileError) { console.error("Error deleting profile:", profileError); throw profileError; }

    console.log("Deleting user from auth...");
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authError) { console.error("Auth deletion error:", authError); throw authError; }

    console.log("User deleted successfully from auth:", user_id);

    return new Response(JSON.stringify({ success: true, message: "User deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in delete-user-admin function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
