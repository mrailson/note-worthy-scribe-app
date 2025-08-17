import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface FetchRequest {
  query: string;
  verificationLevel?: string;
  maxResults?: number;
}

// NICE guidance URLs to fetch
const NICE_SOURCES = [
  'https://www.nice.org.uk/guidance',
  'https://www.nice.org.uk/guidance/published',
  'https://www.nice.org.uk/news'
];

async function fetchNiceContent(url: string): Promise<string> {
  try {
    console.log('Fetching NICE content from:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NHS AI Assistant/1.0 (Medical Information Service)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} characters from NICE`);
    return html;
  } catch (error) {
    console.error('Error fetching NICE content:', error);
    return '';
  }
}

async function processNiceData(html: string, query: string): Promise<any> {
  if (!html || !openaiApiKey) {
    return {
      content: 'Unable to fetch NICE guidance data',
      confidence: 0,
      lastUpdated: null
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an NHS UK NICE guidance specialist. Parse the provided NICE website HTML and extract relevant guidance information.

CRITICAL RULES:
1. Extract ONLY official NICE guidance content 
2. Quote guidance numbers (CG, NG, TA, QS) exactly
3. Extract last updated dates if available
4. Focus on primary care relevant sections
5. Preserve official NICE terminology

OUTPUT FORMAT:
{
  "content": "Extracted relevant NICE guidance content with exact quotes and guidance numbers",
  "guidanceNumbers": ["NG28", "CG181"],
  "lastUpdated": "YYYY-MM-DD or null",
  "sourceUrl": "Direct NICE guidance URL if found",
  "confidence": 0.0-1.0
}

Query context: ${query}`
          },
          {
            role: 'user',
            content: `NICE website HTML content (first 8000 characters):\n${html.substring(0, 8000)}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      }),
    });

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    try {
      return JSON.parse(result);
    } catch {
      return {
        content: result,
        confidence: 0.7,
        lastUpdated: null
      };
    }
  } catch (error) {
    console.error('Error processing NICE data:', error);
    return {
      content: 'Error processing NICE guidance data',
      confidence: 0,
      lastUpdated: null
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, verificationLevel = 'standard', maxResults = 2 }: FetchRequest = await req.json();
    
    console.log('NICE fetcher processing:', query, 'verification:', verificationLevel);

    const results = [];
    const sourceUrls = verificationLevel === 'maximum' ? NICE_SOURCES : NICE_SOURCES.slice(0, 2);

    for (const url of sourceUrls.slice(0, maxResults)) {
      const html = await fetchNiceContent(url);
      const processed = await processNiceData(html, query);
      
      if (processed.content && processed.content !== 'Unable to fetch NICE guidance data') {
        results.push({
          source: 'NICE Guidance',
          url: processed.sourceUrl || url,
          content: processed.content,
          lastUpdated: processed.lastUpdated,
          confidence: processed.confidence || 0.8,
          guidanceNumbers: processed.guidanceNumbers || [],
          sourceType: 'nice'
        });
      }
    }

    console.log(`NICE fetcher found ${results.length} results`);

    return new Response(JSON.stringify({ 
      results,
      source: 'nice',
      query,
      fetchedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('NICE fetcher error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      source: 'nice'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});