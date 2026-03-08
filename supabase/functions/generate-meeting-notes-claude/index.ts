import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Updated to use Lovable AI with Gemini Flash (2M token context)
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// Note: GPT-5 tone audit removed - Gemini prompt already includes governance rules
// and performProfessionalToneAudit() handles pattern replacements locally without
// destroying markdown formatting or adding 75+ seconds of processing time

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// V2 Amanda-compliant system prompt for NHS governance
const SYSTEM_PROMPT_V2 = `You are an expert NHS meeting secretary. You create professional, factual, and neutral minutes suitable for board and governance distribution.
Use British English and adhere strictly to NHS and UK healthcare documentation standards.

Additional Behavioural Rules:
- Never include jokes, humour, idioms, or personal remarks (e.g. "wolf ready to pounce").
- Filter out gossip, personal anecdotes, or informal exchanges — only retain professional, factual, or decision-relevant dialogue.
- Replace informal references (e.g. "Rich's mother-in-law") with the person's correct role or designation if known (e.g. "SPLW candidate"). If uncertain, use a neutral descriptor like "a candidate for the SPLW post".
- Where tone in a section may sound critical, rephrase diplomatically (e.g. "members discussed differing perspectives on autonomy" rather than "the federation was criticised").
- Maintain balance: represent differing views fairly, but without attributing emotional tone.
- Prioritise clarity, professionalism, and governance readability over verbatim fidelity.
- NEVER use placeholder text in square brackets like [Insert X].`;

// Handle large transcripts with Gemini's 2M token context
function handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  console.log('🔧 Using Lovable AI with google/gemini-3-flash-preview');
  
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
    .replace(/Attendees:\s*\[Insert[^\]]*\]/gi, 'Attendees: TBC')
    // Remove Apologies: [Insert...]
    .replace(/Apologies:\s*\[Insert[^\]]*\]/gi, '')
    // Remove Owner: [Insert Owner Name]
    .replace(/Owner:\s*\[Insert[^\]]*\]/gi, 'Owner: Team member')
    // Clean up multiple blank lines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// Professional-tone audit post-processing (v2)
function performProfessionalToneAudit(content: string): string {
  if (!content) return content;
  
  let audited = content;
  
  // Remove judgemental or sarcastic phrases
  const judgemEntalPatterns = [
    { pattern: /complained about/gi, replacement: 'raised concerns regarding' },
    { pattern: /was criticised/gi, replacement: 'received feedback on' },
    { pattern: /criticised the/gi, replacement: 'expressed concerns about the' },
    { pattern: /attacked the/gi, replacement: 'questioned the' },
    { pattern: /blamed\s+(\w+)\s+for/gi, replacement: 'attributed responsibility to $1 for' },
    { pattern: /failed to/gi, replacement: 'did not' },
    { pattern: /refused to/gi, replacement: 'declined to' },
    { pattern: /angrily stated/gi, replacement: 'stated firmly' },
    { pattern: /frustrated by/gi, replacement: 'noted challenges with' },
    { pattern: /annoyed at/gi, replacement: 'expressed concerns about' },
    { pattern: /demanded that/gi, replacement: 'requested that' },
    { pattern: /insisted on/gi, replacement: 'emphasised the need for' },
    { pattern: /members complained/gi, replacement: 'members raised concerns' },
    { pattern: /staff complained/gi, replacement: 'staff raised concerns' },
    { pattern: /the federation was criticised/gi, replacement: 'members discussed differing perspectives on federation governance' },
    { pattern: /wolf ready to pounce/gi, replacement: '' },
    { pattern: /like a wolf/gi, replacement: '' },
  ];
  
  for (const { pattern, replacement } of judgemEntalPatterns) {
    audited = audited.replace(pattern, replacement);
  }
  
  // Remove informal/personal remarks
  const informalPatterns = [
    /\b(lol|haha|lmao)\b/gi,
    /\(laughs\)/gi,
    /\(laughter\)/gi,
    /mother-in-law/gi,
    /father-in-law/gi,
    /my wife|my husband|my partner/gi,
  ];
  
  for (const pattern of informalPatterns) {
    audited = audited.replace(pattern, '');
  }
  
  // Clean up any double spaces or excessive punctuation
  audited = audited
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return audited;
}

