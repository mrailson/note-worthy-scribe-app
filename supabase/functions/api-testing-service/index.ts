import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  prompt: string;
  model: 'claude' | 'gpt' | 'chatgpt5' | 'grok-beta' | 'claude-4-opus' | 'claude-4-sonnet' | 'gpt-4-turbo' | 'gemini-ultra' | 'gpt-5' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  systemPrompt: string;
}

async function callClaude(prompt: string, systemPrompt: string, model: string = 'claude-3-5-sonnet-20241022'): Promise<string> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Claude API error:', error);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGPT(prompt: string, systemPrompt: string, model: string = 'gpt-4o'): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const requestBody: any = {
    model: model,
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
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGrok(prompt: string, systemPrompt: string): Promise<string> {
  const grokApiKey = Deno.env.get('GROK_API_KEY');
  if (!grokApiKey) {
    throw new Error('Grok API key not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${grokApiKey}`
    },
    body: JSON.stringify({
      model: 'grok-2-1212',
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Grok API error:', error);
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(prompt: string, systemPrompt: string, model: string = 'gemini-1.5-pro'): Promise<string> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, model, systemPrompt }: RequestBody = await req.json();

    console.log(`Testing ${model} with prompt length: ${prompt.length}`);

    let response: string;
    let modelName: string;

    switch (model) {
      case 'claude-4-sonnet':
        response = await callClaude(prompt, systemPrompt, 'claude-3-5-sonnet-20241022');
        modelName = 'Claude 3.5 Sonnet';
        break;
      case 'claude-4-opus':
        response = await callClaude(prompt, systemPrompt, 'claude-3-opus-20240229');
        modelName = 'Claude 3 Opus';
        break;
      case 'gpt-5':
        response = await callGPT(prompt, systemPrompt, 'gpt-4.1-2025-04-14');
        modelName = 'GPT-4.1';
        break;
      case 'gpt':
        response = await callGPT(prompt, systemPrompt, 'gpt-4o');
        modelName = 'GPT-4o';
        break;
      case 'chatgpt5':
        response = await callGPT(prompt, systemPrompt, 'gpt-4o-mini');
        modelName = 'GPT-4o Mini';
        break;
      case 'grok-beta':
        response = await callGrok(prompt, systemPrompt);
        modelName = 'Grok';
        break;
      case 'gemini-1.5-pro':
        response = await callGemini(prompt, systemPrompt, 'gemini-1.5-pro');
        modelName = 'Gemini 1.5 Pro';
        break;
      case 'gemini-1.5-flash':
        response = await callGemini(prompt, systemPrompt, 'gemini-1.5-flash');
        modelName = 'Gemini 1.5 Flash';
        break;
      default:
        throw new Error(`Unsupported model: ${model}`);
    }

    // Calculate approximate tokens per second (rough estimate)
    const wordCount = response.split(' ').length;
    const estimatedTokens = Math.floor(wordCount * 1.3); // Rough token estimation
    
    console.log(`${modelName} completed successfully. Response length: ${response.length} chars`);

    return new Response(JSON.stringify({
      response,
      model: modelName,
      tokensPerSecond: estimatedTokens, // This would need actual timing to be accurate
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in API testing service:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});