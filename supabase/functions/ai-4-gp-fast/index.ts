import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  model: string;
  systemPrompt: string;
  enableWebSearch?: boolean;
}

async function performQuickWebSearch(query: string): Promise<string> {
  try {
    console.log(`🔍 Quick web search for: "${query}"`);
    
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    if (!tavilyKey) {
      console.log('⚠️ Tavily API key not configured');
      return '';
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: 'basic',
        include_answer: false,
        include_domains: ['nhs.uk', 'gov.uk', 'nice.org.uk', 'bbc.co.uk/news'],
        max_results: 3
      }),
    });

    if (!response.ok) {
      console.log(`⚠️ Tavily search failed: ${response.status}`);
      return '';
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return '';
    }

    let searchContext = '\n🌐 **QUICK SEARCH RESULTS**:\n';
    data.results.slice(0, 3).forEach((result: any, index: number) => {
      searchContext += `${index + 1}. [${result.title}](${result.url})\n`;
      searchContext += `   ${result.content.substring(0, 100)}...\n\n`;
    });

    console.log(`✅ Quick search returned ${data.results.length} results`);
    return searchContext;
    
  } catch (error) {
    console.error('❌ Quick search error:', error);
    return '';
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

  console.log(`Calling OpenAI API with model: ${model}...`);

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
    console.error('OpenAI API error:', error);
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

  console.log(`Calling Gemini API with model: ${model}...`);

  // Convert messages to Gemini format
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');
  
  const prompt = userMessages.map(m => 
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
    console.error(`Gemini API error:`, error);
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
    console.error('Unexpected Gemini response structure:', JSON.stringify(data));
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
    const requestBody: RequestBody = await req.json();
    const { messages, model, systemPrompt, enableWebSearch } = requestBody;

    console.log(`🚀 Processing fast AI4GP request with model: ${model}`);
    console.log(`📊 Messages: ${messages.length}, Web search: ${enableWebSearch || 'auto'}`);

    let enhancedSystemPrompt = systemPrompt;
    let shouldPerformWebSearch = enableWebSearch;

    // Auto-detect if web search is needed for fast mode
    if (enableWebSearch !== false && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (!shouldPerformWebSearch && detectWebSearchNeeded(latestMessage.content)) {
        shouldPerformWebSearch = true;
        console.log('🎯 Auto-detected need for quick web search');
      }
    }

    // Perform quick web search if needed
    if (shouldPerformWebSearch && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      const searchResults = await performQuickWebSearch(latestMessage.content);
      if (searchResults) {
        enhancedSystemPrompt += searchResults;
        enhancedSystemPrompt += '\n\n⚠️ **Note**: Quick search results provided. For comprehensive current information, use enhanced mode.';
      }
    }

    const startTime = Date.now();
    const response = await callAI(messages, enhancedSystemPrompt, model);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`Response generated in ${responseTime}ms`);

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
    console.error('Error in ai-4-gp-fast function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});