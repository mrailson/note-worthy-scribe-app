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
  useResponsesAPI?: boolean;
  enableStreaming?: boolean;
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

async function callGPT(prompt: string, systemPrompt: string, model: string = 'gpt-4o', useResponsesAPI: boolean = false, enableStreaming: boolean = false): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  if (useResponsesAPI) {
    return await callGPTResponsesAPI(prompt, systemPrompt, model, enableStreaming);
  } else {
    return await callGPTChatCompletions(prompt, systemPrompt, model, enableStreaming);
  }
}

async function callGPTChatCompletions(prompt: string, systemPrompt: string, model: string, enableStreaming: boolean): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const requestBody: any = {
    model: model,
    messages: messages,
    max_tokens: 4000, // Always use max_tokens for Chat Completions API
    temperature: 0.3, // Lower temperature for faster, more deterministic responses
    stream: enableStreaming
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const requestId = response.headers.get("x-request-id");
    console.error('OpenAI Chat Completions API error:', {
      status: response.status,
      requestId: requestId,
      error: errorText
    });
    throw new Error(`OpenAI Chat Completions API error: ${response.status} (${requestId}) - ${errorText}`);
  }

  if (enableStreaming) {
    return await handleOpenAIStreaming(response);
  } else {
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

async function callGPTResponsesAPI(prompt: string, systemPrompt: string, model: string, enableStreaming: boolean): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Correct input format for Responses API
  const requestBody: any = {
    model: model,
    input: [
      { role: "system", content: [{ type: "text", text: systemPrompt || "" }] },
      { role: "user", content: [{ type: "text", text: prompt || "" }] }
    ],
    max_output_tokens: 512, // Use appropriate limit for responses
    stream: enableStreaming
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const requestId = response.headers.get("x-request-id");
    console.error('OpenAI Responses API error:', {
      status: response.status,
      requestId: requestId,
      error: errorText
    });
    throw new Error(`OpenAI Responses API error: ${response.status} (${requestId}) - ${errorText}`);
  }

  if (enableStreaming) {
    return await handleResponsesAPIStreaming(response);
  } else {
    const data = await response.json();
    // Correct way to read output_text from Responses API
    const text = data.output_text || 
      (Array.isArray(data.output) ? 
        data.output.flatMap((m: any) => m.content?.map((c: any) => c.text || "") || []).join("") : 
        "No response generated");
    return text;
  }
}

async function handleOpenAIStreaming(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream available');

  let fullResponse = '';
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
}

async function handleResponsesAPIStreaming(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream available');

  let fullResponse = '';
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            // Correct field for Responses API streaming
            const content = data.output_text?.delta || data.delta;
            if (content) {
              fullResponse += content;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
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

  // Ensure correct model format for Gemini API
  const modelPath = model.includes('gemini-') ? model : `gemini-${model}`;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:generateContent?key=${geminiApiKey}`, {
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
    console.error(`Gemini API error for model ${modelPath}:`, error);
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
    const { prompt, model, systemPrompt, useResponsesAPI = false, enableStreaming = false }: RequestBody = await req.json();

    console.log(`Testing ${model} with prompt length: ${prompt.length}, Responses API: ${useResponsesAPI}, Streaming: ${enableStreaming}`);

    const startTime = Date.now();
    let response: string;
    let modelName: string;
    let apiUsed = 'Unknown';

    switch (model) {
      case 'claude-4-sonnet':
        response = await callClaude(prompt, systemPrompt, 'claude-3-5-sonnet-20241022');
        modelName = 'Claude 3.5 Sonnet';
        apiUsed = 'Anthropic';
        break;
      case 'claude-4-opus':
        response = await callClaude(prompt, systemPrompt, 'claude-3-opus-20240229');
        modelName = 'Claude 3 Opus';
        apiUsed = 'Anthropic';
        break;
      case 'gpt-5':
        // GPT-5 isn't available yet, use GPT-4o as fallback
        response = await callGPT(prompt, systemPrompt, 'gpt-4o', useResponsesAPI, enableStreaming);
        modelName = useResponsesAPI ? 'GPT-4o (Responses API)' : 'GPT-4o (Chat Completions)';
        apiUsed = useResponsesAPI ? 'OpenAI Responses API' : 'OpenAI Chat Completions';
        break;
      case 'gpt':
        response = await callGPT(prompt, systemPrompt, 'gpt-4o', useResponsesAPI, enableStreaming);
        modelName = useResponsesAPI ? 'GPT-4o (Responses API)' : 'GPT-4o (Chat Completions)';
        apiUsed = useResponsesAPI ? 'OpenAI Responses API' : 'OpenAI Chat Completions';
        break;
      case 'chatgpt5':
        response = await callGPT(prompt, systemPrompt, 'gpt-4o-mini', useResponsesAPI, enableStreaming);
        modelName = useResponsesAPI ? 'GPT-4o Mini (Responses API)' : 'GPT-4o Mini (Chat Completions)';
        apiUsed = useResponsesAPI ? 'OpenAI Responses API' : 'OpenAI Chat Completions';
        break;
      case 'grok-beta':
        response = await callGrok(prompt, systemPrompt);
        modelName = 'Grok';
        apiUsed = 'xAI';
        break;
      case 'gemini-1.5-pro':
        response = await callGemini(prompt, systemPrompt, 'gemini-1.5-pro');
        modelName = 'Gemini 1.5 Pro';
        apiUsed = 'Google';
        break;
      case 'gemini-1.5-flash':
        response = await callGemini(prompt, systemPrompt, 'gemini-1.5-flash');
        modelName = 'Gemini 1.5 Flash';
        apiUsed = 'Google';
        break;
      default:
        throw new Error(`Unsupported model: ${model}`);
    }

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Calculate approximate tokens per second (rough estimate)
    const wordCount = response.split(' ').length;
    const estimatedTokens = Math.floor(wordCount * 1.3); // Rough token estimation
    const tokensPerSecond = responseTime > 0 ? Math.round((estimatedTokens / responseTime) * 1000) : 0;
    
    console.log(`${modelName} completed successfully. Response length: ${response.length} chars, Response time: ${responseTime}ms, API: ${apiUsed}`);

    return new Response(JSON.stringify({
      response,
      model: modelName,
      tokensPerSecond: tokensPerSecond,
      responseTimeMs: responseTime,
      apiUsed: apiUsed,
      streamingEnabled: enableStreaming,
      responsesAPIUsed: useResponsesAPI,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in API testing service:', error);
    
    // Enhanced error logging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false,
      errorType: error.name || 'UnknownError'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});