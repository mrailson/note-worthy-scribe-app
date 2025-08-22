import { serve } from "https://deno.land/std/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SMALL_SYS =
  "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullets.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  console.log("=== gpt5-fast-clinical: request received ===");
  const t0 = Date.now();

  const { messages = [], model, systemPrompt } = await req.json();
  const sys = systemPrompt ?? SMALL_SYS;
  const chatMessages = [{ role: "system", content: sys }, ...messages];

  // Try GPT-5 with streaming, then fall back on policy error
  const tryModel = async (m: string, stream: boolean) => {
    console.log(`Trying model: ${m}, stream: ${stream}`);
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m,
        messages: chatMessages,
        stream,
        max_tokens: 450,
        temperature: 0.2,
      }),
    });
    return r;
  };

  try {
    // 1) Primary: gpt-5 streaming
    let resp = await tryModel("gpt-5", true);

    // 2) If org verification blocks streaming, fall back
    if (!resp.ok) {
      try {
        const err = await resp.json();
        console.log("Primary request failed:", err);
        const gated =
          err?.error?.code === "unsupported_value" && err?.error?.param === "stream" ||
          (err?.error?.message || "").toLowerCase().includes("verify organization");
        if (gated) {
          console.log("Org verification required, falling back to gpt-4o-mini streaming");
          // Preferred fallback: 4o-mini streaming
          resp = await tryModel("gpt-4o-mini", true);
        } else {
          console.log("Other error, falling back to gpt-5 non-streaming");
          // Non-stream fallback on gpt-5
          resp = await tryModel("gpt-5", false);
        }
      } catch {
        console.log("Error parsing failed, using safe default");
        // If parsing fails, try a safe default
        resp = await tryModel("gpt-4o-mini", true);
      }
    }

    const t1 = Date.now();
    console.log(`Model selection and request time: ${t1 - t0}ms`);

    // If non-streaming, wrap JSON into synthetic SSE so your client UI still works
    if (resp.ok && resp.headers.get("content-type")?.includes("application/json")) {
      console.log("Wrapping non-streaming response in SSE format");
      const json = await resp.json();
      const text = json?.choices?.[0]?.message?.content ?? "";
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          // send a small meta event
          controller.enqueue(encoder.encode(`data: {"_meta":"nonstream-wrap"}\n\n`));
          // chunk text as delta events
          const chunks = text.match(/.{1,800}/gs) ?? [];
          for (const chunk of chunks) {
            const evt = { choices: [{ delta: { content: chunk } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    console.log("Returning normal streaming response");
    // Normal streaming passthrough
    return new Response(resp.body, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (err) {
    console.error("handler error:", err?.message || String(err));
    // Return SSE-style error so the client doesn't hang
    const errorEvent = `data: ${JSON.stringify({ error: String(err) })}\n\n`;
    return new Response(errorEvent, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
      },
      status: 200, // keep SSE open for client to consume error
    });
  }
});