import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import mammoth from "https://esm.sh/mammoth@1.6.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const grokApiKey = Deno.env.get('GROK_API_KEY');
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
// Removed Tavily API key

// Removed Tavily search functionality to fix response errors

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

interface RequestBody {
  messages: Message[];
  model?: 'claude' | 'gpt' | 'grok-beta' | 'claude-4-opus' | 'claude-4-sonnet' | 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5-2025-08-07' | 'gpt-5' | 'gpt-5-mini-2025-08-07' | 'gpt-5-nano-2025-08-07' | 'gemini-ultra' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  systemPrompt: string;
  files?: UploadedFile[];
  verificationLevel?: string;
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

// PDF text extraction - Enhanced with vision model integration and OCR fallback
async function extractPdfContent(file: UploadedFile): Promise<string> {
  console.log(`Starting comprehensive PDF extraction for ${file.name}`);
  
  try {
    // Convert base64 to array buffer
    const base64Data = file.content.replace(/^data:.*,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to string for comprehensive text pattern matching
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const latin1Text = new TextDecoder('latin1').decode(bytes);
    
    console.log('Attempting traditional PDF text extraction...');
    
    const extractedParts = [];
    
    // Strategy 1: Extract from PDF text objects (most common)
    const textObjectRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let textObjectMatch;
    while ((textObjectMatch = textObjectRegex.exec(text)) !== null) {
      const textCommands = textObjectMatch[1];
      const textMatches = textCommands.match(/\(([^)]+)\)\s*(?:Tj|')|<([0-9A-Fa-f]+)>\s*(?:Tj|')|^\s*\(([^)]+)\)\s*$/gm) || [];
      const extractedFromObj = textMatches.map(match => {
        const parenMatch = match.match(/\(([^)]+)\)/);
        const hexMatch = match.match(/<([0-9A-Fa-f]+)>/);
        if (parenMatch) return parenMatch[1];
        if (hexMatch) {
          try {
            return hexMatch[1].match(/.{2}/g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') || '';
          } catch { return ''; }
        }
        return '';
      }).filter(t => t.trim().length > 0);
      
      if (extractedFromObj.length > 0) {
        extractedParts.push(extractedFromObj.join(' '));
      }
    }
    
    // Strategy 2: Extract from TJ arrays (for formatted text)
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjArrayRegex.exec(text)) !== null) {
      const arrayContent = tjMatch[1];
      const textElements = arrayContent.match(/\(([^)]+)\)/g) || [];
      const tjText = textElements.map(elem => elem.replace(/[()]/g, '')).join('');
      if (tjText.trim().length > 2) {
        extractedParts.push(tjText);
      }
    }
    
    // Strategy 3: Simple parentheses extraction (fallback)
    const simpleParenRegex = /\(([^)]{2,})\)/g;
    let parenMatch;
    const parenTexts = [];
    while ((parenMatch = simpleParenRegex.exec(text)) !== null) {
      const parenText = parenMatch[1].trim();
      if (parenText.length > 1 && /[a-zA-Z0-9]/.test(parenText)) {
        parenTexts.push(parenText);
      }
    }
    
    // Strategy 4: Stream content extraction
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(text)) !== null) {
      const streamContent = streamMatch[1];
      const readableText = streamContent.match(/[a-zA-Z0-9\s.,£$€¥¢]+/g) || [];
      const streamText = readableText.filter(t => t.trim().length > 3 && /[a-zA-Z]/.test(t)).join(' ');
      if (streamText.length > 10) {
        extractedParts.push(streamText);
      }
    }
    
    // Strategy 5: Try Latin1 encoding for older PDFs
    const latin1Regex = /\(([^)]{2,})\)/g;
    let latin1Match;
    const latin1Texts = [];
    while ((latin1Match = latin1Regex.exec(latin1Text)) !== null) {
      const latin1ParenText = latin1Match[1].trim();
      if (latin1ParenText.length > 1 && /[a-zA-Z0-9]/.test(latin1ParenText) && !extractedParts.includes(latin1ParenText)) {
        latin1Texts.push(latin1ParenText);
      }
    }
    
    // Strategy 6: Look for common invoice/document patterns
    const documentPatterns = [
      /Invoice[^a-zA-Z]*([A-Z0-9\-]{3,})/gi,
      /£\s*[\d,]+\.?\d*/g,
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
      /[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+Ltd)?/g,
      /Account[^0-9]*(\d+)/gi,
      /Sort[^0-9]*(\d{2}-\d{2}-\d{2})/gi
    ];
    
    const patternMatches = [];
    for (const pattern of documentPatterns) {
      const matches = text.match(pattern) || [];
      patternMatches.push(...matches);
    }
    
    // Combine traditional extraction results
    const allExtracted = [
      ...extractedParts,
      ...parenTexts,
      ...latin1Texts,
      ...patternMatches
    ].filter(t => t && t.trim().length > 1);
    
    const uniqueText = [...new Set(allExtracted)]
      .filter(text => text.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Traditional extraction result: ${uniqueText.length} characters from ${allExtracted.length} elements`);
    
    // If traditional extraction succeeds with substantial content, return it
    if (uniqueText.length > 100) {
      return `PDF CONTENT EXTRACTED FROM: ${file.name}

${uniqueText}

[Note: PDF text extracted using traditional parsing methods.]`;
    }
    
    // Check if this might be an image-based PDF
    const hasImages = text.includes('/Image') || text.includes('/XObject');
    const hasMinimalText = uniqueText.length < 50;
    
    if (hasImages && hasMinimalText) {
      console.log('Detected image-based PDF - attempting vision model extraction');
      
      // Strategy 7: Vision Model Analysis (ChatGPT-style)
      const visionResult = await extractPdfWithVision(file);
      if (visionResult && visionResult.length > 100) {
        console.log(`Vision extraction successful: ${visionResult.length} characters extracted`);
        return visionResult;
      }
    } else {
      console.log('PDF appears to have some text content, but trying vision model anyway for completeness');
      
      // Also try vision model for text-based PDFs that might have complex layouts
      const visionResult = await extractPdfWithVision(file);
      if (visionResult && visionResult.length > uniqueText.length + 50) {
        console.log(`Vision extraction provided better results: ${visionResult.length} vs ${uniqueText.length} characters`);
        return visionResult;
      }
    }
    
    // Strategy 8: OCR Fallback
    console.log('Attempting OCR fallback extraction');
    const ocrResult = await extractPdfWithOCR(file);
    if (ocrResult && ocrResult.length > 100) {
      console.log(`OCR extraction successful: ${ocrResult.length} characters extracted`);
      return ocrResult;
    }
    
    // Final fallback with enhanced guidance
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Advanced extraction unsuccessful]

Extracted basic patterns: ${uniqueText || 'None detected'}

This PDF requires alternative processing:

**RECOMMENDED SOLUTIONS:**
1. **For scanned/image PDFs**: Take screenshots and upload as images - the AI can analyze images very effectively
2. **Copy-paste method**: Open PDF and manually copy the text content  
3. **Format conversion**: Export as Word (.docx) or plain text (.txt)
4. **OCR tools**: Use online OCR before uploading

**For invoice analysis specifically:**
- Screenshot the invoice and upload as an image
- The vision AI can extract all details from invoice images
- Much more reliable than PDF text extraction for complex layouts

Would you like to try uploading this as an image instead?`;
     
  } catch (error) {
    console.error('PDF extraction error:', error);
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    return `[PDF File: ${file.name} (${fileSize}MB) - Extraction failed: ${error.message}]

Please try: Screenshot → Upload as image for AI analysis`;
  }
}

