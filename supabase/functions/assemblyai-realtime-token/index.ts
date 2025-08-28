// Deno runtime (Supabase Edge Functions)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
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
      return new Response(
        JSON.stringify({ error: "Missing ASSEMBLYAI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors(origin) } }
      );
    }

    // Optional: verify caller is allowed (e.g., check Supabase JWT if you want)
    // const auth = req.headers.get("authorization"); // "Bearer <anon-or-user-jwt>"
    // if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...cors(origin) } });

    // Mint realtime token
    const r = await fetch("https://api.assemblyai.com/v2/realtime/token", {
      method: "POST",
      headers: {
        Authorization: AAI_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_in: 3600 }),
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(
        JSON.stringify({ error: `Token mint failed: ${text}` }),
        { status: r.status, headers: { "Content-Type": "application/json", ...cors(origin) } }
      );
    }

    const data = await r.json(); // { token: "..." }
    return new Response(JSON.stringify({ token: data.token }), {
      headers: { "Content-Type": "application/json", ...cors(origin) },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors(origin) },
    });
  }
});