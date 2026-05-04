// Public submission endpoint for NRES Pay Alignment Survey.
// Validates token, rate-limits per client_hash, inserts response with service role.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { token, practice, isAnonymous, responses, comments, riskFlag } =
      await req.json();

    if (!token || typeof token !== "string") {
      return json(400, { error: "Missing survey token" });
    }
    if (typeof isAnonymous !== "boolean") {
      return json(400, { error: "isAnonymous required" });
    }
    if (!responses || typeof responses !== "object") {
      return json(400, { error: "responses required" });
    }
    if (!isAnonymous && (!practice || typeof practice !== "string")) {
      return json(400, { error: "Practice required when not anonymous" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate survey
    const { data: survey, error: sErr } = await supabase
      .from("nres_pay_alignment_surveys")
      .select("id, is_active, closed_at")
      .eq("token", token)
      .maybeSingle();

    if (sErr) return json(500, { error: sErr.message });
    if (!survey) return json(404, { error: "Survey not found" });
    if (!survey.is_active || survey.closed_at) {
      return json(410, { error: "This survey is no longer active" });
    }

    // client_hash = sha256(ip + ua + survey_id) — never store raw IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const clientHash = await sha256Hex(`${ip}|${ua}|${survey.id}`);

    // Rate limit: max 3 submissions per client_hash per hour for this survey
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: cErr } = await supabase
      .from("nres_pay_alignment_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", survey.id)
      .eq("client_hash", clientHash)
      .gte("submitted_at", oneHourAgo);

    if (cErr) return json(500, { error: cErr.message });
    if ((count ?? 0) >= 3) {
      return json(429, {
        error:
          "You have submitted this survey several times in the last hour. Please wait before trying again.",
      });
    }

    const { error: iErr } = await supabase
      .from("nres_pay_alignment_responses")
      .insert({
        survey_id: survey.id,
        practice: isAnonymous ? null : practice,
        is_anonymous: isAnonymous,
        responses,
        comments: comments ?? {},
        risk_flag: riskFlag || null,
        client_hash: clientHash,
      });

    if (iErr) return json(500, { error: iErr.message });

    return json(200, { success: true });
  } catch (e) {
    console.error("submit-pay-alignment error:", e);
    return json(500, { error: (e as Error).message });
  }
});
