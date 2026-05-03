import { serve } from "https://deno.land/std/http/server.ts";

// v7: Route LLM calls through Lovable AI Gateway (Google/OpenAI) or direct Anthropic API
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SMALL_SYS = "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullets.";

// Token limits
const MAX_CONTEXT_TOKENS = 120000; // Leave buffer for system prompt and response
const CHARS_PER_TOKEN = 4; // Rough estimate

// Keywords that indicate a need for real-time/current information
const REALTIME_INDICATORS = [
  'latest', 'current', 'today', 'this week', 'this month', 'recent', 'new',
  'news', 'announcement', 'update', 'updated', 'breaking', '2024', '2025',
  'what is happening', 'what\'s happening', 'now', 'currently', 'just',
  'gp news', 'nhs news', 'nice update', 'nice guidance', 'latest guidance',
  'contract', 'pay', 'bma', 'strike', 'industrial action', 'changes to'
];

// Estimate tokens from text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Calculate total tokens in messages (text only for estimation)
function calculateMessageTokens(messages: any[]): number {
  return messages.reduce((total, msg) => {
    if (typeof msg.content === 'string') {
      return total + estimateTokens(msg.content);
    }
    // For multimodal content, only count text parts (images handled separately)
    if (Array.isArray(msg.content)) {
      const textTokens = msg.content
        .filter((p: any) => p.type === 'text')
        .reduce((sum: number, p: any) => sum + estimateTokens(p.text || ''), 0);
      // Add estimated tokens for images (vision models handle internally)
      const imageCount = msg.content.filter((p: any) => p.type === 'image_url').length;
      return total + textTokens + (imageCount * 1000); // ~1000 tokens per image estimate
    }
    return total + estimateTokens(JSON.stringify(msg.content));
  }, 0);
}

// Split text into chunks at sentence boundaries
function splitTextIntoChunks(text: string, maxChunkTokens: number = 30000): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    if (estimateTokens(potentialChunk) > maxChunkTokens && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Check if message contains image content
function hasImageContent(messages: any[]): boolean {
  return messages.some(msg => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((p: any) => p.type === 'image_url');
    }
    return false;
  });
}

// Extract text content from a message (for document processing)
function extractTextFromMessage(msg: any): string {
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('\n');
  }
  return '';
}

