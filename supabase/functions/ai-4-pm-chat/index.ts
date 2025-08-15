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
  model: 'claude' | 'gpt' | 'chatgpt5' | 'grok-beta' | 'claude-4-opus' | 'claude-4-sonnet' | 'gpt-4-turbo' | 'gemini-ultra' | 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gpt-5';
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
    
    // Handle Excel files
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || fileType.includes('spreadsheet')) {
      return extractExcelContent(file);
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
    
    // Handle images (for OCR or analysis)
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.gif') || fileName.endsWith('.webp') || fileType.includes('image/')) {
      return extractImageContent(file);
    }
    
    // For other file types, return the original content (might be base64)
    console.log(`Unsupported file type: ${fileName}, type: ${fileType}`);
    return `[File: ${file.name} - Content extraction not supported for this file type. Please convert to .txt, .docx, .xlsx format for full text extraction.]`;
    
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

function extractExcelContent(file: UploadedFile): string {
  try {
    const fileName = file.name.toLowerCase();
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    // Handle CSV files
    if (fileName.endsWith('.csv')) {
      // For CSV files, try to read as text
      if (file.content.startsWith('data:')) {
        const base64Data = file.content.replace(/^data:.*,/, '');
        const csvContent = atob(base64Data);
        return `[CSV File: ${file.name}]\n\nContent:\n${csvContent}`;
      } else {
        return `[CSV File: ${file.name}]\n\nContent:\n${file.content}`;
      }
    }
    
    // For Excel files (.xls, .xlsx), provide instructions
    return `[Excel File: ${file.name} (${fileSize}MB) - For best results with Excel files, please:
1. Open your Excel file
2. Copy the data from relevant sheets
3. Paste directly in your message
4. Or export to CSV format for automatic processing

Excel automatic data extraction is limited. Converting to CSV or copying data directly will provide better results.

If this file contains tabular data that you'd like me to analyze, please paste the data directly in your message.]`;
    
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return `[Excel File: ${file.name} - Error processing file. Please copy data manually or convert to CSV format.]`;
  }
}

function extractImageContent(file: UploadedFile): string {
  try {
    const fileName = file.name.toLowerCase();
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    console.log(`Processing image: ${fileName}, size: ${fileSize}MB`);
    
    // For image files, provide base64 data for AI analysis
    if (file.content.startsWith('data:image/')) {
      console.log('Image has valid base64 data format');
      
      // Return the image in a format that AI models can properly analyze
      return `IMAGE_ANALYSIS_REQUEST: Please analyze this image for handwritten or printed text extraction.

Filename: ${file.name}
Size: ${fileSize}MB
Format: ${file.content.split(';')[0].replace('data:', '')}

IMPORTANT: This is a real image upload that requires actual analysis. Please extract any visible text, especially handwritten content, and provide a detailed transcription.

Base64 Image Data:
${file.content}`;
    } else {
      console.log('Image does not have proper base64 format');
      return `[Image File: ${file.name} (${fileSize}MB) - Image format error. Please ensure the image is properly uploaded.]`;
    }
    
  } catch (error) {
    console.error('Error processing image file:', error);
    return `[Image File: ${file.name} - Error processing image: ${error.message}. Please try uploading again.]`;
  }
}

