const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are an NHS data specialist. Find PCN (Primary Care Network) practice data and return ONLY raw JSON — no markdown, no code fences, no explanation text.

CRITICAL INSTRUCTIONS:
1. Search for the PCN name on digital.nhs.uk, openprescribing.net, and NHS ODS
2. Find ALL member practices — names and ODS codes
3. For list sizes, search openprescribing.net/practice/<ODS_CODE> or digital.nhs.uk for GP registered patients data
4. If you find practice names but NOT exact list sizes, you MUST still return status "found" with your best available data. Use 0 for any missing numeric field and add "estimated" to adjNote/wgtNote.
5. NEVER return "not_found" if you found the PCN name and its member practices — always return "found" with whatever data you have.

If ONE clear PCN match found, return exactly:

{"status":"found","pcnName":"Full PCN Name","pcnCode":"ODS code if known","dataDate":"e.g. January 2026","sourceNote":"e.g. NHS Digital GP practice data","practices":[{"name":"Practice Name","ods":"A12345","registered":8500,"adj":8245,"wgt":8670,"adjNote":"NHS England 26/27 or estimated x0.97","wgtNote":"NHS England or estimated x1.025"}]}

If MULTIPLE PCNs match the search, return:

{"status":"multiple","options":[{"code":"AB1","name":"Full PCN Name","icb":"ICB Name if known"}]}

If you genuinely cannot identify ANY PCN matching the name, return:

{"status":"not_found","message":"brief reason"}

Data sources to search (try ALL of these):
- digital.nhs.uk — GP registered patients by practice
- openprescribing.net/practice/ — shows practice list sizes and PCN membership
- odsportal.digital.nhs.uk — ODS codes for practices
- NHS England PCN configurations spreadsheet

For adjusted population: use NHS England figure if found, otherwise registered x 0.97
For weighted population: use NHS England contractor weighted figure if found, otherwise registered x 1.025

Include ALL member practices in the PCN. Return only valid JSON, nothing else.`;

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

    // Build initial messages
    let messages: any[] = [{
      role: "user",
      content: `Find all member practices, their ODS codes, and their registered patient list sizes for: ${String(query).trim()} PCN. Search openprescribing.net and digital.nhs.uk for the data.`
    }];

    // Multi-turn loop to handle web_search tool use (up to 15 turns)
    let finalText = "";
    for (let turn = 0; turn < 15; turn++) {
      console.log(`[pcn-data-search] Turn ${turn + 1}, messages: ${messages.length}`);

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: SYSTEM,
          messages,
        }),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error("[pcn-data-search] Anthropic error:", upstream.status, errText);
        throw new Error(`Anthropic API ${upstream.status}`);
      }

      const data = await upstream.json();
      const stopReason = data.stop_reason;
      console.log(`[pcn-data-search] Stop reason: ${stopReason}, content blocks: ${data.content?.length}`);

      // Extract any text blocks from this turn
      const textBlocks = (data.content ?? []).filter((b: any) => b.type === "text");
      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b: any) => b.text).join("\n");
      }

      // If end_turn or stop, we're done
      if (stopReason === "end_turn" || stopReason === "stop" || stopReason === "max_tokens") {
        break;
      }

      // If pause_turn with tool_use, append assistant response and continue
      if (stopReason === "pause_turn" || data.content?.some((b: any) => b.type === "server_tool_use" || b.type === "tool_use" || b.type === "web_search_tool_result")) {
        // Append the full assistant response to continue the conversation
        messages = [
          ...messages,
          { role: "assistant", content: data.content },
        ];
        continue;
      }

      // Unknown stop reason — break
      console.log(`[pcn-data-search] Unknown stop reason: ${stopReason}, breaking`);
      break;
    }

    console.log("[pcn-data-search] Final text length:", finalText.length);
    console.log("[pcn-data-search] Final text preview:", finalText.substring(0, 300));

    const match = finalText.match(/\{[\s\S]*\}/);
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
