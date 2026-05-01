// Diagnostic edge function: pings Gemini Pro / Flash directly via Lovable AI Gateway
// to surface the TRUE behaviour without any fallback wrapper.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIXED_PROMPT =
  'Summarise this in one sentence: The team met on Tuesday to review Q3 spend and agreed to defer the marketing budget until October.';

const MODEL_MAP: Record<string, string> = {
  'gemini-3.1-pro': 'google/gemini-3.1-pro-preview',
  'gemini-3-flash': 'google/gemini-3-flash-preview',
  // Allow passing the gateway model id directly too
  'google/gemini-3.1-pro-preview': 'google/gemini-3.1-pro-preview',
  'google/gemini-3-flash-preview': 'google/gemini-3-flash-preview',
};

type ReasoningMode = 'default' | 'excluded' | 'low' | 'minimal';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let modelKey = 'gemini-3-flash';
  let maxTokens = 1024;
  let reasoningMode: ReasoningMode = 'default';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.model && MODEL_MAP[body.model]) modelKey = body.model;
    if (typeof body?.max_tokens === 'number' && body.max_tokens > 0) maxTokens = Math.floor(body.max_tokens);
    if (body?.reasoning_mode && ['default', 'excluded', 'low', 'minimal'].includes(body.reasoning_mode)) {
      reasoningMode = body.reasoning_mode;
    }
  } catch (_) { /* ignore */ }

  const gatewayModel = MODEL_MAP[modelKey];
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ status_code: 0, elapsed_ms: 0, body_preview: '', error_message: 'LOVABLE_API_KEY not configured' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const requestBody: Record<string, unknown> = {
    model: gatewayModel,
    messages: [{ role: 'user', content: FIXED_PROMPT }],
    max_completion_tokens: maxTokens,
    max_tokens: maxTokens,
  };
  if (reasoningMode === 'excluded') {
    requestBody.reasoning = { exclude: true };
  } else if (reasoningMode === 'low') {
    requestBody.reasoning = { effort: 'low' };
  } else if (reasoningMode === 'minimal') {
    requestBody.reasoning = { effort: 'minimal' };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const elapsed_ms = Date.now() - start;
    const text = await response.text();

    let finish_reason: string | null = null;
    let native_finish_reason: string | null = null;
    let total_tokens: number | null = null;
    try {
      const parsed = JSON.parse(text);
      const choice = parsed?.choices?.[0];
      // OpenAI-compatible shape: choices[0].finish_reason, choices[0].native_finish_reason
      // Some providers nest under message — check both for robustness.
      finish_reason = choice?.finish_reason ?? choice?.message?.finish_reason ?? null;
      native_finish_reason = choice?.native_finish_reason ?? choice?.message?.native_finish_reason ?? null;
      const usage = parsed?.usage;
      if (typeof usage?.total_tokens === 'number') {
        total_tokens = usage.total_tokens;
      } else if (typeof usage?.completion_tokens === 'number' || typeof usage?.prompt_tokens === 'number') {
        total_tokens = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);
      }
    } catch (_) { /* ignore parse errors */ }

    return new Response(
      JSON.stringify({
        status_code: response.status,
        elapsed_ms,
        body_preview: text.slice(0, 600),
        error_message: response.ok ? null : `HTTP ${response.status}`,
        model_tested: modelKey,
        gateway_model: gatewayModel,
        max_tokens: maxTokens,
        reasoning_mode: reasoningMode,
        finish_reason,
        native_finish_reason,
        total_tokens,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    const elapsed_ms = Date.now() - start;
    const isTimeout = err?.name === 'AbortError';
    return new Response(
      JSON.stringify({
        status_code: 0,
        elapsed_ms,
        body_preview: '',
        error_message: isTimeout ? `Timeout after ${elapsed_ms}ms` : (err?.message || String(err)),
        model_tested: modelKey,
        gateway_model: gatewayModel,
        max_tokens: maxTokens,
        reasoning_mode: reasoningMode,
        finish_reason: null,
        native_finish_reason: null,
        total_tokens: null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } finally {
    clearTimeout(timer);
  }
});