async function callClaude(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Format messages for Claude
  const claudeMessages = messages.map(msg => {
    let content = msg.content || '';
    
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
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

  const gptMessages = [
    { role: 'system', content: systemPrompt }
  ];

  messages.forEach(msg => {
    let content = msg.content || '';
    
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
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

  const gptMessages = [
    { role: 'system', content: systemPrompt }
  ];

  messages.forEach(msg => {
    let content = msg.content || '';
    
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
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
      max_completion_tokens: 4000
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

async function callGrok(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const grokApiKey = Deno.env.get('GROK_API_KEY');
  if (!grokApiKey) {
    throw new Error('Grok API key not configured');
  }

  console.log('Calling Grok API...');

  const grokMessages = [
    { role: 'system', content: systemPrompt }
  ];

  messages.forEach(msg => {
    let content = msg.content || '';
    
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
    if (!content.trim()) {
      content = '[No message content]';
    }
    
    grokMessages.push({
      role: msg.role,
      content
    });
  });

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: grokMessages,
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error response:', errorText);
      console.error('Grok API status:', response.status);
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Grok API response received successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected Grok API response structure:', data);
      throw new Error('Unexpected response structure from Grok API');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Grok API:', error);
    throw error;
  }
}

async function callGemini(messages: Message[], systemPrompt: string, model: string = 'gemini-1.5-pro', files?: UploadedFile[]): Promise<string> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  console.log(`Calling Gemini API with model: ${model}...`);

  // Format messages for Gemini
  let content = systemPrompt + '\n\n';
  
  messages.forEach(msg => {
    content += `${msg.role}: `;
    content += msg.content || '[No message content]';
    
    if (msg.files && msg.files.length > 0) {
      const fileContent = msg.files.map(file => 
        `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
      ).join('');
      content += fileContent;
    }
    
    content += '\n\n';
  });

  // Ensure correct model format for Gemini API
  const modelPath = model.includes('gemini-') ? model : `gemini-${model}`;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelPath}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: content }]
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
    const today = new Date().toISOString().split('T')[0];
    enhancedSystemPrompt += `\nCURRENT DATE: ${today}`;
    if (enableWebSearch) {
      const lastUserMessage = processedMessages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        try {
          const tavilyKey = Deno.env.get('TAVILY_API_KEY');
          if (tavilyKey) {
            // Extract key terms from the user's message, limiting to 300 chars for safety
            let query = lastUserMessage.content.replace(/\n--- File:.*?--- End of.*?---/gs, '').trim();
            
            // If query is still too long, extract key medical/healthcare terms
            if (query.length > 300) {
              // Extract key terms (medical conditions, drugs, procedures, etc.)
              const keyTerms = query.match(/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[a-z]+(?:ide|ine|ate|tion|osis|itis|oma|pathy|therapy|treatment|drug|medicine|NHS|NICE|BNF|CQC|GP|prescription|patient|clinical|diagnosis|symptoms?))\b/g);
              
              if (keyTerms && keyTerms.length > 0) {
                query = keyTerms.slice(0, 10).join(' ').slice(0, 300);
              } else {
                // Fallback: take first few words
                query = query.split(' ').slice(0, 20).join(' ').slice(0, 300);
              }
            }
            
            console.log(`Running Tavily web search for: ${query}\n`);
            const tavilyResp = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: tavilyKey,
                query,
                search_depth: 'advanced',
                max_results: 8,
                time_range: 'year',
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
                  'www.parliament.uk',
                  'www.bbc.co.uk',
                  'www.bbc.com',
                  'www.hsj.co.uk',
                  'www.nhsconfed.org',
                  'www.theguardian.com',
                  // Local and regional sources requested (excluding Northants Telegraph)
                  'www.northamptonchron.co.uk',
                  'www.itv.com',
                  'www.nhft.nhs.uk',
                  'www.northnorthants.gov.uk',
                  'www.westnorthants.gov.uk',
                  'www.heart.co.uk',
                  'planetradio.co.uk',
                  // GP trade press
                  'www.pulsetoday.co.uk'
                ]
              })
            });
            if (tavilyResp.ok) {
              const data = await tavilyResp.json();
              const results = Array.isArray(data.results) ? data.results : [];
              const summary = (data.answer || '').toString().trim();

              // Strict recency filter: keep items within ~120 days when a date is present
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 120);
              const dated = results.filter((r: any) => {
                const ds = (r.published_date || r.date || r.published_at || '').toString();
                const d = ds ? new Date(ds) : null;
                return d && !isNaN(d.getTime()) && d >= cutoff;
              });
              const used = dated.length > 0 ? dated : results;

              const formatted = used.slice(0, 8).map((r: any) => {
                const url = r.url || r.link || '';
                let host = '';
                try { host = new URL(url).host; } catch {}
                const date = (r.published_date || r.date || r.published_at || '').toString();
                const snippet = (r.content || r.snippet || r.answer || '').replace(/\s+/g, ' ').slice(0, 220);
                return `- ${r.title || 'Untitled'} — ${host}${date ? ' — ' + date : ''}\n  ${url}\n  ${snippet}`;
              }).join('\n');

              enhancedSystemPrompt += `\n\nDIRECTIONS: When RECENT WEB SEARCH RESULTS are present, base your answer ONLY on them. Do not rely on memory for policy/personnel status. If no items are within the last 120 days, explicitly state that and avoid outdated statements. Always cite source URLs with publication dates.\n`;

              if (summary) {
                enhancedSystemPrompt += `\nRECENT WEB SEARCH SUMMARY:\n${summary}\n`;
              }
              if (formatted) {
                const recencyNote = dated.length === 0 ? "\n[Note: No items with clear dates in the last 120 days were found; verify before asserting 'recent' changes.]\n" : '';
                enhancedSystemPrompt += `\nRECENT WEB SEARCH RESULTS (authoritative UK health sources, last ~120 days):\n${formatted}${recencyNote}`;
                console.log(`Tavily results total=${results.length}, recent=${dated.length}`);
              }
            } else {
              const errorText = await tavilyResp.text();
              console.log(`Tavily search failed: ${errorText}`);
              
              // If query too long, try with a shorter version
              if (errorText.includes('too long')) {
                console.log('Retrying with shorter query...');
                const shortQuery = query.split(' ').slice(0, 5).join(' ').slice(0, 100);
                console.log(`Retry query: ${shortQuery}`);
                
                const retryResp = await fetch('https://api.tavily.com/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    api_key: tavilyKey,
                    query: shortQuery,
                    search_depth: 'basic',
                    max_results: 5,
                    include_answer: true,
                    include_raw_content: false,
                    include_images: false
                  })
                });
                
                if (retryResp.ok) {
                  const retryData = await retryResp.json();
                  const retryResults = Array.isArray(retryData.results) ? retryData.results : [];
                  if (retryResults.length > 0) {
                    const retryFormatted = retryResults.slice(0, 3).map((r: any) => {
                      const url = r.url || r.link || '';
                      let host = '';
                      try { host = new URL(url).host; } catch {}
                      const snippet = (r.content || r.snippet || '').replace(/\s+/g, ' ').slice(0, 150);
                      return `- ${r.title || 'Untitled'} — ${host}\n  ${snippet}`;
                    }).join('\n');
                    
                    enhancedSystemPrompt += `\n\nLIMITED WEB SEARCH RESULTS:\n${retryFormatted}`;
                  }
                }
              }
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

    // Model routing with proper mapping
    if (model === 'claude' || model === 'claude-4-opus' || model === 'claude-4-sonnet') {
      response = await callClaude(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'gpt' || model === 'gpt-4-turbo') {
      response = await callGPT(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'chatgpt5' || model === 'gpt-5') {
      response = await callGPT5(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'grok-beta') {
      response = await callGrok(processedMessages, enhancedSystemPrompt, files);
    } else if (model === 'gemini-ultra' || model === 'gemini-1.5-pro') {
      response = await callGemini(processedMessages, enhancedSystemPrompt, 'gemini-1.5-pro', files);
    } else if (model === 'gemini-1.5-flash') {
      response = await callGemini(processedMessages, enhancedSystemPrompt, 'gemini-1.5-flash', files);
    } else {
      throw new Error(`Unsupported model: ${model}`);
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