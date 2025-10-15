import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add this function to handle large transcripts
function handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  if (transcript.length > 25000) {
    // Implement chunking strategy
    return processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  } else {
    // Use standard single API call
    return processSingle(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  }
}

function processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const words = transcript.split(' ');
  const chunkSize = 20000; // Words per chunk
  const overlap = 2000; // Word overlap between chunks
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  
  return { chunks, strategy: 'chunked' };
}

function processSingle(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  return { transcript, strategy: 'single' };
}

// Sanitize output to remove placeholders
function sanitizeMeetingMinutes(content: string): string {
  return content
    // Remove [Insert X] patterns
    .replace(/\[Insert[^\]]*\]/gi, '')
    // Remove Location: [Insert Location]
    .replace(/Location:\s*\[Insert[^\]]*\]/gi, 'Location: Location not specified')
    // Remove Attendees: [Insert...]
    .replace(/Attendees:\s*\[Insert[^\]]*\]/gi, 'Attendees: Practice team members')
    // Remove Apologies: [Insert...]
    .replace(/Apologies:\s*\[Insert[^\]]*\]/gi, '')
    // Remove Owner: [Insert Owner Name]
    .replace(/Owner:\s*\[Insert[^\]]*\]/gi, 'Owner: Team member')
    // Clean up multiple blank lines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

async function consolidateChunkResults(chunkResults, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const consolidationPrompt = `Consolidate these meeting minute chunks into a single comprehensive document. Use British English throughout.

CRITICAL RULES:
- Never use placeholder text like [Insert X] or [Not specified]
- If information is not available, omit the field entirely
- Use "Practice team members" for unknown attendees
- Use "Location not specified" if location unknown
- Merge all agenda items chronologically
- Remove duplicate action items and decisions
- Maintain all specific details, names, dates

CHUNK RESULTS TO CONSOLIDATE:
${chunkResults.join('\n\n--- CHUNK SEPARATOR ---\n\n')}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert meeting secretary for NHS and UK healthcare organisations. Use British English and never include placeholder text in square brackets.' 
        },
        { 
          role: 'user', 
          content: consolidationPrompt 
        }
      ],
      max_completion_tokens: 8192
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error during consolidation: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return sanitizeMeetingMinutes(content);
}

async function processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  console.log('🎯 Processing chunk with GPT-5 - NO PLACEHOLDERS');
  
  const meetingNotesPrompt = `You are a professional meeting secretary creating detailed minutes using British English. Analyse the transcript and produce polished, factual minutes.

STRICT RULES:
- Use British English spellings and 24-hour time format throughout
- Use British date formats with ordinals (e.g., 22nd October 2025)
- Only include information actually present in the transcript
- NEVER use placeholders or square brackets like [Insert X], [Not specified], [To be confirmed]
- If information is not available, omit the field/section entirely
- Use "Practice team members" for unknown attendees
- Use "Location not specified" if location is unknown
- Capture ALL agenda items, decisions, and action items from the transcript

OUTPUT STRUCTURE:

# MEETING DETAILS
- Meeting Title: ${meetingTitle || 'General Meeting'}
- Date: ${meetingDate || 'Date not recorded'}
- Time: ${meetingTime || 'Time not recorded'}
- Location: [Only if explicitly mentioned in transcript, otherwise write "Location not specified"]
- Attendees: [List specific names/roles if mentioned, otherwise write "Practice team members"]

# EXECUTIVE SUMMARY
Write 2-3 concise paragraphs covering: meeting purpose, key decisions, major outcomes, and next steps.

# DISCUSSION SUMMARY
For each major topic discussed:
- Background: Brief context
- Key Points: Bullet points with important details
- Outcome: Conclusions or decisions reached

# DECISIONS & RESOLUTIONS
Numbered list of specific decisions made. Omit section if no decisions.

# ACTION ITEMS
Markdown table only if actions exist:
| Action | Responsible Party | Deadline | Priority |
|--------|------------------|----------|----------|

Use real names/roles from transcript. Use "To be determined" for unspecified deadlines.

# FOLLOW-UP REQUIREMENTS
Bullet points for monitoring/check-ins mentioned. Omit if none.

# OPEN ITEMS & RISKS
Bullet points for unresolved issues or risks. Omit if none.

# NEXT MEETING
Only include if explicitly scheduled in transcript.

TRANSCRIPT:
${transcript}`;

  console.log('Processing chunk for meeting:', meetingTitle);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert meeting secretary for NHS and UK healthcare organisations. Use British English and never include placeholder text in square brackets.' 
        },
        { 
          role: 'user', 
          content: meetingNotesPrompt 
        }
      ],
      max_completion_tokens: 8192
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('OpenAI API error:', response.status, await response.text());
    throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return sanitizeMeetingMinutes(content);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, meetingTitle, meetingDate, meetingTime, detailLevel, customPrompt } = await req.json();

    console.log('🔍 Request details:', {
      hasTranscript: !!transcript,
      hasCustomPrompt: !!customPrompt,
      customPromptLength: customPrompt ? customPrompt.length : 0,
      detailLevel: detailLevel
    });

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    // If customPrompt is provided, use it directly with GPT-5
    if (customPrompt) {
      console.log('🎨 Using custom prompt for generation');
      console.log('📝 Custom prompt preview:', customPrompt.substring(0, 200) + '...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert meeting secretary for NHS and UK healthcare organisations. Use British English throughout and never include placeholder text in square brackets like [Insert X].' 
            },
            { 
              role: 'user', 
              content: customPrompt
            }
          ],
          max_completion_tokens: 8192
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', response.status, errorData);
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let generatedNotes = data.choices[0].message.content;
      
      // Sanitize output
      generatedNotes = sanitizeMeetingMinutes(generatedNotes);
      
      console.log('✅ Custom prompt generated successfully');
      console.log('📝 Generated preview:', generatedNotes.substring(0, 300));

      return new Response(JSON.stringify({
        meetingMinutes: generatedNotes,
        generatedNotes: generatedNotes,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const level = (detailLevel || 'standard').toString().toLowerCase();
    
    // Determine style based on detailLevel
    let styleChoice = 1; // Default to Professional Business
    if (level === 'informal' || level === 'original') {
      styleChoice = 2; // Original Informal
    } else if (level === 'nhs' || level === 'formal') {
      styleChoice = 3; // NHS Formal
    }

    // Handle large transcripts with chunking strategy
    const processingResult = handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
    
    let meetingMinutes;
    
    if (processingResult.strategy === 'chunked') {
      console.log(`Processing large transcript with ${processingResult.chunks.length} chunks`);
      
      // Process chunks and consolidate results
      const chunkResults = [];
      
      for (let i = 0; i < processingResult.chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${processingResult.chunks.length}`);
        const chunkMinutes = await processChunk(processingResult.chunks[i], meetingTitle, meetingDate, meetingTime, styleChoice);
        chunkResults.push(chunkMinutes);
      }
      
      console.log('Consolidating chunk results');
      // Consolidate chunk results
      meetingMinutes = await consolidateChunkResults(chunkResults, meetingTitle, meetingDate, meetingTime, styleChoice);
    } else {
      // Standard single processing
      meetingMinutes = await processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
    }

    console.log('GPT-5 meeting minutes generated successfully');
    console.log('Generated minutes preview:', meetingMinutes.substring(0, 500));

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: meetingMinutes 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-claude function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});