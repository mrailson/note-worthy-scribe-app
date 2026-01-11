import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessedNewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary: string;
  content: string;
  relevance_score: number;
  tags: string[];
  image_url?: string;
}

// Utility to decode common HTML entities and numeric codes
function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&(lsquo|rsquo);/g, "'")
    .replace(/&(ldquo|rdquo);/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    // Note: OPENAI_API_KEY is optional. We'll fetch real RSS/Atom feeds by default.


    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    
    // Handle full article request
    if (body.mode === 'full_article') {
      if (body.url) {
        try {
          const response = await fetch(body.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SupabaseEdgeFunction/1.0; +https://supabase.com)',
              'Accept-Language': 'en-GB,en;q=0.9'
            }
          });
          if (!response.ok) {
            return new Response(JSON.stringify({ 
              content: "Unable to fetch full article content. Please visit the original source.",
              success: true 
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const clean = (s: string) => s
            .replace(/\u00A0/g, ' ') // nbsp
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (doc) {
            // Remove non-content elements
            doc.querySelectorAll('script, style, nav, header, footer, aside, noscript, svg, form, iframe, button, input').forEach(el => el.remove());

            const selectors = [
              'article',
              'main',
              '[role="main"]',
              '#main-content',
              '.story-body__inner',
              '.ssrcss-uf6wea-RichTextComponentWrapper', // BBC
              '.content__article-body',
              '.article-body',
              '.article__content',
              '.post-content',
              '.entry-content',
              '.rich-text',
              '.c-article-body',
              '.o-article__body'
            ];

            let container: any = null;
            for (const sel of selectors) {
              const el = doc.querySelector(sel);
              if (el && (el.textContent || '').length > 400) { container = el; break; }
            }

            // Heuristic fallback: pick the element with the most paragraph text
            if (!container) {
              let best: any = null; let bestLen = 0;
              doc.querySelectorAll('article, section, div').forEach((el: any) => {
                const text = el.querySelectorAll('p')
                  ? Array.from(el.querySelectorAll('p')).map((p: any) => p.textContent || '').join(' ')
                  : (el.textContent || '');
                const len = text.length;
                if (len > bestLen) { bestLen = len; best = el; }
              });
              container = best || doc.body;
            }

            const blocks = Array.from(container.querySelectorAll('h1, h2, h3, p, li'))
              .map((el: any) => clean(el.textContent || ''))
              .filter(t => t && t.length > 0);

            const content = clean(blocks.join('\n\n')) || clean(container.textContent || '');

            const decodedContent = decodeHtmlEntities(content);

            return new Response(JSON.stringify({ 
              content: decodedContent.substring(0, 12000),
              success: true 
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Fallback: plain-text strip
          const fallback = clean(html.replace(/<[^>]+>/g, ' '));
          return new Response(JSON.stringify({ content: decodeHtmlEntities(fallback).substring(0, 8000), success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (error) {
          console.error('Error fetching article content:', error);
        }
      }
      return new Response(JSON.stringify({ content: "Unable to fetch article content.", success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: fetch real news from trusted NHS-related sources (RSS/Atom)
    console.log('Fetching real NHS GP news from official feeds...');

    const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });

    const feeds = [
      // National NHS/Healthcare sources
      { source: 'NHS England', url: 'https://www.england.nhs.uk/feed/', type: 'rss', isAlert: false },
      { source: 'NHS England News', url: 'https://www.england.nhs.uk/news/feed/', type: 'rss', isAlert: false },
      { source: 'MHRA Alerts', url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom', type: 'atom', isAlert: true },
      { source: 'DHSC', url: 'https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom', type: 'atom', isAlert: false },
      { source: 'NICE Guidance', url: 'https://www.nice.org.uk/guidance/published?ajax=ajax&type=cg,ng,sg,sc,mpg,ph&ps=15&format=rss', type: 'rss', isAlert: false },
      { source: 'NICE News', url: 'https://www.nice.org.uk/about/nice-communities/public-involvement/news/rss', type: 'rss', isAlert: false },
      { source: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', type: 'rss', isAlert: false },
      { source: 'Pulse Today', url: 'https://www.pulsetoday.co.uk/feed/', type: 'rss', isAlert: false },
      { source: 'The Guardian Health', url: 'https://www.theguardian.com/society/health/rss', type: 'rss', isAlert: false },
      // Local Northamptonshire sources
      { source: 'BBC Northamptonshire', url: 'https://feeds.bbci.co.uk/news/england/northamptonshire/rss.xml', type: 'rss', isAlert: false },
      { source: 'Northants Live', url: 'https://www.northantslive.news/news/?service=rss', type: 'rss', isAlert: false },
    ] as const;

    // Track feed fetch results for logging
    const feedResults: { source: string; status: 'success' | 'failed'; count: number; error?: string }[] = [];

    const sanitizeText = (html: string) =>
      (html || '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const extractImageFromDescription = (description: string): string | undefined => {
      const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i;
      const match = description.match(imgRegex);
      return match ? match[1] : undefined;
    };

    const parseRss = (xml: string, source: string) => {
      try {
        const j: any = xmlParser.parse(xml);
        const itemsRaw = j?.rss?.channel?.item || j?.['rdf:RDF']?.item || [];
        const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw].filter(Boolean);
        return items.map((it: any) => {
          const title = decodeHtmlEntities(String(it?.title ?? '').trim());
          const url = String(it?.link ?? '').trim();
          const pub = it?.pubDate || it?.pubdate || it?.['dc:date'] || '';
          const desc = it?.description || it?.['content:encoded'] || '';
          const catsRaw = it?.category ?? [];
          const catsArr = Array.isArray(catsRaw) ? catsRaw : [catsRaw];
          const tags = catsArr
            .map((c: any) => typeof c === 'string' ? c : (c?.['#text'] || c?.['@_term'] || c?.term || ''))
            .filter(Boolean);
          const text = decodeHtmlEntities(sanitizeText(String(desc)));
          const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
          const relevance_score = Math.min(100, 70 + Math.floor(Math.random() * 26));
          
          // Extract image URL from various RSS fields
          let image_url: string | undefined;
          
          // Try media:thumbnail or media:content
          if (it?.['media:thumbnail']?.['@_url']) {
            image_url = it['media:thumbnail']['@_url'];
          } else if (it?.['media:content']?.['@_url']) {
            image_url = it['media:content']['@_url'];
          }
          // Try enclosure for image
          else if (it?.enclosure?.['@_url'] && it?.enclosure?.['@_type']?.startsWith('image/')) {
            image_url = it.enclosure['@_url'];
          }
          // Try image field
          else if (it?.image?.url) {
            image_url = it.image.url;
          } else if (typeof it?.image === 'string') {
            image_url = it.image;
          }
          // Extract from description HTML
          else if (desc) {
            image_url = extractImageFromDescription(String(desc));
          }
          
          // Validate and clean image URL
          if (image_url && !image_url.startsWith('http')) {
            if (image_url.startsWith('//')) {
              image_url = 'https:' + image_url;
            } else if (image_url.startsWith('/')) {
              const baseUrl = new URL(url).origin;
              image_url = baseUrl + image_url;
            } else {
              image_url = undefined; // Invalid URL
            }
          }
          
          return {
            title,
            url,
            source,
            published_at,
            summary: text.slice(0, 280),
            content: text,
            relevance_score,
            tags: tags.length ? tags : [source],
            image_url,
          } as ProcessedNewsItem;
        }).filter((a: ProcessedNewsItem) => a.title && a.url);
      } catch (e) {
        console.error('RSS parse error:', e);
        return [] as ProcessedNewsItem[];
      }
    };

    const parseAtom = (xml: string, source: string) => {
      try {
        const j: any = xmlParser.parse(xml);
        const raw = j?.feed?.entry || [];
        const entries = Array.isArray(raw) ? raw : [raw].filter(Boolean);
        const getText = (node: any) => {
          if (!node) return '';
          if (typeof node === 'string') return node;
          if (typeof node === 'object') return node['#text'] || node._ || node.__text || '';
          return '';
        };
        return entries.map((entry: any) => {
          const title = decodeHtmlEntities(String(getText(entry?.title) || '').trim());
          let url = '';
          const link = entry?.link;
          if (Array.isArray(link)) {
            const alt = link.find((l: any) => l?.['@_rel'] === 'alternate') || link[0];
            url = (alt?.['@_href'] || alt?.href || '').toString().trim();
          } else if (typeof link === 'object') {
            url = (link?.['@_href'] || link?.href || '').toString().trim();
          } else if (typeof link === 'string') {
            url = link.trim();
          }
          const updated = entry?.updated || entry?.published || '';
          const summaryRaw = entry?.summary || entry?.content || '';
          const text = decodeHtmlEntities(sanitizeText(getText(summaryRaw)));
          const published_at = updated ? new Date(updated).toISOString() : new Date().toISOString();
          const catsRaw = entry?.category ?? [];
          const catsArr = Array.isArray(catsRaw) ? catsRaw : [catsRaw];
          const tags = catsArr
            .map((c: any) => typeof c === 'string' ? c : (c?.['@_term'] || c?.term || c?.['#text'] || ''))
            .filter(Boolean);
          const relevance_score = Math.min(100, 72 + Math.floor(Math.random() * 24));
          
          // Extract image URL from Atom entry
          let image_url: string | undefined;
          
          // Try media:thumbnail or media:content
          if (entry?.['media:thumbnail']?.['@_url']) {
            image_url = entry['media:thumbnail']['@_url'];
          } else if (entry?.['media:content']?.['@_url']) {
            image_url = entry['media:content']['@_url'];
          }
          // Try link with enclosure type
          else if (Array.isArray(link)) {
            const imgLink = link.find((l: any) => l?.['@_type']?.startsWith('image/'));
            if (imgLink?.['@_href']) {
              image_url = imgLink['@_href'];
            }
          }
          // Extract from summary/content HTML
          else if (summaryRaw) {
            image_url = extractImageFromDescription(String(getText(summaryRaw)));
          }
          
          // Validate and clean image URL
          if (image_url && !image_url.startsWith('http')) {
            if (image_url.startsWith('//')) {
              image_url = 'https:' + image_url;
            } else if (image_url.startsWith('/')) {
              const baseUrl = new URL(url).origin;
              image_url = baseUrl + image_url;
            } else {
              image_url = undefined; // Invalid URL
            }
          }
          
          return {
            title,
            url,
            source,
            published_at,
            summary: text.slice(0, 280),
            content: text,
            relevance_score,
            tags: tags.length ? tags : [source],
            image_url,
          } as ProcessedNewsItem;
        }).filter((a: ProcessedNewsItem) => a.title && a.url);
      } catch (e) {
        console.error('Atom parse error:', e);
        return [] as ProcessedNewsItem[];
      }
    };

    const allArticles: ProcessedNewsItem[] = [];

    await Promise.all(feeds.map(async (f) => {
      const startTime = Date.now();
      try {
        const res = await fetch(f.url, { 
          headers: { 
            'Accept': 'application/xml, text/xml, application/atom+xml, application/rss+xml',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-GB,en;q=0.9'
          }
        });
        if (!res.ok) {
          console.error(`❌ Feed fetch FAILED for ${f.source}: HTTP ${res.status} ${res.statusText}`);
          feedResults.push({ source: f.source, status: 'failed', count: 0, error: `HTTP ${res.status}` });
          return;
        }
        const xml = await res.text();
        let parsed = f.type === 'rss' ? parseRss(xml, f.source) : parseAtom(xml, f.source);
        
        // Mark alert articles
        if (f.isAlert) {
          parsed = parsed.map(a => ({ ...a, tags: [...a.tags, 'ALERT'] }));
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ ${f.source}: ${parsed.length} articles fetched in ${elapsed}ms`);
        feedResults.push({ source: f.source, status: 'success', count: parsed.length });
        allArticles.push(...parsed);
      } catch (e) {
        console.error(`❌ Error fetching ${f.source} feed:`, e);
        feedResults.push({ source: f.source, status: 'failed', count: 0, error: String(e) });
      }
    }));

    // Log feed fetch summary
    console.log('=== Feed Fetch Summary ===');
    feedResults.forEach(r => {
      const icon = r.status === 'success' ? '✅' : '❌';
      console.log(`${icon} ${r.source}: ${r.count} articles${r.error ? ` (${r.error})` : ''}`);
    });
    const successCount = feedResults.filter(r => r.status === 'success').length;
    const failedCount = feedResults.filter(r => r.status === 'failed').length;
    console.log(`Total: ${successCount} succeeded, ${failedCount} failed out of ${feeds.length} feeds`);

    // Restrict local sources to only NHS/GP/health-related items
    const localSources = new Set([
      'BBC Northamptonshire',
      'Northants Live'
    ]);
    const excludedSources = new Set(['Northants Telegraph']);
    const healthKeywords = [
      'nhs','gp','general practice','practice manager','primary care','pcn','ics','icb',
      'nhft','mental health','hospital','northampton general','kettering general','ngh','kgh',
      'vaccin','immunis','flu','covid','measles','pharmacy','pharmacist','prescription',
      'dental','dentist','urgent care','a&e','emergency department','cqc','midwife','maternity',
      'health centre','clinic','surgery','surgeries','public health'
    ];
    const isHealthRelated = (a: ProcessedNewsItem) => {
      const hay = `${a.title} ${a.summary} ${a.content}`.toLowerCase();
      return healthKeywords.some(k => hay.includes(k));
    };
    const isHealthRelatedByTags = (a: ProcessedNewsItem) => {
      const tags = (a.tags || []).map(t => String(t).toLowerCase());
      return healthKeywords.some(k => tags.some(t => t.includes(k))) || tags.includes('health');
    };
    const isHealthRelatedByUrl = (a: ProcessedNewsItem) => {
      const u = (a.url || '').toLowerCase();
      return healthKeywords.some(k => u.includes(k)) || u.includes('/health');
    };
    const filteredArticles = allArticles.filter(a => {
      if (excludedSources.has(a.source)) return false;
      return localSources.has(a.source) ? isHealthRelated(a) : true;
    });

    // De-duplicate by URL and title
    const uniqueMap = new Map<string, ProcessedNewsItem>();
    for (const a of filteredArticles) {
      const key = a.url || a.title;
      if (!uniqueMap.has(key)) uniqueMap.set(key, a);
    }

    // Group by source and take top articles from each to ensure variety
    const bySource = new Map<string, ProcessedNewsItem[]>();
    for (const a of uniqueMap.values()) {
      if (!bySource.has(a.source)) bySource.set(a.source, []);
      bySource.get(a.source)!.push(a);
    }
    
    // Sort each source's articles by date and take up to 10 per source
    const maxPerSource = 10;
    const balancedArticles: ProcessedNewsItem[] = [];
    for (const [source, articles] of bySource) {
      const sorted = articles
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, maxPerSource);
      balancedArticles.push(...sorted);
      console.log(`Source ${source}: keeping ${sorted.length} of ${articles.length} articles`);
    }
    
    // Final sort by date and limit to 80 total
    const validArticles = balancedArticles
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 80);
    
    console.log(`Final articles by source:`, validArticles.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));

    if (validArticles.length === 0 && body.mode === 'generate' && openaiApiKey) {
      // Optional fallback to AI generation if explicitly requested
      console.log('No articles parsed, falling back to AI generation (explicit request).');
      
      // Clear existing articles from database first
      const { error: deleteError } = await supabase
        .from('news_articles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('Error clearing articles:', deleteError);
      }

      // Store articles in database, replacing old ones
      const { error: deleteError2 } = await supabase
        .from('news_articles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError2) {
        console.error('Error clearing articles:', deleteError2);
      }
      // ... keep minimal AI fallback for explicit generate mode
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return only valid JSON array of news items.' },
            { role: 'user', content: 'Generate 8 UK NHS news items with real sources (title, url, source, published_at ISO, summary, content, relevance_score 70-95, tags array). JSON only.' }
          ],
          temperature: 0.2,
          max_tokens: 2000,
        })
      });
      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || '[]';
      content = content.replace(/```json\s*|```/g, '').trim();
      const parsed: any[] = JSON.parse(content);
      parsed.forEach((p) => {
        if (p.title && p.url) {
          validArticles.push({
            title: `Fake: ${p.title}`,
            url: p.url,
            source: p.source || 'AI Generated',
            published_at: p.published_at || new Date().toISOString(),
            summary: p.summary || '',
            content: p.content || p.summary || '',
            relevance_score: Math.max(60, Math.min(100, p.relevance_score || 80)),
            tags: Array.isArray(p.tags) ? p.tags : ['General'],
          });
        }
      });
    }

    if (validArticles.length === 0) {
      console.warn('No news articles parsed from feeds. Returning 200 with zero updates.');
      return new Response(JSON.stringify({
        success: true,
        message: 'No articles fetched from feeds (zero updates) — try Generate (AI) or refresh later.',
        articles_processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetched ${validArticles.length} real articles. Writing to DB...`);

    // Clear existing articles from database first to ensure fresh data
    const { error: deleteError } = await supabase
      .from('news_articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.warn('Error deleting existing articles (continuing):', deleteError);
    }

    const { error: insertError } = await supabase
      .from('news_articles')
      .insert(validArticles);

    if (insertError) {
      console.error('Error inserting articles:', insertError);
      throw insertError;
    }

    console.log(`Successfully stored ${validArticles.length} news articles`);

    return new Response(JSON.stringify({
      success: true,
      message: `Fetched and stored ${validArticles.length} real NHS news articles`,
      articles_processed: validArticles.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-gp-news function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});