import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsSource {
  name: string;
  url: string;
  type: 'rss' | 'json' | 'html';
  priority: number; // Higher number = higher priority for canonical selection
}

interface RawNewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  description?: string;
  full_text?: string;
  image_url?: string;
}

interface ProcessedNewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary: string;
  content: string;
  relevance_score: number;
  tags: string[];
  why_it_matters: string;
  image_url?: string;
  category: string;
  northamptonshire_related: boolean;
}

const NEWS_SOURCES: NewsSource[] = [
  {
    name: "NHS England",
    url: "https://www.england.nhs.uk/news/feed/",
    type: "rss",
    priority: 10
  },
  {
    name: "Department of Health and Social Care",
    url: "https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom",
    type: "rss",
    priority: 9
  },
  {
    name: "UKHSA",
    url: "https://www.gov.uk/government/organisations/uk-health-security-agency.atom",
    type: "rss",
    priority: 8
  },
  {
    name: "NICE",
    url: "https://www.nice.org.uk/feeds/news",
    type: "rss",
    priority: 8
  }
];

// Utility function to parse RSS feeds
async function parseRSS(xmlContent: string, sourceName: string): Promise<RawNewsItem[]> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");
    
    if (!doc) return [];
    
    const items = doc.querySelectorAll("item, entry");
    const results: RawNewsItem[] = [];
    
    for (const item of items) {
      const title = item.querySelector("title")?.textContent?.trim();
      const link = item.querySelector("link")?.textContent?.trim() || 
                   item.querySelector("link")?.getAttribute("href")?.trim();
      const pubDate = item.querySelector("pubDate, published, updated")?.textContent?.trim();
      const description = item.querySelector("description, summary, content")?.textContent?.trim();
      
      if (title && link) {
        // Only include articles from the last 21 days
        const articleDate = new Date(pubDate || Date.now());
        const daysDiff = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 21) {
          results.push({
            title,
            url: link,
            source: sourceName,
            published_at: articleDate.toISOString(),
            description: description || "",
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error parsing RSS for ${sourceName}:`, error);
    return [];
  }
}

// Fetch article content from URL
async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NHS-GP-News-Bot/1.0)'
      }
    });
    
    if (!response.ok) return "";
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    if (!doc) return "";
    
    // Remove script and style elements
    const scripts = doc.querySelectorAll("script, style, nav, header, footer");
    scripts.forEach(el => el.remove());
    
    // Try to find main content area
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.content',
      '.article-content',
      '.post-content',
      '.entry-content',
      'article'
    ];
    
    let content = "";
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        content = element.textContent?.trim() || "";
        if (content.length > 100) break;
      }
    }
    
    // Fallback to body content if no main content found
    if (!content) {
      content = doc.querySelector("body")?.textContent?.trim() || "";
    }
    
    // Clean up whitespace
    return content.replace(/\s+/g, ' ').substring(0, 10000);
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error);
    return "";
  }
}

// Extract image from article
async function extractImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    if (!doc) return null;
    
    // Try og:image first
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const imageUrl = ogImage.getAttribute("content");
      if (imageUrl) return imageUrl;
    }
    
    // Fallback to first img in article
    const img = doc.querySelector('article img, main img, .content img');
    if (img) {
      const src = img.getAttribute("src");
      if (src) {
        return src.startsWith('http') ? src : new URL(src, url).href;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting image from ${url}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('No OpenAI API key found');
      return new Response(JSON.stringify({ 
        error: "OpenAI API key not configured. Please configure the OPENAI_API_KEY secret to enable real news fetching.",
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    
    // Handle full article request
    if (body.mode === 'full_article') {
      if (body.url) {
        const fullContent = await fetchArticleContent(body.url);
        return new Response(JSON.stringify({ 
          content: fullContent || "Unable to fetch full article content. Please visit the original source.",
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        content: "No article URL provided.",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting comprehensive NHS news fetch...');
    
    // Step A: Fetch from all sources
    const allItems: RawNewsItem[] = [];
    
    for (const source of NEWS_SOURCES) {
      try {
        console.log(`Fetching from ${source.name}...`);
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NHS-GP-News-Bot/1.0)'
          }
        });
        
        if (response.ok) {
          const content = await response.text();
          const items = await parseRSS(content, source.name);
          allItems.push(...items);
          console.log(`Fetched ${items.length} items from ${source.name}`);
        }
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
    }
    
    console.log(`Total raw items fetched: ${allItems.length}`);
    
    if (allItems.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No news articles could be fetched from any source",
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Step B: Extract full content for recent items (limit to 30 most recent)
    const recentItems = allItems
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 30);
    
    for (const item of recentItems) {
      item.full_text = await fetchArticleContent(item.url);
      item.image_url = await extractImage(item.url);
    }
    
    // Step C & D: De-duplicate and rank with OpenAI
    const rankingPrompt = `You are a UK NHS primary-care news curator for GP practices in Northamptonshire.

Score each item 0-100 for PRACTICAL relevance to GP practice operations, finance/contracting, vaccination/UKHSA alerts, NICE guidance, ICS/ICB updates, CQC/compliance, workforce, digital primary care.

Boost if: (a) source is NHS England/DHSC/NICE/UKHSA/ICB/LMC, (b) mentions Northamptonshire/East Midlands, (c) has direct operational impact in next 0-8 weeks.

Down-rank general politics unless it changes GP operations.

Also cluster any near-duplicates (same story, ≥0.85 semantic similarity) and choose the best canonical version preferring: NHS England/NICE/DHSC > UKHSA > others.

Return JSON with top 10 only, newest first, ties by relevance:
{
  "top10": [
    {
      "url": "...",
      "reason": "Brief explanation of relevance",
      "relevance": 0-100,
      "category": "NICE|UKHSA|ICB|CQC|Finance|Workforce|Digital|Access|Vaccinations|Other",
      "northamptonshire_related": true|false
    }
  ]
}`;

    const rankingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: rankingPrompt },
          { role: 'user', content: JSON.stringify(recentItems.map(item => ({
            title: item.title,
            url: item.url,
            source: item.source,
            published_at: item.published_at,
            snippet: item.description,
            fulltext_preview: item.full_text?.substring(0, 2000)
          }))) }
        ],
        temperature: 0.2,
        max_tokens: 2000
      }),
    });

    if (!rankingResponse.ok) {
      throw new Error(`OpenAI ranking failed: ${await rankingResponse.text()}`);
    }

    const rankingData = await rankingResponse.json();
    const rankingResult = JSON.parse(rankingData.choices[0].message.content);
    
    // Step E: Generate summaries for top articles
    const finalArticles: ProcessedNewsItem[] = [];
    
    for (const topItem of rankingResult.top10) {
      const originalItem = recentItems.find(item => item.url === topItem.url);
      if (!originalItem) continue;
      
      const summaryPrompt = `Format this article for GP practice managers:

TASK: Return JSON with:
{
  "summary": "40-70 word summary",
  "why_it_matters": "One sentence explaining relevance to GP practices",
  "tags": ["2-4 relevant tags from: NICE, Vaccinations, ICB, CQC, Workforce, Digital, Finance, Access, Urgent, Compliance"],
  "content": "Clean markdown of full article with H2 headline, source line, TL;DR bullets, key points, dates in bold, quotes as blockquotes"
}

Audience: GP partners/practice managers under NHS standards.
No invented facts; if content missing, state "Full text unavailable".`;

      const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: JSON.stringify({
              title: originalItem.title,
              source: originalItem.source,
              url: originalItem.url,
              published_at: originalItem.published_at,
              full_text: originalItem.full_text || originalItem.description
            }) }
          ],
          temperature: 0.2,
          max_tokens: 1500
        }),
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        const summary = JSON.parse(summaryData.choices[0].message.content);
        
        finalArticles.push({
          title: originalItem.title,
          url: originalItem.url,
          source: originalItem.source,
          published_at: originalItem.published_at,
          summary: summary.summary,
          content: summary.content,
          relevance_score: topItem.relevance,
          tags: summary.tags,
          why_it_matters: summary.why_it_matters,
          image_url: originalItem.image_url,
          category: topItem.category,
          northamptonshire_related: topItem.northamptonshire_related
        });
      }
    }
    
    // Store in database
    const { error: deleteError } = await supabase
      .from('news_articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting existing articles:', deleteError);
    }

    const { error: insertError } = await supabase
      .from('news_articles')
      .insert(finalArticles.map(article => ({
        title: article.title,
        summary: article.summary,
        content: article.content,
        url: article.url,
        source: article.source,
        published_at: article.published_at,
        relevance_score: article.relevance_score,
        tags: article.tags,
        image_url: article.image_url
      })));

    if (insertError) {
      console.error('Error inserting articles:', insertError);
      throw insertError;
    }

    console.log(`Successfully processed ${finalArticles.length} news articles`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully fetched and processed ${finalArticles.length} relevant NHS news articles`,
      articles_processed: finalArticles.length,
      sources_checked: NEWS_SOURCES.length
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