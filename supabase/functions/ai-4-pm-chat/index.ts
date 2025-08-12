import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import mammoth from "https://esm.sh/mammoth@1.6.0";

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
  model: 'claude' | 'gpt' | 'chatgpt5';
  systemPrompt: string;
  files?: UploadedFile[];
  enableWebSearch?: boolean;
}

// Helper function to extract text content from files
async function extractFileContent(file: UploadedFile): Promise<string> {
  try {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    
    // Handle Word documents
    if (fileName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
      return await extractWordContent(file);
    }
    
    // Handle text files
    if (fileName.endsWith('.txt') || fileType.includes('text/plain')) {
      return extractTextContent(file);
    }
    
    // Handle PDFs (basic extraction)
    if (fileName.endsWith('.pdf') || fileType.includes('pdf')) {
      return extractPdfContent(file);
    }
    
    // Handle PowerPoint files (basic extraction)
    if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || fileType.includes('presentation')) {
      return extractPowerPointContent(file);
    }
    
    // For other file types, return the original content (might be base64)
    console.log(`Unsupported file type: ${fileName}, type: ${fileType}`);
    return `[File: ${file.name} - Content extraction not supported for this file type. Please convert to .txt, .docx format for full text extraction.]`;
    
  } catch (error) {
    console.error(`Error extracting content from ${file.name}:`, error);
    return `[Error extracting content from ${file.name}: ${error.message}]`;
  }
}

