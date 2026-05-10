import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth — verify the caller is logged in.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { body, expectedNames } = (await req.json()) as {
      body?: string;
      expectedNames?: string[];
    };
    if (!body || typeof body !== "string") {
      return new Response(JSON.stringify({ error: "body is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expected = Array.isArray(expectedNames) ? expectedNames.filter(Boolean) : [];

    const system =
      "You are a privacy auditor for NHS GP complaint letters. Identify any person names that appear in the letter body but are NOT in the expected names list. Treat staff titles (Dr, Nurse, Practice Manager) as fine if associated with the practice. Reply with ONLY a JSON array of strings — no prose, no code fences. Example: [\"Jane Smith\",\"John Doe\"]. If none, reply [].";

    const user = `Expected names (these are fine): ${JSON.stringify(expected)}\n\nLetter body:\n"""\n${body.slice(0, 8000)}\n"""`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("[pii-check] Anthropic error", r.status, errText);
      return new Response(
        JSON.stringify({ unexpectedNames: [], error: "PII check unavailable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await r.json();
    const text: string = (json?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();

    let unexpectedNames: string[] = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : text);
      if (Array.isArray(parsed)) {
        unexpectedNames = parsed
          .filter((v) => typeof v === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch (e) {
      console.warn("[pii-check] could not parse model output:", text);
    }

    return new Response(JSON.stringify({ unexpectedNames }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pii-check] fatal:", err);
    return new Response(
      JSON.stringify({ unexpectedNames: [], error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
