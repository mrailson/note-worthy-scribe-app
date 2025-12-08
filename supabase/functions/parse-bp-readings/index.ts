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
  position?: 'sitting' | 'standing' | 'standard';
  standingMinutes?: number;
}

// Enhanced BP Diary Parser System Prompt for UK GP Practice with Sit/Stand support
const BP_DIARY_PARSER_SYSTEM_PROMPT = `You are a blood pressure (BP) diary parser for a UK general practice.

You receive a HOME blood pressure diary page. The diary may contain:
1. Standard home BP readings (single column)
2. Sit/Stand BP assessments with separate Sitting and Standing columns

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
- position ("sitting", "standing", or null for standard readings)
- standing_minutes (1 or 3 if standing reading indicates time after standing, null otherwise)
- valid (true/false)
- reason_invalid (string or null)

POSITION DETECTION RULES
------------------------

1. Column Headers: Look for column headers indicating "Sitting" or "Standing":
   - "Sitting", "Sit", "Seated", "Sat" → position = "sitting"
   - "Standing", "Stand", "Stood" → position = "standing"
   
2. If the document has separate Sitting and Standing columns:
   - Readings under the "Sitting" column header → position = "sitting"
   - Readings under the "Standing" column header → position = "standing"
   
3. Inline Position Markers: Look for position indicators in text:
   - "Sitting: 140/90" or "Sit 140/90" → position = "sitting"
   - "Standing: 130/85" or "Stand 130/85" → position = "standing"
   - "After 1 min standing", "1 min", "1min" → standing_minutes = 1
   - "After 3 min standing", "3 min", "3min" → standing_minutes = 3
   
4. If no position indicators are found, set position = null (standard reading)

5. IMPORTANT: In spreadsheet/tabular data with Sitting and Standing columns:
   - Extract BOTH sitting AND standing readings as separate entries
   - Each row with both values should produce TWO readings: one sitting, one standing
   - Use the same date/time for both but different positions

RULES (BP PARSING)
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
   - For Sit/Stand data, each position column may have its own pulse value.
   - If no suitable third number is present, set pulse = null.
   - Ignore obvious noise numbers (e.g. page numbers, 2025, etc.).

3. Time-of-day (AM/PM)
   - If the row contains "AM" or "PM" (any case), use that as time_of_day.
   - If a row has a BP but no AM/PM, and the immediately previous BP row in the same column has AM or PM, INHERIT that value.
   - If a time like "1145" or "2100" is given, infer AM (before 12:00) or PM (12:00 onwards).
   - If you cannot infer AM/PM reliably, set time_of_day = null.

4. Date handling and INHERITANCE (critical)
   - Diaries are organised by DATE at the top of a column or as a row label.
   - Date formats: "1st", "2nd", "3rd", "4th"... should be interpreted with the month/year context.
   - If the dominant month is October 2025, "1st" = "01/10/25", "15th" = "15/10/25".
   - For the next BP rows in sequence, if they do NOT contain their own date, INHERIT current_date.
   - Never leave date empty if there is an obvious date immediately above in the same sequence of rows.
   - DO NOT invent dates that do not appear at all in the page.

5. Multiple readings on the same date
   - It is normal to have both AM and PM readings on the same date.
   - It is also normal to have both Sitting and Standing readings at the same time.
   - Create separate reading entries for each.

6. Validity and exclusion
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

// Enhanced handwriting recognition prompt for vision mode with Sit/Stand
const HANDWRITING_VISION_PROMPT = `HANDWRITTEN DOCUMENT ANALYSIS - BLOOD PRESSURE DIARY (with Sit/Stand Support)

Please perform careful handwriting recognition on this BP diary image:

1. SCAN THE ENTIRE PAGE systematically from top-left to bottom-right

2. IDENTIFY THE LAYOUT TYPE:
   a) Standard BP diary (single BP column per time)
   b) Sit/Stand assessment (separate Sitting and Standing columns)
   
3. LOOK FOR COLUMN HEADERS:
   - "Sitting", "Sit", "Seated" columns → position = "sitting"  
   - "Standing", "Stand", "Stood" columns → position = "standing"
   - If Sitting and Standing columns exist, extract BOTH readings per row

4. For each column/section, read from TOP to BOTTOM:
   - Look for the DATE (DD/MM/YY format, or "1st", "2nd", etc.)
   - Find AM/PM indicators or times like "1145", "2100"
   - BP format is typically NNN/NN or NN/NN (systolic/diastolic)
   - Pulse may appear as a third number after BP

5. FOR SIT/STAND SPREADSHEETS:
   - Each row typically has: Date | Time | Sitting SYS/DIA/Pulse | Standing SYS/DIA/Pulse
   - Create TWO readings per row: one with position="sitting", one with position="standing"
   - Use same date/time for both readings

6. HANDWRITING RECOGNITION TIPS:
   - 1 and 7 can look similar - check context and typical BP values
   - 4 and 9 may be confused - verify with typical BP ranges
   - 0 and 6 handwritten can look alike
   - Slashes in BP readings (/) may be faint or angled

7. EXTRACT EVERY VISIBLE BP READING - do not skip any.

