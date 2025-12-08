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
  sourceRow?: number;
  excluded?: boolean;
  excludeReason?: string;
  confidence?: 'confirmed' | 'single_source' | 'needs_review';
}

// Enhanced BP Diary Parser System Prompt for UK GP Practice
const BP_DIARY_PARSER_SYSTEM_PROMPT = `You are a blood pressure (BP) diary parser for a UK general practice.

You receive a handwritten HOME blood pressure diary page. The diary usually has columns by DATE, with AM and/or PM readings underneath each date.

Your job is to reconstruct a complete, error-checked table of readings suitable for NICE NG136 home BP averaging and GP clinical review.

TASK
-----
From the image or text, build a clean list of BP readings, each with:

- systolic
- diastolic
- pulse (if present)
- date (DD/MM/YY)
- time_of_day ("AM" or "PM")
- source_row (approximate row number from top of page, starting at 1)
- valid (true/false)
- reason_invalid (string or null)

RULES
------

1. Identify blood pressure readings
   - A BP reading always has the form NNN/NN or NN/NN, where N are digits.
   - Systolic must be > diastolic.
   - Normal acceptable numeric ranges:
     - systolic: 70–250
     - diastolic: 40–150
   - If a pair N1/N2 violates these rules, mark the reading as:
     - valid = false
     - reason_invalid = "systolic lower than diastolic" or "out of BP range" etc.

2. Pulse extraction
   - If a third number appears on the same row as the BP (for example "147/93 78") and is between 30 and 130, treat it as PULSE.
   - If no suitable third number is present, set pulse = null.
   - Ignore obvious noise numbers (e.g. page numbers, 2025, etc.).

3. Time-of-day (AM/PM)
   - If the row contains "AM" or "PM" (any case), use that as time_of_day.
   - If a row has a BP but no AM/PM, and the immediately previous BP row in the same column has AM or PM, INHERIT that value.
   - If you cannot infer AM/PM reliably, set time_of_day = null.

4. Date handling and INHERITANCE (critical)
   - Diaries are organised by DATE at the top of a column, with AM/PM readings under that date.
   - If a row includes a clear date (e.g. "18/11/25"), treat that as the current_date for subsequent rows in that column.
   - For the next BP rows in sequence that appear to belong to that column (e.g. directly underneath in the text order), if they do NOT contain their own date, INHERIT current_date.
   - Never leave date empty if there is an obvious date immediately above in the same sequence of rows.
   - DO NOT invent dates that do not appear at all in the page.

5. Dominant month/year and correction of OCR mistakes
   - Determine the dominant month and year from clearly recognised dates (for example, most dates might be in November 2025, written as 18/11/25, 19/11/25, etc.).
   - If a single date appears with a different month that is clearly inconsistent with all the others (for example 23/01/25 when all other dates are **/11/25 and the handwriting style suggests "11"), CORRECT it to match the dominant month/year (e.g. 23/11/25).
   - Only make such a correction if it is strongly supported by context. If you cannot be confident, mark the reading:
     - valid = false
     - reason_invalid = "unreliable date"
   - Never introduce months or years that are absent from the diary (e.g. do not invent January 2025 if the diary is clearly November 2025).

6. Multiple readings on the same date
   - It is normal to have both AM and PM readings on the same date.
   - Treat each BP pair as a separate reading with the same date but different time_of_day.

7. Notes and non-BP rows
   - Ignore notes like "NEW MEDICINE", "HOME BP", "READINGS", etc. Do not turn them into readings.
   - If a row has no valid BP pattern, skip it entirely.

8. Validity and exclusion
   - A reading is valid if:
     - The BP values pass the numeric checks (Rule 1),
     - There is at least a plausible date (either direct or inherited),
     - There is no serious inconsistency (impossible date, impossible month).
   - If the BP numbers are valid but date or time are missing or unreliable, you may still include the reading but:
     - valid = false
     - reason_invalid = e.g. "missing date", "uncertain month".
   - Do NOT hallucinate extra BP readings, dates, or pulses. If in doubt, leave the row out.

Your priority is maximum accuracy and safety for clinical use:
- prefer dropping an uncertain reading over inventing data,
- follow the diary structure carefully,
- be conservative when guessing dates.`;

// Enhanced handwriting recognition prompt for vision mode
const HANDWRITING_VISION_PROMPT = `HANDWRITTEN DOCUMENT ANALYSIS - BLOOD PRESSURE DIARY

Please perform careful handwriting recognition on this BP diary image:

1. SCAN THE ENTIRE PAGE systematically from top-left to bottom-right
2. IDENTIFY ALL COLUMNS - each column typically represents a different date
3. For each column, read from TOP to BOTTOM:
   - Look for the DATE at the top of the column (usually DD/MM/YY format)
   - Find AM readings (morning)
   - Find PM readings (evening)
   - BP format is typically NNN/NN or NN/NN (systolic/diastolic)
   - Pulse may appear as a third number after BP

4. HANDWRITING RECOGNITION TIPS:
   - 1 and 7 can look similar - check context and typical BP values
   - 4 and 9 may be confused - verify with typical BP ranges (systolic 100-180, diastolic 60-100)
   - 0 and 6 handwritten can look alike
   - Slashes in BP readings (/) may be faint or angled
   - Look for underlines or boxes that may group readings
   - Written numbers may have varying slants

5. DATE INHERITANCE: If a reading has no date directly above it in its column, inherit the date from the column header at the top.

6. EXTRACT EVERY VISIBLE BP READING - do not skip any. Include all readings even if handwriting is slightly unclear.

Call the extract_bp_readings function with ALL readings found.`;

