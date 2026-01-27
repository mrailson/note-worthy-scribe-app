import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ZipReader, BlobReader, TextWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Proper DOCX text extraction using ZIP library
async function extractFromDocx(buffer: Uint8Array): Promise<string> {
  try {
    // Create a blob from the buffer
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    // Create a ZipReader to read the DOCX (which is a ZIP archive)
    const zipReader = new ZipReader(new BlobReader(blob));
    
    // Get all entries in the ZIP
    const entries = await zipReader.getEntries();
    
    // Find the main document.xml file (contains the document content)
    const documentEntry = entries.find(entry => 
      entry.filename === 'word/document.xml'
    );
    
    if (!documentEntry) {
      await zipReader.close();
      console.error('No document.xml found in DOCX');
      return 'Unable to extract text from this DOCX file - document.xml not found.';
    }
    
    // Extract the XML content
    const xmlContent = await documentEntry.getData!(new TextWriter());
    await zipReader.close();
    
    // Parse the XML to extract text from <w:t> tags
    const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    
    if (!textMatches || textMatches.length === 0) {
      console.log('No w:t tags found, trying alternative extraction');
      // Fallback: try to find any text content
      const allText = xmlContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return allText || 'Unable to extract text from this DOCX file.';
    }
    
    // Extract text content, preserving paragraph structure
    const paragraphs: string[] = [];
    let currentParagraph = '';
    
    // Split by paragraph markers
    const xmlParts = xmlContent.split(/<w:p[^>]*>/);
    
    for (const part of xmlParts) {
      const textInPart = part.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (textInPart) {
        const paragraphText = textInPart
          .map(match => match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
          .join('');
        if (paragraphText.trim()) {
          paragraphs.push(paragraphText.trim());
        }
      }
    }
    
    const extractedText = paragraphs.join('\n\n');
    
    if (extractedText.length < 50) {
      // If we got very little text, try a simpler extraction
      const simpleText = textMatches
        .map(match => match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return simpleText || 'Unable to extract meaningful text from this DOCX file.';
    }
    
    return extractedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return `Error extracting text from DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Simple PDF text extraction
async function extractFromPdf(buffer: Uint8Array): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(buffer);
    
    // PDF text is often stored in stream objects
    // Look for text between BT (Begin Text) and ET (End Text) markers
    const textBlocks: string[] = [];
    
    // Extract text from stream objects
    const streamMatches = content.match(/stream[\s\S]*?endstream/g);
    if (streamMatches) {
      for (const stream of streamMatches) {
        // Look for text operators: Tj, TJ, ', "
        const textMatches = stream.match(/\(([^)]+)\)\s*Tj/g);
        if (textMatches) {
          textMatches.forEach(match => {
            const text = match.replace(/\(|\)\s*Tj/g, '');
            if (text.length > 1) {
              textBlocks.push(text);
            }
          });
        }
        
        // Also try to extract readable ASCII
        const readableText = stream
          .replace(/[^\x20-\x7E\n\r]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (readableText.length > 50) {
          textBlocks.push(readableText);
        }
      }
    }
    
    // Fallback: extract any readable text
    if (textBlocks.length === 0) {
      const readableContent = content
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Filter out PDF structure keywords
      const filtered = readableContent
        .replace(/\/[A-Z][a-zA-Z]+/g, ' ')
        .replace(/\b(obj|endobj|stream|endstream|xref|trailer)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (filtered.length > 100) {
        return filtered;
      }
    }
    
    const result = textBlocks.join(' ').replace(/\s+/g, ' ').trim();
    return result || 'Unable to extract text from this PDF. It may be scanned or image-based. Please provide a text-based PDF.';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return 'Error extracting text from PDF file.';
  }
}

// Plain text extraction
function extractFromTxt(buffer: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);
  
  return text
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\r\n/g, '\n')
    .trim();
}

// Detect policy type from content
function detectPolicyType(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  const policyPatterns: [RegExp, string][] = [
    [/safeguard.*child|child.*protect/i, 'Safeguarding Children Policy'],
    [/safeguard.*adult|adult.*protect|vulnerable.*adult/i, 'Safeguarding Adults Policy'],
    [/infection.*control|infection.*prevent/i, 'Infection Prevention and Control Policy'],
    [/data.*protect|gdpr|information.*governance/i, 'Data Protection Policy'],
    [/complaint|complaint.*procedure/i, 'Complaints Policy'],
    [/consent|patient.*consent|informed.*consent/i, 'Consent Policy'],
    [/confidential|patient.*confident/i, 'Confidentiality Policy'],
    [/health.*safety|h&s|risk.*assess/i, 'Health and Safety Policy'],
    [/fire.*safety|fire.*evacuat/i, 'Fire Safety Policy'],
    [/chaperone/i, 'Chaperone Policy'],
    [/prescrib|medication.*safety/i, 'Prescribing Policy'],
    [/whistleblow|raising.*concern/i, 'Whistleblowing Policy'],
    [/equality|diversity|discrimination/i, 'Equality and Diversity Policy'],
    [/lone.*work/i, 'Lone Working Policy'],
    [/business.*continu|disaster.*recover/i, 'Business Continuity Policy'],
    [/significant.*event|sei|incident.*report/i, 'Significant Event Policy'],
    [/record.*keep|clinical.*record|documentation/i, 'Record Keeping Policy'],
    [/train|cpd|professional.*develop/i, 'Training Policy'],
  ];
  
  for (const [pattern, policyType] of policyPatterns) {
    if (pattern.test(lowerText)) {
      return policyType;
    }
  }
  
  return null;
}

// Extract metadata from policy
function extractMetadata(text: string): Record<string, string | null> {
  const metadata: Record<string, string | null> = {
    title: null,
    version: null,
    effectiveDate: null,
    reviewDate: null,
    author: null,
  };
  
  // Try to extract title (usually first non-empty line or after "Title:")
  const titleMatch = text.match(/(?:title|policy)[\s:]+([^\n]+)/i) ||
                     text.match(/^([A-Z][A-Za-z\s]{10,50}(?:Policy|Procedure))/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }
  
  // Version
  const versionMatch = text.match(/version[\s:]+(\d+\.?\d*)/i);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }
  
  // Dates
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/gi;
  const effectiveDateMatch = text.match(/(?:effective|implementation|start)\s*(?:date)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  const reviewDateMatch = text.match(/(?:review|next\s*review)\s*(?:date)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  
  if (effectiveDateMatch) {
    metadata.effectiveDate = effectiveDateMatch[1];
  }
  if (reviewDateMatch) {
    metadata.reviewDate = reviewDateMatch[1];
  }
  
  // Author
  const authorMatch = text.match(/(?:author|written\s*by|prepared\s*by)[\s:]+([^\n]+)/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
  
  return metadata;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { file_data, file_name, file_type } = body;

    if (!file_data || !file_name) {
      throw new Error('file_data and file_name are required');
    }

    console.log('Extracting text from:', file_name, 'type:', file_type);

    // Decode base64
    const binaryString = atob(file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    let extractedText = '';
    const lowerFileName = file_name.toLowerCase();

    if (lowerFileName.endsWith('.docx') || lowerFileName.endsWith('.doc')) {
      extractedText = await extractFromDocx(bytes);
    } else if (lowerFileName.endsWith('.pdf')) {
      extractedText = await extractFromPdf(bytes);
    } else if (lowerFileName.endsWith('.txt') || lowerFileName.endsWith('.md')) {
      extractedText = extractFromTxt(bytes);
    } else {
      throw new Error(`Unsupported file type: ${file_name}. Supported: .docx, .doc, .pdf, .txt`);
    }

    // Detect policy type
    const detectedPolicyType = detectPolicyType(extractedText);
    
    // Extract metadata
    const metadata = extractMetadata(extractedText);

    console.log('Text extracted, length:', extractedText.length, 'detected type:', detectedPolicyType);

    return new Response(JSON.stringify({
      success: true,
      extracted_text: extractedText,
      detected_policy_type: detectedPolicyType,
      metadata,
      char_count: extractedText.length,
      word_count: extractedText.split(/\s+/).filter(w => w.length > 0).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('extract-policy-text error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