Call the extract_bp_readings function with ALL readings found, including position for each.`;

// Tool schema for structured BP extraction with position fields
const BP_EXTRACTION_TOOL = {
  type: 'function',
  function: {
    name: 'extract_bp_readings',
    description: 'Extract blood pressure readings from BP diary, including position (sitting/standing) where indicated',
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
              position: { type: 'string', enum: ['sitting', 'standing'], description: 'Position when reading was taken: "sitting" or "standing". Null if not specified (standard reading).' },
              standing_minutes: { type: 'number', enum: [1, 3], description: 'Minutes after standing for standing readings (1 or 3), null otherwise' },
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

// Detect if text contains sit/stand indicators
function detectSitStandMode(text: string): boolean {
  const sitStandPatterns = [
    /\bsitting\b/i,
    /\bstanding\b/i,
    /\bsit\b/i,
    /\bstand\b/i,
    /\bseated\b/i,
    /\bpostural\b/i,
    /sitting.*standing/i,
    /sit.*stand/i
  ];
  return sitStandPatterns.some(pattern => pattern.test(text));
}

// Run single extraction with specified model
async function runExtraction(
  content: { type: 'text'; text: string } | { type: 'image'; dataUrl: string },
  model: string = 'google/gemini-2.5-flash',
  isSitStandMode: boolean = false
): Promise<BPReading[]> {
  const messages: any[] = [];
  
  // Auto-detect sit/stand from text content
  if (content.type === 'text') {
    isSitStandMode = isSitStandMode || detectSitStandMode(content.text);
  }
  
  const sitStandInstruction = isSitStandMode 
    ? '\n\nIMPORTANT: This appears to be a Sit/Stand BP assessment. Look carefully for Sitting and Standing columns or indicators. Extract BOTH sitting and standing readings as separate entries with the appropriate position field.'
    : '';
  
  if (content.type === 'image') {
    // Vision mode - optimized for handwritten document analysis
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: HANDWRITING_VISION_PROMPT + sitStandInstruction },
        { type: 'image_url', image_url: { url: content.dataUrl } }
      ]
    });
  } else {
    // Text mode - format as numbered rows
    const formattedText = formatAsNumberedRows(content.text);
    
    // Check if this looks like CSV/tabular data with Sitting/Standing columns
    const hasTableHeaders = content.text.toLowerCase().includes('sitting') && 
                           content.text.toLowerCase().includes('standing');
    
    const tableInstruction = hasTableHeaders 
      ? `\n\nCRITICAL: This is TABULAR data with SEPARATE Sitting and Standing columns. 
For EACH ROW that has BP readings in both Sitting AND Standing columns, you MUST create TWO separate readings:
1. One reading with position="sitting" using the Sitting column values (SYS, DIA, Pulse)
2. One reading with position="standing" using the Standing column values (SYS, DIA, Pulse)
Both readings should have the same date and time.

Example: If row shows "1st,1145,136,/,67,54,118,/,65,56" 
- Create reading 1: systolic=136, diastolic=67, pulse=54, position="sitting"
- Create reading 2: systolic=118, diastolic=65, pulse=56, position="standing"`
      : '';
    
    messages.push({
      role: 'user',
      content: `Parse the blood pressure readings from this diary text. Call the extract_bp_readings function with the results.${sitStandInstruction}${tableInstruction}\n\n${formattedText}`
    });
  }

  console.log(`Calling ${model} for extraction (sitStandMode: ${isSitStandMode})...`);
  const extractStart = Date.now();
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: BP_DIARY_PARSER_SYSTEM_PROMPT },
        ...messages
      ],
      tools: [BP_EXTRACTION_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_bp_readings' } }
    }),
  });
  
  console.log(`${model} API call took ${Date.now() - extractStart}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Extraction error:', response.status, errorText);
    throw new Error(`Extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const rawReadings = parsed.readings || [];
      
      console.log(`Parsed ${rawReadings.length} raw readings from AI response`);
      
      // Log position distribution
      const sittingCount = rawReadings.filter((r: any) => r.position === 'sitting').length;
      const standingCount = rawReadings.filter((r: any) => r.position === 'standing').length;
      const standardCount = rawReadings.filter((r: any) => !r.position).length;
      console.log(`Position breakdown: ${sittingCount} sitting, ${standingCount} standing, ${standardCount} standard`);
      
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
        confidence: 'confirmed' as const,
        position: r.position ?? undefined,
        standingMinutes: r.standing_minutes ?? undefined
      }));
    } catch (e) {
      console.error('Failed to parse response:', e);
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
          confidence: 'confirmed' as const,
          position: r.position ?? undefined,
          standingMinutes: r.standing_minutes ?? undefined
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
    const { text, imageData, dataUrl, mode, isSitStandMode } = await req.json();
    const imageSource = imageData || dataUrl; // Support both parameter names
    
    // Default to Flash for speed
    const model = 'google/gemini-2.5-flash';
    console.log(`Processing BP readings in ${mode} mode with ${model}, sitStandMode: ${isSitStandMode}`);
    const startTime = Date.now();

    let readings: BPReading[] = [];

    if (mode === 'image' && imageSource) {
      // Single-pass vision extraction
      console.log(`Running vision extraction with ${model} (handwriting optimized)...`);
      readings = await runExtraction({ type: 'image', dataUrl: imageSource }, model, isSitStandMode);
      console.log(`Extracted ${readings.length} readings from image`);
    } else if (text) {
      // Text mode extraction
      console.log(`Running text extraction with ${model}...`);
      readings = await runExtraction({ type: 'text', text }, model, isSitStandMode);
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
