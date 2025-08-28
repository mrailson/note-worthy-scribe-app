// supabase/functions/assemblyai-realtime-token/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // ✅ must include these two for supabase-js
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }

  try {
    const AAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!AAI_KEY) {
      return new Response(JSON.stringify({ error: "Missing ASSEMBLYAI_API_KEY" }), {
        status: 500, headers: cors(origin),
      });
    }

    const r = await fetch("https://api.assemblyai.com/v2/realtime/token", {
      method: "POST",
      headers: { Authorization: AAI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_in: 3600 }),
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: `Token mint failed: ${text}` }), {
        status: r.status, headers: cors(origin),
      });
    }

    const data = await r.json(); // { token }
    return new Response(JSON.stringify({ token: data.token }), {
      headers: cors(origin),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: cors(origin),
    });
  }
});