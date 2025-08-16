import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  model: string;
  systemPrompt: string;
  enableWebSearch?: boolean;
  searchDepth?: 'basic' | 'advanced';
  files?: any[];
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score: number;
  source: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Search result caching
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function performUnifiedWebSearch(query: string, depth: string = 'advanced'): Promise<SearchResult[]> {
  console.log(`🔍 Performing unified web search for: "${query}" with depth: ${depth}`);
  
  // Check cache first
  const cacheKey = `${query}-${depth}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('📄 Returning cached search results');
    return cached.results;
  }

  const allResults: SearchResult[] = [];
  
  // Parallel search across multiple APIs
  const searchPromises = [];

  // 1. Tavily Search (Primary - most reliable)
  const tavilyKey = Deno.env.get('TAVILY_API_KEY');
  if (tavilyKey) {
    searchPromises.push(searchWithTavily(query, tavilyKey, depth));
  }

  // 2. Perplexity Search (Secondary - real-time web access)
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (perplexityKey) {
    searchPromises.push(searchWithPerplexity(query, perplexityKey));
  }

  try {
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Combine and deduplicate results
    for (const result of searchResults) {
      if (result.status === 'fulfilled' && result.value) {
        allResults.push(...result.value);
      }
    }

    // Smart filtering and ranking for GP/healthcare relevance
    const filteredResults = rankAndFilterResults(allResults, query);
    
    // Cache the results
    searchCache.set(cacheKey, { results: filteredResults, timestamp: Date.now() });
    
    console.log(`✅ Found ${filteredResults.length} relevant search results`);
    return filteredResults;
    
  } catch (error) {
    console.error('❌ Search error:', error);
    return [];
  }
}

async function searchWithTavily(query: string, apiKey: string, depth: string): Promise<SearchResult[]> {
  try {
    console.log('🔎 Searching with Tavily...');
    
    // Optimize query for healthcare/GP relevance
    const optimizedQuery = optimizeQueryForHealthcare(query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: optimizedQuery,
        search_depth: depth,
        include_answer: false,
        include_domains: [
          'nhs.uk', 'gov.uk', 'nice.org.uk', 'rcgp.org.uk', 
          'bma.org.uk', 'england.nhs.uk', 'healthwatch.co.uk',
          'cqc.org.uk', 'bbc.co.uk/news', 'theguardian.com',
          'telegraph.co.uk', 'independent.co.uk'
        ],
        exclude_domains: ['youtube.com', 'facebook.com', 'twitter.com'],
        max_results: 10
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    if (data.results) {
      for (const item of data.results) {
        results.push({
          title: item.title || 'No title',
          url: item.url || '',
          content: item.content || '',
          published_date: item.published_date,
          score: item.score || 0.5,
          source: 'Tavily'
        });
      }
    }

    console.log(`📊 Tavily returned ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('❌ Tavily search failed:', error);
    return [];
  }
}

