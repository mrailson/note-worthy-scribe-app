import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function triggerGeneration(meetingId: string, forceRegenerate: boolean) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/auto-generate-meeting-notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ meetingId, forceRegenerate }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.warn("auto-generate-meeting-notes returned non-2xx:", resp.status, t);
    } else {
      const json = await resp.json().catch(() => ({}));
      console.log("✅ auto-generate-meeting-notes started:", json);
    }
  } catch (e) {
    console.error("Failed to call auto-generate-meeting-notes:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, forceRegenerate = true } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget in background to avoid client timeouts
    // Using a microtask to ensure it runs after the response is sent
    queueMicrotask(() => {
      triggerGeneration(meetingId, forceRegenerate);
    });

    return new Response(
      JSON.stringify({ status: "accepted", meetingId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 }
    );
  } catch (e: any) {
    console.error("start-standard-notes error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
