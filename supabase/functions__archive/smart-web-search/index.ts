import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 5 } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[smart-web-search] Searching for: "${query}"`);

    if (!TAVILY_API_KEY) {
      console.error('TAVILY_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Web search not configured',
          results: [],
          searchPerformed: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Tavily API for web search
    const searchResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'advanced',
        include_domains: [
          'nhs.uk',
          'nice.org.uk',
          'gov.uk',
          'bma.org.uk',
          'rcgp.org.uk',
          'gponline.com',
          'pulsetoday.co.uk',
          'bmj.com',
          'england.nhs.uk',
          'healthcareers.nhs.uk'
        ],
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Tavily API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Search failed',
          results: [],
          searchPerformed: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    console.log(`[smart-web-search] Found ${searchData.results?.length || 0} results`);

    // Format results for injection into LLM context
    const formattedResults = (searchData.results || []).map((result: any, index: number) => ({
      title: result.title,
      url: result.url,
      content: result.content?.substring(0, 500) || '',
      score: result.score
    }));

    // Create a summary context for the LLM
    const contextSummary = formattedResults.length > 0 
      ? `\n\n📰 REAL-TIME WEB SEARCH RESULTS (searched: "${query}"):\n\n` +
        formattedResults.map((r: any, i: number) => 
          `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.content}\n`
        ).join('\n') +
        `\n---\nPlease use these current sources to inform your response. Cite sources where appropriate.`
      : '';

    return new Response(
      JSON.stringify({
        searchPerformed: true,
        query: query,
        answer: searchData.answer || null,
        results: formattedResults,
        contextSummary: contextSummary,
        resultCount: formattedResults.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[smart-web-search] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        results: [],
        searchPerformed: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
