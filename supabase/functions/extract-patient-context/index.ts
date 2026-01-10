import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractionResult {
  success: boolean;
  name?: string;
  nhsNumber?: string;
  dob?: string;
  confidence?: number;
  rawText?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, clinicalSystem } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare the image URL
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    const systemPrompt = `You are an expert at extracting patient identification data from UK clinical system screenshots (EMIS Web, SystmOne, Vision).

TASK: Extract the patient's Name, NHS Number, and Date of Birth from the screenshot.

CRITICAL RULES:
1. Extract EXACTLY what is shown - do not guess or infer
2. NHS numbers are 10 digits, often formatted as XXX XXX XXXX
3. Dates of Birth are typically DD/MM/YYYY or DD-MMM-YYYY format
4. Patient names may be in format "SURNAME, Firstname" or "Firstname Surname"
5. If you cannot clearly read a field, set it to null
6. Do NOT include any patient data that is not clearly visible

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Full patient name as displayed",
  "nhsNumber": "10 digit NHS number, digits only",
  "dob": "Date of birth in DD/MM/YYYY format",
  "confidence": 0.0-1.0 confidence score,
  "rawText": "Any relevant text you extracted"
}

If you cannot extract the data, return:
{
  "error": "Description of what went wrong",
  "confidence": 0
}`;

    console.log('Calling Lovable AI for patient context extraction...');
    console.log('Clinical system hint:', clinicalSystem || 'not specified');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the patient identification details from this ${clinicalSystem || 'clinical system'} screenshot. Return only valid JSON.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for more consistent extraction
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Raw AI response:', content);

    // Parse the JSON response (handle potential markdown wrapping)
    let extracted: ExtractionResult;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      extracted = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse extraction result',
          rawText: content
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if extraction had an error
    if (extracted.error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: extracted.error,
          confidence: extracted.confidence || 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up NHS number - remove spaces and dashes
    let cleanNhsNumber = extracted.nhsNumber?.replace(/[\s-]/g, '') || '';
    
    // Validate we have the minimum required data
    if (!extracted.name || !cleanNhsNumber) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract patient name or NHS number from image',
          rawText: extracted.rawText,
          confidence: extracted.confidence || 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted patient context:', {
      name: extracted.name,
      nhsNumberLength: cleanNhsNumber.length,
      hasDob: !!extracted.dob,
      confidence: extracted.confidence
    });

    return new Response(
      JSON.stringify({
        success: true,
        name: extracted.name,
        nhsNumber: cleanNhsNumber,
        dob: extracted.dob || '',
        confidence: extracted.confidence || 0.8,
        rawText: extracted.rawText
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-patient-context:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
