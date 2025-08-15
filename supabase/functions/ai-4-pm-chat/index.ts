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
    console.log(`Processing PDF: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Convert base64 to array buffer
    const base64Data = file.content.replace(/^data:.*,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to string for text pattern matching
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    console.log('Attempting PDF text extraction...');
    
    // Multiple extraction strategies
    let extractedText = '';
    
    // Strategy 1: Look for stream content between 'stream' and 'endstream'
    const streamMatches = text.match(/stream\s*([\s\S]*?)\s*endstream/g) || [];
    const streamContent = streamMatches.map(match => {
      const content = match.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
      // Try to decode if it looks like text
      if (/[a-zA-Z0-9\s]/.test(content)) {
        return content;
      }
      return '';
    }).join(' ').trim();
    
    // Strategy 2: Look for text objects with Tj and TJ operators
    const textObjects = text.match(/\[([^\]]*)\]\s*TJ|BT([^E]*?)ET|\(([^)]+)\)\s*Tj/g) || [];
    const tjContent = textObjects.map(match => {
      // Extract text from different PDF text operators
      if (match.includes('TJ')) {
        const arrayMatch = match.match(/\[([^\]]*)\]/);
        if (arrayMatch) {
          return arrayMatch[1].replace(/[()]/g, '').trim();
        }
      } else if (match.includes('Tj')) {
        const parenMatch = match.match(/\(([^)]+)\)/);
        if (parenMatch) {
          return parenMatch[1].trim();
        }
      } else if (match.includes('BT') && match.includes('ET')) {
        const textMatch = match.match(/\(([^)]+)\)/g) || [];
        return textMatch.map(t => t.replace(/[()]/g, '')).join(' ');
      }
      return '';
    }).filter(text => text.length > 1).join(' ');
    
    // Strategy 3: Simple parentheses extraction (fallback)
    const textMatches = text.match(/\(([^)]{2,})\)/g) || [];
    const parenContent = textMatches
      .map(match => match.replace(/[()]/g, '').trim())
      .filter(text => text.length > 2 && /[a-zA-Z]/.test(text))
      .join(' ');
    
    // Combine all extraction methods
    extractedText = [streamContent, tjContent, parenContent]
      .filter(content => content.length > 10)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`PDF extraction result: ${extractedText.length} characters extracted`);
    
    if (extractedText.length > 50) {
      return `PDF CONTENT EXTRACTED FROM: ${file.name}

${extractedText}

[Note: PDF text extraction may not preserve exact formatting. For critical documents, please verify accuracy.]`;
    }

    // If extraction fails, provide clear instructions
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Automatic text extraction was unsuccessful.

This could be because:
1. The PDF contains scanned images rather than selectable text
2. The PDF uses complex formatting or encryption
3. The text is embedded in a way that requires specialized PDF parsing

RECOMMENDED SOLUTIONS:
1. Copy and paste the text directly from the PDF viewer
2. Convert the PDF to a Word document (.docx) or text file (.txt)
3. If it's a scanned document, use OCR software first

Please try uploading the content in a different format, or paste the text directly into your message.]`;
     
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Text extraction failed with error: ${error.message}

Please try:
1. Copying text manually from the PDF
2. Converting to .docx or .txt format
3. Ensuring the PDF contains selectable text (not just scanned images)]`;
  }
}

function extractPowerPointContent(file: UploadedFile): string {
  try {
    const fileName = file.name.toLowerCase();
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    console.log(`Processing PowerPoint: ${fileName}, size: ${fileSize}MB`);
    
    // Try to extract text from PowerPoint binary format
    try {
      const base64Data = file.content.replace(/^data:.*,/, '');
      const binaryString = atob(base64Data);
      
      console.log('Attempting PowerPoint text extraction...');
      
      // PowerPoint files contain XML structures we can extract from
      // Look for slide content, text boxes, and other readable content
      const textMatches = binaryString.match(/[\x20-\x7E]{4,}/g) || [];
      const extractedText = textMatches
        .filter(text => {
          // Filter for meaningful text content
          return /[a-zA-Z]/.test(text) && 
                 text.length > 3 && 
                 !text.match(/^[0-9.]+$/) && // Not just numbers
                 !text.match(/^[^a-zA-Z]*$/) && // Contains letters
                 !text.includes('<?xml') && // Not XML headers
                 !text.includes('Microsoft') && // Not software metadata
                 !text.includes('PowerPoint'); // Not software metadata
        })
        .slice(0, 50) // Limit output
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`PowerPoint extraction result: ${extractedText.length} characters extracted`);
      
      if (extractedText.length > 50) {
        return `POWERPOINT CONTENT EXTRACTED FROM: ${file.name}

