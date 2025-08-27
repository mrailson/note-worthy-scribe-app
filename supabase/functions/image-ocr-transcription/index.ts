const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'OpenAI API key not configured',
          extractedText: '' 
        }),
        { 
          status: 200,  // Return 200 so ImageProcessor can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { imageData, fileName } = await req.json();
    
    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing OCR for image: ${fileName || 'unknown'}`);

    // Use GPT-4o for vision capabilities (supports images)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert OCR (Optical Character Recognition) assistant. Extract all visible text from images with high accuracy. Preserve formatting, spacing, and structure as much as possible. If the image contains handwriting, do your best to transcribe it accurately. Return only the extracted text without any additional commentary or formatting unless specifically requested.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all text from this image. Maintain the original formatting and structure as much as possible.'
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
        ],
        max_tokens: 4096,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to process image', 
          details: errorData.error?.message || 'Unknown error',
          extractedText: ''
        }),
        { 
          status: 200,  // Return 200 so ImageProcessor can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    console.log(`Successfully extracted ${extractedText.length} characters from image`);

    return new Response(
      JSON.stringify({ 
        success: true,
        extractedText,
        fileName: fileName || 'unknown',
        characterCount: extractedText.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in image-ocr-transcription function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: error.message,
        extractedText: ''
      }),
      {
        status: 200,  // Return 200 so ImageProcessor can handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});