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
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let modelKey = 'gemini-3-flash';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.model && MODEL_MAP[body.model]) modelKey = body.model;
  } catch (_) { /* ignore */ }

  const gatewayModel = MODEL_MAP[modelKey];
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ status_code: 0, elapsed_ms: 0, body_preview: '', error_message: 'LOVABLE_API_KEY not configured' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const start = Date.now();
  // Direct call — NO fallback, NO wrapper. 120s timeout to mirror the production limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [{ role: 'user', content: FIXED_PROMPT }],
        max_completion_tokens: 200,
      }),
      signal: controller.signal,
    });
    const elapsed_ms = Date.now() - start;
    const text = await response.text();
    return new Response(
      JSON.stringify({
        status_code: response.status,
        elapsed_ms,
        body_preview: text.slice(0, 600),
        error_message: response.ok ? null : `HTTP ${response.status}`,
        model_tested: modelKey,
        gateway_model: gatewayModel,
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } finally {
    clearTimeout(timer);
  }
});
