import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();

  try {
    const { messages, model = 'gpt-5-mini-2025-08-07', systemPrompt }: RequestBody = await req.json();

    if (!messages?.length) {
      throw new Error('No messages provided');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Ultra-minimal system prompt (<200 chars)
    const clinicalPrompt = systemPrompt || "NHS GP assistant. BNF/NICE/MHRA. Bullet points. UK terms.";
    
    // Build minimal input for Responses API
    const input = [
      { role: 'system', content: clinicalPrompt },
      ...messages
    ];

    const t1 = Date.now();
    console.log(`t0->t1 (prep): ${t1-t0}ms`);

    // Use OpenAI Responses API with streaming
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: input,
        stream: true,
        max_output_tokens: 700, // Optimal for clinical summaries
        temperature: 0.2
      }),
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
    console.log(`Error after ${totalTime}ms: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        responseTime: totalTime
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});