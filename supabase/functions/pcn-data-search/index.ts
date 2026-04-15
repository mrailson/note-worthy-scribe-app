const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { query } = await req.json();

    if (!query || String(query).trim().length < 2) {
      return new Response(JSON.stringify({ status: "error", message: "Query too short" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

    if (!apiKey) {
      return new Response(JSON.stringify({ status: "error", message: "Search not configured" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `You are an NHS data specialist. Find PCN (Primary Care Network) practice data and return ONLY raw JSON — no markdown, no code fences, no explanation text.

If ONE clear PCN match found, return exactly:

{"status":"found","pcnName":"Full PCN Name","pcnCode":"ODS code if known","dataDate":"e.g. January 2026","sourceNote":"e.g. NHS Digital GP practice data","practices":[{"name":"Practice Name","ods":"A12345","registered":8500,"adj":8245,"wgt":8670,"adjNote":"NHS England 26/27 or estimated x0.97","wgtNote":"NHS England or estimated x1.025"}]}

If MULTIPLE PCNs match, return:

{"status":"multiple","options":[{"code":"AB1","name":"Full PCN Name","icb":"ICB Name if known"}]}

If NOT FOUND, return:

{"status":"not_found","message":"brief reason"}

Data sources to search:

- NHS Digital GP practice list sizes (January 2026 for 2026/27)
- NHS England PCN Adjusted Populations 2026/27 spreadsheet (published March 2026)
- OpenPrescribing.net for practice-to-PCN mappings
- NHS ODS for practice codes

For adjusted population: use NHS England figure if found, otherwise registered x 0.97
For weighted population: use NHS England contractor weighted figure if found, otherwise registered x 1.025

Include ALL member practices in the PCN. Return only valid JSON, nothing else.`,
        messages: [{
          role: "user",
          content: `Find all member practices and their 2026/27 list sizes for: ${String(query).trim()} PCN`
        }],
      }),
    });

    const data = await upstream.json();

    const text = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return new Response(
        JSON.stringify({ status: "not_found", message: "No data found for that PCN name" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(match[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[pcn-data-search]", e);
    return new Response(
      JSON.stringify({ status: "error", message: e?.message ?? "Search failed" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
