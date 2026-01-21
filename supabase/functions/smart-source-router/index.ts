import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface SourceRequest {
  query: string;
  maxSources?: number;
  verificationLevel?: 'standard' | 'latest' | 'maximum';
}

interface SourceResult {
  source: string;
  url: string;
  content: string;
  lastUpdated?: string;
  confidence: number;
  sourceType: 'nhs' | 'nice' | 'bnf' | 'mhra' | 'greenbook' | 'ukhsa';
}

interface RouterResponse {
  sources: SourceResult[];
  verificationPanel: {
    sourcesChecked: string[];
    lastVerified: string;
    confidenceScore: number;
    freshDataUsed: boolean;
  };
  recommendedSources: string[];
}

// Smart query classification using GPT
async function classifyQuery(query: string): Promise<string[]> {
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
            content: `You are a UK NHS query classifier. Analyze the query and return ONLY a JSON array of source types needed.

Available sources:
- "nhs": NHS England guidance, policies, vaccination programmes
- "nice": NICE guidelines, CGs, TAs, quality standards  
- "bnf": BNF drug information, dosing, interactions
- "mhra": MHRA drug safety alerts, device alerts
- "greenbook": UK immunisation guidance, vaccine schedules
- "ukhsa": UKHSA epidemiological data, outbreak guidance

Examples:
"COVID vaccination eligibility" -> ["nhs", "greenbook"]
"diabetes management guidelines" -> ["nice", "bnf"]
"drug safety alert paracetamol" -> ["mhra", "bnf"]
"flu vaccine schedule children" -> ["greenbook", "nhs"]

Return ONLY the JSON array, no other text.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      console.error('OpenAI classification failed:', response.status);
      return ['nhs', 'nice']; // Default fallback
    }

    const data = await response.json();
    const result = data.choices[0].message.content.trim();
    
    try {
      return JSON.parse(result);
    } catch {
      console.error('Failed to parse classification result:', result);
      return ['nhs', 'nice']; // Default fallback
    }
  } catch (error) {
    console.error('Query classification error:', error);
    return ['nhs', 'nice']; // Default fallback
  }
}

// Fetch from specific sources
async function fetchFromSources(sourceTypes: string[], query: string, verificationLevel: string): Promise<SourceResult[]> {
  const results: SourceResult[] = [];
  
  for (const sourceType of sourceTypes) {
    try {
      let functionName = '';
      switch (sourceType) {
        case 'nhs':
          functionName = 'nhs-guidance-fetcher';
          break;
        case 'nice':
          functionName = 'nice-guidance-fetcher';
          break;
        case 'bnf':
          functionName = 'bnf-updates-fetcher';
          break;
        case 'mhra':
          functionName = 'mhra-alerts-fetcher';
          break;
        case 'greenbook':
          functionName = 'green-book-fetcher';
          break;
        case 'ukhsa':
          functionName = 'ukhsa-updates-fetcher';
          break;
        default:
          continue;
      }

      // Call the specific source fetcher
      const response = await fetch(`https://dphcnbricafkbtizkoal.supabase.co/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ 
          query, 
          verificationLevel,
          maxResults: verificationLevel === 'maximum' ? 3 : 2
        })
      });

      if (response.ok) {
        const sourceData = await response.json();
        if (sourceData.results) {
          results.push(...sourceData.results.map((r: any) => ({
            ...r,
            sourceType: sourceType as any
          })));
        }
      } else {
        console.error(`Failed to fetch from ${sourceType}:`, response.status);
      }
    } catch (error) {
      console.error(`Error fetching from ${sourceType}:`, error);
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxSources = 5, verificationLevel = 'standard' }: SourceRequest = await req.json();

    console.log('Smart router processing query:', query, 'verification level:', verificationLevel);

    // Classify query to determine which sources to use
    const recommendedSources = await classifyQuery(query);
    console.log('Recommended sources:', recommendedSources);

    // Fetch from recommended sources
    const sourceResults = await fetchFromSources(recommendedSources, query, verificationLevel);
    
    // Calculate overall confidence score
    const confidenceScore = sourceResults.length > 0 
      ? sourceResults.reduce((sum, r) => sum + r.confidence, 0) / sourceResults.length 
      : 0;

    const response: RouterResponse = {
      sources: sourceResults.slice(0, maxSources),
      verificationPanel: {
        sourcesChecked: recommendedSources,
        lastVerified: new Date().toISOString(),
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        freshDataUsed: verificationLevel !== 'standard'
      },
      recommendedSources
    };

    console.log('Router response:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Smart router error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      sources: [],
      verificationPanel: {
        sourcesChecked: [],
        lastVerified: new Date().toISOString(),
        confidenceScore: 0,
        freshDataUsed: false
      },
      recommendedSources: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});