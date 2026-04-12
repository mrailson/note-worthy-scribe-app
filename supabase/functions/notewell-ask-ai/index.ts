import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SEARCH_TRIGGERS = [
  // Time signals
  'latest', 'current', 'recent', 'update', 'today',
  'this week', 'this month', 'news', 'announced',
  'just published', 'new guidance', 'has changed',
  'what is the', 'what are the',
  // Year signals
  '2025', '2026', '2027', 'april 2025', 'april 2026',
  // NHS contracts & payments
  'des ', 'pcn des', 'arrs', 'network contract',
  'les ', 'local enhanced', 'qof', 'iif',
  'caip', 'gpad', 'enhanced access', 'pharmacy first',
  'reimbursement rate', 'tariff', 'payment rate',
  // Policy & guidance
  'guidance', 'policy', 'plan', 'strategy', 'proposal',
  'consultation', 'specification', 'framework',
  'white paper', 'green paper', 'mandate',
  // NHS organisations & people
  'nhs england', 'nhse', 'nice', 'dhsc', 'icb',
  'wes streeting', 'streeting', 'secretary of state',
  'nhsc', 'primary care', 'gpc', 'bma',
  // NHS programmes
  '10 year plan', 'ten year plan', 'long term plan',
  'neighbourhood health', 'neighbourhood care',
  'new models', 'elective reform', 'access recovery',
  'workforce plan', 'nhs reform',
  // Formulary & prescribing
  'formulary', 'prescribing', 'drug', 'medicine',
  'nice ta', 'technology appraisal', 'semaglutide',
  'tirzepatide', 'glp-1', 'ozempic', 'wegovy',
  'adhd medication', 'controlled drug',
  // Local
  'northamptonshire', 'nres', 'enn', 'pml',
  'blue pcn', 'northants',
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
  'digital.nhs.uk',
  'health.org.uk',
  'kingsfund.org.uk',
  'nhsconfed.org',
  'pulsetoday.co.uk',
  'hsj.co.uk',
  'nationalhealthexecutive.com',
  'parliament.uk',
];

const NHS_DIRECT_URLS: Record<string, string[]> = {
  des: [
    'https://www.england.nhs.uk/gp/the-best-of-general-practice/primary-care-networks/',
    'https://www.england.nhs.uk/wp-content/uploads/2025/03/network-contract-des-specification-2025-26.pdf',
    'https://www.england.nhs.uk/publication/network-contract-directed-enhanced-service-des-specification-2026-27/',
  ],
  arrs: [
    'https://www.england.nhs.uk/gp/the-best-of-general-practice/primary-care-networks/',
    'https://www.england.nhs.uk/publication/network-contract-directed-enhanced-service-des-specification-2026-27/',
  ],
  qof: [
    'https://www.england.nhs.uk/wp-content/uploads/2023/03/qof-2023-24-guidance.pdf',
  ],
  formulary: [
    'https://www.icnorthamptonshire.org.uk/primarycareportal/',
    'https://www.icnorthamptonshire.org.uk/documents/',
  ],
};

function needsSearch(message: string): boolean {
  const m = message.toLowerCase();

  // Never search for these — pure generation tasks
  const skipPatterns = [
    'write a letter', 'draft a letter',
    'create a word doc', 'make a spreadsheet',
    'write a policy', 'create an excel',
    'make a powerpoint', 'create a presentation',
    'generate an image', 'create a photo',
    'write an email', 'draft an email',
    'write a template', 'create a template',
    'summarise this document', 'summarise the attached',
  ];

  if (skipPatterns.some(p => m.includes(p)))
    return false;

  // Search for anything that looks like a question
  // or information request about NHS/health topics
  const alwaysSearch = [
    'what is', 'what are', 'what does', 'what was',
    'how do', 'how does', 'how can', 'how much',
    'when is', 'when was', 'when did',
    'who is', 'who are', 'who was',
    'why is', 'why did', 'why has',
    'tell me', 'explain', 'describe',
    'latest', 'current', 'recent', 'news',
    'update', 'guidance', 'policy',
  ];

  if (alwaysSearch.some(p => m.includes(p)))
    return true;

  // Check original trigger list as fallback
  return SEARCH_TRIGGERS.some(t => m.includes(t));
}

