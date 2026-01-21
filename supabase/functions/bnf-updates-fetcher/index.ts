import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface BNFFetchRequest {
  query: string;
  verificationLevel?: string;
  maxResults?: number;
}

// BNF sources to fetch
const BNF_SOURCES = [
  'https://bnf.nice.org.uk/',
  'https://bnf.nice.org.uk/news/',
  'https://bnf.nice.org.uk/interaction/'
];

async function fetchBNFContent(url: string): Promise<string> {
  try {
    console.log('Fetching BNF content from:', url);
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
    console.log(`Fetched ${html.length} characters from BNF`);
    return html;
  } catch (error) {
    console.error('Error fetching BNF content:', error);
    return '';
  }
}

async function processBNFData(html: string, query: string): Promise<any> {
  if (!html || !openaiApiKey) {
    return {
      content: 'Unable to fetch BNF data',
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
            content: `You are an NHS UK BNF specialist. Parse the provided BNF website HTML and extract relevant drug information.

CRITICAL RULES:
1. Extract ONLY official BNF drug information
2. Include dosing, contraindications, interactions, side effects
3. Extract update dates if available  
4. Focus on primary care prescribing
5. Preserve official BNF drug names and classifications

OUTPUT FORMAT:
{
  "content": "Extracted BNF drug information with dosing and safety data",
  "drugNames": ["aspirin", "paracetamol"],
  "lastUpdated": "YYYY-MM-DD or null",
  "sourceUrl": "Direct BNF drug URL if found",
  "safetyAlerts": ["any safety warnings found"],
  "confidence": 0.0-1.0
}

Query context: ${query}`
          },
          {
            role: 'user',
            content: `BNF website HTML content (first 8000 characters):\n${html.substring(0, 8000)}`
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
    console.error('Error processing BNF data:', error);
    return {
      content: 'Error processing BNF data',
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
    const { query, verificationLevel = 'standard', maxResults = 2 }: BNFFetchRequest = await req.json();
    
    console.log('BNF fetcher processing:', query, 'verification:', verificationLevel);

    const results = [];
    const sourceUrls = verificationLevel === 'maximum' ? BNF_SOURCES : BNF_SOURCES.slice(0, 2);

    for (const url of sourceUrls.slice(0, maxResults)) {
      const html = await fetchBNFContent(url);
      const processed = await processBNFData(html, query);
      
      if (processed.content && processed.content !== 'Unable to fetch BNF data') {
        results.push({
          source: 'BNF (British National Formulary)',
          url: processed.sourceUrl || url,
          content: processed.content,
          lastUpdated: processed.lastUpdated,
          confidence: processed.confidence || 0.8,
          drugNames: processed.drugNames || [],
          safetyAlerts: processed.safetyAlerts || [],
          sourceType: 'bnf'
        });
      }
    }

    console.log(`BNF fetcher found ${results.length} results`);

    return new Response(JSON.stringify({ 
      results,
      source: 'bnf',
      query,
      fetchedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('BNF fetcher error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      source: 'bnf'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});