// Extract document content from messages - handles various content formats
function extractDocumentContent(messages: any[]): { userQuery: string; documentContent: string; hasLargeDoc: boolean; originalMessages: any[]; hasImages: boolean } {
  let documentContent = '';
  let userQuery = '';
  const hasImages = hasImageContent(messages);
  
  // Common file/document markers
  const fileMarkers = [
    '📄 File:', '--- Document Content ---', 'File content:', 
    '```', '---\n', 'Content:\n', '[Document:', '<document>'
  ];
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = extractTextFromMessage(msg);
      
      // Check if this message contains file content
      const hasFileMarker = fileMarkers.some(marker => content.includes(marker));
      
      if (hasFileMarker) {
        // Try to extract the user query (usually at the start before document)
        // Look for common patterns where query comes before document
        const queryPatterns = [
          /^(.*?)(?:📄 File:|--- Document Content ---|File content:|```)/is,
          /^(.*?)(?:\n{2,})/is // Query followed by blank lines then content
        ];
        
        for (const pattern of queryPatterns) {
          const match = content.match(pattern);
          if (match && match[1]?.trim()) {
            userQuery = match[1].trim();
            break;
          }
        }
        
        // If no query extracted, use a generic one
        if (!userQuery) {
          userQuery = "Please summarise and analyse this document.";
        }
        
        documentContent += content;
      } else {
        // This is likely a pure user query
        userQuery = content;
      }
    }
  }
  
  // If still no document content identified but total content is large,
  // treat the entire last user message as the document
  if (!documentContent && messages.length > 0) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      const content = extractTextFromMessage(lastUserMsg);
      const contentTokens = estimateTokens(content);
      
      // If last message is very large, it's probably a document
      if (contentTokens > 50000) {
        console.log(`[gpt5-fast-clinical] Large message detected (${contentTokens} tokens), treating as document`);
        documentContent = content;
        
        // Try to extract query from first 500 chars
        const firstPart = content.substring(0, 500);
        const sentenceEnd = firstPart.search(/[.!?]\s/);
        if (sentenceEnd > 20) {
          userQuery = content.substring(0, sentenceEnd + 1).trim();
        } else {
          userQuery = "Please summarise and analyse this document.";
        }
      }
    }
  }
  
  const docTokens = estimateTokens(documentContent);
  const hasLargeDoc = docTokens > 50000; // More aggressive threshold
  
  console.log(`[gpt5-fast-clinical] Document tokens: ${docTokens}, hasLargeDoc: ${hasLargeDoc}, hasImages: ${hasImages}, userQuery: "${userQuery.substring(0, 50)}..."`);
  
  return { userQuery, documentContent, hasLargeDoc, originalMessages: messages, hasImages };
}

// Summarise a chunk of document
async function summariseChunk(chunk: string, chunkIndex: number, totalChunks: number, userQuery: string): Promise<string> {
  const systemPrompt = `You are a document summariser. Summarise the following section (part ${chunkIndex + 1} of ${totalChunks}) of a larger document.
Focus on key points relevant to this query: "${userQuery}"
Be comprehensive but concise. Preserve all important details, dates, figures, and requirements.`;

  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Fast + cheap summarisation model
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chunk }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[gpt5-fast-clinical] Chunk ${chunkIndex + 1} summarisation failed:`, error);
    throw new Error(`Chunk summarisation failed: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Process large documents by chunking and summarising
async function processLargeDocument(userQuery: string, documentContent: string): Promise<string> {
  console.log('[gpt5-fast-clinical] Processing large document with chunking...');
  
  const chunks = splitTextIntoChunks(documentContent, 30000);
  console.log(`[gpt5-fast-clinical] Split into ${chunks.length} chunks`);
  
  // Summarise chunks in parallel (max 3 at a time to avoid rate limits)
  const summaries: string[] = [];
  const batchSize = 3;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, idx) => 
      summariseChunk(chunk, i + idx, chunks.length, userQuery)
    );
    
    const batchResults = await Promise.all(batchPromises);
    summaries.push(...batchResults);
    console.log(`[gpt5-fast-clinical] Processed chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)}`);
  }
  
  // Combine summaries
  const combinedSummary = summaries.map((s, i) => `## Section ${i + 1}\n${s}`).join('\n\n');
  console.log(`[gpt5-fast-clinical] Combined ${summaries.length} chunk summaries, total tokens: ${estimateTokens(combinedSummary)}`);
  
  return combinedSummary;
}

// Check if query needs real-time information
function needsWebSearch(messages: any[]): { needed: boolean; query: string } {
  const lastMessage = messages[messages.length - 1];
  const textContent = extractTextFromMessage(lastMessage).toLowerCase();
  
  const needsSearch = REALTIME_INDICATORS.some(indicator => textContent.includes(indicator));
  
  if (needsSearch) {
    // Extract a good search query from the user's message
    const searchQuery = extractTextFromMessage(lastMessage).substring(0, 200);
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
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
      });
      if (!__vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }
    // ---- /AUTH GUARD ----

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

  if (!LOVABLE_API_KEY) {
    console.error('CRITICAL: LOVABLE_API_KEY environment variable is not set');
    return sseError("Lovable AI key not configured.", 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return sseError("Bad JSON in request body.", 400);
  }

  let { messages = [], model, systemPrompt, max_tokens, skipWebSearch } = body;
  
  // Check if we have a large document that needs chunking
  const totalTokens = calculateMessageTokens(messages);
  const containsImages = hasImageContent(messages);
  console.log(`[gpt5-fast-clinical] Total message tokens: ${totalTokens}, containsImages: ${containsImages}`);
  
  // IMPORTANT: Skip chunking for image-containing messages - vision models need the raw image data
  if (!containsImages && (totalTokens > MAX_CONTEXT_TOKENS || totalTokens > 100000)) {
    console.log('[gpt5-fast-clinical] Large document detected, applying chunking strategy...');
    
    try {
      const { userQuery, documentContent, hasLargeDoc, originalMessages, hasImages } = extractDocumentContent(messages);
      
      // If we detected a large document OR total tokens exceed limit, process it
      // But NEVER chunk image messages
      if (!hasImages && (hasLargeDoc || totalTokens > MAX_CONTEXT_TOKENS)) {
        const contentToProcess = documentContent || extractTextFromMessage(messages[messages.length - 1]);
        
        console.log(`[gpt5-fast-clinical] Processing content of ${estimateTokens(contentToProcess)} tokens`);
        
        // Process the large document
        const condensedSummary = await processLargeDocument(userQuery, contentToProcess);
        
        // Replace messages with condensed version
        messages = [
          {
            role: 'user',
            content: `${userQuery}\n\n--- Condensed Document Summary ---\n${condensedSummary}\n\nPlease provide a comprehensive response based on this summarised document content.`
          }
        ];
        
        console.log(`[gpt5-fast-clinical] Condensed to ${calculateMessageTokens(messages)} tokens`);
      }
    } catch (error) {
      console.error('[gpt5-fast-clinical] Document chunking failed:', error);
      return sseError("Document too large to process. Please try with a smaller document or specific sections.", 400);
    }
  }
  
  // Check if web search is needed (skip if caller explicitly opts out)
  let webSearchContext = '';
  let searchPerformed = false;
  
  if (!skipWebSearch) {
    const { needed: needsSearch, query: searchQuery } = needsWebSearch(messages);
    if (needsSearch) {
      console.log('[gpt5-fast-clinical] Query needs real-time info, performing web search...');
      webSearchContext = await performWebSearch(searchQuery);
      searchPerformed = webSearchContext.length > 0;
    }
  }

  // Sanitise multimodal messages: convert invalid image_url entries (non-base64 text) to text parts
  // This prevents 400 errors when plain text is accidentally sent as inline_data
  function sanitiseMessages(msgs: any[]): any[] {
    return msgs.map(msg => {
      if (!Array.isArray(msg.content)) return msg;
      
      const sanitisedContent = msg.content.map((part: any) => {
        if (part.type === 'image_url' && part.image_url?.url) {
          const url = part.image_url.url;
          // Valid: data URLs with base64 or remote URLs
          if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
            return part;
          }
          // Invalid: plain text mistakenly wrapped as image_url — convert to text
          console.warn('[gpt5-fast-clinical] Converting invalid image_url to text (non-base64 content detected)');
          return { type: 'text', text: url };
        }
        return part;
      });
      
      return { ...msg, content: sanitisedContent };
    });
  }

  // Append web search results to system prompt if available
  const sys = (systemPrompt ?? SMALL_SYS) + webSearchContext;

  const chatMessages = [{ role: "system", content: sys }, ...sanitiseMessages(messages)];

  // Content type detection for dynamic token allocation
  function detectContentType(messages: any[]): { maxTokens: number; contentType: string } {
    const lastMessage = messages[messages.length - 1];
    const content = extractTextFromMessage(lastMessage).toLowerCase();
    
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

  // Map Anthropic model IDs to actual API model strings
  const ANTHROPIC_MODEL_MAP: Record<string, string> = {
    'anthropic/claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20250627',
  };

  const isAnthropicModel = (m: string): boolean => m.startsWith('anthropic/');

  const resolveGatewayModel = (m?: string): string => {
    // SPEED-OPTIMISED: Use Gemini 3 Flash as default
    const input = (m || '').trim();
    if (!input) return 'google/gemini-3-flash-preview';

    // FAST MODE: Speed/grok/fast all route to Gemini 3 Flash
    if (input === 'speed' || input === 'fast' || input === 'grok') {
      return 'google/gemini-3-flash-preview';
    }

    // GPT-5 full — pass through as valid gateway model
    if (input === 'gpt-5' || input === 'gpt-5-2025-08-07') {
      return 'openai/gpt-5';
    }

    // Balanced option: GPT-5 mini
    if (input === 'gpt-5-mini' || input === 'gpt-5-instant' || input === 'chatgpt5') {
      return 'openai/gpt-5-mini';
    }

    if (input === 'gpt-5-nano') return 'openai/gpt-5-nano';

    // Already a gateway or anthropic model - pass through
    if (input.startsWith('openai/') || input.startsWith('google/') || input.startsWith('anthropic/')) return input;

    // Safe fast default
    return 'google/gemini-3-flash-preview';
  };

  // Call Anthropic API directly (not through Lovable gateway)
  const tryAnthropicModel = async (modelId: string, stream: boolean): Promise<Response> => {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    const apiModel = ANTHROPIC_MODEL_MAP[modelId] || modelId.replace('anthropic/', '');
    
    // Convert OpenAI-style messages to Anthropic format
    const systemContent = chatMessages
      .filter((m: any) => m.role === 'system')
      .map((m: any) => typeof m.content === 'string' ? m.content : m.content?.map((p: any) => p.text || '').join('\n'))
      .join('\n\n');
    
    const anthropicMessages = chatMessages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : m.content?.map((p: any) => {
          if (p.type === 'text') return { type: 'text', text: p.text };
          if (p.type === 'image_url') return { type: 'image', source: { type: 'url', url: p.image_url?.url } };
          return { type: 'text', text: p.text || '' };
        }),
      }));

    const requestBody: Record<string, any> = {
      model: apiModel,
      max_tokens: finalMaxTokens,
      messages: anthropicMessages,
      stream,
    };
    if (systemContent) {
      requestBody.system = systemContent;
    }

    const timeoutMs = modelId.includes('sonnet') ? 120000 : 90000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Anthropic request timeout after ${Math.round(timeoutMs / 1000)}s for ${modelId}`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        throw new Error(`Anthropic request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      throw error;
    }
  };

  // Convert Anthropic SSE stream to OpenAI-compatible SSE stream
  const convertAnthropicStream = (anthropicBody: ReadableStream): ReadableStream => {
    const reader = anthropicBody.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                const openaiChunk = {
                  choices: [{ delta: { content: event.delta.text }, index: 0 }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
              }
            } catch { /* skip malformed lines */ }
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });
  };

  const tryModel = async (m: string, stream: boolean) => {
    const gatewayModel = resolveGatewayModel(m);

    // Route Anthropic models to direct API
    if (isAnthropicModel(gatewayModel)) {
      return tryAnthropicModel(gatewayModel, stream);
    }

    const requestBody: Record<string, any> = {
      model: gatewayModel,
      messages: chatMessages,
      stream,
    };

    // GPT-5 family requires `max_completion_tokens` (OpenAI-compatible API behaviour)
    if (gatewayModel.startsWith('openai/gpt-5')) {
      requestBody.max_completion_tokens = finalMaxTokens;
    } else {
      requestBody.max_tokens = finalMaxTokens;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Timeout: 120s for Pro models (known latency), 90s for Flash, 60s for others
    const timeoutMs = 
      gatewayModel === 'google/gemini-3.1-pro-preview' || gatewayModel === 'google/gemini-2.5-pro' ? 120000 :
      gatewayModel.includes('flash') ? 90000 : 90000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Request timeout after ${Math.round(timeoutMs / 1000)}s for model ${gatewayModel}`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        console.error(`API call timed out for ${m} (${gatewayModel}) after ${Math.round(timeoutMs / 1000)}s`);
        throw new Error(`Upstream AI request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      console.error(`API call failed for ${m}:`, error?.message || String(error));
      throw error;
    }
  };

  // Fallback chain: primary model → retry once → fallback models (deeper chain)
  const FALLBACK_CHAIN: Record<string, string[]> = {
    'google/gemini-3.1-pro-preview': ['google/gemini-2.5-pro', 'openai/gpt-5'],
    'google/gemini-3-flash-preview': ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5'],
    'google/gemini-2.5-pro': ['openai/gpt-5', 'google/gemini-2.5-flash'],
    'google/gemini-2.5-flash': ['google/gemini-3-flash-preview', 'openai/gpt-5-mini'],
    'openai/gpt-5': ['google/gemini-3-flash-preview', 'google/gemini-2.5-pro'],
    'openai/gpt-5.2': ['google/gemini-3-flash-preview', 'openai/gpt-5'],
    'openai/gpt-5-mini': ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash'],
    'anthropic/claude-haiku-4-5': ['anthropic/claude-sonnet-4-6', 'google/gemini-3-flash-preview'],
    'anthropic/claude-sonnet-4-6': ['anthropic/claude-haiku-4-5', 'google/gemini-3.1-pro-preview'],
  };

  const MODEL_LABELS: Record<string, string> = {
    'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
    'google/gemini-3-flash-preview': 'Gemini 3 Flash',
    'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
    'openai/gpt-5': 'GPT-5',
    'openai/gpt-5.2': 'GPT-5.2',
    'openai/gpt-5-mini': 'GPT-5 Mini',
    'anthropic/claude-haiku-4-5': 'Claude Haiku 4.5',
    'anthropic/claude-sonnet-4-6': 'Claude Sonnet 4.6',
  };

  try {
    const requestedModel = model;
    const resolvedModel = resolveGatewayModel(requestedModel || 'google/gemini-3-flash-preview');
    console.log(`Starting request with model: ${resolvedModel}, tokens: ${finalMaxTokens}, webSearch: ${searchPerformed}`);
    
    let resp: Response | null = null;
    let usedModel = resolvedModel;
    let fallbackUsed = false;

    // Try primary model
    try {
      resp = await tryModel(resolvedModel, true);
      if (resp.status === 503 || resp.status === 429) {
        console.log(`Primary model ${resolvedModel} returned ${resp.status}, retrying once...`);
        resp = await tryModel(resolvedModel, true);
      }
    } catch (e) {
      console.error(`Primary model ${resolvedModel} failed:`, e);
    }

    // If primary failed or returned error, try fallback chain
    if (!resp || !resp.ok) {
      const fallbacks = FALLBACK_CHAIN[resolvedModel] || ['google/gemini-2.5-pro', 'openai/gpt-5'];
      
      for (const fallbackModel of fallbacks) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          resp = await tryModel(fallbackModel, true);
          if (resp.ok) {
            usedModel = fallbackModel;
            fallbackUsed = true;
            console.log(`Fallback to ${fallbackModel} succeeded`);
            break;
          }
        } catch (e) {
          console.error(`Fallback ${fallbackModel} failed:`, e);
        }
      }
    }

    if (!resp || !resp.ok) {
      const errorText = resp ? await resp.text() : 'All models failed';
      console.error(`All models failed:`, errorText);
      return sseError(`AI API error: ${errorText}`, resp?.status || 500);
    }

    console.log(`Successfully got response using ${usedModel}`);
    
    // For Anthropic models, convert the stream to OpenAI-compatible SSE
    const isAnthropicResponse = isAnthropicModel(usedModel);
    const responseBody = isAnthropicResponse && resp.body ? convertAnthropicStream(resp.body) : resp.body;
    
    // Build meta message with fallback info and/or web search info
    const metaInfo: Record<string, any> = {};
    if (searchPerformed) metaInfo.webSearchPerformed = true;
    if (fallbackUsed) {
      metaInfo.fallbackUsed = true;
      metaInfo.fallbackModel = usedModel;
      metaInfo.fallbackModelLabel = MODEL_LABELS[usedModel] || usedModel;
    }

    if (Object.keys(metaInfo).length > 0) {
      const metaMessage = `data: ${JSON.stringify({ _meta: metaInfo })}\n\n`;
      
      const originalBody = responseBody;
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
    return new Response(responseBody, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (err: any) {
    return sseError(`Handler error: ${err?.message || String(err)}`, 500);
  }
});