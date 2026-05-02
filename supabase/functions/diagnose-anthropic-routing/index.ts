// TRANSIENT diagnostic edge function — Phase B of stuck-meeting investigation.
// Created 2 May 2026. DELETE after diagnosis (and revoke DIAG_TOKEN secret).
//
// What it does:
//   1. Reports the egress IP the Deno Deploy runtime uses
//   2. Resolves api.anthropic.com via TLS connect + DoH cross-check
//   3. Hits Sonnet 4.6 with a 50-token prompt, 3 times, ~5 s apart
//   4. Hits Haiku 4.5 with the same 50-token shape (model comparator)
//   5. Hits Sonnet 4.6 with a ~14k-input-token prompt (size repro)
//   6. Repeats #5 with a stripped/simplified request shape
//   7. Sanity-checks the Lovable AI Gateway (openai/gpt-5, 50 tokens)
//
// Auth: caller MUST send `x-diag-token: <DIAG_TOKEN secret>`. Without it the
// function 401s — protects against URL leak.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-diag-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AttemptResult {
  label: string;
  ok: boolean;
  status?: number;
  request_id?: string | null;
  elapsed_ms: number;
  body_chars?: number;
  body_preview?: string;
  error?: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function makeBigPrompt(): string {
  // ~56 000 chars of plausible meeting-transcript filler — matches the
  // failing payload size (prompt_chars=56569, ~14k input tokens).
  const words = ('attendee said action item agreed resolved noted the and ' +
    'PCN ARRS funding workforce locum CQC next steps risk register ' +
    'safeguarding governance partners practice manager nurse').split(' ');
  let out = '';
  let seed = 1;
  while (out.length < 56000) {
    // Deterministic pseudo-random word pick (no Math.random for repeatability)
    seed = (seed * 9301 + 49297) % 233280;
    out += words[seed % words.length] + ' ';
    if (out.length % 80 < 1) out += '\n';
  }
  return out.slice(0, 56000);
}

async function callAnthropic(
  label: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<AttemptResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    return {
      label,
      ok: resp.ok,
      status: resp.status,
      request_id: resp.headers.get('request-id') || resp.headers.get('x-request-id'),
      elapsed_ms: Date.now() - start,
      body_chars: text.length,
      body_preview: text.slice(0, 200),
    };
  } catch (e: unknown) {
    const err = e as Error;
    return {
      label,
      ok: false,
      elapsed_ms: Date.now() - start,
      error: err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (err.message || String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callGateway(
  label: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<AttemptResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    return {
      label,
      ok: resp.ok,
      status: resp.status,
      request_id: resp.headers.get('x-request-id') || resp.headers.get('x-trace-id'),
      elapsed_ms: Date.now() - start,
      body_chars: text.length,
      body_preview: text.slice(0, 200),
    };
  } catch (e: unknown) {
    const err = e as Error;
    return {
      label,
      ok: false,
      elapsed_ms: Date.now() - start,
      error: err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (err.message || String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function getEgressIp(): Promise<{ ip: string | null; elapsed_ms: number; error?: string }> {
  const start = Date.now();
  try {
    const r = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json();
    return { ip: j.ip ?? null, elapsed_ms: Date.now() - start };
  } catch (e: unknown) {
    return { ip: null, elapsed_ms: Date.now() - start, error: (e as Error).message };
  }
}

async function dohResolve(provider: 'cloudflare' | 'google'): Promise<string[]> {
  const url = provider === 'cloudflare'
    ? 'https://cloudflare-dns.com/dns-query?name=api.anthropic.com&type=A'
    : 'https://dns.google/resolve?name=api.anthropic.com&type=A';
  try {
    const r = await fetch(url, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json();
    return (j.Answer || [])
      .filter((a: { type: number; data: string }) => a.type === 1)
      .map((a: { data: string }) => a.data);
  } catch {
    return [];
  }
}

async function denoConnectPeer(): Promise<{ peer: string | null; elapsed_ms: number; error?: string }> {
  const start = Date.now();
  try {
    const conn = await Deno.connect({ hostname: 'api.anthropic.com', port: 443 });
    const peer = (conn.remoteAddr as Deno.NetAddr);
    const result = `${peer.hostname}:${peer.port}`;
    conn.close();
    return { peer: result, elapsed_ms: Date.now() - start };
  } catch (e: unknown) {
    return { peer: null, elapsed_ms: Date.now() - start, error: (e as Error).message };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth gate
  const expected = Deno.env.get('DIAG_TOKEN');
  const provided = req.headers.get('x-diag-token');
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const report: Record<string, unknown> = {
    ts: new Date().toISOString(),
    deno_version: (Deno.version as { deno?: string }).deno ?? 'unknown',
  };

  // 1. Egress IP
  report.egress = await getEgressIp();

  // 2. DNS / TLS-connect
  const [denoPeer, doh_cloudflare, doh_google] = await Promise.all([
    denoConnectPeer(),
    dohResolve('cloudflare'),
    dohResolve('google'),
  ]);
  const peerIp = denoPeer.peer?.split(':')[0] ?? null;
  const allDoh = new Set([...doh_cloudflare, ...doh_google]);
  report.dns = {
    deno_peer: denoPeer.peer,
    deno_connect_ms: denoPeer.elapsed_ms,
    deno_connect_error: denoPeer.error,
    doh_cloudflare,
    doh_google,
    deno_peer_in_doh: peerIp ? allDoh.has(peerIp) : false,
  };

  // 3. Sonnet 4.6 — 50-token prompt × 3, ~5 s apart
  const smallBody = (model: string) => ({
    model,
    max_tokens: 60,
    messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
  });
  const sonnetSmall: AttemptResult[] = [];
  for (let i = 1; i <= 3; i++) {
    sonnetSmall.push(
      await callAnthropic(`sonnet_small_${i}`, anthropicKey, smallBody('claude-sonnet-4-6'), 30_000),
    );
    if (i < 3) await sleep(5000);
  }
  report.sonnet_small = sonnetSmall;

  // 4. Haiku 4.5 comparator — same 50-token shape, model swapped
  report.haiku_small = await callAnthropic(
    'haiku_small',
    anthropicKey,
    smallBody('claude-haiku-4-5'),
    30_000,
  );

  // 5. Sonnet 4.6 — ~14k-token full-shape prompt
  const transcript = makeBigPrompt();
  report.sonnet_large_full = await callAnthropic(
    'sonnet_large_full',
    anthropicKey,
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'You are a meticulous British-English meeting notes generator. Produce concise governance-style minutes with RESOLVED / AGREED / NOTED prefixes in bold.',
      messages: [
        { role: 'user', content: 'Summarise this transcript in 3 bullet points:\n\n' + transcript },
      ],
    },
    90_000,
  );

  // 6. Sonnet 4.6 — same size, stripped shape (no system prompt, smaller max_tokens)
  report.sonnet_large_stripped = await callAnthropic(
    'sonnet_large_stripped',
    anthropicKey,
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [
        { role: 'user', content: 'Summarise in 3 bullets:\n\n' + transcript },
      ],
    },
    90_000,
  );

  // 7. Lovable Gateway sanity (openai/gpt-5)
  if (lovableKey) {
    report.gateway_control = await callGateway(
      'gateway_gpt5_small',
      lovableKey,
      {
        model: 'openai/gpt-5',
        max_completion_tokens: 60,
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
      },
      30_000,
    );
  } else {
    report.gateway_control = { error: 'LOVABLE_API_KEY not configured' };
  }

  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
