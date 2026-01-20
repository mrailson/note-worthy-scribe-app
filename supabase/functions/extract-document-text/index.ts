import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileType, dataUrl, fileName } = await req.json();
    console.log(`Processing ${fileType} file: ${fileName}`);

    let extractedText = '';

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

    } else if (fileType === 'pdf' || fileType === 'powerpoint' || fileType === 'word' || fileType === 'excel') {
      // For PDFs, PowerPoint, Word docs, and Excel, use vision model to extract text
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const fileTypeDescriptions: Record<string, string> = {
        'pdf': 'PDF document',
        'powerpoint': 'PowerPoint presentation',
        'word': 'Word document',
        'excel': 'Excel spreadsheet',
      };

      const extractionPrompt = fileType === 'excel' 
        ? 'Extract ALL text and data from this Excel spreadsheet. Return the content in a readable format, preserving table structure where possible. Include all sheets, headers, and cell values. Do not add any commentary.'
        : `Extract ALL text content from this ${fileTypeDescriptions[fileType] || 'document'}. Return ONLY the extracted text, preserving the structure, headings, bullet points, and formatting. Include all text from all pages/slides/sections. Do not add any commentary.`;

      console.log(`Extracting text from ${fileType} using Gemini vision...`);

      const docResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  text: extractionPrompt
                },
                {
                  type: 'file',
                  file: { 
                    filename: fileName,
                    file_data: dataUrl 
                  }
                }
              ]
            }
          ]
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
