// Extract structured management time entries from free-text (parsed from a Word doc, PDF or image)
// using the Lovable AI Gateway with strict JSON tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You extract billable management time entries from notes, diaries, calendars or scanned documents for an NHS-style claim form. British English. Use British date conventions (DD/MM/YYYY input → ISO YYYY-MM-DD output). Use 24-hour times (HH:mm). When both a start and end time are present, compute hours = (end - start) in decimal hours rounded to the nearest 0.25. Drop any line that does not have a resolvable date. Description must be a short single-line summary (max ~120 chars) of what was done on that date — never include the date or times in the description. If there is ambiguity about the year, assume the current claim year. Return zero entries if nothing date-bound is found.`;

const TOOL = {
  type: "function",
  function: {
    name: "return_entries",
    description: "Return the list of extracted management time entries.",
    parameters: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              work_date: { type: "string", description: "ISO date YYYY-MM-DD" },
              start_time: { type: "string", description: "24-hour HH:mm or empty" },
              end_time: { type: "string", description: "24-hour HH:mm or empty" },
              hours: { type: "number", description: "Decimal hours, rounded to 0.25" },
              description: { type: "string" },
            },
            required: ["work_date", "hours", "description"],
            additionalProperties: false,
          },
        },
      },
      required: ["entries"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return new Response(JSON.stringify({ entries: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap input length defensively
    const trimmed = text.length > 30_000 ? text.slice(0, 30_000) : text;
    const today = new Date().toISOString().slice(0, 10);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\nToday's date: ${today}.` },
          { role: "user", content: `Extract entries from the following document text:\n\n${trimmed}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_entries" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit, please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please top up the workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments || "{}";
    let parsed: { entries?: any[] } = {};
    try { parsed = JSON.parse(argsStr); } catch { parsed = { entries: [] }; }

    const cleaned = (parsed.entries || []).filter((e: any) => e && e.work_date && /^\d{4}-\d{2}-\d{2}$/.test(e.work_date));

    return new Response(JSON.stringify({ entries: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-management-time-entries error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
