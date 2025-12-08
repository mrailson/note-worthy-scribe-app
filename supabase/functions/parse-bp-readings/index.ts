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
  sourceRow?: number;
  excluded?: boolean;
  excludeReason?: string;
  confidence?: 'confirmed' | 'single_source' | 'needs_review';
}

interface RawReading {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  date?: string;
  time_of_day?: 'AM' | 'PM' | null;
  source_row?: number;
  valid: boolean;
  reason_invalid?: string | null;
}

// Enhanced BP Diary Parser System Prompt for UK GP Practice
const BP_DIARY_PARSER_SYSTEM_PROMPT = `You are a blood pressure (BP) diary parser for a UK general practice.

You receive noisy OCR text extracted from Google Vision / Document AI for a single handwritten HOME blood pressure diary page. The diary usually has columns by DATE, with AM and/or PM readings underneath each date.

Your job is to reconstruct a complete, error-checked table of readings suitable for NICE NG136 home BP averaging and GP clinical review.

INPUT FORMAT
-------------
You will be given a block of text that starts with:

ROWS:
[1] <raw row text>
[2] <raw row text>
[3] <raw row text>
...

Each [n] line is a single horizontal OCR "row" from the page, already ordered from top-left to bottom-right. Rows for the same vertical column appear close together in sequence.

Rows may include:
- Dates, usually DD/MM/YY (e.g. 18/11/25)
- Time-of-day labels: "AM", "PM", "am", "pm"
- Blood pressure readings like "147/93"
- Optional pulse values after the BP, e.g. "147/93 78"
- Notes such as "NEW MEDICINE", "HOME BP", etc.
- Noise, mis-spellings, or partial numbers

TASK
-----
From these rows, build a clean list of BP readings, each with:

- systolic
- diastolic
- pulse (if present)
- date (DD/MM/YY)
- time_of_day ("AM" or "PM")
- source_row (the row index [n] from which the reading came)
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
   - If a single date is OCR'd with a different month that is clearly inconsistent with all the others (for example 23/01/25 when all other dates are **/11/25 and the handwriting style suggests "11"), CORRECT it to match the dominant month/year (e.g. 23/11/25).
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

9. Output format
   - Return JSON ONLY, with this exact shape and field names:

   {
     "readings": [
       {
         "systolic": 147,
         "diastolic": 93,
         "pulse": 78,
         "date": "18/11/25",
         "time_of_day": "AM",
         "source_row": 3,
         "valid": true,
         "reason_invalid": null
       }
     ]
   }

   - systolic, diastolic, pulse are integers (pulse can be null).
   - date is a string in format "DD/MM/YY".
   - time_of_day is "AM", "PM", or null.
   - source_row is the row index as an integer (e.g. 3 for [3]).
   - valid is true/false (boolean).
   - reason_invalid is a string explanation or null.

Your priority is maximum accuracy and safety for clinical use:
- prefer dropping an uncertain reading over inventing data,
- follow the diary structure carefully,
- be conservative when guessing dates.`;

// Prompt for extracting raw OCR rows from image
const OCR_EXTRACTION_PROMPT = `You are an OCR text extraction assistant. Extract all visible text from this blood pressure diary image.

Output the text as numbered rows, one per line, in reading order (top-left to bottom-right, row by row):

ROWS:
[1] <first row of text>
[2] <second row of text>
[3] <third row of text>
...

Include ALL visible text including:
- Dates (e.g., 18/11/25)
- Time labels (AM, PM)
- Blood pressure readings (e.g., 147/93)
- Pulse numbers
- Any notes or labels

Preserve the original text exactly as written, including any apparent OCR errors or unclear characters.
Do not interpret or clean the text - just transcribe it accurately row by row.`;

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
              source_row: { type: 'number', description: 'The row index [n] from which this reading came' },
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

// Create a unique key for deduplication
function getReadingKey(r: RawReading): string {
  return `${r.date || 'nodate'}-${r.time_of_day || 'notime'}-${r.systolic}-${r.diastolic}`;
}

// Check if two readings are similar enough to be considered duplicates
function readingsAreSimilar(r1: RawReading, r2: RawReading): boolean {
  const sysDiff = Math.abs(r1.systolic - r2.systolic);
  const diaDiff = Math.abs(r1.diastolic - r2.diastolic);
  const sameDate = r1.date === r2.date;
  const sameTime = r1.time_of_day === r2.time_of_day;
  
  // Readings are similar if they have same date/time and values are within 5 mmHg
  return sameDate && sameTime && sysDiff <= 5 && diaDiff <= 5;
}

// Run extraction with a specific model
async function runExtractionPass(
  input: string,
  model: string,
  isImage: boolean,
  imageData?: string
): Promise<RawReading[]> {
  const messages = isImage
    ? [
        { role: 'system', content: BP_DIARY_PARSER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Parse the blood pressure readings from this diary image. Output as structured JSON.\n\nROWS:\n${input}` },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ]
    : [
        { role: 'system', content: BP_DIARY_PARSER_SYSTEM_PROMPT },
        { role: 'user', content: `Parse the blood pressure readings from this diary text.\n\n${input}` }
      ];

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: [BP_EXTRACTION_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${model} extraction error:`, errorText);
    return [];
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.readings || [];
    } catch (e) {
      console.error(`Failed to parse ${model} response:`, e);
    }
  }

  return [];
}

