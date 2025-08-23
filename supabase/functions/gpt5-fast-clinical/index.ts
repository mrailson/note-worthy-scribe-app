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

  const { messages = [], model, systemPrompt, max_tokens } = body;
  const sys = systemPrompt ?? SMALL_SYS;

  const chatMessages = [{ role: "system", content: sys }, ...messages];

  // Content type detection for dynamic token allocation
  function detectContentType(messages: any[]): { maxTokens: number; contentType: string } {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content?.toLowerCase() || '';
    
    // Check for comprehensive content indicators
    const comprehensiveIndicators = [
      'leaflet', 'comprehensive', 'detailed guide', 'full guide', 'complete guide',
      'patient information', 'detailed explanation', 'comprehensive overview',
      'step by step', 'complete instructions', 'full instructions'
    ];
    
    const medicalAnalysisIndicators = [
      'analyze', 'assessment', 'evaluation', 'diagnosis', 'differential',
      'complex case', 'investigation', 'clinical reasoning', 'pathophysiology'
    ];
    
    const clinicalNotesIndicators = [
      'clinical note', 'soap note', 'consultation note', 'discharge summary',
      'referral letter', 'brief summary', 'quick note'
    ];
    
    // Use maximum tokens for ALL content types to prevent cutoffs
    if (comprehensiveIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'comprehensive' };
    }
    
    if (medicalAnalysisIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'analysis' };
    }
    
    if (clinicalNotesIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'clinical_notes' };
    }
    
    // Check content length as secondary indicator
    if (content.length > 200) {
      return { maxTokens: 4096, contentType: 'medium' };
    }
    
    return { maxTokens: 4096, contentType: 'short' };
  }

  // Determine max tokens - use provided value or detect from content
  const { maxTokens: detectedMaxTokens } = detectContentType(messages);
  const finalMaxTokens = max_tokens || detectedMaxTokens;

  const tryModel = async (m: string, stream: boolean) => {
    const requestBody: Record<string, any> = {
      model: m,
      messages: chatMessages,
      stream,
      // Use appropriate max_tokens for GPT-5 (max_completion_tokens) vs legacy models (max_tokens)
      ...(m.startsWith('gpt-5') ? 
        { max_completion_tokens: finalMaxTokens } : 
        { max_tokens: finalMaxTokens, temperature: 0.2 }
      ),
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
          // Send the full text as a single chunk to avoid truncation issues
          if (text) {
            const evt = { choices: [{ delta: { content: text } }] };
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