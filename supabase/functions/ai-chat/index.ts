const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();

    // Extract user query from last message for KB search
    let kbContext = "";
    let kbSources: { title: string; source: string; effective_date: string }[] = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (supabaseUrl && supabaseServiceKey && body.messages?.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      const query = typeof lastMsg.content === "string"
        ? lastMsg.content
        : lastMsg.content?.find?.((c: any) => c.type === "text")?.text || "";

      if (query.length > 2) {
        try {
          const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

          // Search kb_documents by keyword match
          const searchTerms = query
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w: string) => w.length >= 2)
            .slice(0, 6);

          if (searchTerms.length > 0) {
            // Build OR conditions that also search the keywords column
            const orConditions = searchTerms
              .map((term: string) => 
                `title.ilike.%${term}%,summary.ilike.%${term}%,keywords.cs.{${term}}`
              )
              .join(",");

            const { data: kbDocs } = await serviceClient
              .from("kb_documents")
              .select("title, summary, key_points, keywords, source, effective_date")
              .eq("is_active", true)
              .eq("status", "indexed")
              .or(orConditions)
              .limit(5);

            if (kbDocs && kbDocs.length > 0) {
              kbSources = kbDocs.map((doc: any) => ({
                title: doc.title || "",
                source: doc.source || "Unknown",
                effective_date: doc.effective_date || "",
              }));

              const entries = kbDocs.map((doc: any) => {
                const keyPts = Array.isArray(doc.key_points) ? doc.key_points.join("; ") : "";
                const kws = Array.isArray(doc.keywords) ? doc.keywords.join(", ") : "";
                return `SOURCE: ${doc.source || "Unknown"} (${doc.effective_date || "No date"})\n${doc.summary || ""}\nKey points: ${keyPts}${kws ? `\nKeywords: ${kws}` : ""}`;
              });

              kbContext = `\n\nNORTHAMPTONSHIRE LOCAL KNOWLEDGE BASE (use this in preference to general knowledge):\n\n${entries.join("\n---\n")}\n---`;
            }

            // If no results from structured search, try keyword array text search via RPC-like approach
            if (!kbDocs || kbDocs.length === 0) {
              // Fallback: search keywords array with case-insensitive matching
              for (const term of searchTerms) {
                if (term.length < 2) continue;
                const { data: fallbackDocs } = await serviceClient
                  .from("kb_documents")
                  .select("title, summary, key_points, keywords, source, effective_date")
                  .eq("is_active", true)
                  .eq("status", "indexed")
                  .or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
                  .limit(3);

                if (fallbackDocs && fallbackDocs.length > 0) {
                  kbSources = fallbackDocs.map((doc: any) => ({
                    title: doc.title || "",
                    source: doc.source || "Unknown",
                    effective_date: doc.effective_date || "",
                  }));

                  const entries = fallbackDocs.map((doc: any) => {
                    const keyPts = Array.isArray(doc.key_points) ? doc.key_points.join("; ") : "";
                    return `SOURCE: ${doc.source || "Unknown"} (${doc.effective_date || "No date"})\n${doc.summary || ""}\nKey points: ${keyPts}`;
                  });

                  kbContext = `\n\nNORTHAMPTONSHIRE LOCAL KNOWLEDGE BASE (use this in preference to general knowledge):\n\n${entries.join("\n---\n")}\n---`;
                  break;
                }
              }
            }
          }
        } catch (kbErr) {
          console.error("KB search error (non-fatal):", kbErr);
        }
      }
    }

    // Augment system prompt with KB context if found
    let systemPrompt = body.system || "";
    if (kbContext) {
      systemPrompt += kbContext;
    }
    systemPrompt += "\n\nWhen using knowledge base content, always cite the source and effective date. If content may be outdated (effective date more than 6 months ago), note this.";

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        ...body,
        system: systemPrompt,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return new Response(JSON.stringify(err), {
        status: upstream.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Create a custom stream that prepends KB sources metadata
    const encoder = new TextEncoder();
    const upstreamBody = upstream.body!;

    const readable = new ReadableStream({
      async start(controller) {
        // Send KB sources as custom SSE event first
        if (kbSources.length > 0) {
          const meta = `event: kb_sources\ndata: ${JSON.stringify(kbSources)}\n\n`;
          controller.enqueue(encoder.encode(meta));
        }

        // Pipe upstream body
        const reader = upstreamBody.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