// Vision Model PDF Analysis (matches ChatGPT approach)
async function extractPdfWithVision(file: UploadedFile): Promise<string | null> {
  console.log('Starting vision model PDF analysis');
  
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('OpenAI API key not available for vision analysis');
      return null;
    }
    
    // Re-enable vision processing for PDFs with proper handling
    let imageData = file.content;
    
    // For PDF files, treat the base64 content as image data for vision processing
    if (file.name.toLowerCase().endsWith('.pdf')) {
      console.log('Processing PDF with vision model');
      imageData = file.content; // Already in data URL format
    }
    
    const systemPrompt = `You are an expert document analyzer specializing in PDF and document text extraction. 
Extract ALL visible text from this document with complete accuracy.

EXTRACTION REQUIREMENTS:
- Extract EVERY piece of visible text
- Include ALL: names, addresses, numbers, dates, amounts
- Include ALL: line items, descriptions, totals
- Preserve structure where possible
- If text is unclear, extract what you can see and note [unclear]

Return complete extracted text preserving document structure.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use more reliable vision model
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract ALL text content from this document:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high'
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Vision API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content;
    
    if (extractedText && extractedText.length > 50) {
      console.log(`Vision model successfully extracted ${extractedText.length} characters`);
      return `DOCUMENT CONTENT EXTRACTED FROM: ${file.name}

