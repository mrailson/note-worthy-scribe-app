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
    console.log('🚀 AI API Test function started (RECREATED)');
    
    const requestBody = await req.json();
    const { model, prompt }: TestRequest = requestBody;
    
    console.log(`📝 Testing model: ${model}`);
    console.log(`💬 Prompt: ${prompt.substring(0, 50)}...`);
    
    // Get API keys using the exact same method as working functions
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('🔑 API Keys status (recreated function):', {
      openai: OPENAI_API_KEY ? 'Present' : 'Missing',
      anthropic: ANTHROPIC_API_KEY ? 'Present' : 'Missing',
      grok: GROK_API_KEY ? 'Present' : 'Missing',
      gemini: GEMINI_API_KEY ? 'Present' : 'Missing'
    });

    const startTime = Date.now();
    let response: string;
    let modelUsed: string;

    // Route to appropriate API with fallbacks to available APIs
    switch (model) {
      case 'gpt-5-2025-08-07':
        if (!OPENAI_API_KEY) {
          console.log('⚠️ OpenAI API key not found, falling back to Claude API');
          if (!ANTHROPIC_API_KEY) {
            throw new Error('Neither OpenAI nor Anthropic API keys are configured');
          }
          response = await testClaude(prompt, ANTHROPIC_API_KEY);
          modelUsed = 'claude-3-5-sonnet-20241022 (fallback from gpt-5)';
        } else {
          response = await testOpenAI(prompt, 'gpt-4o', OPENAI_API_KEY);
          modelUsed = 'gpt-4o (fallback from gpt-5)';
        }
        break;
        
      case 'claude-4-opus':
        if (!ANTHROPIC_API_KEY) {
          throw new Error('Anthropic API key not configured');
        }
        response = await testClaude(prompt, ANTHROPIC_API_KEY);
        modelUsed = 'claude-3-5-sonnet-20241022';
        break;
        
      case 'gpt-4-turbo':
        if (!OPENAI_API_KEY) {
          console.log('⚠️ OpenAI API key not found, falling back to Claude API');
          if (!ANTHROPIC_API_KEY) {
            throw new Error('Neither OpenAI nor Anthropic API keys are configured');
          }
          response = await testClaude(prompt, ANTHROPIC_API_KEY);
          modelUsed = 'claude-3-5-sonnet-20241022 (fallback from gpt-4-turbo)';
        } else {
          response = await testOpenAI(prompt, 'gpt-4-turbo', OPENAI_API_KEY);
          modelUsed = 'gpt-4-turbo';
        }
        break;
        
      case 'grok-beta':
        if (!GROK_API_KEY) {
          throw new Error('Grok API key not configured');
        }
        response = await testGrok(prompt, GROK_API_KEY);
        modelUsed = 'grok-2-1212';
        break;
        
      case 'gemini-1.5-pro':
        if (!GEMINI_API_KEY) {
          throw new Error('Gemini API key not configured');
        }
        response = await testGemini(prompt, GEMINI_API_KEY);
        modelUsed = 'gemini-1.5-pro-latest';
        break;
        
      default:
        // Default fallback to any available API
        if (ANTHROPIC_API_KEY) {
          console.log('🧠 Unknown model, falling back to Claude API');
          response = await testClaude(prompt, ANTHROPIC_API_KEY);
          modelUsed = 'claude-3-5-sonnet-20241022 (fallback)';
        } else if (GROK_API_KEY) {
          console.log('🚀 Unknown model, falling back to Grok API');
          response = await testGrok(prompt, GROK_API_KEY);
          modelUsed = 'grok-2-1212 (fallback)';
        } else if (GEMINI_API_KEY) {
          console.log('💎 Unknown model, falling back to Gemini API');
          response = await testGemini(prompt, GEMINI_API_KEY);
          modelUsed = 'gemini-1.5-pro-latest (fallback)';
        } else {
          throw new Error(`Unsupported model: ${model} and no API keys available`);
        }
    }

    const responseTime = Date.now() - startTime;
    
    console.log(`✅ ${model} test completed successfully in ${responseTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      response: response.trim(),
      responseTime: responseTime,
      model: modelUsed,
      requestedModel: model
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ API test error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
  console.log(`🤖 Testing OpenAI with model: ${model}`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
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
  console.log('🧠 Testing Claude API');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
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
  console.log('🚀 Testing Grok API');
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-2-1212',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
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
  console.log('💎 Testing Gemini API');
  
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
        maxOutputTokens: 150,
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