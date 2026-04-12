import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SEARCH_TRIGGERS = [
  'latest', 'current', 'recent', 'update', '2025', '2026',
  'des ', 'pcn des', 'arrs', 'network contract', 'les ',
  'guidance', 'has changed', 'new policy', 'announcement',
  'nice', 'nhse', 'nhs england', 'formulary', 'tariff',
  'reimbursement rate', 'qof', 'iif', 'caip', 'gpad',
  'enhanced access', 'pharmacy first', 'icb', 'spec',
  'this year', 'this month', 'april 2025', 'april 2026'
];

const NHS_DOMAINS = [
  'england.nhs.uk',
  'nice.org.uk',
  'gov.uk',
  'bma.org.uk',
  'rcgp.org.uk',
  'nhsbsa.nhs.uk',
  'icnorthamptonshire.org.uk',
  'northamptonformulary.nhs.uk',
  'cqrs.nhs.uk',
  'digital.nhs.uk'
];

function needsSearch(message: string): boolean {
  const lower = message.toLowerCase();
  return SEARCH_TRIGGERS.some(t => lower.includes(t));
}

async function searchNHS(query: string, tavilyKey: string) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `NHS primary care ${query}`,
      search_depth: 'basic',
      max_results: 4,
      include_domains: NHS_DOMAINS,
      include_answer: true
    })
  });
  if (!res.ok) return null;
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, latestMessage, model, max_tokens } =
      await req.json();

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build enhanced system prompt with live search results
    let enhancedSystem = systemPrompt;
    let searchUsed = false;
    let searchSources: { title: string; url: string }[] = [];

    if (tavilyKey && needsSearch(latestMessage || '')) {
      try {
        const results = await searchNHS(latestMessage, tavilyKey);
        if (results?.results?.length > 0) {
          searchUsed = true;
          searchSources = results.results.map((r: any) => ({
            title: r.title,
            url: r.url
          }));

          const searchContext = results.results
            .map((r: any) =>
              `SOURCE: ${r.title} (${r.url})\n` +
              `DATE: ${r.published_date || 'recent'}\n` +
              `${r.content?.slice(0, 600)}`
            )
            .join('\n\n---\n\n');

          enhancedSystem += `\n\nLIVE NHS SEARCH RESULTS ` +
            `(retrieved now — use this in preference to ` +
            `training knowledge for current figures/dates):\n\n` +
            `${searchContext}\n\n` +
            `Always cite the source URL as a markdown link when using these results.`;
        }
      } catch (e) {
        console.error('Search failed, continuing without:', e);
      }
    }

    // Stream response from Anthropic
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: max_tokens || 4096,
          stream: true,
          system: enhancedSystem,
          messages: messages
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic error:', errBody);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a TransformStream to prepend search metadata then pass through Anthropic's SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Pipe: first send search metadata event, then Anthropic stream
    (async () => {
      try {
        // If search was performed, send sources as a custom SSE event
        if (searchUsed && searchSources.length > 0) {
          await writer.write(encoder.encode(
            `event: web_search_sources\ndata: ${JSON.stringify(searchSources)}\n\n`
          ));
        }

        // Pipe the Anthropic response body through
        const reader = response.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
