import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  model?: string;
  systemPrompt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();
  console.log('=== GPT5-Fast-Clinical Function Started ===');

  try {
    const { messages = [], model = 'gpt-5-mini-2025-08-07', systemPrompt }: RequestBody = await req.json();
    console.log(`Received request - messages count: ${messages.length}, model: ${model}`);

    if (!messages?.length) {
      console.error('ERROR: No messages provided');
      throw new Error('No messages provided');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('ERROR: OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }
    console.log('OpenAI API key found');

    // Ultra-minimal system prompt (≤200 chars)
    const clinicalPrompt = systemPrompt || "NHS GP assistant. Use BNF/NICE/MHRA/NHS.uk/Green Book/ICB only. Concise UK GP bullet points.";
    
    // Build messages for Chat Completions API
    const chatMessages = [
      { role: 'system', content: clinicalPrompt },
      ...messages
    ];

    const t1 = Date.now();
    console.log(`t0->t1 (prep): ${t1-t0}ms`);
    console.log(`System prompt length: ${clinicalPrompt.length} chars`);
    console.log(`Total chat messages: ${chatMessages.length}`);

    // Use OpenAI Chat Completions API with streaming
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);

    const requestBody = {
      model: model,
      messages: chatMessages,
      stream: true,
      max_tokens: 450,
      temperature: 0.2
    };
    
    console.log('Making OpenAI API call...');
    console.log(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const t2 = Date.now();
    console.log(`t1->t2 (TTFB): ${t2-t1}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    // Stream the response directly to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
      }
    });

  } catch (error) {
    const totalTime = Date.now() - t0;
    console.error(`=== ERROR after ${totalTime}ms ===`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Return SSE format even for errors to maintain streaming UX
    const errorStream = new ReadableStream({
      start(controller) {
        const errorMsg = `data: {"choices":[{"delta":{"content":"Error: ${error.message}"}}]}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorMsg));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(errorStream, {
      status: 200, // Keep 200 for streaming
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream' 
      }
    });
  }
});