// Validate magic-link token and return policy + assignment metadata for a non-account reader
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (await req.json().catch(() => ({})))?.token;
    const policyId = url.searchParams.get("policy_id");
    if (!token || !policyId) {
      return new Response(JSON.stringify({ error: "missing token or policy_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tokenHash = await hashToken(token);
    const { data: assignment } = await admin
      .from("mandatory_read_assignments")
      .select("id, full_name, email, due_at, status, magic_token_expires_at, mandatory_read_id")
      .eq("magic_token_hash", tokenHash)
      .eq("mandatory_read_id", policyId)
      .maybeSingle();

    if (!assignment) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (assignment.magic_token_expires_at && new Date(assignment.magic_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: policy } = await admin
      .from("mandatory_reads")
      .select("id, title, description, body_html, version, version_hash, effective_date")
      .eq("id", policyId)
      .single();

    return new Response(JSON.stringify({ ok: true, assignment, policy }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
