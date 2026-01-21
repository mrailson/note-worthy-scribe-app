import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface MHRAFetchRequest {
  query: string;
  verificationLevel?: string;
  maxResults?: number;
}

// MHRA sources for safety alerts
const MHRA_SOURCES = [
  'https://www.gov.uk/drug-safety-update',
  'https://www.gov.uk/drug-device-alerts',
  'https://www.gov.uk/government/collections/mhra-guidance'
];

async function fetchMHRAContent(url: string): Promise<string> {
  try {
    console.log('Fetching MHRA content from:', url);
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
    console.log(`Fetched ${html.length} characters from MHRA`);
    return html;
  } catch (error) {
    console.error('Error fetching MHRA content:', error);
    return '';
  }
}

async function processMHRAData(html: string, query: string): Promise<any> {
  if (!html || !openaiApiKey) {
    return {
      content: 'Unable to fetch MHRA safety alerts',
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
            content: `You are an NHS UK MHRA safety specialist. Parse the provided MHRA website HTML and extract relevant drug safety alerts.

CRITICAL RULES:
1. Extract ONLY official MHRA safety alerts and device alerts
2. Include alert dates, affected drugs/devices, key actions for GPs
3. Identify urgent vs routine safety notices
4. Focus on primary care prescribing implications
5. Preserve official MHRA alert terminology

OUTPUT FORMAT:
{
  "content": "Extracted MHRA safety alerts with key GP actions",
  "alertTypes": ["Drug Safety Update", "Medical Device Alert"],
  "affectedDrugs": ["drug names if relevant"],
  "urgencyLevel": "urgent|important|routine",
  "lastUpdated": "YYYY-MM-DD or null",
  "sourceUrl": "Direct MHRA alert URL if found",
  "confidence": 0.0-1.0
}

Query context: ${query}`
          },
          {
            role: 'user',
            content: `MHRA website HTML content (first 8000 characters):\n${html.substring(0, 8000)}`
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
    console.error('Error processing MHRA data:', error);
    return {
      content: 'Error processing MHRA safety data',
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
    const { query, verificationLevel = 'standard', maxResults = 2 }: MHRAFetchRequest = await req.json();
    
    console.log('MHRA fetcher processing:', query, 'verification:', verificationLevel);

    const results = [];
    const sourceUrls = verificationLevel === 'maximum' ? MHRA_SOURCES : MHRA_SOURCES.slice(0, 2);

    for (const url of sourceUrls.slice(0, maxResults)) {
      const html = await fetchMHRAContent(url);
      const processed = await processMHRAData(html, query);
      
      if (processed.content && processed.content !== 'Unable to fetch MHRA safety alerts') {
        results.push({
          source: 'MHRA (Medicines and Healthcare products Regulatory Agency)',
          url: processed.sourceUrl || url,
          content: processed.content,
          lastUpdated: processed.lastUpdated,
          confidence: processed.confidence || 0.8,
          alertTypes: processed.alertTypes || [],
          affectedDrugs: processed.affectedDrugs || [],
          urgencyLevel: processed.urgencyLevel || 'routine',
          sourceType: 'mhra'
        });
      }
    }

    console.log(`MHRA fetcher found ${results.length} results`);

    return new Response(JSON.stringify({ 
      results,
      source: 'mhra',
      query,
      fetchedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('MHRA fetcher error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      source: 'mhra'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});