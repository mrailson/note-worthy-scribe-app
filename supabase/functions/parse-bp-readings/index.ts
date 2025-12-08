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
  confidence?: 'high' | 'medium' | 'low';
  source?: 'both' | 'flash_only' | 'pro_only';
}

interface ExtractedReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  date?: string;
  time?: string;
  sourceText?: string;
  valid: boolean;
  reason_invalid?: string;
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

CRITICAL FOR HANDWRITTEN DIARIES:
- Look VERY carefully at ALL areas of the image including any bottom sections, margins, or additional rows.
- Handwritten numbers can be ambiguous - consider context when interpreting digits.
- Multiple readings may appear on the same line or in unusual layouts.
- If you see faint or partially visible readings, still extract them but mark with lower confidence.

Output all rows that contain a plausible BP pair even if date or pulse is missing, but mark them invalid where appropriate.

Never fabricate extra readings; if in doubt, leave the row out.`;

const ZONE_AWARE_PROMPT = `${BP_DIARY_PARSER_PROMPT}

ZONE-BASED EXTRACTION:
This diary may have multiple zones/sections:
1. MAIN GRID - typically dated columns with AM/PM readings arranged in a table
2. BOTTOM SECTION - additional readings below the main grid, possibly with different formatting
3. MARGINS - occasional readings written in margins or empty spaces

Process EACH zone separately and include ALL readings from ALL zones.
Do NOT stop after the main grid - continue to extract from ALL visible areas.`;

const toolSchema = {
  type: 'function',
  function: {
    name: 'extract_bp_readings',
    description: 'Extract blood pressure readings from BP diary',
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
        zones_found: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of zones/sections found in the image (e.g. "main_grid", "bottom_section", "margins")'
        },
        total_readings_confidence: {
          type: 'string',
          description: 'Overall confidence in extraction completeness: high/medium/low'
        }
      },
      required: ['readings']
    }
  }
};

// Run a single extraction pass with specified model
async function runExtractionPass(
  imageData: string, 
  model: string,
  prompt: string
): Promise<{ readings: ExtractedReading[], zones?: string[], confidence?: string }> {
  console.log(`Running extraction pass with ${model}`);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL blood pressure readings from this image. Pay special attention to ALL zones including bottom sections and margins. Do not miss any readings.'
            },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      tools: [toolSchema],
      tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${model} API error:`, errorText);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`${model} found ${parsed.readings?.length || 0} readings`);
      return {
        readings: parsed.readings || [],
        zones: parsed.zones_found,
        confidence: parsed.total_readings_confidence
      };
    } catch (e) {
      console.error(`Failed to parse ${model} response:`, e);
    }
  }
  
  return { readings: [] };
}

// Create a unique key for a reading to detect duplicates
function getReadingKey(r: ExtractedReading): string {
  // Normalize the key: use systolic/diastolic and date/time
  const dateKey = r.date?.replace(/\//g, '') || 'nodate';
  const timeKey = r.time?.replace(/:/g, '') || 'notime';
  return `${r.systolic}-${r.diastolic}-${dateKey}-${timeKey}`;
}

// Check if two readings are similar enough to be considered the same
function readingsAreSimilar(a: ExtractedReading, b: ExtractedReading): boolean {
  // Same BP values
  if (a.systolic !== b.systolic || a.diastolic !== b.diastolic) return false;
  
  // Same date (if both have dates)
  if (a.date && b.date && a.date !== b.date) return false;
  
  // Same time period (within 30 mins if both have times)
  if (a.time && b.time) {
    const aMinutes = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1] || '0');
    const bMinutes = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1] || '0');
    if (Math.abs(aMinutes - bMinutes) > 30) return false;
  }
  
  return true;
}

// Merge readings from multiple passes with consensus logic
function mergeReadings(
  flashReadings: ExtractedReading[], 
  proReadings: ExtractedReading[]
): BPReading[] {
  const merged: Map<string, BPReading> = new Map();
  const flashKeys = new Set(flashReadings.map(r => getReadingKey(r)));
  const proKeys = new Set(proReadings.map(r => getReadingKey(r)));
  
  // Process Flash readings
  for (const r of flashReadings) {
    const key = getReadingKey(r);
    
    // Check if Pro also found this reading
    const foundInPro = proReadings.some(pr => readingsAreSimilar(r, pr));
    
    merged.set(key, {
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      date: r.date,
      time: r.time,
      sourceText: r.sourceText,
      excluded: !r.valid,
      excludeReason: r.reason_invalid,
      confidence: foundInPro ? 'high' : 'medium',
      source: foundInPro ? 'both' : 'flash_only'
    });
  }
  
  // Process Pro readings - add any that Flash missed
  for (const r of proReadings) {
    const key = getReadingKey(r);
    
    // Check if already in merged (found by Flash)
    if (!merged.has(key)) {
      // Check for similar readings that might have slightly different keys
      const hasSimilar = flashReadings.some(fr => readingsAreSimilar(fr, r));
      
      if (!hasSimilar) {
        merged.set(key, {
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
          date: r.date,
          time: r.time,
          sourceText: r.sourceText,
          excluded: !r.valid,
          excludeReason: r.reason_invalid,
          confidence: 'medium',
          source: 'pro_only'
        });
      }
    }
  }
  
  return Array.from(merged.values());
}