Detected slide content:
${extractedText}

[Note: PowerPoint extraction may not preserve slide structure or formatting. For complete content, please export to PDF or copy text manually.]`;
      }
    } catch (pptError) {
      console.error('Error parsing PowerPoint binary:', pptError);
    }
    
    // Fallback instructions
    return `[PowerPoint File: ${file.name} (${fileSize}MB) - Automatic extraction was unsuccessful.

RECOMMENDED SOLUTIONS:
1. Export to PDF format for automatic text extraction
2. Copy and paste slide content directly into your message
3. Export as Word document (.docx) for better text extraction
4. Take screenshots of key slides and upload as images

For best results with PowerPoint analysis:
- Export to PDF and re-upload for automatic text extraction
- Copy slide content manually
- Use "Save As" > "Plain Text" to extract all text content

Please try uploading the content in a different format, or paste the slide content directly into your message.]`;
    
  } catch (error) {
    console.error('Error processing PowerPoint file:', error);
    return `[PowerPoint File: ${file.name} - Error processing file: ${error.message}. Please export to PDF or copy content manually.]`;
  }
}

function extractExcelContent(file: UploadedFile): string {
  try {
    const fileName = file.name.toLowerCase();
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    console.log(`Processing Excel/CSV: ${fileName}, size: ${fileSize}MB`);
    
    // Handle CSV files
    if (fileName.endsWith('.csv')) {
      try {
        let csvContent = '';
        
        // For CSV files, try to read as text
        if (file.content.startsWith('data:')) {
          const base64Data = file.content.replace(/^data:.*,/, '');
          csvContent = atob(base64Data);
        } else {
          csvContent = file.content;
        }
        
        console.log(`CSV extraction successful: ${csvContent.length} characters`);
        
        // Parse CSV content for better formatting
        const lines = csvContent.split('\n').filter(line => line.trim());
        const formattedContent = lines.map((line, index) => {
          if (index === 0) {
            return `Header: ${line}`;
          }
          return `Row ${index}: ${line}`;
        }).join('\n');
        
        return `CSV CONTENT EXTRACTED FROM: ${file.name}

${formattedContent}

[Note: CSV data has been parsed and formatted. Original structure preserved.]`;
        
      } catch (csvError) {
        console.error('Error parsing CSV:', csvError);
        return `[CSV File: ${file.name} - Error parsing CSV content. Please ensure it's a valid CSV file or paste the data directly.]`;
      }
    }
    
    // Handle Excel files (.xls, .xlsx)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        // Convert base64 to binary for analysis
        const base64Data = file.content.replace(/^data:.*,/, '');
        const binaryString = atob(base64Data);
        
        // Look for text patterns in Excel binary format
        // Excel files contain XML-like structures we can extract from
        const textMatches = binaryString.match(/[\x20-\x7E]{3,}/g) || [];
        const extractedText = textMatches
          .filter(text => /[a-zA-Z0-9]/.test(text) && text.length > 2)
          .filter(text => !text.match(/^[0-9.]+$/)) // Filter out pure numbers/decimals
          .slice(0, 100) // Limit to prevent huge outputs
          .join(' ');
        
        console.log(`Excel extraction result: ${extractedText.length} characters extracted`);
        
        if (extractedText.length > 50) {
          return `EXCEL CONTENT EXTRACTED FROM: ${file.name}

Detected text content:
${extractedText}

[Note: Excel extraction may not preserve exact cell structure or formulas. For precise data analysis, please export to CSV or copy data directly.]`;
        }
      } catch (excelError) {
        console.error('Error parsing Excel binary:', excelError);
      }
    }
    
    // Fallback instructions for Excel files or failed extraction
    return `[Excel File: ${file.name} (${fileSize}MB) - Automatic extraction was unsuccessful.

RECOMMENDED SOLUTIONS:
1. Export to CSV format for automatic processing
2. Copy and paste the spreadsheet data directly into your message
3. Take a screenshot of the data and upload as an image
4. Export to PDF or Word format

For best results with Excel analysis:
- Paste tabular data directly in your message
- Use CSV format for automatic parsing
- Include column headers when copying data

Please try uploading the content in a different format, or paste the data directly into your message.]`;
    
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return `[Excel File: ${file.name} - Error processing file: ${error.message}. Please copy data manually or convert to CSV format.]`;
  }
}