async function extractWordContent(file: UploadedFile): Promise<string> {
  try {
    // Convert base64 to array buffer
    const base64Data = file.content.replace(/^data:.*,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    return result.value || '[No text content found in Word document]';
  } catch (error) {
    console.error('Error extracting Word content:', error);
    throw new Error(`Failed to extract Word document content: ${error.message}`);
  }
}

function extractTextContent(file: UploadedFile): string {
  try {
    // If it's base64 encoded text file
    if (file.content.startsWith('data:')) {
      const base64Data = file.content.replace(/^data:.*,/, '');
      return atob(base64Data);
    }
    // Otherwise return as-is
    return file.content;
  } catch (error) {
    console.error('Error extracting text content:', error);
    return file.content; // Fallback to original content
  }
}

async function extractPdfContent(file: UploadedFile): Promise<string> {
  try {
    // Convert base64 to array buffer
    const base64Data = file.content.replace(/^data:.*,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Basic PDF text extraction using a simple approach
    // Convert bytes to string and try to extract readable text
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    // Look for text patterns in PDF (very basic extraction)
    const textMatches = text.match(/\((.*?)\)/g) || [];
    const extractedText = textMatches
      .map(match => match.replace(/[()]/g, '').trim())
      .filter(text => text.length > 2 && /[a-zA-Z]/.test(text))
      .join(' ');

    if (extractedText.length > 50) {
      return extractedText;
    }

    // If basic extraction fails, return instructions
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Text extraction partially successful. For better results:
1. Open your PDF file and copy the text manually
2. Or convert to .docx/.txt format for better extraction
3. If this is a scanned PDF, OCR processing would be needed

Some text may have been extracted but might be incomplete or fragmented.]`;
    
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Text extraction failed. Please:
1. Copy text manually from the PDF
2. Convert to .docx or .txt format
3. Ensure the PDF contains selectable text (not just images)]`;
  }
}

function extractPowerPointContent(file: UploadedFile): string {
  // Basic PowerPoint handling - in a real implementation you'd use a PPTX parser
  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  return `[PowerPoint File: ${file.name} (${fileSize}MB) - For best results with PowerPoint files, please:
1. Open your PowerPoint file
2. Copy the text content from slides
3. Paste the text directly in your message

PowerPoint automatic text extraction is limited. Converting to .docx or .txt format will provide better results.]`;
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
      model: 'gpt-4o',
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

async function callGPT5(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Format messages for GPT-5 (using flagship model)
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
      model: 'gpt-4.1-2025-04-14', // Using the flagship model for ChatGPT 5.0
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
    const { messages, model, systemPrompt, files, enableWebSearch }: RequestBody = await req.json();

    console.log(`Processing ${model} request with ${messages.length} messages`);
    console.log('SystemPrompt:', systemPrompt ? 'Present' : 'Missing');
    console.log('Messages content check:', messages.map(m => ({ role: m.role, hasContent: !!m.content })));

    // Process uploaded files to extract text content
    const processedMessages = await Promise.all(
      messages.map(async (message) => {
        if (message.files && message.files.length > 0) {
          console.log(`Processing ${message.files.length} files for message`);
          
          // Extract text content from each file
          const processedFiles = await Promise.all(
            message.files.map(async (file) => {
              console.log(`Extracting content from: ${file.name} (${file.type})`);
              const extractedContent = await extractFileContent(file);
              return {
                ...file,
                content: extractedContent
              };
            })
          );
          
          return {
            ...message,
            files: processedFiles
          };
        }
        return message;
      })
    );

    // Add web search context if enabled
    let enhancedSystemPrompt = systemPrompt;
    if (enableWebSearch) {
      const lastUserMessage = processedMessages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        try {
          const tavilyKey = Deno.env.get('TAVILY_API_KEY');
          if (tavilyKey) {
            const query = `${lastUserMessage.content}`.slice(0, 500);
            console.log('Running Tavily web search for:', query);
            const tavilyResp = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: tavilyKey,
                query,
                search_depth: 'advanced',
                max_results: 8,
                time_range: '3m',
                topic: 'news',
                include_answer: true,
                include_raw_content: false,
                include_images: false,
                include_domains: [
                  'www.england.nhs.uk',
                  'www.nhs.uk',
                  'www.gov.uk',
                  'www.nice.org.uk',
                  'www.cqc.org.uk',
                  'www.bma.org.uk',
                  'www.parliament.uk'
                ]
              })
            });
            if (tavilyResp.ok) {
              const data = await tavilyResp.json();
              const results = Array.isArray(data.results) ? data.results : [];
              const summary = (data.answer || '').toString().trim();
              const formatted = results.slice(0, 8).map((r: any) => {
                const url = r.url || r.link || '';
                let host = '';
                try { host = new URL(url).host; } catch {}
                const date = (r.published_date || r.date || r.published_at || '').toString();
                const snippet = (r.content || r.snippet || r.answer || '').replace(/\s+/g, ' ').slice(0, 220);
                return `- ${r.title || 'Untitled'} — ${host}${date ? ' — ' + date : ''}\n  ${url}\n  ${snippet}`;
              }).join('\n');

              enhancedSystemPrompt += `\n\nDIRECTIONS: When RECENT WEB SEARCH RESULTS are present, base your answer ONLY on them. Do not rely on memory for policy/personnel status. If no items are within the last 3 months, say so and avoid outdated statements. Always cite source URLs with publication dates.\n`;

              if (summary) {
                enhancedSystemPrompt += `\nRECENT WEB SEARCH SUMMARY:\n${summary}\n`;
              }
              if (formatted) {
                enhancedSystemPrompt += `\nRECENT WEB SEARCH RESULTS (authoritative UK health sources, last 3 months):\n${formatted}`;
                console.log(`Tavily results appended: ${results.length}`);
              }
            } else {
              console.error('Tavily search failed:', await tavilyResp.text());
            }
          } else {
            console.log('Tavily API key not configured; proceeding without live web search');
          }
        } catch (webSearchError) {
          console.error('Web search error (continuing without web results):', webSearchError);
        }
      }
    }

    let response: string;

    if (model === 'claude') {
      response = await callClaude(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'gpt') {
      response = await callGPT(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'chatgpt5') {
      response = await callGPT5(processedMessages, enhancedSystemPrompt, files);
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