// Tool schema for structured BP extraction
const BP_EXTRACTION_TOOL = {
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
              pulse: { type: 'number', description: 'Pulse/heart rate if present (30-130 range), null if not present' },
              date: { type: 'string', description: 'Date in DD/MM/YY format' },
              time_of_day: { type: 'string', enum: ['AM', 'PM'], description: 'Time of day (AM or PM)' },
              source_row: { type: 'number', description: 'Approximate row number from top of page' },
              valid: { type: 'boolean', description: 'Whether the reading passes validation rules' },
              reason_invalid: { type: 'string', description: 'Reason if reading is invalid, null otherwise' }
            },
            required: ['systolic', 'diastolic', 'valid']
          }
        }
      },
      required: ['readings']
    }
  }
};

// Convert 2-digit year to 4-digit
function normalizeDate(date?: string): string | undefined {
  if (!date) return undefined;
  
  // Match DD/MM/YY or DD/MM/YYYY
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return date;
  
  const [, day, month, year] = match;
  const fullYear = year.length === 2 
    ? (parseInt(year) > 50 ? `19${year}` : `20${year}`)
    : year;
  
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
}

// Convert AM/PM to 24-hour time
function normalizeTime(timeOfDay?: string | null): string | undefined {
  if (!timeOfDay) return undefined;
  if (timeOfDay.toUpperCase() === 'AM') return '08:00';
  if (timeOfDay.toUpperCase() === 'PM') return '20:00';
  return undefined;
}

// Format text into numbered rows
function formatAsNumberedRows(text: string): string {
  const lines = text.split('\n').filter(line => line.trim());
  const rows = lines.map((line, idx) => `[${idx + 1}] ${line.trim()}`);
  return `ROWS:\n${rows.join('\n')}`;
}

// Run single extraction with Gemini 2.5 Pro
async function runExtraction(
  content: { type: 'text'; text: string } | { type: 'image'; dataUrl: string }
): Promise<BPReading[]> {
  const messages: any[] = [];
  
  if (content.type === 'image') {
    // Vision mode - optimized for handwritten document analysis with Gemini 2.5 Pro
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: HANDWRITING_VISION_PROMPT },
        { type: 'image_url', image_url: { url: content.dataUrl } }
      ]
    });
  } else {
    // Text mode - format as numbered rows
    const formattedText = formatAsNumberedRows(content.text);
    messages.push({
      role: 'user',
      content: `Parse the blood pressure readings from this diary text. Call the extract_bp_readings function with the results.\n\n${formattedText}`
    });
  }

  console.log('Calling Gemini 2.5 Pro for extraction...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: BP_DIARY_PARSER_SYSTEM_PROMPT },
        ...messages
      ],
      tools: [BP_EXTRACTION_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini Pro extraction error:', response.status, errorText);
    throw new Error(`Extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const rawReadings = parsed.readings || [];
      
      // Transform to frontend format
      return rawReadings.map((r: any, idx: number) => ({
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse ?? undefined,
        date: normalizeDate(r.date),
        time: normalizeTime(r.time_of_day),
        sourceRow: r.source_row,
        excluded: !r.valid,
        excludeReason: r.reason_invalid ?? undefined,
        confidence: 'confirmed' as const
      }));
    } catch (e) {
      console.error('Failed to parse Gemini Pro response:', e);
    }
  }

  // Fallback: try to parse from content
  const contentText = data.choices?.[0]?.message?.content;
  if (contentText) {
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*"readings"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.readings || []).map((r: any) => ({
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse ?? undefined,
          date: normalizeDate(r.date),
          time: normalizeTime(r.time_of_day),
          sourceRow: r.source_row,
          excluded: !r.valid,
          excludeReason: r.reason_invalid ?? undefined,
          confidence: 'confirmed' as const
        }));
      }
    } catch (e) {
      console.error('Failed to parse content as JSON:', e);
    }
  }

  return [];
}

// Server-side validation
function applyServerValidation(readings: BPReading[]): BPReading[] {
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
    
    if (reasons.length > 0) {
      return { ...r, excluded: true, excludeReason: reasons.join('; ') };
    }
    return r;
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, imageData, dataUrl, mode } = await req.json();
    const imageSource = imageData || dataUrl; // Support both parameter names
    
    console.log(`Processing BP readings in ${mode} mode with Gemini 2.5 Pro`);
    const startTime = Date.now();

    let readings: BPReading[] = [];

    if (mode === 'image' && imageSource) {
      // Single-pass vision extraction with Gemini 2.5 Pro
      console.log('Running vision extraction with Gemini 2.5 Pro (handwriting optimized)...');
      readings = await runExtraction({ type: 'image', dataUrl: imageSource });
      console.log(`Extracted ${readings.length} readings from image`);
    } else if (text) {
      // Text mode extraction
      console.log('Running text extraction with Gemini 2.5 Pro...');
      readings = await runExtraction({ type: 'text', text });
      console.log(`Extracted ${readings.length} readings from text`);
    }

    // Apply server-side validation
    readings = applyServerValidation(readings);
    
    // Add IDs for frontend
    readings = readings.map((r, idx) => ({
      ...r,
      id: `reading-${Date.now()}-${idx}`
    }));

    const elapsed = Date.now() - startTime;
    console.log(`Completed in ${elapsed}ms. Returning ${readings.length} validated readings.`);

    return new Response(JSON.stringify({ readings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parse-bp-readings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      readings: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
