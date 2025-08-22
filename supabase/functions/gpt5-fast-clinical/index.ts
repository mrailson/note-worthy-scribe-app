import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// CORS headers
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle preflight early
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("=== gpt5-fast-clinical: request received ===");
  const t0 = Date.now();

  try {
    const { messages = [], model, systemPrompt } = await req.json();

    // Small, fast system prompt
    const sys =
      systemPrompt ??
      "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullet points.";

    const chatMessages = [
      { role: "system", content: sys },
      ...messages,
    ];

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 65000);

    const m = model || "gpt-5-instant"; // or "gpt-5" / "gpt-5-mini"
    console.log(`model=${m}`);

    const t1 = Date.now();
    console.log(`prep (t1 - t0): ${t1 - t0}ms`);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: m,
        messages: chatMessages,
        stream: true,
        max_tokens: 450, // right-sized for BNF cribs
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    });

    clearTimeout(timeout);

    // Wrap the body to log first-byte time
    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();
    let sawFirst = false;

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader!.read();
        if (done) {
          console.log(`complete (t - t0): ${Date.now() - t0}ms`);
          controller.close();
          return;
        }
        if (!sawFirst) {
          console.log(`TTFB (t - t1): ${Date.now() - t1}ms`);
          sawFirst = true;
          // identify the function in the stream
          controller.enqueue(new TextEncoder().encode(`data: {"_meta":"gpt5-fast-clinical"}\n\n`));
        }
        controller.enqueue(value);
      },
      cancel(reason) {
        console.error("stream cancelled:", reason);
        reader?.cancel(reason);
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("handler error:", err?.message || String(err));
    // Return SSE-style error so the client doesn't hang
    const errorEvent = `data: ${JSON.stringify({ error: String(err) })}\n\n`;
    return new Response(errorEvent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
      status: 200, // keep SSE open for client to consume error
    });
  }
});