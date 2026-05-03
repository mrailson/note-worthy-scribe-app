// jsr type import removed (causes deploy timeouts)

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });

  try {
    // ---- AUTH GUARD ----
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: cors(origin),
      });
    }
    {
      const token = authHeader.replace("Bearer ", "");
      const vr = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      });
      if (!vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: cors(origin),
        });
      }
    }
    // ---- /AUTH GUARD ----
    const AAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!AAI_KEY) {
      return new Response(JSON.stringify({ error: "Missing ASSEMBLYAI_API_KEY" }), {
        status: 500, headers: cors(origin),
      });
    }

    // v3: GET /v3/token with expires_in_seconds
    const url = new URL("https://streaming.assemblyai.com/v3/token");
    url.searchParams.set("expires_in_seconds", "540"); // 9 minutes; safe within 600 limit

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: AAI_KEY },
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: `Token mint failed: ${text}` }), {
        status: r.status, headers: cors(origin),
      });
    }

    const data = await r.json(); // { token, expires_in_seconds }
    return new Response(JSON.stringify({ token: data.token }), { headers: cors(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: cors(origin),
    });
  }
});