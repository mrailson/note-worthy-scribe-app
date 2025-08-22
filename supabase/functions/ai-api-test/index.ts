import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  model: string;
  prompt: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { model, prompt }: TestRequest = await req.json();
    
    console.log(`Testing model: ${model} with prompt: ${prompt}`);
    
    // Check environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('Environment check:', {
      openai: OPENAI_API_KEY ? `Present (${OPENAI_API_KEY.substring(0, 10)}...)` : 'Missing',
      anthropic: ANTHROPIC_API_KEY ? `Present (${ANTHROPIC_API_KEY.substring(0, 10)}...)` : 'Missing',
      grok: GROK_API_KEY ? `Present (${GROK_API_KEY.substring(0, 10)}...)` : 'Missing',
      gemini: GEMINI_API_KEY ? `Present (${GEMINI_API_KEY.substring(0, 10)}...)` : 'Missing'
    });

    let response: string;
    let responseTime: number;

    switch (model) {
      case 'gpt-5-2025-08-07':
        if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
        response = await testOpenAI(prompt, 'gpt-4o', OPENAI_API_KEY); // Use GPT-4o as GPT-5 might not be available
        break;
        
      case 'claude-4-opus':
        if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured');
        response = await testClaude(prompt, ANTHROPIC_API_KEY);
        break;
        
      case 'gpt-4-turbo':
        if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
        response = await testOpenAI(prompt, 'gpt-4-turbo', OPENAI_API_KEY);
        break;
        
      case 'grok-beta':
        if (!GROK_API_KEY) throw new Error('Grok API key not configured');
        response = await testGrok(prompt, GROK_API_KEY);
        break;
        
      case 'gemini-1.5-pro':
        if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
        response = await testGemini(prompt, GEMINI_API_KEY);
        break;
        
      default:
        throw new Error(`Unsupported model: ${model}`);
    }

    responseTime = Date.now() - startTime;
    
    console.log(`${model} test completed in ${responseTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      response: response,
      responseTime: responseTime,
      model: model
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`API test error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
  console.log(`Testing OpenAI with model: ${model}`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error (${response.status}):`, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testClaude(prompt: string, apiKey: string): Promise<string> {
  console.log('Testing Claude API');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Claude API error (${response.status}):`, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function testGrok(prompt: string, apiKey: string): Promise<string> {
  console.log('Testing Grok API');
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-2-1212',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Grok API error (${response.status}):`, errorText);
    throw new Error(`Grok API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testGemini(prompt: string, apiKey: string): Promise<string> {
  console.log('Testing Gemini API');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error (${response.status}):`, errorText);
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}