function buildQuery(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('arrs') || m.includes('reimbursement') || m.includes('additional roles')) {
    const year = m.includes('26/27') || m.includes('2026') ? '2026 2027' : '2025 2026';
    return `ARRS additional roles reimbursement rates percentage ${year} network contract DES NHS England site:england.nhs.uk`;
  }

  if (m.includes('des') || m.includes('network contract') || m.includes('pcn des')) {
    const year = m.includes('26/27') || m.includes('2026') ? '2026 2027' : '2025 2026';
    return `Network Contract Directed Enhanced Service DES ${year} NHS England requirements specifications site:england.nhs.uk`;
  }

  if (m.includes('qof'))
    return 'QOF quality outcomes framework indicators 2025 2026 NHS England';
  if (m.includes('caip') || m.includes('access improvement'))
    return 'CAIP capacity access improvement payment 2025 2026 NHS England primary care';
  if (m.includes('formulary') || m.includes('prescribing'))
    return 'Northamptonshire ICB primary care formulary prescribing guidance 2025 2026 site:icnorthamptonshire.org.uk';
  if (m.includes('les') || m.includes('local enhanced'))
    return 'NHS local enhanced services LES Northamptonshire primary care 2025 2026';

  // News / people / policy
  if (m.includes('wes streeting') || m.includes('streeting') || m.includes('secretary of state')) {
    return `Wes Streeting NHS announcement policy primary care 2025 2026 latest news`;
  }
  if (m.includes('10 year plan') || m.includes('ten year plan') || m.includes('long term plan') || m.includes('nhs plan')) {
    return `NHS 10 year plan primary care implications neighbourhood health 2025 2026 GP PCN`;
  }
  if (m.includes('neighbourhood health') || m.includes('neighbourhood care')) {
    return `NHS neighbourhood health service primary care 2025 2026 GP PCN integration`;
  }
  if (m.includes('news') || m.includes('latest') || m.includes('announced')) {
    return `NHS primary care ${message} site:england.nhs.uk OR site:gov.uk OR site:bma.org.uk 2025 2026`;
  }

  return `NHS primary care ${message} 2025 2026`;
}

async function searchNHS(query: string, tavilyKey: string) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: buildQuery(query),
      search_depth: 'basic',
      max_results: 4,
      include_domains: NHS_DOMAINS,
      include_answer: true,
      include_raw_content: false,
      days: 365
    })
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchDirectContent(urls: string[]): Promise<string> {
  const results: string[] = [];

  for (const url of urls.slice(0, 2)) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'NotewellAI/1.0' }
      });
      if (!res.ok) continue;

      const text = await res.text();

      const plain = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500);

      if (plain.length > 100) {
        results.push(`DIRECT SOURCE: ${url}\nContent: ${plain}`);
      }
    } catch {
      continue;
    }
  }

  return results.join('\n\n---\n\n');
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

    let enhancedSystem = systemPrompt;
    let searchUsed = false;
    let searchSources: { title: string; url: string }[] = [];
    const msg = (latestMessage || '').toLowerCase();

    // Tavily search
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
            .map((r: any, i: number) => {
              const date = r.published_date
                ? new Date(r.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'recent';
              return `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\nDate: ${date}\n${r.content?.slice(0, 600)}`;
            })
            .join('\n\n---\n\n');

          enhancedSystem += `\n\nLIVE NHS SEARCH RESULTS ` +
            `(retrieved just now — use these in preference to ` +
            `training knowledge for current figures, dates, and rates):\n\n` +
            `${searchContext}\n\n` +
            `CITATION RULES:\n` +
            `- Always cite each source used as a markdown link: [Title](URL)\n` +
            `- Include the publication date where available\n` +
            `- If multiple sources agree, cite the most recent one\n` +
            `- At the end of the response add a "Sources" section listing all sources used`;
        }
      } catch (e) {
        console.error('Search failed, continuing without:', e);
      }
    }

    // Direct NHS England page fetch for key topics
    let directContent = '';
    if (msg.includes('des') || msg.includes('network contract') || msg.includes('pcn des') || msg.includes('26/27') || msg.includes('2026/27')) {
      directContent = await fetchDirectContent(NHS_DIRECT_URLS.des);
    } else if (msg.includes('arrs') || msg.includes('reimbursement')) {
      directContent = await fetchDirectContent(NHS_DIRECT_URLS.arrs);
    } else if (msg.includes('qof')) {
      directContent = await fetchDirectContent(NHS_DIRECT_URLS.qof);
    } else if (msg.includes('formulary') || msg.includes('prescribing')) {
      directContent = await fetchDirectContent(NHS_DIRECT_URLS.formulary);
    }

    if (directContent) {
      enhancedSystem += `\n\nDIRECT NHS ENGLAND PAGE CONTENT (fetched live — highest authority):\n\n${directContent}`;
    }

    // Currency signal
    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    enhancedSystem += `\nIMPORTANT: Today is ${todayStr}. ` +
      `If you cannot confirm the 2026/27 DES has been published yet, say so explicitly and ` +
      `provide the 2025/26 figures with a note that 2026/27 specifications should be verified at: ` +
      `https://www.england.nhs.uk/gp/the-best-of-general-practice/primary-care-networks/\n` +
      `Never present 2025/26 figures as 2026/27 without source confirmation.\n`;

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

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        if (searchUsed && searchSources.length > 0) {
          await writer.write(encoder.encode(
            `event: web_search_sources\ndata: ${JSON.stringify(searchSources)}\n\n`
          ));
        }

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
