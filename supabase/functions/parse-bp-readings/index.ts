import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface BPReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  date?: string;
  time?: string;
  sourceText?: string;
  excluded?: boolean;
  excludeReason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, imageData, fileName, mode } = await req.json();
    
    console.log(`Processing BP readings in ${mode} mode`);

    let contentToAnalyze = '';

    if (mode === 'image' && imageData) {
      // For images, use GPT-4o vision to extract text
      console.log('Using vision model for image analysis');
      
      const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5',
          messages: [
            {
              role: 'system',
              content: `You are an expert at reading medical documents and extracting blood pressure readings. 
Extract ALL blood pressure readings from the image, including handwritten ones.
Look for patterns like:
- 140/90 or 140/90/72 (with pulse)
- BP: 140/90
- Systolic 140, Diastolic 90
- Any table or list of BP readings

Return the extracted text containing all BP readings found.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please extract all blood pressure readings from this image. Include any dates or times associated with the readings.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          max_completion_tokens: 2000
        }),
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('Vision API error:', errorText);
        throw new Error(`Vision API error: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      contentToAnalyze = visionData.choices?.[0]?.message?.content || '';
      console.log('Extracted text from image:', contentToAnalyze);
    } else if (mode === 'text' && text) {
      contentToAnalyze = text;
    } else {
      throw new Error('Invalid input: provide either text or imageData');
    }

    if (!contentToAnalyze.trim()) {
      return new Response(
        JSON.stringify({ readings: [], message: 'No content to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now use AI to extract structured BP readings from the text
    console.log('Extracting structured BP readings from text');

    const extractionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a medical data extraction expert. Extract ALL blood pressure readings from the provided text.

For each reading, identify:
1. Systolic pressure (the higher number, typically 90-180)
2. Diastolic pressure (the lower number, typically 50-120)
3. Pulse/heart rate if present (typically 40-200)
4. Date if mentioned (in DD/MM/YYYY format for UK)
5. Time if mentioned (in HH:MM format)
6. The original source text snippet

Common BP formats to recognize:
- 140/90 (systolic/diastolic)
- 140/90/72 (systolic/diastolic/pulse)
- BP: 140/90
- Sys 140 Dia 90
- 140 over 90
- Blood pressure reading: 140/90
- Tables with BP columns
- Lists like "Mon: 142/88, Tue: 138/85"

IMPORTANT:
- Extract EVERY BP reading found
- Validate that systolic > diastolic
- If a value seems invalid, skip that reading
- Be thorough - patients may have many readings`
          },
          {
            role: 'user',
            content: `Extract all blood pressure readings from this text:\n\n${contentToAnalyze}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_bp_readings',
              description: 'Extract blood pressure readings from text',
              parameters: {
                type: 'object',
                properties: {
                  readings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        systolic: { type: 'number', description: 'Systolic pressure (higher number)' },
                        diastolic: { type: 'number', description: 'Diastolic pressure (lower number)' },
                        pulse: { type: 'number', description: 'Pulse/heart rate if present' },
                        date: { type: 'string', description: 'Date in DD/MM/YYYY format if found' },
                        time: { type: 'string', description: 'Time in HH:MM format if found' },
                        sourceText: { type: 'string', description: 'Original text snippet containing this reading' }
                      },
                      required: ['systolic', 'diastolic']
                    }
                  }
                },
                required: ['readings']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
      }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error('Extraction API error:', errorText);
      throw new Error(`Extraction API error: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();
    
    // Parse the tool call response
    const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];
    let readings: BPReading[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        readings = parsed.readings || [];
      } catch (e) {
        console.error('Failed to parse tool response:', e);
      }
    }

    // Validate readings - mark invalid ones as excluded rather than removing
    readings = readings.map(r => {
      const reasons: string[] = [];
      
      if (r.systolic < 70 || r.systolic > 250) {
        reasons.push(`Systolic ${r.systolic} out of range (70-250)`);
      }
      if (r.diastolic < 40 || r.diastolic > 150) {
        reasons.push(`Diastolic ${r.diastolic} out of range (40-150)`);
      }
      if (r.systolic <= r.diastolic) {
        reasons.push('Systolic must be higher than diastolic');
      }
      if (r.pulse && (r.pulse < 40 || r.pulse > 200)) {
        reasons.push(`Pulse ${r.pulse} out of range (40-200)`);
      }
      
      // Validate time format (HH:MM should have valid hours 0-23 and minutes 0-59)
      if (r.time) {
        const timeMatch = r.time.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          if (hours > 23 || minutes > 59) {
            reasons.push(`Invalid time ${r.time}`);
          }
        }
      }
      
      if (reasons.length > 0) {
        return { ...r, excluded: true, excludeReason: reasons.join('; ') };
      }
      return r;
    });

    const validCount = readings.filter(r => !r.excluded).length;
    console.log(`Found ${readings.length} BP readings (${validCount} valid, ${readings.length - validCount} excluded)`);

    return new Response(
      JSON.stringify({ 
        readings,
        rawText: contentToAnalyze.substring(0, 500) // Include preview of analyzed text
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-bp-readings:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse BP readings' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
