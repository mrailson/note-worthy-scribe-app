import { serve } from "https://deno.land/std/http/server.ts";

// Force redeploy to pick up updated OPENAI_API_KEY - v3
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
    console.error('CRITICAL: OPENAI_API_KEY environment variable is not set');
    console.log('Available env vars:', Object.keys(Deno.env.toObject()));
    return sseError("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.", 500);
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
      max_tokens: finalMaxTokens,
      temperature: 0.2
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (OPENAI_ORG) headers["OpenAI-Organization"] = OPENAI_ORG;

    // Much shorter timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Request timeout after 15 seconds for model ${m}`);
      controller.abort();
    }, 15000); // 15 second timeout

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`API call failed for ${m}:`, error.message);
      throw error;
    }
  };

  try {
    // Use GPT-4o-mini directly with streaming for fast, reliable responses
    console.log(`Starting request with model: gpt-4o-mini, tokens: ${finalMaxTokens}`);
    const resp = await tryModel("gpt-4o-mini", true);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`GPT-4o-mini failed:`, errorText);
      return sseError(`OpenAI API error: ${errorText}`, resp.status);
    }

    console.log(`Successfully got response from gpt-4o-mini`);
    
    // Return the streaming response directly
    return new Response(resp.body, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (err: any) {
    return sseError(`Handler error: ${err?.message || String(err)}`, 500);
  }
});