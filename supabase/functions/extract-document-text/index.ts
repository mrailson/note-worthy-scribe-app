import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to decode base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileType, dataUrl, fileName } = await req.json();
    console.log(`Processing ${fileType} file: ${fileName}`);

    let extractedText = '';
    
    // Extract base64 data from data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    console.log(`File MIME type: ${mimeType}, Base64 length: ${base64Data.length}`);

    if (fileType === 'image') {
      // Use Lovable AI for OCR on images
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const ocrResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this image. Return ONLY the extracted text, no other commentary. If there is no text, return "No text found in image".'
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl }
                }
              ]
            }
          ]
        })
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error('OCR API error:', ocrResponse.status, errorText);
        throw new Error(`OCR failed: ${ocrResponse.status}`);
      }

      const ocrData = await ocrResponse.json();
      extractedText = ocrData.choices?.[0]?.message?.content || 'Failed to extract text from image';
      console.log('OCR extracted text length:', extractedText.length);

    } else if (fileType === 'pdf') {
      // For PDFs, use Gemini which supports PDF natively
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      console.log('Extracting text from PDF using Gemini...');

      const pdfResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract ALL text content from this PDF document. Return ONLY the extracted text, preserving the structure, headings, bullet points, and formatting. Include all text from all pages. Do not add any commentary.'
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:application/pdf;base64,${base64Data}` }
                }
              ]
            }
          ]
        })
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error('PDF extraction API error:', pdfResponse.status, errorText);
        throw new Error(`PDF extraction failed: ${pdfResponse.status}`);
      }

      const pdfData = await pdfResponse.json();
      extractedText = pdfData.choices?.[0]?.message?.content || 'Failed to extract text from PDF';
      console.log('PDF extracted text length:', extractedText.length);

    } else if (fileType === 'word' || fileType === 'powerpoint' || fileType === 'excel') {
      // For Office documents, use Claude which handles documents better
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const fileTypeDescriptions: Record<string, string> = {
        'word': 'Word document (.docx)',
        'powerpoint': 'PowerPoint presentation (.pptx)',
        'excel': 'Excel spreadsheet (.xlsx)',
      };

      console.log(`Extracting text from ${fileType} using Claude...`);

      // Claude can handle document files with base64 content
      const docResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract ALL text content from this ${fileTypeDescriptions[fileType] || 'document'}. The file is base64 encoded below.

IMPORTANT INSTRUCTIONS:
- Extract EVERY piece of text from the document
- Preserve the structure, headings, bullet points, and formatting
- Include all text from all pages/slides/sections
- Do not skip or summarize any content
- Return ONLY the extracted text, no commentary

Base64 encoded ${fileType} file (decode this to read the document):
${base64Data}`
                }
              ]
            }
          ],
          max_tokens: 16000
        })
      });

      if (!docResponse.ok) {
        const errorText = await docResponse.text();
        console.error('Document extraction API error:', docResponse.status, errorText);
        throw new Error(`Document extraction failed: ${docResponse.status}`);
      }

      const docData = await docResponse.json();
      extractedText = docData.choices?.[0]?.message?.content || 'Failed to extract text from document';
      console.log(`${fileType} extracted text length:`, extractedText.length);

    } else {
      console.log(`Unknown file type: ${fileType}, returning empty text`);
      extractedText = '';
    }

    return new Response(
      JSON.stringify({ extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-document-text:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
