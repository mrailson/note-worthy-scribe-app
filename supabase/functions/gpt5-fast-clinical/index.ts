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

  // Minimal system prompt focused on clinical accuracy
  const clinicalSystemPrompt = systemPrompt || `You are a clinical AI assistant providing accurate medical information based on current UK NHS guidelines. 
Be precise, evidence-based, and always recommend consulting appropriate healthcare professionals for patient care decisions.
Current date: ${new Date().toISOString().split('T')[0]}`;

  // Build minimal message array
  const apiMessages = [
    { role: 'system', content: clinicalSystemPrompt },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  const startTime = Date.now();
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        max_completion_tokens: 4000,
        // Note: temperature not supported for GPT-5 models
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    console.log(`GPT-5 Fast response time: ${responseTime}ms`);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure from OpenAI API');
    }

    return data.choices[0].message.content || 'No response generated';
    
  } catch (error) {
    console.error('GPT-5 Fast call failed:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('🚀 GPT-5 Fast Clinical function started');
    
    const requestBody = await req.json();
    const { messages, model = 'gpt-5-2025-08-07', systemPrompt }: RequestBody = requestBody;

    console.log(`Processing ${messages?.length || 0} messages with model: ${model}`);

    // Validate input
    if (!messages || messages.length === 0) {
      throw new Error('No messages provided');
    }

    // Call GPT-5 directly with minimal overhead
    const response = await callGPT5Fast(messages, systemPrompt, model);
    
    const totalTime = Date.now() - startTime;
    console.log(`Total response time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({ 
        response,
        responseTime: totalTime,
        model: model,
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
    console.error('Error in gpt5-fast-clinical function:', error);
    
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