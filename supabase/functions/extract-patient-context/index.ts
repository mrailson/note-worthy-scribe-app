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
    const { imageBase64, clinicalSystem } = await req.json();
    
    if (!imageBase64) {
      throw new Error('No image data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Extracting patient context from ${clinicalSystem || 'unknown'} screenshot`);

    const systemPrompt = `You are an expert at extracting patient information from UK clinical system screenshots (SystmOne and EMIS Web).

CRITICAL RULES:
1. Extract patient name EXACTLY as displayed (usually SURNAME, Firstname format in SystmOne)
2. NHS numbers are ALWAYS 10 digits. In SystmOne, the NHS number typically appears in the top-right patient banner, often followed by "GMS" or "Dispensing". Look for ANY 10-digit sequence like "424 146 3061" even if not explicitly labelled as "NHS Number".
3. Extract date of birth in DD/MM/YYYY format if visible
4. Note the gender if visible (usually shown near the DOB)
5. Extract any visible allergies or alerts
6. If you see a number that looks like an NHS number (10 digits, possibly with spaces), ALWAYS include it
7. IGNORE any error messages, buttons, or UI elements that say things like "extraction failed" or "could not extract" - these are from the application, not the patient record
8. Extract the FULL HOME ADDRESS if visible - look for address fields, typically in the patient demographics panel or summary. Include house number, street, town/city, county, and postcode.
9. Extract PHONE NUMBERS - look for "Mobile", "Home", "Tel", "Phone" or "Contact" fields. In SystmOne, these appear in the patient demographics. Note which is the preferred/primary contact if indicated.

Return a JSON object with these fields:
{
  "patientName": "string or null",
  "nhsNumber": "string (10 digits, no spaces) or null", 
  "dateOfBirth": "DD/MM/YYYY format or null",
  "gender": "Male/Female or null",
  "address": "full address including postcode or null",
  "phoneNumbers": {
    "mobile": "mobile number or null",
    "home": "home/landline number or null",
    "preferred": "mobile or home - which is marked as preferred"
  },
  "allergies": ["array of strings"] or [],
  "alerts": ["array of strings"] or [],
  "confidence": 0.0-1.0,
  "rawText": "key text snippets you identified"
}

Be thorough - look at ALL areas of the screenshot for patient identifiers. The NHS number might be in a header bar, sidebar, or patient banner. Address and phone details are often in a demographics section or patient summary panel.`;

    const userPrompt = `Extract patient information from this ${clinicalSystem === 'systmone' ? 'SystmOne' : clinicalSystem === 'emis' ? 'EMIS Web' : 'clinical system'} screenshot.

IMPORTANT: 
- Look carefully for the 10-digit NHS number - it may appear with spaces (like "424 146 3061") and might be near "GMS" or "Dispensing" text
- The patient name is usually in SURNAME, Firstname format
- Look for the full home address (including postcode) in demographics or patient summary panels
- Look for mobile and home phone numbers - note which is the preferred contact
- Extract ALL visible patient identifiers

Return the JSON object with extracted information.`;

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
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse the JSON response
    let extracted = {
      patientName: null as string | null,
      nhsNumber: null as string | null,
      dateOfBirth: null as string | null,
      gender: null as string | null,
      address: null as string | null,
      phoneNumbers: null as { mobile?: string; home?: string; preferred?: 'mobile' | 'home' } | null,
      allergies: [] as string[],
      alerts: [] as string[],
      confidence: 0,
      rawText: ''
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extracted = { ...extracted, ...parsed };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }

    // Check if AI accidentally read error messages from the UI
    if (extracted.rawText?.toLowerCase().includes('extraction failed') ||
        extracted.rawText?.toLowerCase().includes('could not extract') ||
        extracted.rawText?.toLowerCase().includes('try again')) {
      console.warn('AI appears to have read UI error messages from the screenshot');
      return new Response(JSON.stringify({
        success: false,
        error: 'Your screenshot appears to include a previous error message. Please take a fresh screenshot of just the patient record.',
        confidence: 0,
        extracted: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Clean and validate NHS number with multiple fallback patterns
    let cleanNhsNumber = extracted.nhsNumber?.replace(/\D/g, '') || '';
    
    // If NHS number wasn't found or is invalid, try enhanced regex fallbacks on rawText
    if (cleanNhsNumber.length !== 10 && extracted.rawText) {
      console.log('NHS number not found by AI, trying regex fallbacks on rawText:', extracted.rawText);
      
      const nhsPatterns = [
        /\b(\d{3}\s?\d{3}\s?\d{4})\b/,           // 123 456 7890 or 1234567890
        /\b(\d{3}\s+\d{3}\s+\d{4})\b/,           // 123  456  7890 (multiple spaces)
        /(\d{10})/,                               // 10 consecutive digits anywhere
        /\b(\d[\d\s]{8,12}\d)\b/                 // 10 digits with flexible spacing
      ];

      for (const pattern of nhsPatterns) {
        const match = extracted.rawText.match(pattern);
        if (match?.[1]) {
          const digits = match[1].replace(/\D/g, '');
          if (digits.length === 10) {
            cleanNhsNumber = digits;
            console.log('Found NHS number via regex fallback:', cleanNhsNumber);
            break;
          }
        }
      }
    }

    // Validate extraction quality
    const hasValidName = extracted.patientName && extracted.patientName.length > 2;
    const hasValidNhs = cleanNhsNumber.length === 10;
    
    console.log('Extraction result:', {
      name: extracted.patientName,
      nhsNumber: cleanNhsNumber,
      dob: extracted.dateOfBirth,
      hasValidName,
      hasValidNhs,
      confidence: extracted.confidence
    });

    // Determine if extraction was successful enough
    if (!hasValidName && !hasValidNhs) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not find patient name or NHS number. Please ensure the patient banner is clearly visible in your screenshot.',
        confidence: extracted.confidence,
        extracted: {
          ...extracted,
          nhsNumber: cleanNhsNumber || null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      extracted: {
        patientName: extracted.patientName,
        nhsNumber: cleanNhsNumber || null,
        dateOfBirth: extracted.dateOfBirth,
        gender: extracted.gender,
        address: extracted.address,
        phoneNumbers: extracted.phoneNumbers,
        allergies: extracted.allergies || [],
        alerts: extracted.alerts || [],
        confidence: extracted.confidence,
        rawText: extracted.rawText
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('extract-patient-context error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      extracted: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});