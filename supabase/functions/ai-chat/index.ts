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
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
      });
      if (!__vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ---- /AUTH GUARD ----

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

          // STAGE 1: Find relevant documents via title/summary/keyword match
          const searchTerms = query
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w: string) => w.length >= 3)
            .slice(0, 8);

          if (searchTerms.length > 0) {
            const orConditions = searchTerms
              .map((term: string) =>
                `title.ilike.%${term}%,summary.ilike.%${term}%,keywords.cs.{${term}}`
              )
              .join(",");

            const { data: matchedDocs } = await serviceClient
              .from("kb_documents")
              .select("id, title, source, effective_date, summary, key_points, keywords")
              .eq("is_active", true)
              .eq("status", "indexed")
              .or(orConditions)
              .limit(4);

            if (matchedDocs && matchedDocs.length > 0) {
              const docIds = matchedDocs.map((d: any) => d.id);

              // STAGE 2: Get chunks from those documents that contain search terms
              const chunkOrConditions = searchTerms
                .map((term: string) => `content.ilike.%${term}%`)
                .join(",");

              const { data: matchedChunks } = await serviceClient
                .from("kb_chunks")
                .select("document_id, content, chunk_index")
                .in("document_id", docIds)
                .or(chunkOrConditions)
                .order("chunk_index", { ascending: true })
                .limit(6);

              kbSources = matchedDocs.map((doc: any) => ({
                title: doc.title || "",
                source: doc.source || "Unknown",
                effective_date: doc.effective_date || "",
              }));

              const docMap = new Map(
                matchedDocs.map((d: any) => [d.id, d])
              );

              let contextParts: string[] = [];

              if (matchedChunks && matchedChunks.length > 0) {
                const chunksByDoc = new Map<string, string[]>();
                for (const chunk of matchedChunks) {
                  const existing = chunksByDoc.get(chunk.document_id) || [];
                  existing.push(chunk.content);
                  chunksByDoc.set(chunk.document_id, existing);
                }

                for (const [docId, chunks] of chunksByDoc) {
                  const doc = docMap.get(docId);
                  if (!doc) continue;
                  contextParts.push(
                    `SOURCE: ${doc.title} (${doc.effective_date || "No date"}) · ${doc.source || ""}\n` +
                    chunks.join("\n")
                  );
                }
              } else {
                for (const doc of matchedDocs) {
                  const kp = Array.isArray(doc.key_points)
                    ? "\n- " + doc.key_points.join("\n- ")
                    : "";
                  contextParts.push(
                    `SOURCE: ${doc.title} (${doc.effective_date || "No date"})\n` +
                    `${doc.summary || ""}${kp}`
                  );
                }
              }

              if (contextParts.length > 0) {
                kbContext =
                  "\n\nNORTHAMPTONSHIRE LOCAL KNOWLEDGE BASE" +
                  " — AUTHORITATIVE. Prioritise this over" +
                  " general knowledge for all Northants" +
                  " prescribing questions:\n\n" +
                  contextParts.join("\n\n---\n\n") +
                  "\n---";
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
    systemPrompt += `\n\nFORMULARY RESPONSE RULES — MANDATORY when answering any prescribing, drug, or medication question:
1. ALWAYS lead with the Northamptonshire traffic light status if found in the knowledge base. Format it prominently like this:
   🔴🔴 DOUBLE RED — [drug name]: [reason/action]
   🔴 RED — hospital/specialist prescribing only
   🟡 AMBER — specialist initiation or recommendation required
   🟢 GREEN — suitable for primary care prescribing
   ⚫ GREY — not recommended by ICB
2. If the KB contains a specific local position (e.g. preferred brand, switching advice, carbon footprint guidance) STATE IT EXPLICITLY — do not just link to the formulary. The GP needs the answer, not a signpost.
3. Format prescribing answers like this:
   **Northamptonshire Formulary Position**
   [Traffic light badge + one-line position]
   **Preferred choice(s)**
   [Named drug/brand + brief reason]
   **What NOT to prescribe**
   [Any double red / red items with reason]
   **Local context**
   [Any specific local guidance, carbon footprint notes, shared care requirements]
   **National guidance**
   [NICE/BNF reference for context]
4. When the KB contains the answer, prioritise it over general knowledge. Only fall back to BNF/NICE if the KB has no relevant entry.
5. Always end prescribing answers with:
   Source: [KB document title] · [effective date]
   Verify at: icnorthamptonshire.org.uk/mo-formulary
6. If asked about a drug and no local data found, say so explicitly: "I don't have a specific Northamptonshire formulary entry for this drug — check icnorthamptonshire.org.uk/trafficlightdrugs for the current traffic light classification."`;

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
