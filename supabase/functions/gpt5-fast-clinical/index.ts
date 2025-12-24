import { serve } from "https://deno.land/std/http/server.ts";

// Force redeploy to pick up updated OPENAI_API_KEY - v4 with web search
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_ORG = Deno.env.get("OPENAI_ORG") ?? "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SMALL_SYS = "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullets.";

// Keywords that indicate a need for real-time/current information
const REALTIME_INDICATORS = [
  'latest', 'current', 'today', 'this week', 'this month', 'recent', 'new',
  'news', 'announcement', 'update', 'updated', 'breaking', '2024', '2025',
  'what is happening', 'what\'s happening', 'now', 'currently', 'just',
  'gp news', 'nhs news', 'nice update', 'nice guidance', 'latest guidance',
  'contract', 'pay', 'bma', 'strike', 'industrial action', 'changes to'
];

// Check if query needs real-time information
function needsWebSearch(messages: any[]): { needed: boolean; query: string } {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content?.toLowerCase() || '';
  
  const needsSearch = REALTIME_INDICATORS.some(indicator => content.includes(indicator));
  
  if (needsSearch) {
    // Extract a good search query from the user's message
    const searchQuery = lastMessage?.content?.substring(0, 200) || '';
    return { needed: true, query: searchQuery };
  }
  
  return { needed: false, query: '' };
}

// Perform web search using Tavily
async function performWebSearch(query: string): Promise<string> {
  if (!TAVILY_API_KEY) {
    console.log('[gpt5-fast-clinical] No TAVILY_API_KEY, skipping web search');
    return '';
  }

  try {
    console.log(`[gpt5-fast-clinical] Performing web search for: "${query.substring(0, 50)}..."`);
    
    const searchResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_domains: [
          'nhs.uk', 'nice.org.uk', 'gov.uk', 'bma.org.uk', 'rcgp.org.uk',
          'gponline.com', 'pulsetoday.co.uk', 'bmj.com', 'england.nhs.uk'
        ],
        max_results: 4,
        include_answer: true
      })
    });

    if (!searchResponse.ok) {
      console.error('[gpt5-fast-clinical] Tavily API error:', await searchResponse.text());
      return '';
    }

    const searchData = await searchResponse.json();
    const results = searchData.results || [];
    
    if (results.length === 0) {
      return '';
    }

    console.log(`[gpt5-fast-clinical] Found ${results.length} web results`);

    // Format results for context injection
    const formattedResults = results.map((r: any, i: number) => 
      `[${i + 1}] ${r.title}\nSource: ${r.url}\n${(r.content || '').substring(0, 400)}`
    ).join('\n\n');

    return `\n\n🔍 REAL-TIME WEB SEARCH RESULTS:\n${formattedResults}\n\n---\nPlease incorporate these current sources into your response where relevant. Cite sources when using specific information.`;
    
  } catch (error) {
    console.error('[gpt5-fast-clinical] Web search error:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const sseError = (message: string, status = 200) =>
    new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
      status
    });

  if (!OPENAI_API_KEY) {
    console.error('CRITICAL: OPENAI_API_KEY environment variable is not set');
    return sseError("OpenAI API key not configured.", 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return sseError("Bad JSON in request body.", 400);
  }

  const { messages = [], model, systemPrompt, max_tokens } = body;
  
  // Check if web search is needed
  const { needed: needsSearch, query: searchQuery } = needsWebSearch(messages);
  let webSearchContext = '';
  let searchPerformed = false;
  
  if (needsSearch) {
    console.log('[gpt5-fast-clinical] Query needs real-time info, performing web search...');
    webSearchContext = await performWebSearch(searchQuery);
    searchPerformed = webSearchContext.length > 0;
  }

  // Append web search results to system prompt if available
  const sys = (systemPrompt ?? SMALL_SYS) + webSearchContext;

  const chatMessages = [{ role: "system", content: sys }, ...messages];

  // Content type detection for dynamic token allocation
  function detectContentType(messages: any[]): { maxTokens: number; contentType: string } {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content?.toLowerCase() || '';
    
    // Check for comprehensive content indicators
    const comprehensiveIndicators = [
      'leaflet', 'comprehensive', 'detailed guide', 'full guide', 'complete guide',
      'patient information', 'detailed explanation', 'comprehensive overview',
      'step by step', 'complete instructions', 'full instructions'
    ];
    
    const medicalAnalysisIndicators = [
      'analyze', 'assessment', 'evaluation', 'diagnosis', 'differential',
      'complex case', 'investigation', 'clinical reasoning', 'pathophysiology'
    ];
    
    const clinicalNotesIndicators = [
      'clinical note', 'soap note', 'consultation note', 'discharge summary',
      'referral letter', 'brief summary', 'quick note'
    ];
    
    // Use maximum tokens for ALL content types to prevent cutoffs
    if (comprehensiveIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'comprehensive' };
    }
    
    if (medicalAnalysisIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'analysis' };
    }
    
    if (clinicalNotesIndicators.some(indicator => content.includes(indicator))) {
      return { maxTokens: 4096, contentType: 'clinical_notes' };
    }
    
    // Check content length as secondary indicator
    if (content.length > 200) {
      return { maxTokens: 4096, contentType: 'medium' };
    }
    
    return { maxTokens: 4096, contentType: 'short' };
  }

  // Determine max tokens - use provided value or detect from content
  const { maxTokens: detectedMaxTokens } = detectContentType(messages);
  const finalMaxTokens = max_tokens || detectedMaxTokens;

  const tryModel = async (m: string, stream: boolean) => {
    const requestBody: Record<string, any> = {
      model: m,
      messages: chatMessages,
      stream,
      max_tokens: finalMaxTokens,
      temperature: 0.2
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (OPENAI_ORG) headers["OpenAI-Organization"] = OPENAI_ORG;

    // Much shorter timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Request timeout after 15 seconds for model ${m}`);
      controller.abort();
    }, 15000); // 15 second timeout

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`API call failed for ${m}:`, error.message);
      throw error;
    }
  };

  try {
    // Use GPT-4o-mini directly with streaming for fast, reliable responses
    console.log(`Starting request with model: gpt-4o-mini, tokens: ${finalMaxTokens}, webSearch: ${searchPerformed}`);
    const resp = await tryModel("gpt-4o-mini", true);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`GPT-4o-mini failed:`, errorText);
      return sseError(`OpenAI API error: ${errorText}`, resp.status);
    }

    console.log(`Successfully got response from gpt-4o-mini`);
    
    // If web search was performed, prepend a meta message indicating this
    if (searchPerformed) {
      const metaMessage = `data: ${JSON.stringify({ _meta: { webSearchPerformed: true } })}\n\n`;
      
      // Create a new ReadableStream that prepends the meta message
      const originalBody = resp.body;
      const newStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(metaMessage));
          
          if (originalBody) {
            const reader = originalBody.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        }
      });
      
      return new Response(newStream, {
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }
    
    // Return the streaming response directly
    return new Response(resp.body, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (err: any) {
    return sseError(`Handler error: ${err?.message || String(err)}`, 500);
  }
});