import { serve } from "https://deno.land/std/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_ORG = Deno.env.get("OPENAI_ORG") ?? ""; // optional

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SMALL_SYS = "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullets.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const sseError = (message: string, status = 200) =>
    new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
      status
    });

  if (!OPENAI_API_KEY) {
    return sseError("Missing OPENAI_API_KEY in environment. Set it and redeploy.", 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return sseError("Bad JSON in request body.", 400);
  }

  const { messages = [], model, systemPrompt } = body;
  const sys = systemPrompt ?? SMALL_SYS;

  const chatMessages = [{ role: "system", content: sys }, ...messages];

  const tryModel = async (m: string, stream: boolean) => {
    const requestBody: Record<string, any> = {
      model: m,
      messages: chatMessages,
      stream,
      // Use Chat Completions params everywhere for compatibility
      max_tokens: 450,
      temperature: 0.2,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (OPENAI_ORG) headers["OpenAI-Organization"] = OPENAI_ORG;

    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });
  };

  try {
    // Primary attempt: gpt-5 streaming
    let resp = await tryModel(model ?? "gpt-5", true);

    if (!resp.ok) {
      // Read error once so we can branch intelligently
      let errJson: any = null;
      let errText = "";
      try { errJson = await resp.json(); } catch { errText = await resp.text(); }

      const msg = (errJson?.error?.message ?? errText ?? "").toLowerCase();
      const gated =
        (errJson?.error?.code === "unsupported_value" && errJson?.error?.param === "stream") ||
        msg.includes("verify organization") ||
        msg.includes("must be verified to stream");

      if (gated) {
        // Same model, non-stream (allowed even when streaming is gated)
        resp = await tryModel("gpt-5", false);
      } else {
        // Something else (e.g., parameter error or model not available) → try 4o-mini streaming
        resp = await tryModel("gpt-4o-mini", true);
      }

      // If still not OK, last fallback: 4o-mini non-stream (we will wrap)
      if (!resp.ok) {
        resp = await tryModel("gpt-4o-mini", false);
      }

      // If STILL not OK, surface the original error cleanly
      if (!resp.ok) {
        const finalErr = errJson ?? (errText || (await resp.text()));
        return sseError(`OpenAI error: ${typeof finalErr === "string" ? finalErr : JSON.stringify(finalErr)}`, 502);
      }
    }

    // If non-streaming JSON, wrap to SSE so the client can consume uniformly
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const json = await resp.json();
      const text = json?.choices?.[0]?.message?.content ?? "";
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"_meta":"nonstream-wrap"}\n\n`));
          const chunks = text.match(/.{1,800}/gs) ?? [];
          for (const chunk of chunks) {
            const evt = { choices: [{ delta: { content: chunk } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }

    // Otherwise it's a proper streaming body already → passthrough
    return new Response(resp.body, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (err: any) {
    return sseError(`Handler error: ${err?.message || String(err)}`, 500);
  }
});