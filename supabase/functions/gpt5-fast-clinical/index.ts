import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  model?: string;
  systemPrompt?: string;
}

async function callGPT5Fast(messages: Message[], systemPrompt: string, model: string): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  // Ultra-minimal system prompt for speed
  const clinicalSystemPrompt = systemPrompt || `Clinical AI assistant. UK NHS guidelines. Evidence-based. ${new Date().toISOString().split('T')[0]}`;

  // Minimal message array
  const apiMessages = [
    { role: 'system', content: clinicalSystemPrompt },
    ...messages
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      max_completion_tokens: 2000, // Reduced for speed
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No response generated';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages, model = 'gpt-5-mini-2025-08-07', systemPrompt }: RequestBody = await req.json();

    if (!messages?.length) {
      throw new Error('No messages provided');
    }

    const response = await callGPT5Fast(messages, systemPrompt, model);
    const totalTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        response,
        responseTime: totalTime,
        model,
        success: true,
        service: 'gpt5-fast-clinical'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        response: `Error: ${error.message}`,
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