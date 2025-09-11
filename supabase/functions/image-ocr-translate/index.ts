import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    const googleTranslateApiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');

    if (!googleVisionApiKey) {
      console.error('Missing Google Vision API key');
      return new Response(
        JSON.stringify({ error: 'Google Vision API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!googleTranslateApiKey) {
      console.error('Missing Google Translate API key');
      return new Response(
        JSON.stringify({ error: 'Google Translate API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { imageData, sourceLanguage = null, targetLanguage = 'en' } = await req.json();

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Starting OCR processing...');

    // Step 1: Extract text using Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageData.replace(/^data:image\/[a-z]+;base64,/, ''),
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'OCR processing failed', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const visionResult = await visionResponse.json();
    console.log('Vision API response:', JSON.stringify(visionResult, null, 2));

    if (!visionResult.responses || !visionResult.responses[0]) {
      return new Response(
        JSON.stringify({ error: 'No OCR response received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const textAnnotations = visionResult.responses[0].textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No text found in image',
          originalText: '',
          translatedText: '',
          detectedLanguage: 'unknown',
          confidence: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const extractedText = textAnnotations[0].description;
    console.log('Extracted text:', extractedText);

    // Step 2: Detect language and translate using Google Translate API
    const translateBody = {
      q: extractedText,
      target: targetLanguage,
      format: 'text',
    };
    
    // Add source language if specified (not auto-detect)
    if (sourceLanguage) {
      translateBody.source = sourceLanguage;
    }
    
    const translateResponse = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleTranslateApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(translateBody),
      }
    );

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error('Translate API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Translation failed', 
          details: errorText,
          originalText: extractedText,
          translatedText: extractedText,
          detectedLanguage: 'unknown',
          confidence: 0.7
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const translateResult = await translateResponse.json();
    console.log('Translation result:', JSON.stringify(translateResult, null, 2));

    if (!translateResult.data || !translateResult.data.translations || translateResult.data.translations.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No translation received',
          originalText: extractedText,
          translatedText: extractedText,
          detectedLanguage: 'unknown',
          confidence: 0.7
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const translation = translateResult.data.translations[0];
    const result: TranslationResult = {
      originalText: extractedText,
      translatedText: translation.translatedText,
      detectedLanguage: translation.detectedSourceLanguage || 'unknown',
      confidence: 0.85 // Default confidence score
    };

    console.log('OCR and translation completed successfully');
    
    // Perform clinical verification
    try {
      console.log('Starting clinical verification...');
      const clinicalResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/clinical-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          originalText: extractedText,
          translatedText: translation.translatedText,
          sourceLanguage: translation.detectedSourceLanguage,
          targetLanguage: targetLanguage
        })
      });
      
      if (clinicalResponse.ok) {
        const clinicalResult = await clinicalResponse.json();
        console.log('Clinical verification completed:', clinicalResult);
        
        return new Response(
          JSON.stringify({
            ...result,
            clinicalVerification: clinicalResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.warn('Clinical verification failed, proceeding without it');
      }
    } catch (clinicalError) {
      console.warn('Clinical verification error:', clinicalError);
    }
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in image-ocr-translate function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        originalText: '',
        translatedText: '',
        detectedLanguage: 'unknown',
        confidence: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});