// Sanitise action item owners to prevent hallucinations
function sanitiseActionOwners(notes: string, transcript: string): string {
  if (!notes || !transcript) return notes;
  
  let sanitisedCount = 0;
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const hasExplicitAssignment = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    const escaped = escapeRegExp(name);
    const nameWord = `\\b${escaped}\\b`;
    const patterns = [
      new RegExp(`${nameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
      new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${nameWord}`, 'i'),
      new RegExp(`${nameWord}.*(?:responsible|owner|lead)`, 'i'),
      new RegExp(`assign(?:ed)?\\s+to\\s+${nameWord}`, 'i')
    ];
    const firstName = name.split(/\s+/)[0];
    if (firstName && firstName !== name) {
      const firstNameWord = `\\b${escapeRegExp(firstName)}\\b`;
      const firstNamePatterns = [
        new RegExp(`${firstNameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
        new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${firstNameWord}`, 'i'),
        new RegExp(`assign(?:ed)?\\s+to\\s+${firstNameWord}`, 'i')
      ];
      if (firstNamePatterns.some(p => p.test(text))) return true;
    }
    return patterns.some(p => p.test(text));
  };
  
  try {
    const actionHeaderMatch = notes.match(/(?:^|\n)(?:#{1,6}\s*|\d+\.\s*)ACTION ITEMS\b[\s\S]*/i);
    if (!actionHeaderMatch) return notes;
    
    const afterHeader = actionHeaderMatch[0];
    const headerIdx = notes.indexOf(afterHeader);
    const tableMatch = afterHeader.match(/\n\|.*\|\n\|[-:\s|]+\|\n([\s\S]*?)(?:\n(?:#{1,6}\s|\d+\.\s|$))/);
    if (!tableMatch) return notes;
    
    const tableHeader = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf('\n', tableMatch[0].indexOf('\n') + 1));
    const headerCells = tableHeader.split('\n')[0].split('|').map(c => c.trim()).filter(Boolean);
    const ownerColumnIdx = headerCells.findIndex(h => /responsible|owner|lead|assignee/i.test(h));
    if (ownerColumnIdx === -1) return notes;
    
    const tableRows = tableMatch[1].split('\n').map(r => r.trim()).filter(r => r.startsWith('|') && r.length > 2);
    const rebuiltRows = tableRows.map(row => {
      const cells = row.split('|').map(c => c.trim());
      if (cells.length > ownerColumnIdx + 1) {
        const responsible = cells[ownerColumnIdx + 1];
        if (responsible && responsible.toUpperCase() !== 'TBC' && responsible.trim() !== '') {
          if (!hasExplicitAssignment(transcript, responsible)) {
            cells[ownerColumnIdx + 1] = 'TBC';
            sanitisedCount++;
          }
        }
      }
      return cells.join(' | ');
    });
    
    const beforeTable = notes.substring(0, headerIdx + (tableMatch.index || 0));
    const tableStart = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf(tableMatch[1]));
    const afterTable = afterHeader.substring((tableMatch.index || 0) + tableMatch[0].length);
    const reconstructed = beforeTable + tableStart + rebuiltRows.join('\n') + '\n' + afterTable;
    
    if (sanitisedCount > 0) {
      console.log(`✅ Sanitiser (claude): set ${sanitisedCount} owner(s) to TBC`);
    }
    return reconstructed;
  } catch (error) {
    console.warn('⚠️ Error sanitising action owners:', error);
    return notes;
  }
}

async function consolidateChunkResults(chunkResults, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const startTime = Date.now();
  console.log('⏱️ Starting chunk consolidation...');
  
  const consolidationPrompt = `Consolidate these meeting minute chunks into a single comprehensive document. Use British English throughout.

CRITICAL RULES:
- Never use placeholder text like [Insert X] or [Not specified]
- If information is not available, omit the field entirely
- Use "TBC" for unknown attendees (attendees should be managed separately)
- Use "Location not specified" if location unknown
- Merge all agenda items chronologically
- Remove duplicate action items and decisions
- Maintain all specific details, names, dates
- Filter out any informal banter, personal anecdotes, humour, or off-topic remarks
- Ensure every paragraph could safely appear in a circulated Board pack

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
          content: SYSTEM_PROMPT_V2
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
  let sanitized = sanitizeMeetingMinutes(content);
  sanitized = performProfessionalToneAudit(sanitized);
  console.log(`🧹 Sanitization took: ${Date.now() - sanitizeStartTime}ms`);
  console.log(`⏱️ Total consolidation time: ${Date.now() - startTime}ms`);
  
  return sanitized;
}

async function processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const startTime = Date.now();
  console.log('🎯 Processing chunk with Gemini Flash - V2 Amanda-compliant');
  console.log(`📊 Transcript length: ${transcript.length} characters`);
  
  const meetingNotesPrompt = `You are a professional NHS meeting secretary creating detailed, factual minutes in British English.

Before producing the final minutes, analyse each transcript segment carefully.

PRE-FILTER RULES:
- Discard informal, humorous, or anecdotal remarks (e.g., jokes, metaphors, or personal asides such as "wolf ready to pounce").
- Replace any personal identifiers with the correct professional role or neutral descriptor (e.g., use "SPLW candidate" instead of "Rich's mother-in-law").
- When merging multiple segments, maintain a consistent, formal, and neutral tone suitable for circulation in Board or ICB documentation.
- Never reproduce off-topic or emotive language, or anything that could appear unprofessional in circulated minutes.

Then follow the full structure and rules below.

STRICT RULES:
- Use British English spellings and 24-hour time.
- Use British date format with ordinals (e.g., 22nd October 2025).
- Only include information actually present in the transcript.
- Never use placeholders or square brackets.
- If a section has no information, omit it entirely.
- Always write "TBC" for attendees (attendees handled separately).
- Write "Location not specified" if no venue is mentioned.

OUTPUT STRUCTURE:

# MEETING DETAILS
- Meeting Title: ${meetingTitle || 'General Meeting'}
- Date: ${meetingDate || 'Date not recorded'}
- Time: ${meetingTime || 'Time not recorded'}
- Location: [explicit or "Location not specified"]
- Attendees: TBC

# EXECUTIVE SUMMARY
Write 2–3 concise paragraphs covering purpose, key decisions, and next steps. Keep tone factual and balanced.

# DISCUSSION SUMMARY
For each major topic:
- Background: short context
- Key Points: bullet points with factual discussion points
- Outcome: summarise conclusions reached

# DECISIONS & RESOLUTIONS
Numbered list of decisions (omit section if none).

# ACTION ITEMS
| Action | Responsible Party | Deadline | Priority |
|--------|------------------|----------|----------|
| ... | ... | ... | ... |

Rules:
- Only include names/roles explicitly mentioned.
- Use "TBC" where not stated.

# FOLLOW-UP REQUIREMENTS
Bullet points of follow-up items.

# OPEN ITEMS & RISKS
Bullet points for unresolved matters.

# NEXT MEETING
Include only if explicitly mentioned.

FINAL CHECK:
Before output, review tone and remove any phrases that could appear judgemental or critical. Use diplomatic, governance-appropriate wording (e.g., "members discussed differing perspectives" instead of "members criticised").

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
          content: SYSTEM_PROMPT_V2
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
  let sanitized = sanitizeMeetingMinutes(content);
  sanitized = performProfessionalToneAudit(sanitized);
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
              content: SYSTEM_PROMPT_V2
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
      generatedNotes = performProfessionalToneAudit(generatedNotes);
      generatedNotes = sanitiseActionOwners(generatedNotes, transcript);
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
      meetingMinutes = sanitiseActionOwners(meetingMinutes, transcript);
    } else {
      // Standard single processing
      meetingMinutes = await processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
      meetingMinutes = sanitiseActionOwners(meetingMinutes, transcript);
    }

    const totalTime = Date.now() - functionStartTime;
    console.log('✅ Lovable AI meeting minutes generated successfully');
    console.log('📝 Generated minutes preview:', meetingMinutes.substring(0, 500));
    console.log(`⏱️ Total function execution time: ${totalTime}ms`);

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: meetingMinutes,
      generatedNotes: meetingMinutes,
      processingTimeMs: totalTime
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
