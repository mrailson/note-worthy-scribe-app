import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { patientId, screenshotBase64, expectedNhs, expectedDob, clinicalSystem } = await req.json();

    if (!screenshotBase64 || !expectedNhs || !expectedDob) {
      throw new Error('Missing required parameters');
    }

    console.log(`Validating upload for patient ${patientId}, clinical system: ${clinicalSystem}`);

    // Use GPT-4o Vision to analyse the screenshot
    const systemPrompt = `You are an expert at analysing screenshots from UK clinical systems (EMIS Web and SystmOne).
Your task is to extract patient identification information and detect uploaded documents from the screenshot.

IMPORTANT: Extract information EXACTLY as it appears on screen. Do not infer or guess.

Look for:
1. NHS Number - A 10-digit number, may be formatted with spaces (e.g., 123 456 7890)
2. Date of Birth - In UK format (DD/MM/YYYY or similar)
3. Uploaded documents - Look for any PDF filenames, especially Lloyd George records

Return your findings as JSON.`;

    const userPrompt = `Examine this screenshot from a UK clinical system (${clinicalSystem === 'emis' ? 'EMIS Web' : 'SystmOne'}).

Extract the following information visible on screen:
1. NHS Number (10 digits, may be formatted with spaces)
2. Date of Birth (any UK date format)
3. Any uploaded document filenames visible (especially PDF files containing Lloyd George)

Return JSON in this exact format:
{
  "nhs_number": "extracted NHS number (digits only, no spaces)",
  "dob": "YYYY-MM-DD format",
  "uploaded_files": ["filename1.pdf", ...],
  "confidence": 0.0-1.0,
  "raw_text_found": "relevant text snippets you identified"
}

If you cannot find a field, use null for that field.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: screenshotBase64,
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
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    console.log('GPT-4o Vision response:', content);

    // Parse the JSON response
    let extracted: {
      nhs_number: string | null;
      dob: string | null;
      uploaded_files: string[];
      confidence: number;
      raw_text_found: string;
    } = {
      nhs_number: null,
      dob: null,
      uploaded_files: [],
      confidence: 0,
      raw_text_found: ''
    };

    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }

    // Normalise NHS numbers for comparison
    const normaliseNhs = (nhs: string | null): string => {
      if (!nhs) return '';
      return nhs.replace(/\s/g, '');
    };

    // Normalise dates for comparison
    const normaliseDate = (dateStr: string | null): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      } catch {
        return dateStr;
      }
    };

    const extractedNhs = normaliseNhs(extracted.nhs_number);
    const extractedDob = normaliseDate(extracted.dob);
    const expectedNhsNorm = normaliseNhs(expectedNhs);
    const expectedDobNorm = normaliseDate(expectedDob);

    // Perform validation
    const validation = {
      nhs_match: extractedNhs === expectedNhsNorm && extractedNhs !== '',
      dob_match: extractedDob === expectedDobNorm && extractedDob !== '',
      file_detected: extracted.uploaded_files.length > 0
    };

    console.log('Validation result:', {
      extracted: { nhs: extractedNhs, dob: extractedDob, files: extracted.uploaded_files },
      expected: { nhs: expectedNhsNorm, dob: expectedDobNorm },
      validation
    });

    // Store screenshot in storage for audit trail
    if (patientId) {
      try {
        // Convert base64 to Uint8Array
        const base64Data = screenshotBase64.split(',')[1] || screenshotBase64;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const screenshotPath = `validation/${patientId}/screenshot_${Date.now()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from('lg')
          .upload(screenshotPath, bytes, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error('Error storing validation screenshot:', uploadError);
        } else {
          console.log('Validation screenshot stored:', screenshotPath);
        }
      } catch (storageError) {
        console.error('Storage error:', storageError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      extracted: {
        nhs_number: extractedNhs || null,
        dob: extractedDob || null,
        uploaded_files: extracted.uploaded_files,
        confidence: extracted.confidence,
        raw_text: extracted.raw_text_found
      },
      validation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('lg-validate-upload error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