${extractedText}

[Content extracted using AI Vision technology]`;
    }
    
    console.log('Vision model returned insufficient content');
    return null;
    
  } catch (error) {
    console.error('Vision model extraction error:', error);
    return null;
  }
}

// OCR Fallback using Google Vision API
async function extractPdfWithOCR(file: UploadedFile): Promise<string | null> {
  console.log('Starting OCR fallback extraction');
  
  try {
    const googleVisionKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!googleVisionKey) {
      console.log('Google Vision API key not available for OCR');
      return null;
    }
    
    // Convert PDF to image format for OCR
    const base64Data = file.content.split(',')[1];
    
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleVisionKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64Data
          },
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }]
        }]
      }),
    });

    if (!response.ok) {
      console.log(`OCR API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const extractedText = data.responses[0]?.fullTextAnnotation?.text;
    
    if (extractedText && extractedText.length > 50) {
      console.log('OCR successfully extracted text from PDF');
      return `PDF CONTENT EXTRACTED FROM: ${file.name} (Using OCR)

${extractedText}

[Note: Content extracted using OCR technology for text recognition from image-based documents.]`;
    }
    
    return null;
  } catch (error) {
    console.error('OCR extraction error:', error);
    return null;
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

  console.log('Calling GPT-5 with web search tools...');
  console.log('Messages count:', messages.length);
  console.log('System prompt length:', systemPrompt.length);
  console.log('Files count:', files?.length || 0);

  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const enhancedSystemPrompt = `You are "AI 4 GP Service" for UK NHS primary care.
Today is ${today} (Europe/London).

For time-sensitive questions about BNF/NICE updates, DHSC/NHSE policy, Wes Streeting announcements, ARRS, vaccination programmes, provide the best guidance you can from your training data and suggest users check the latest information at the relevant official sources (gov.uk, england.nhs.uk, nhs.uk, nice.org.uk, bnf.nice.org.uk, ukhsa.gov.uk).

${systemPrompt}

CRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:
- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text
- DO NOT generate fictional content, clinical scenarios, or patient information
- DO NOT hallucinate or invent details not visible in the image
- Only describe what you can actually see written or printed in the image
- If text is unclear, state that it's unclear rather than guessing`;

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

  // First completion - check for tool calls
  console.log('Making initial GPT-5 API call...');
  console.log('Request body preview:', {
    model: 'gpt-5-2025-08-07',
    max_completion_tokens: 4000,
    messageCount: gptMessages.length,
    hasTools: true
  });
  
  const initial = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      max_completion_tokens: 4000, // GPT-5 uses max_completion_tokens
      // Note: GPT-5 doesn't support temperature parameter
      messages: gptMessages
    })
  });

  if (!initial.ok) {
    const error = await initial.text();
    console.error('OpenAI API error:', error);
    console.error('API response status:', initial.status);
    console.error('API response headers:', Object.fromEntries(initial.headers.entries()));
    
    // Check for quota exceeded error specifically
    if (initial.status === 429 || error.includes('insufficient_quota')) {
      throw new Error(`OpenAI API quota exceeded (429): ${error}`);
    }
    
    // Check for unsupported model - fallback to GPT-4o
    if (initial.status === 404 || error.includes('model') || error.includes('not found')) {
      console.log('GPT-5 not available, falling back to GPT-4o');
      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 4000,
          temperature: 0.7,
          messages: gptMessages
        })
      });
      
      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text();
        throw new Error(`OpenAI API fallback error: ${fallbackResponse.status} - ${fallbackError}`);
      }
      
      const fallbackData = await fallbackResponse.json();
      return fallbackData.choices[0].message.content;
    }
    
    throw new Error(`OpenAI API error: ${initial.status}`);
  }

  const initialData = await initial.json();
  console.log('GPT-5 API response received successfully');
  console.log('Response structure:', {
    hasChoices: !!initialData.choices,
    choicesLength: initialData.choices?.length,
    hasMessage: !!initialData.choices?.[0]?.message,
    hasToolCalls: !!initialData.choices?.[0]?.message?.tool_calls,
    toolCallsCount: initialData.choices?.[0]?.message?.tool_calls?.length || 0
  });
  
  const choice = initialData.choices?.[0];
  console.log('Initial completion result - GPT-5 response received successfully');
  console.log('Response length:', choice?.message?.content?.length || 0);

  // Return the direct response since we're not using tools anymore
  return choice?.message?.content || 'No response received from GPT-5';
  if (!finalContent || finalContent.trim() === '' || finalContent === 'No response received') {
    console.error('ERROR: GPT-5 returned empty or invalid response');
    return 'I apologize, but I encountered an issue generating a response. Please try again.';
  }
  
  return finalContent;
}

