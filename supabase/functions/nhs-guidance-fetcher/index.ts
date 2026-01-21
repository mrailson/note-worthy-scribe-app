import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface NHSFetchRequest {
  query: string;
  verificationLevel?: string;
  maxResults?: number;
}

// NHS England key sources
const NHS_SOURCES = [
  'https://www.england.nhs.uk/publication/',
  'https://www.england.nhs.uk/long-read/',
  'https://www.nhs.uk/news/',
  'https://www.england.nhs.uk/coronavirus/'
];

async function fetchNHSContent(url: string): Promise<string> {
  try {
    console.log('Fetching NHS content from:', url);
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
    console.log(`Fetched ${html.length} characters from NHS`);
    return html;
  } catch (error) {
    console.error('Error fetching NHS content:', error);
    return '';
  }
}

async function processNHSData(html: string, query: string): Promise<any> {
  if (!html || !openaiApiKey) {
    return {
      content: 'Unable to fetch NHS guidance data',
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
        model: 'openai/gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are an NHS UK guidance specialist. Parse the provided NHS England website HTML and extract relevant guidance.

CRITICAL RULES:
1. Extract ONLY official NHS England guidance, policies, and long-reads
2. Include publication dates and effective dates
3. Extract key policy points and implementation guidance
4. Focus on primary care and GP practice implications
5. Preserve official NHS terminology and policy numbers

OUTPUT FORMAT:
{
  "content": "Extracted NHS guidance with policy details and dates",
  "publicationType": "Long-read|Policy|Guidance|News",
  "publicationDate": "YYYY-MM-DD or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "policyNumbers": ["policy reference numbers if found"],
  "sourceUrl": "Direct NHS guidance URL if found",
  "confidence": 0.0-1.0
}

Query context: ${query}`
          },
          {
            role: 'user',
            content: `NHS website HTML content (first 8000 characters):\n${html.substring(0, 8000)}`
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
    console.error('Error processing NHS data:', error);
    return {
      content: 'Error processing NHS guidance data',
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
    const { query, verificationLevel = 'standard', maxResults = 2 }: NHSFetchRequest = await req.json();
    
    console.log('NHS fetcher processing:', query, 'verification:', verificationLevel);

    const results = [];
    const sourceUrls = verificationLevel === 'maximum' ? NHS_SOURCES : NHS_SOURCES.slice(0, 2);

    for (const url of sourceUrls.slice(0, maxResults)) {
      const html = await fetchNHSContent(url);
      const processed = await processNHSData(html, query);
      
      if (processed.content && processed.content !== 'Unable to fetch NHS guidance data') {
        results.push({
          source: 'NHS England',
          url: processed.sourceUrl || url,
          content: processed.content,
          lastUpdated: processed.publicationDate || processed.effectiveDate,
          confidence: processed.confidence || 0.8,
          publicationType: processed.publicationType,
          policyNumbers: processed.policyNumbers || [],
          sourceType: 'nhs'
        });
      }
    }

    console.log(`NHS fetcher found ${results.length} results`);

    return new Response(JSON.stringify({ 
      results,
      source: 'nhs',
      query,
      fetchedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('NHS fetcher error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      source: 'nhs'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});