// Extract raw OCR rows from image
async function extractOCRRows(imageData: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: OCR_EXTRACTION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text from this blood pressure diary image as numbered rows.' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ]
    }),
  });

  if (!response.ok) {
    console.error('OCR extraction failed:', await response.text());
    return '';
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Merge readings from two passes with consensus logic
function mergeReadings(pass1: RawReading[], pass2: RawReading[]): BPReading[] {
  const merged: Map<string, BPReading> = new Map();
  const pass1Keys = new Set(pass1.map(getReadingKey));
  const pass2Keys = new Set(pass2.map(getReadingKey));

  // Process Pass 1 readings
  for (const r of pass1) {
    const key = getReadingKey(r);
    const inBoth = pass2Keys.has(key) || pass2.some(r2 => readingsAreSimilar(r, r2));
    
    merged.set(key, {
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? undefined,
      date: normalizeDate(r.date),
      time: normalizeTime(r.time_of_day),
      sourceRow: r.source_row,
      excluded: !r.valid,
      excludeReason: r.reason_invalid ?? undefined,
      confidence: inBoth ? 'confirmed' : 'single_source'
    });
  }

  // Process Pass 2 readings
  for (const r of pass2) {
    const key = getReadingKey(r);
    
    if (!merged.has(key)) {
      // Check if similar reading exists
      const similarKey = Array.from(merged.keys()).find(k => {
        const existing = merged.get(k);
        if (!existing) return false;
        const sysDiff = Math.abs(r.systolic - existing.systolic);
        const diaDiff = Math.abs(r.diastolic - existing.diastolic);
        return sysDiff <= 5 && diaDiff <= 5 && 
               normalizeDate(r.date) === existing.date &&
               normalizeTime(r.time_of_day) === existing.time;
      });

      if (similarKey) {
        // Values differ slightly - flag for review
        const existing = merged.get(similarKey)!;
        existing.confidence = 'needs_review';
        existing.excludeReason = existing.excludeReason 
          ? `${existing.excludeReason}; Values differ between passes`
          : 'Values differ between passes';
      } else {
        // New reading from Pass 2 only
        merged.set(key, {
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse ?? undefined,
          date: normalizeDate(r.date),
          time: normalizeTime(r.time_of_day),
          sourceRow: r.source_row,
          excluded: !r.valid,
          excludeReason: r.reason_invalid ?? undefined,
          confidence: 'single_source'
        });
      }
    }
  }

  return Array.from(merged.values());
}

// Format text into numbered rows
function formatAsNumberedRows(text: string): string {
  const lines = text.split('\n').filter(line => line.trim());
  const rows = lines.map((line, idx) => `[${idx + 1}] ${line.trim()}`);
  return `ROWS:\n${rows.join('\n')}`;
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, imageData, fileName, mode } = await req.json();
    
    console.log(`Processing BP readings in ${mode} mode with dual-pass OCR`);
    const startTime = Date.now();

    let readings: BPReading[] = [];
    let rawText = '';

    if (mode === 'image' && imageData) {
      // Step 1: Extract OCR rows from image
      console.log('Step 1: Extracting OCR rows from image...');
      const ocrRows = await extractOCRRows(imageData);
      rawText = ocrRows;
      console.log(`Extracted ${ocrRows.split('\n').length} OCR rows`);

      // Step 2: Run dual-pass extraction
      console.log('Step 2: Running dual-pass extraction (Flash + Pro)...');
      const [pass1Results, pass2Results] = await Promise.all([
        runExtractionPass(ocrRows, 'google/gemini-2.5-flash', true, imageData),
        runExtractionPass(ocrRows, 'google/gemini-2.5-pro', true, imageData)
      ]);

      console.log(`Pass 1 (Flash): ${pass1Results.length} readings`);
      console.log(`Pass 2 (Pro): ${pass2Results.length} readings`);

      // Step 3: Merge with consensus logic
      console.log('Step 3: Merging results with consensus logic...');
      readings = mergeReadings(pass1Results, pass2Results);
      console.log(`Merged: ${readings.length} unique readings`);

    } else if (mode === 'text' && text) {
      rawText = text;
      
      // Format text as numbered rows
      const formattedRows = formatAsNumberedRows(text);
      console.log('Formatted text into numbered rows');

      // Run dual-pass extraction on text
      console.log('Running dual-pass extraction on text...');
      const [pass1Results, pass2Results] = await Promise.all([
        runExtractionPass(formattedRows, 'google/gemini-2.5-flash', false),
        runExtractionPass(formattedRows, 'google/gemini-2.5-pro', false)
      ]);

      console.log(`Pass 1 (Flash): ${pass1Results.length} readings`);
      console.log(`Pass 2 (Pro): ${pass2Results.length} readings`);

      readings = mergeReadings(pass1Results, pass2Results);
      console.log(`Merged: ${readings.length} unique readings`);

    } else {
      throw new Error('Invalid input: provide either text or imageData');
    }

    // Apply server-side validation
    readings = applyServerValidation(readings);

    // Calculate statistics
    const validCount = readings.filter(r => !r.excluded).length;
    const confirmedCount = readings.filter(r => r.confidence === 'confirmed').length;
    const singleSourceCount = readings.filter(r => r.confidence === 'single_source').length;
    const needsReviewCount = readings.filter(r => r.confidence === 'needs_review').length;
    
    const duration = Date.now() - startTime;
    console.log(`Found ${readings.length} BP readings in ${duration}ms:`);
    console.log(`  - Valid: ${validCount}, Excluded: ${readings.length - validCount}`);
    console.log(`  - Confirmed (both passes): ${confirmedCount}`);
    console.log(`  - Single source: ${singleSourceCount}`);
    console.log(`  - Needs review: ${needsReviewCount}`);

    return new Response(
      JSON.stringify({ 
        readings,
        rawText: rawText.substring(0, 1000),
        stats: {
          total: readings.length,
          valid: validCount,
          excluded: readings.length - validCount,
          confirmed: confirmedCount,
          singleSource: singleSourceCount,
          needsReview: needsReviewCount,
          processingTimeMs: duration
        }
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
