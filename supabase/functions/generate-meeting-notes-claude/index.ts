import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Updated to use Lovable AI with Gemini Flash (2M token context)
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle large transcripts with Gemini's 2M token context
function handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  console.log('🔧 Using Lovable AI with google/gemini-2.5-flash (2M token context)');
  
  // Gemini can handle ~2M tokens (~500K characters) - much larger than GPT-5-nano
  if (transcript.length > 500000) {
    console.log('⚠️ Transcript exceeds 500K chars, using chunked processing');
    return processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  } else {
    // Use standard single API call
    return processSingle(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  }
}

function processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const words = transcript.split(' ');
  const chunkSize = 100000; // Words per chunk (increased for Gemini)
  const overlap = 5000; // Word overlap between chunks
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
  const startTime = Date.now();
  console.log('⏱️ Starting chunk consolidation...');
  
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

  const apiStartTime = Date.now();
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
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
      max_completion_tokens: 2000
    }),
  });

  const apiEndTime = Date.now();
  console.log(`⚡ Lovable AI consolidation took: ${apiEndTime - apiStartTime}ms`);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 402) {
      throw new Error('Insufficient Lovable AI credits. Please contact support.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`AI service error during consolidation: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const sanitizeStartTime = Date.now();
  const sanitized = sanitizeMeetingMinutes(content);
  console.log(`🧹 Sanitization took: ${Date.now() - sanitizeStartTime}ms`);
  console.log(`⏱️ Total consolidation time: ${Date.now() - startTime}ms`);
  
  return sanitized;
}

async function processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const startTime = Date.now();
  console.log('🎯 Processing chunk with Gemini Flash - NO PLACEHOLDERS');
  console.log(`📊 Transcript length: ${transcript.length} characters`);
  
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

CRITICAL: ONLY use names/roles EXPLICITLY mentioned in transcript as responsible for specific actions. If not stated, write "TBC". Use "TBC" for unspecified deadlines. NEVER infer or assume responsibility.

# FOLLOW-UP REQUIREMENTS
Bullet points for monitoring/check-ins mentioned. Omit if none.

# OPEN ITEMS & RISKS
Bullet points for unresolved issues or risks. Omit if none.

# NEXT MEETING
Only include if explicitly scheduled in transcript.

DO NOT include a "Meeting Transcript for Reference" section.

TRANSCRIPT:
${transcript}`;

  console.log('📤 Sending request to Lovable AI (Gemini Flash)...');
  const apiStartTime = Date.now();

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
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
      max_completion_tokens: 2000
    }),
  });

  const apiEndTime = Date.now();
  console.log(`⚡ Lovable AI response received in: ${apiEndTime - apiStartTime}ms`);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 402) {
      throw new Error('Insufficient Lovable AI credits. Please contact support.');
    }
    const errorData = await response.json().catch(() => ({}));
    console.error('Lovable AI error:', response.status, errorData);
    throw new Error(`AI service error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const sanitizeStartTime = Date.now();
  const sanitized = sanitizeMeetingMinutes(content);
  console.log(`🧹 Sanitization took: ${Date.now() - sanitizeStartTime}ms`);
  console.log(`⏱️ Total chunk processing time: ${Date.now() - startTime}ms`);
  
  return sanitized;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionStartTime = Date.now();
  console.log('🚀 Function invoked at:', new Date().toISOString());

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

    // If customPrompt is provided, use it directly with Gemini
    if (customPrompt) {
      console.log('🎨 Using custom prompt for generation');
      console.log('📝 Custom prompt preview:', customPrompt.substring(0, 200) + '...');
      
      const customApiStartTime = Date.now();
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
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
          max_completion_tokens: 2000
        }),
      });

      const customApiEndTime = Date.now();
      console.log(`⚡ Custom prompt API call took: ${customApiEndTime - customApiStartTime}ms`);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('Insufficient Lovable AI credits. Please contact support.');
        }
        const errorData = await response.json().catch(() => ({}));
        console.error('Lovable AI error:', response.status, errorData);
        throw new Error(`AI service error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let generatedNotes = data.choices[0].message.content;
      
      // Sanitize output
      const sanitizeStartTime = Date.now();
      generatedNotes = sanitizeMeetingMinutes(generatedNotes);
      console.log(`🧹 Sanitization took: ${Date.now() - sanitizeStartTime}ms`);
      
      console.log('✅ Custom prompt generated successfully');
      console.log('📝 Generated preview:', generatedNotes.substring(0, 300));
      console.log(`⏱️ Total custom prompt processing: ${Date.now() - functionStartTime}ms`);

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

    const totalTime = Date.now() - functionStartTime;
    console.log('✅ Lovable AI meeting minutes generated successfully');
    console.log('📝 Generated minutes preview:', meetingMinutes.substring(0, 500));
    console.log(`⏱️ TOTAL FUNCTION EXECUTION TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: meetingMinutes,
      processingTimeMs: totalTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-claude function:', error);
    
    // Return user-friendly error messages
    let userMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes('Rate limit')) {
      statusCode = 429;
    } else if (error.message.includes('credits')) {
      statusCode = 402;
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: userMessage
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