async function callGPT4Turbo(messages: Message[], systemPrompt: string, files?: UploadedFile[]): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('Calling GPT-4 Turbo with web search tools...');

  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const enhancedSystemPrompt = `You are "AI 4 GP Service" for UK NHS primary care.
Today is ${today} (Europe/London).

If a question is time-sensitive (BNF/NICE updates, DHSC/NHSE policy, Wes Streeting announcements, ARRS, vaccination programmes),
CALL tavily_search first with a recency window and an allow-list:
["gov.uk","england.nhs.uk","nhs.uk","nice.org.uk","bnf.nice.org.uk","ukhsa.gov.uk"].

Never write "I will search now" unless you actually call tavily_search.
Always include dates + sources. If nothing recent is found, say what you searched.

${systemPrompt}

CRITICAL INSTRUCTIONS FOR IMAGE ANALYSIS:
- When analyzing uploaded images with handwritten or printed text, you MUST transcribe ONLY the actual visible text
- DO NOT generate fictional content, clinical scenarios, or patient information
- DO NOT hallucinate or invent details not visible in the image
- Only describe what you can actually see written or printed in the image
- If text is unclear, state that it's unclear rather than guessing`;

  // Removed tools - direct response only

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

  // First completion - check for tool calls
  const initial = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 1400,
      tools,
      tool_choice: "auto",
      messages: gptMessages
    })
  });

  if (!initial.ok) {
    const error = await initial.text();
    console.error('OpenAI API error:', error);
    
    // Check for quota exceeded error specifically
    if (initial.status === 429 || error.includes('insufficient_quota')) {
      throw new Error(`OpenAI API quota exceeded (429): ${error}`);
    }
    
    throw new Error(`OpenAI API error: ${initial.status}`);
  }

  const initialData = await initial.json();
  const choice = initialData.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];

  console.log('Initial completion result:', JSON.stringify({
    choices: initialData.choices?.length,
    hasToolCalls: !!toolCalls.length,
    toolCallDetails: toolCalls.map(tc => ({ name: tc.function?.name, args: tc.function?.arguments }))
  }));
  console.log('Tool calls detected:', toolCalls.length);

  if (toolCalls.length > 0) {
    // Handle tool calls
    for (const call of toolCalls) {
      if (call.function.name === "tavily_search") {
        console.log('Executing tavily_search...');
        const args = JSON.parse(call.function.arguments);
        console.log('Search args:', args);
        
        try {
          const tavilyResults = await runTavilySearch(args.q, args.recencyDays, args.siteLimit);
          
          // Add the assistant message with tool call
          gptMessages.push({
            role: "assistant",
            content: choice.message.content ?? "",
            tool_calls: toolCalls
          });

          // Add the tool result
          gptMessages.push({
            role: "tool",
            name: "tavily_search",
            tool_call_id: call.id,
            content: JSON.stringify(tavilyResults)
          });

          // Second completion with tool results
          console.log('Running final completion with search results...');
          const final = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              temperature: 0.2,
              max_tokens: 1400,
              tools,
              messages: gptMessages
            })
          });

          if (!final.ok) {
            const error = await final.text();
            console.error('OpenAI final API error:', error);
            throw new Error(`OpenAI API error: ${final.status}`);
          }

          const finalData = await final.json();
          return finalData.choices[0].message.content;
        } catch (searchError) {
          console.error('Error in tavily search:', searchError);
          // Continue with original response if search fails
          return choice.message.content || "I encountered an error while searching for recent information.";
        }
      }
    }
  }

  // No tool calls, return the initial response
  return choice.message.content;
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
    console.log('🚀 AI-4-PM-Chat function started');
    console.log('📝 Request method:', req.method);
    console.log('📝 Request headers:', Object.fromEntries(req.headers.entries()));
    
    const requestBody = await req.json();
    console.log('📝 Request body keys:', Object.keys(requestBody));
    
    const { messages, model, systemPrompt, files, verificationLevel }: RequestBody = requestBody;

    // Check API key availability
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GROK_API_KEY = Deno.env.get('GROK_API_KEY'); 
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('API Keys status:', {
      openai: OPENAI_API_KEY ? 'Set' : 'Missing',
      anthropic: ANTHROPIC_API_KEY ? 'Set' : 'Missing',
      grok: GROK_API_KEY ? 'Set' : 'Missing',
      gemini: GEMINI_API_KEY ? 'Set' : 'Missing'
    });

    console.log(`Processing request with model: ${model || 'undefined'}`);
    console.log(`Messages count: ${messages?.length || 0}`);
    console.log('SystemPrompt:', systemPrompt ? 'Present' : 'Missing');
    console.log('Messages content check:', messages?.map(m => ({ role: m.role, hasContent: !!m.content })) || 'No messages');

    // Default to gpt-4-turbo if no model specified
    const selectedModel = model || 'gpt-4-turbo';
    console.log(`Using model: ${selectedModel}`);

    // Process uploaded files to extract text content
    const processedMessages = await Promise.all(
      messages.map(async (message) => {
        if (message.files && message.files.length > 0) {
          console.log(`Processing ${message.files.length} files for message`);
          
          // Extract text content from each file with intelligent content management
          const processedFiles = await Promise.all(
            message.files.map(async (file) => {
              console.log(`Extracting content from: ${file.name} (${file.type})`);
              let extractedContent = await extractFileContent(file);
              
              // Implement intelligent content management for large files
              const maxFileContentLength = 50000; // Per file limit to avoid token issues
              if (extractedContent.length > maxFileContentLength) {
                console.log(`File ${file.name} content too large (${extractedContent.length} chars), truncating to ${maxFileContentLength} chars`);
                extractedContent = extractedContent.substring(0, maxFileContentLength) + '\n\n[CONTENT TRUNCATED DUE TO SIZE - Only first portion shown]';
              }
              
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

    // Optimized system prompt - no more Tavily injection, let OpenAI handle web search
    const today = new Date().toISOString().split('T')[0];
    const enhancedSystemPrompt = systemPrompt + `\nCURRENT DATE: ${today}`;
    
    console.log('Using optimized AI4GP with live source verification capabilities');
    console.log('Verification level:', verificationLevel);

    // Add live source verification context if enabled
    let sourceContext = '';
    if (verificationLevel && verificationLevel !== 'standard') {
      try {
        console.log('Fetching live sources via smart router...');
        const routerResponse = await fetch(`https://dphcnbricafkbtizkoal.supabase.co/functions/v1/smart-source-router`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ 
            query: messages[messages.length - 1]?.content || '',
            verificationLevel,
            maxSources: verificationLevel === 'maximum' ? 5 : 3
          })
        });

        if (routerResponse.ok) {
          const routerData = await routerResponse.json();
          if (routerData.sources && routerData.sources.length > 0) {
            sourceContext = `\n\nLIVE SOURCE VERIFICATION DATA:\n${routerData.sources.map((s: any) => 
              `Source: ${s.source} (${s.url})\nConfidence: ${s.confidence}\nContent: ${s.content}\nLast Updated: ${s.lastUpdated || 'Unknown'}\n`
            ).join('\n')}\n\nVerification Panel: Sources checked - ${routerData.verificationPanel.sourcesChecked.join(', ')}, Confidence Score: ${routerData.verificationPanel.confidenceScore}`;
            console.log('Live sources integrated successfully');
          }
        }
      } catch (error) {
        console.error('Error fetching live sources:', error);
      }
    }

    // Create final system prompt by combining enhanced prompt with source context
    const finalSystemPrompt = enhancedSystemPrompt + sourceContext;

  // Initialize response variable
  let response: string = '';
  
  console.log('About to route to model:', selectedModel);

  // Model routing with proper mapping
  if (selectedModel === 'claude' || selectedModel === 'claude-4-opus' || selectedModel === 'claude-4-sonnet') {
    response = await callClaude(processedMessages, finalSystemPrompt, files);
  } else if (selectedModel === 'gpt-5-2025-08-07' || selectedModel === 'gpt-5' || selectedModel === 'gpt-5-mini-2025-08-07' || selectedModel === 'gpt-5-nano-2025-08-07') {
    // Use GPT-5 function for GPT-5 models with fallback
    try {
      console.log('Calling GPT-5...');
      response = await callGPT5(processedMessages, finalSystemPrompt, files);
      console.log('GPT-5 response received:', !!response, 'Length:', response?.length || 0);
      
      // Ensure we have a valid response
      if (!response || response.trim() === '') {
        console.log('GPT-5 returned empty response, falling back to GPT-4 Turbo');
        response = await callGPT4Turbo(processedMessages, finalSystemPrompt, files);
      }
    } catch (error) {
      console.log('GPT-5 failed, falling back to GPT-4 Turbo:', error.message);
      response = await callGPT4Turbo(processedMessages, finalSystemPrompt, files);
    }
  } else if (selectedModel === 'gpt' || selectedModel === 'gpt-4-turbo' || selectedModel === 'gpt-4o' || selectedModel === 'gpt-4o-mini' || !selectedModel) {
    // Use GPT-4 Turbo for legacy models
    response = await callGPT4Turbo(processedMessages, finalSystemPrompt, files);
  } else if (selectedModel === 'grok-beta') {
    response = await callGrok(processedMessages, finalSystemPrompt, files);
  } else if (selectedModel === 'gemini-ultra' || selectedModel === 'gemini-1.5-pro') {
    response = await callGemini(processedMessages, finalSystemPrompt, 'gemini-1.5-pro', files);
  } else if (selectedModel === 'gemini-1.5-flash') {
    response = await callGemini(processedMessages, finalSystemPrompt, 'gemini-1.5-flash', files);
  } else {
    // Fallback to GPT-4 Turbo for any unsupported model
    console.log(`Unsupported model ${selectedModel}, falling back to GPT-4 Turbo`);
    response = await callGPT4Turbo(processedMessages, finalSystemPrompt, files);
  }
  
  console.log('Model call completed successfully');
  console.log('Response received:', !!response);
  console.log('Response length:', response?.length || 0);
  console.log('Response preview:', response?.substring(0, 200) + '...');
  
  // Final validation before returning
  if (!response || response.trim() === '') {
    console.error('ERROR: Empty response from model, this should not happen');
    response = 'I apologize, but I encountered an issue generating a response. Please try again.';
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
    console.error('Error stack:', error.stack);
    console.error('Request details:', { 
      selectedModel, 
      verificationLevel, 
      messageCount: messages.length,
      hasFiles: !!files?.length 
    });
    
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    console.error('Final error message:', errorMessage);

    // Handle OpenAI quota exceeded error with helpful message
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
      const quotaExceededResponse = `I apologize, but I'm currently experiencing API quota limitations. This means I've reached the usage limit for my primary AI service.

**What this means:**
- The OpenAI API quota has been exceeded
- This is a temporary billing/usage limit issue
- Your question is valid, but I cannot process it right now

**Immediate solutions:**
1. **Wait and retry** - Quotas typically reset monthly
2. **Contact system administrator** - They can check billing and upgrade limits
3. **Use alternative features** - Other parts of the system may still work

**For clinical questions:**
- Please consult official NHS guidance directly
- Speak with colleagues or senior clinicians
- Use established clinical decision support tools

I'll be back online once the API quota is restored. Thank you for your patience.`;

      return new Response(JSON.stringify({
        content: quotaExceededResponse,
        success: true,
        quotaExceeded: true,
        timeToFirstWords: 100,
        apiResponseTime: 0,
        model: 'fallback-system'
      }), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        response: `Error: ${errorMessage}`,
        error: errorMessage,
        success: false 
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