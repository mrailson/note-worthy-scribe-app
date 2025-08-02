import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

interface RequestBody {
  messages: Message[];
  model: 'claude' | 'gpt';
  systemPrompt: string;
  files?: UploadedFile[];
}

async function callClaude(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Format messages for Claude
  const claudeMessages = messages.map(msg => {
    let content = msg.content || ''; // Ensure content is never null/undefined
    
    // Add file content if present
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
    // Ensure content is not empty
    if (!content.trim()) {
      content = '[No message content]';
    }
    
    return {
      role: msg.role,
      content
    };
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: systemPrompt,
      messages: claudeMessages
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

async function callGPT(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Format messages for GPT
  const gptMessages = [
    { role: 'system', content: systemPrompt }
  ];

  messages.forEach(msg => {
    let content = msg.content || ''; // Ensure content is never null/undefined
    
    // Add file content if present
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
    // Ensure content is not empty
    if (!content.trim()) {
      content = '[No message content]';
    }
    
    gptMessages.push({
      role: msg.role,
      content
    });
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: gptMessages,
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, systemPrompt, files }: RequestBody = await req.json();

    console.log(`Processing ${model} request with ${messages.length} messages`);

    let response: string;

    if (model === 'claude') {
      response = await callClaude(messages, systemPrompt, files);
    } else if (model === 'gpt') {
      response = await callGPT(messages, systemPrompt, files);
    } else {
      throw new Error('Invalid model specified');
    }

    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in ai-4-pm-chat function:', error);
    
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
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