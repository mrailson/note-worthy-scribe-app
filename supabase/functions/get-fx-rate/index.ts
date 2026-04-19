// Edge function: get-fx-rate
// Returns the FX rate for (base -> target) on a given date, cached for 24h in fx_rates table.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  base: string;
  target: string;
  date: string; // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: Body = await req.json();
    const base = (body.base || "").toUpperCase().trim();
    const target = (body.target || "GBP").toUpperCase().trim();
    const date = body.date;

    if (!base || !target || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "Invalid input. Require {base, target, date:YYYY-MM-DD}" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (base === target) {
      return new Response(
        JSON.stringify({ rate: 1, source: "identity", cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up cache (within 24h)
    const { data: cached } = await supabase
      .from("fx_rates")
      .select("rate, source, cached_at")
      .eq("base_currency", base)
      .eq("target_currency", target)
      .eq("rate_date", date)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.cached_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({ rate: Number(cached.rate), source: cached.source, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch from exchangerate.host (historical endpoint)
    const url = `https://api.exchangerate.host/${date}?base=${base}&symbols=${target}`;
    let rate: number | null = null;
    let source = "exchangerate.host";

    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const v = j?.rates?.[target];
        if (typeof v === "number" && v > 0) rate = v;
      }
    } catch (_) { /* fall through */ }

    // Fallback: frankfurter.app (free, no key)
    if (rate === null) {
      try {
        const r2 = await fetch(
          `https://api.frankfurter.app/${date}?from=${base}&to=${target}`,
        );
        if (r2.ok) {
          const j2 = await r2.json();
          const v = j2?.rates?.[target];
          if (typeof v === "number" && v > 0) {
            rate = v;
            source = "frankfurter.app";
          }
        }
      } catch (_) { /* fall through */ }
    }

    if (rate === null) {
      return new Response(
        JSON.stringify({ error: "Could not resolve FX rate from any provider" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert into cache
    await supabase.from("fx_rates").upsert(
      {
        base_currency: base,
        target_currency: target,
        rate_date: date,
        rate,
        source,
        cached_at: new Date().toISOString(),
      },
      { onConflict: "base_currency,target_currency,rate_date" },
    );

    return new Response(
      JSON.stringify({ rate, source, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("get-fx-rate error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