// Verification pass - confirm readings exist in image (subtract only, never add)
async function runVerificationPass(
  imageData: string,
  readings: BPReading[]
): Promise<BPReading[]> {
  if (readings.length === 0) return readings;
  
  console.log('Running verification pass to confirm readings');
  
  const readingsList = readings.map((r, i) => 
    `${i + 1}. ${r.systolic}/${r.diastolic} ${r.pulse ? `pulse ${r.pulse}` : ''} on ${r.date || 'unknown date'} at ${r.time || 'unknown time'}`
  ).join('\n');
  
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
          content: `You are verifying BP readings extracted from an image. For each reading in the list, confirm if you can see it in the image. 
Only mark readings as NOT VERIFIED if you are CERTAIN they do not appear in the image.
If a reading seems plausible or you can see similar values, mark it as VERIFIED.
This is a safety check to remove hallucinated readings - err on the side of keeping readings.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Verify each of these extracted readings exists in the image:\n\n${readingsList}\n\nReturn the index numbers of any readings you CANNOT find in the image.`
            },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'verify_readings',
          description: 'Report which readings could not be verified in the image',
          parameters: {
            type: 'object',
            properties: {
              unverified_indices: {
                type: 'array',
                items: { type: 'number' },
                description: 'Index numbers (1-based) of readings that could NOT be found in the image'
              },
              verification_notes: {
                type: 'string',
                description: 'Brief notes about the verification process'
              }
            },
            required: ['unverified_indices']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'verify_readings' } }
    }),
  });

  if (!response.ok) {
    console.warn('Verification pass failed, keeping all readings');
    return readings;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const unverified = new Set(parsed.unverified_indices || []);
      console.log(`Verification: ${unverified.size} readings could not be verified`);
      
      if (parsed.verification_notes) {
        console.log(`Verification notes: ${parsed.verification_notes}`);
      }
      
      // Mark unverified readings but don't remove them - just lower confidence
      return readings.map((r, i) => {
        if (unverified.has(i + 1)) {
          return { 
            ...r, 
            confidence: 'low' as const,
            excludeReason: r.excludeReason 
              ? `${r.excludeReason}; Could not verify in image` 
              : 'Could not verify in image'
          };
        }
        return r;
      });
    } catch (e) {
      console.error('Failed to parse verification response:', e);
    }
  }
  
  return readings;
}

// Apply server-side validation rules
function applyValidation(readings: BPReading[]): BPReading[] {
  return readings.map(r => {
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
    
    // Validate time format
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, imageData, fileName, mode } = await req.json();
    
    console.log(`Processing BP readings in ${mode} mode with dual-pass extraction`);
    const startTime = Date.now();

    let readings: BPReading[] = [];
    let rawText = '';
    let extractionMetadata = {
      flash_count: 0,
      pro_count: 0,
      merged_count: 0,
      verified_count: 0,
      high_confidence: 0,
      medium_confidence: 0,
      low_confidence: 0
    };

    if (mode === 'image' && imageData) {
      console.log('Starting dual-model extraction for image');
      
      // Run both models in parallel
      const [flashResult, proResult] = await Promise.all([
        runExtractionPass(imageData, 'google/gemini-2.5-flash', ZONE_AWARE_PROMPT),
        runExtractionPass(imageData, 'google/gemini-2.5-pro', ZONE_AWARE_PROMPT)
      ]);
      
      extractionMetadata.flash_count = flashResult.readings.length;
      extractionMetadata.pro_count = proResult.readings.length;
      
      console.log(`Flash found ${flashResult.readings.length}, Pro found ${proResult.readings.length}`);
      
      // Merge with consensus logic
      readings = mergeReadings(flashResult.readings, proResult.readings);
      extractionMetadata.merged_count = readings.length;
      
      console.log(`Merged to ${readings.length} unique readings`);
      
      // Run verification pass
      readings = await runVerificationPass(imageData, readings);
      extractionMetadata.verified_count = readings.filter(r => r.confidence !== 'low').length;
      
      // Build raw text summary
      rawText = `Dual-pass extraction: Flash=${flashResult.readings.length}, Pro=${proResult.readings.length}, Merged=${readings.length}`;
      if (flashResult.zones?.length) {
        rawText += `. Zones: ${flashResult.zones.join(', ')}`;
      }

    } else if (mode === 'text' && text) {
      rawText = text;
      
      // For text, single pass is usually sufficient
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: BP_DIARY_PARSER_PROMPT },
            { role: 'user', content: `Extract all blood pressure readings from this text:\n\n${text}` }
          ],
          tools: [toolSchema],
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
          readings = (parsed.readings || []).map((r: ExtractedReading) => ({
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse,
            date: r.date,
            time: r.time,
            sourceText: r.sourceText,
            excluded: !r.valid,
            excludeReason: r.reason_invalid,
            confidence: 'high' as const,
            source: 'both' as const
          }));
        } catch (e) {
          console.error('Failed to parse tool response:', e);
        }
      }
    } else {
      throw new Error('Invalid input: provide either text or imageData');
    }

    // Apply server-side validation
    readings = applyValidation(readings);
    
    // Count confidence levels
    extractionMetadata.high_confidence = readings.filter(r => r.confidence === 'high').length;
    extractionMetadata.medium_confidence = readings.filter(r => r.confidence === 'medium').length;
    extractionMetadata.low_confidence = readings.filter(r => r.confidence === 'low').length;

    const validCount = readings.filter(r => !r.excluded).length;
    const duration = Date.now() - startTime;
    console.log(`Found ${readings.length} BP readings (${validCount} valid) in ${duration}ms`);
    console.log(`Confidence breakdown: High=${extractionMetadata.high_confidence}, Medium=${extractionMetadata.medium_confidence}, Low=${extractionMetadata.low_confidence}`);

    return new Response(
      JSON.stringify({ 
        readings,
        rawText: rawText.substring(0, 500),
        extractionMetadata
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