function extractImageContent(file: UploadedFile): string {
  try {
    const fileName = file.name.toLowerCase();
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    const fileType = file.content.split(';')[0]?.replace('data:', '') || 'unknown';
    
    console.log(`Processing image: ${fileName}, size: ${fileSize}MB, type: ${fileType}`);
    
    // For image files, provide base64 data for AI analysis
    if (file.content.startsWith('data:image/')) {
      console.log('Image has valid base64 data format - preparing for AI analysis');
      
      // Enhanced image analysis instructions
      return `IMAGE_ANALYSIS_REQUEST: Analyze this uploaded image for content extraction.

CRITICAL INSTRUCTIONS:
- Extract ANY visible text (handwritten, printed, typed)
- Describe visible content objectively
- DO NOT hallucinate or invent content not visible in the image
- If text is unclear, state "text unclear" rather than guessing
- Focus on accurate transcription and description

IMAGE DETAILS:
Filename: ${fileName}
Size: ${fileSize}MB
Format: ${fileType}
Purpose: Content extraction and analysis

ANALYSIS REQUIREMENTS:
1. Transcribe all visible text exactly as written
2. Describe document structure (forms, tables, notes, etc.)
3. Identify any signatures, stamps, or official markings
4. Note handwritten vs. printed text
5. Describe any diagrams, charts, or visual elements

Base64 Image Data:
${file.content}

Remember: Only describe what is actually visible in the image. Do not create fictional content.`;
    } else {
      console.log('Image does not have proper base64 format');
      return `[Image File: ${fileName} (${fileSize}MB) - Image format error. 

The uploaded file appears to be corrupted or in an unsupported format.

TROUBLESHOOTING:
1. Ensure the image is in a common format (JPG, PNG, GIF, WebP)
2. Try reducing the image size if it's very large
3. Re-upload the image
4. If the image contains text, consider scanning it again with better quality

Supported formats: JPG, PNG, GIF, WebP
Maximum recommended size: 10MB]`;
    }
    
  } catch (error) {
    console.error('Error processing image file:', error);
    return `[Image File: ${file.name} - Error processing image: ${error.message}

TROUBLESHOOTING STEPS:
1. Check that the image file isn't corrupted
2. Try re-uploading the image
3. Ensure the image is in a supported format (JPG, PNG, GIF, WebP)
4. If the image contains important text, try taking a clearer photo or scan

If the issue persists, you can describe the image content manually in your message.]`;
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
      system: systemPrompt + "\n\nCRITICAL: When analyzing uploaded images with handwritten text, you MUST transcribe only the actual visible text. DO NOT generate fictional content. DO NOT hallucinate clinical scenarios. Only describe what you can actually see written in the image.",
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

  const enhancedSystemPrompt = systemPrompt + "\n\nCRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:\n- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text\n- DO NOT generate fictional content, clinical scenarios, or patient information\n- DO NOT hallucinate or invent details not visible in the image\n- Only describe what you can actually see written or printed in the image\n- If text is unclear, state that it's unclear rather than guessing";

  const gptMessages = [
    { role: 'system', content: enhancedSystemPrompt }
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
      temperature: 0.1
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

  const enhancedSystemPrompt = systemPrompt + "\n\nCRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:\n- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text\n- DO NOT generate fictional content, clinical scenarios, or patient information\n- DO NOT hallucinate or invent details not visible in the image\n- Only describe what you can actually see written or printed in the image\n- If text is unclear, state that it's unclear rather than guessing\n- Focus on accurate transcription rather than interpretation";

  const gptMessages = [
    { role: 'system', content: enhancedSystemPrompt }
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
      model: 'gpt-5-2025-08-07',
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

  const enhancedSystemPrompt = systemPrompt + "\n\nCRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:\n- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text\n- DO NOT generate fictional content, clinical scenarios, or patient information\n- DO NOT hallucinate or invent details not visible in the image\n- Only describe what you can actually see written or printed in the image\n- If text is unclear, state that it's unclear rather than guessing";

  const grokMessages = [
    { role: 'system', content: enhancedSystemPrompt }
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
        temperature: 0.1
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

  const enhancedSystemPrompt = systemPrompt + "\n\nCRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:\n- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text\n- DO NOT generate fictional content, clinical scenarios, or patient information\n- DO NOT hallucinate or invent details not visible in the image\n- Only describe what you can actually see written or printed in the image\n- If text is unclear, state that it's unclear rather than guessing";

  // Format messages for Gemini
  let content = enhancedSystemPrompt + '\n\n';
  
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
        temperature: 0.1,
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