async function searchWithPerplexity(query: string, apiKey: string): Promise<SearchResult[]> {
  try {
    console.log('🔍 Searching with Perplexity...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Find current, reliable information from authoritative sources. Focus on UK healthcare, NHS, and GP practice related content.'
          },
          {
            role: 'user',
            content: `Search for current information about: ${query}. Provide reliable sources with dates and brief summaries.`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month'
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse Perplexity response to extract structured results
    const results = parsePerplexityResponse(content);
    
    console.log(`📊 Perplexity returned ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('❌ Perplexity search failed:', error);
    return [];
  }
}

function optimizeQueryForHealthcare(query: string): string {
  // Add healthcare context keywords to improve relevance
  const healthcareKeywords = ['NHS', 'GP', 'primary care', 'healthcare UK'];
  const lowerQuery = query.toLowerCase();
  
  // If query doesn't contain healthcare terms, add context
  const hasHealthcareContext = healthcareKeywords.some(keyword => 
    lowerQuery.includes(keyword.toLowerCase())
  );
  
  if (!hasHealthcareContext) {
    return `${query} NHS UK healthcare`;
  }
  
  return query;
}

function parsePerplexityResponse(content: string): SearchResult[] {
  // Basic parsing of Perplexity response to extract sources and information
  const results: SearchResult[] = [];
  
  // Simple regex to find URLs and associated text
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = content.match(urlRegex) || [];
  
  // Extract title and summary for each URL found
  urls.forEach((url, index) => {
    const urlIndex = content.indexOf(url);
    const beforeUrl = content.substring(Math.max(0, urlIndex - 200), urlIndex);
    const afterUrl = content.substring(urlIndex + url.length, urlIndex + url.length + 200);
    
    results.push({
      title: extractTitleFromContext(beforeUrl, afterUrl),
      url: url,
      content: (beforeUrl + afterUrl).trim(),
      score: 0.7,
      source: 'Perplexity'
    });
  });
  
  return results.slice(0, 5); // Limit to 5 results from Perplexity
}

function extractTitleFromContext(before: string, after: string): string {
  // Try to extract a meaningful title from surrounding context
  const text = (before + after).replace(/[^\w\s]/g, ' ').trim();
  const words = text.split(/\s+/).filter(word => word.length > 2);
  return words.slice(0, 6).join(' ') || 'Search Result';
}

function rankAndFilterResults(results: SearchResult[], query: string): SearchResult[] {
  // Remove duplicates by URL
  const uniqueResults = new Map<string, SearchResult>();
  
  for (const result of results) {
    const normalizedUrl = result.url.replace(/\/$/, ''); // Remove trailing slash
    if (!uniqueResults.has(normalizedUrl)) {
      uniqueResults.set(normalizedUrl, result);
    }
  }
  
  // Convert back to array and apply GP/healthcare relevance scoring
  const scoredResults = Array.from(uniqueResults.values())
    .map(result => ({
      ...result,
      score: calculateRelevanceScore(result, query)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Keep top 8 results
    
  return scoredResults;
}

function calculateRelevanceScore(result: SearchResult, query: string): number {
  let score = result.score || 0.5;
  
  // Boost score for authoritative healthcare sources
  const authoritativeDomains = [
    'nhs.uk', 'gov.uk', 'nice.org.uk', 'rcgp.org.uk', 
    'bma.org.uk', 'england.nhs.uk', 'cqc.org.uk'
  ];
  
  if (authoritativeDomains.some(domain => result.url.includes(domain))) {
    score += 0.3;
  }
  
  // Boost score for recent dates
  if (result.published_date) {
    const publishDate = new Date(result.published_date);
    const daysSincePublished = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSincePublished < 30) score += 0.2;
    else if (daysSincePublished < 90) score += 0.1;
  }
  
  // Boost score for query term matches in title
  const queryTerms = query.toLowerCase().split(' ');
  const titleLower = result.title.toLowerCase();
  const matchingTerms = queryTerms.filter(term => titleLower.includes(term)).length;
  score += (matchingTerms / queryTerms.length) * 0.2;
  
  return Math.min(score, 1.0);
}

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No current search results found.';
  }
  
  let formatted = '\n🌐 **CURRENT WEB SEARCH RESULTS** (Latest information from authoritative sources):\n\n';
  
  results.forEach((result, index) => {
    const publishDate = result.published_date ? 
      ` (${new Date(result.published_date).toLocaleDateString('en-GB')})` : '';
    
    formatted += `${index + 1}. **[${result.title}](${result.url})**${publishDate}\n`;
    formatted += `   ${result.content.substring(0, 150)}...\n`;
    formatted += `   Source: ${getDomainFromUrl(result.url)} | Relevance: ${(result.score * 100).toFixed(0)}%\n\n`;
  });
  
  return formatted;
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function detectWebSearchNeeded(query: string): boolean {
  const searchTriggers = [
    'latest', 'recent', 'current', 'new', 'today', 'this week', 'this month',
    'announce', 'update', 'change', 'news', 'what are', 'what is happening',
    'status', 'when', 'how much', 'price', 'cost', '2024', '2025'
  ];
  
  const lowerQuery = query.toLowerCase();
  return searchTriggers.some(trigger => lowerQuery.includes(trigger));
}

async function callAI(messages: Message[], systemPrompt: string, model: string): Promise<string> {
  console.log(`🤖 Calling ${model} with ${messages.length} messages`);
  
  // Prepare messages for the AI
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // Route to appropriate AI service based on model
  if (model.includes('gemini')) {
    return await callGemini(apiMessages, model);
  } else if (model.includes('gpt') || model.includes('o3') || model.includes('o4')) {
    return await callOpenAI(apiMessages, model);
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
}

async function callOpenAI(messages: any[], model: string): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log(`🔗 Calling OpenAI API with model: ${model}...`);

  // Map model names to actual OpenAI model names
  const modelMapping: { [key: string]: string } = {
    'gpt-5': 'gpt-5-2025-08-07',
    'gpt-5-mini': 'gpt-5-mini-2025-08-07',
    'gpt-5-nano': 'gpt-5-nano-2025-08-07',
    'gpt-4.1': 'gpt-4.1-2025-04-14',
    'gpt-4.1-mini': 'gpt-4.1-mini-2025-04-14',
    'o3': 'o3-2025-04-16',
    'o4-mini': 'o4-mini-2025-04-16'
  };

  const actualModel = modelMapping[model] || model;

  const requestBody: any = {
    model: actualModel,
    messages: messages
  };

  // Use correct parameters based on model
  if (model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4')) {
    requestBody.max_completion_tokens = 4000;
    // Don't include temperature for newer models
  } else {
    requestBody.max_tokens = 4000;
    requestBody.temperature = 0.7;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(messages: any[], model: string): Promise<string> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  console.log(`🔗 Calling Gemini API with model: ${model}...`);

  // Convert messages to Gemini format
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessages = messages.filter((m: any) => m.role !== 'system');
  
  const prompt = userMessages.map((m: any) => 
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n\n');

  const fullPrompt = systemMessage ? `${systemMessage.content}\n\n${prompt}` : prompt;

  const modelPath = model.includes('gemini-') ? model : `gemini-${model}`;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Gemini API error:`, error);
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
    console.error('❌ Unexpected Gemini response structure:', JSON.stringify(data));
    throw new Error('Invalid response structure from Gemini API');
  }
  
  return data.candidates[0].content.parts[0].text || 'No response generated';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const requestBody: RequestBody = await req.json();
    const { messages, model, systemPrompt, enableWebSearch, searchDepth = 'advanced', files } = requestBody;

    console.log(`🚀 Processing enhanced AI4GP request with model: ${model}`);
    console.log(`📊 Messages: ${messages.length}, Web search: ${enableWebSearch || 'auto'}, Depth: ${searchDepth}`);

    let enhancedSystemPrompt = systemPrompt;
    let shouldPerformWebSearch = enableWebSearch;

    // Auto-detect if web search is needed based on query content
    if (enableWebSearch !== false && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (!shouldPerformWebSearch && detectWebSearchNeeded(latestMessage.content)) {
        shouldPerformWebSearch = true;
        console.log('🎯 Auto-detected need for web search');
      }
    }

    // Perform web search if enabled or auto-detected
    if (shouldPerformWebSearch && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      console.log(`🔍 Performing web search for: "${latestMessage.content}"`);
      
      try {
        const searchResults = await performUnifiedWebSearch(latestMessage.content, searchDepth);
        
        if (searchResults.length > 0) {
          const formattedResults = formatSearchResults(searchResults);
          enhancedSystemPrompt += `\n\n${formattedResults}`;
          enhancedSystemPrompt += '\n\n⚠️ **IMPORTANT**: Base your response PRIMARILY on the current web search results above. Always cite sources with publication dates when available. If the search results are recent (within 120 days), prioritize them over any training data.';
          
          console.log(`✅ Enhanced prompt with ${searchResults.length} search results`);
        } else {
          enhancedSystemPrompt += '\n\n⚠️ **Note**: Web search was attempted but no current results were found. Relying on training data (which may be outdated).';
          console.log('⚠️ No search results found');
        }
      } catch (searchError) {
        console.error('❌ Web search failed:', searchError);
        enhancedSystemPrompt += '\n\n⚠️ **Note**: Web search failed. Relying on training data (which may be outdated).';
      }
    }

    // Generate AI response
    const response = await callAI(messages, enhancedSystemPrompt, model);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Response generated in ${responseTime}ms`);

    return new Response(JSON.stringify({
      response: response,
      success: true,
      responseTime: responseTime,
      searchPerformed: shouldPerformWebSearch || false,
      model: model
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in ai-4-gp-enhanced function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false,
      responseTime: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});