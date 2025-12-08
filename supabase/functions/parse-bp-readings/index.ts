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

const BP_DIARY_PARSER_PROMPT = `You are a BP diary parser for a UK GP practice.
Input: noisy OCR text from Google Vision for a home blood pressure diary page, already split into ordered rows.

Your job is to reconstruct a complete, error-checked table of readings.
Each reading must have:
- systolic
- diastolic
- pulse (if present)
- date (DD/MM/YY or DD/MM/YYYY)
- time (HH:MM in 24-hour format if available, otherwise derive from AM/PM)
- valid = true/false
- reason_invalid (if invalid)

Rules:

1. The diary is written in columns by date, with AM and/or PM readings below the date.

2. If a row has no date but is under a previous date in the same column, use that previous date.

3. Never leave date empty if there is an obvious date above in the same column.

4. A blood pressure reading always looks like NNN/NN (systolic/diastolic).

5. Systolic must be > diastolic.

6. Normal ranges: systolic 70–250, diastolic 40–150.

7. If these rules are broken, set valid = false and explain in reason_invalid.

8. If a third number appears on the same row (e.g. 147/93 78) and is between 30 and 130, treat it as pulse.

9. If no such number, set pulse = null.

Time:
- If the row contains "AM" or "PM", use that to determine time (AM = 08:00, PM = 20:00 if no specific time).
- If the row lacks AM/PM but is directly below a row with AM or PM, inherit that.
- If a specific time like 07:30 or 19:45 is present, use that exact time.

Dates:
- Do not invent dates that are not clearly supported by the context.
- Use the dominant month/year you see repeated (e.g. 11/25).
- If OCR misreads the month as 01 but all other dates nearby are 11 and the day matches the pattern, correct to 11.
- If a date cannot be confidently interpreted (e.g. "34/11/25"), set valid = false and explain.
- Convert 2-digit years to 4-digit (25 -> 2025, 24 -> 2024).

Output all rows that contain a plausible BP pair even if date or pulse is missing, but mark them invalid where appropriate.

Never fabricate extra readings; if in doubt, leave the row out.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, imageData, fileName, mode } = await req.json();
    
    console.log(`Processing BP readings in ${mode} mode`);
    const startTime = Date.now();

    let readings: BPReading[] = [];
    let rawText = '';

    if (mode === 'image' && imageData) {
      // For images, use Gemini Flash vision to extract BP readings directly in one call
      console.log('Using Gemini Flash vision for direct BP extraction');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: BP_DIARY_PARSER_PROMPT
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all blood pressure readings from this image. Follow the parsing rules carefully, especially for date inheritance and AM/PM detection.'
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
          tools: [
            {
              type: 'function',
              function: {
                name: 'extract_bp_readings',
                description: 'Extract blood pressure readings from BP diary image',
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
                          pulse: { type: 'number', description: 'Pulse/heart rate if present (30-130 range)' },
                          date: { type: 'string', description: 'Date in DD/MM/YYYY format' },
                          time: { type: 'string', description: 'Time in HH:MM 24-hour format' },
                          sourceText: { type: 'string', description: 'Original text snippet containing this reading' },
                          valid: { type: 'boolean', description: 'Whether the reading passes validation rules' },
                          reason_invalid: { type: 'string', description: 'Reason if reading is invalid' }
                        },
                        required: ['systolic', 'diastolic', 'valid']
                      }
                    },
                    rawText: { type: 'string', description: 'Brief summary of what was found in the image' }
                  },
                  required: ['readings']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          readings = (parsed.readings || []).map((r: any) => ({
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse || undefined,
            date: r.date,
            time: r.time,
            sourceText: r.sourceText,
            excluded: r.valid === false,
            excludeReason: r.reason_invalid
          }));
          rawText = parsed.rawText || '';
        } catch (e) {
          console.error('Failed to parse tool response:', e);
        }
      }

    } else if (mode === 'text' && text) {
      rawText = text;
      
      // For text, use Gemini Flash to extract structured readings
      console.log('Extracting structured BP readings from text');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: BP_DIARY_PARSER_PROMPT
            },
            {
              role: 'user',
              content: `Extract all blood pressure readings from this text. Follow the parsing rules carefully, especially for date inheritance and AM/PM detection.\n\n${text}`
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'extract_bp_readings',
                description: 'Extract blood pressure readings from BP diary text',
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
                          pulse: { type: 'number', description: 'Pulse/heart rate if present (30-130 range)' },
                          date: { type: 'string', description: 'Date in DD/MM/YYYY format' },
                          time: { type: 'string', description: 'Time in HH:MM 24-hour format' },
                          sourceText: { type: 'string', description: 'Original text snippet containing this reading' },
                          valid: { type: 'boolean', description: 'Whether the reading passes validation rules' },
                          reason_invalid: { type: 'string', description: 'Reason if reading is invalid' }
                        },
                        required: ['systolic', 'diastolic', 'valid']
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          readings = (parsed.readings || []).map((r: any) => ({
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse || undefined,
            date: r.date,
            time: r.time,
            sourceText: r.sourceText,
            excluded: r.valid === false,
            excludeReason: r.reason_invalid
          }));
        } catch (e) {
          console.error('Failed to parse tool response:', e);
        }
      }
    } else {
      throw new Error('Invalid input: provide either text or imageData');
    }

    // Additional server-side validation as a safety net
    readings = readings.map(r => {
      const reasons: string[] = r.excludeReason ? [r.excludeReason] : [];
      
      if (r.systolic < 70 || r.systolic > 250) {
        reasons.push(`Systolic ${r.systolic} out of range (70-250)`);
      }
      if (r.diastolic < 40 || r.diastolic > 150) {
        reasons.push(`Diastolic ${r.diastolic} out of range (40-150)`);
      }
      if (r.systolic <= r.diastolic) {
        reasons.push('Systolic must be higher than diastolic');
      }
      if (r.pulse && (r.pulse < 30 || r.pulse > 200)) {
        reasons.push(`Pulse ${r.pulse} out of range (30-200)`);
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
    const duration = Date.now() - startTime;
    console.log(`Found ${readings.length} BP readings (${validCount} valid, ${readings.length - validCount} excluded) in ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        readings,
        rawText: rawText.substring(0, 500)
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
