import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

// Large transcript cleaning functions
function splitTextIntoChunks(text: string, target = 3500, overlap = 200): string[] {
  if (text.length <= target) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);

    // try to end on a sentence boundary
    const boundary = text.lastIndexOf('.', end);
    if (boundary > start + target * 0.6) {
      end = boundary + 1;
    } else {
      const q = text.lastIndexOf('?', end);
      const e = text.lastIndexOf('!', end);
      const best = Math.max(q, e);
      if (best > start + target * 0.6) end = best + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function dedupeBoundary(prev: string, next: string): string {
  // Remove duplicated overlap from start of next if present
  const tail = prev.slice(-220);
  if (!tail) return next;
  const normalizedTail = tail.replace(/\s+/g, ' ').trim();
  let candidate = next;
  for (let k = 220; k >= 80; k -= 20) {
    const t = normalizedTail.slice(-k);
    const re = new RegExp('^' + escapeRegExp(t).replace(/\s+/g, '\\s+'));
    if (re.test(candidate.replace(/\s+/g, ' ').trim())) {
      // strip the matching prefix (approximate)
      const idx = candidate.toLowerCase().indexOf(t.toLowerCase());
      if (idx === 0) {
        return candidate.slice(t.length).trimStart();
      }
    }
  }
  return next;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeCleanedChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';
  let out = chunks[0].trim();
  for (let i = 1; i < chunks.length; i++) {
    const cleanedNext = dedupeBoundary(out, chunks[i]);
    out = `${out}\n\n${cleanedNext.trim()}`;
  }
  return out.trim();
}

async function cleanLargeTranscript(
  rawTranscript: string,
  meetingTitle: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  const chunks = splitTextIntoChunks(rawTranscript, 3500, 200);
  const results: string[] = new Array(chunks.length);

  // Process chunks sequentially to avoid overwhelming the system
  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/gpt-clean-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: chunks[i] }),
      });

      if (response.ok) {
        const data = await response.json();
        results[i] = data.cleanedTranscript || chunks[i];
      } else {
        results[i] = chunks[i]; // fallback to original chunk
      }
    } catch (error) {
      console.warn(`⚠️ Failed to clean chunk ${i + 1}/${chunks.length}:`, error);
      results[i] = chunks[i]; // fallback to original chunk
    }
  }

  return mergeCleanedChunks(results);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId, forceRegenerate = false } = await req.json();
    console.log('🤖 Auto-generating notes for meeting:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Add retry logic for race conditions - wait a moment for the meeting to be fully committed
    let meeting;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      // Get meeting details with retry logic - explicitly select context fields
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*, agenda, participants, meeting_context, meeting_location, meeting_format')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError) {
        console.error('❌ Database error fetching meeting:', meetingError);
        throw new Error(`Database error: ${meetingError.message}`);
      }

      if (meetingData) {
        meeting = meetingData;
        break;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`⏳ Meeting not found, retrying in 2s (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('❌ Meeting not found after all retries:', meetingId);
        throw new Error(`Meeting not found with ID: ${meetingId}`);
      }
    }

    // Validate meeting has transcript data before proceeding
    const { data: initialTranscriptCheck } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });
    
    const initialTranscriptData = initialTranscriptCheck?.[0];
    const hasTranscript = initialTranscriptData?.transcript && initialTranscriptData.transcript.trim().length > 0;
    
    if (!hasTranscript) {
      console.log('⚠️ Meeting found but no transcript available yet, will retry later');
      return new Response(
        JSON.stringify({ message: 'Meeting has no transcript yet, will retry later', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if notes already exist and we're not forcing regeneration
    if (!forceRegenerate) {
      const { data: existingSummary } = await supabase
        .from('meeting_summaries')
        .select('id')
        .eq('meeting_id', meetingId)
        .single();

      if (existingSummary) {
        console.log('📝 Notes already exist for meeting, skipping generation');
        return new Response(
          JSON.stringify({ message: 'Notes already exist', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update meeting status to generating
    await supabase
      .from('meetings')
      .update({ notes_generation_status: 'generating' })
      .eq('id', meetingId);

    // Get transcript using the database function that checks all possible sources
    const { data: finalTranscriptResult, error: transcriptError } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    if (transcriptError) {
      console.error('❌ Error fetching transcript:', transcriptError);
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
      throw new Error(`Failed to fetch transcript: ${transcriptError.message}`);
    }

    const transcriptData = finalTranscriptResult?.[0];
    const fullTranscript = transcriptData?.transcript || '';
    const transcriptSource = transcriptData?.source || 'unknown';
    const itemCount = transcriptData?.item_count || 0;
    
    console.log(`📄 Found transcript from ${transcriptSource} with ${itemCount} items, ${fullTranscript.length} chars`);
    
    if (!fullTranscript.trim()) {
      console.log('⚠️ No transcript found for meeting');
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
      
      throw new Error('No transcript available for notes generation');
    }

    console.log('📄 Raw transcript length:', fullTranscript.length, 'chars');

    // Calculate word count for the meeting
    const wordCount = fullTranscript.split(/\s+/).filter(word => word.length > 0).length;
    console.log('📊 Word count:', wordCount);

    // Smart cleaning strategy: skip for small/medium transcripts
    let cleanedTranscript = fullTranscript;
    let transcriptUsed = 'raw';
    const transcriptLength = fullTranscript.length;
    
    console.log('📊 Transcript length:', transcriptLength, 'chars (~', Math.round(transcriptLength / 4), 'words)');
    
    // Only clean very large transcripts (>500K chars)
    // Gemini Flash can handle up to ~2M tokens, so most transcripts don't need cleaning
    if (transcriptLength < 500000) {
      console.log('⚡ Skipping cleaning - transcript within Gemini context window');
      cleanedTranscript = fullTranscript;
      transcriptUsed = 'raw-optimized';
    } else {
      // Very large transcript - use cleaning
      try {
        console.log('🧹 Large transcript detected (>500K chars), using Lovable AI cleaning...');
        cleanedTranscript = await cleanLargeTranscript(fullTranscript, meeting.title, supabaseUrl, supabaseServiceKey);
        transcriptUsed = 'lovable-cleaned';
        console.log('✅ Cleaning completed:', fullTranscript.length, '→', cleanedTranscript.length, 'chars');
      } catch (cleanError) {
        console.warn('⚠️ Transcript cleaning failed, using original:', cleanError.message);
        cleanedTranscript = fullTranscript;
        transcriptUsed = 'raw-fallback';
      }
    }

    console.log('📄 Using', transcriptUsed, 'transcript for notes generation');

    // Generate notes using Lovable AI
    let systemPrompt = `You are an expert meeting notes assistant. Create comprehensive, professional meeting notes from ANY provided transcript content.

CRITICAL INSTRUCTIONS:
- ALWAYS generate structured business meeting notes regardless of the content type (meetings, discussions, educational content, documentaries, etc.)
- Transform any audio/video transcript into professional business-style meeting notes
- Extract business-relevant information, decisions, action items, and discussion points from any content
- Never refuse to generate notes based on content type - treat all content as meeting material`;

    // Add raw transcript handling note if cleaning was skipped
    if (transcriptUsed === 'raw-optimized') {
      systemPrompt += `

NOTE ON TRANSCRIPT QUALITY:
- This transcript may contain minor speech recognition artifacts, duplicates, or fragments
- Intelligently filter out obvious duplicates and fragments whilst preserving all meaningful content
- Focus on extracting the core business information and decisions from the content`;
    }

    systemPrompt += `

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: Wednesday 31st August 2025 (including day of week)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions for professional language and formatting
- Use £ symbol positioning following UK conventions

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

Start with a descriptive document title based on the meeting content (e.g., "Practice Partnership Meeting - Strategic Planning Review")

Then add: Date: [Day of week] [Day with ordinal] [Month] [Year]

Then use these sections with # headers (level 1):

# MEETING DETAILS
- Meeting Title: [from metadata]
- Date: [full British format with day of week]
- Time: [24-hour format]
- Location: [from authoritative context - DO NOT CHANGE THIS]

# EXECUTIVE SUMMARY
Write 2-3 substantial paragraphs that capture the essence of the content. Include:
- Main focus areas, initiatives, or programmes discussed  
- Key decisions made and their context
- Important timelines, deadlines, or milestones mentioned
- Critical issues, concerns, or challenges raised
- Specific details that make this content memorable and distinguishable
- Financial, operational, or strategic implications discussed

# ATTENDEES
- [Name]
- [Name]
(List each attendee's name on a separate bullet point)

# DISCUSSION SUMMARY

Background
[Write a context-setting paragraph explaining what led to this meeting and the key topics to be addressed]

Key Points
1. [First major discussion point with full context and outcomes]

2. [Second major discussion point with details]

3. [Continue with all significant discussion items]

# ACTION ITEMS
| Action | Responsible Party | Deadline | Priority |
|--------|-------------------|----------|----------|
| [Specific task description] | [Person's name] | [Date or timeframe] | High/Medium/Low |
| [Next action item] | [Person's name] | [Date or timeframe] | High/Medium/Low |

(Format as a proper markdown table with these exact column headers)

# OPEN ITEMS & RISKS
- [Items deferred or requiring future consideration with context]
- [Outstanding issues or unresolved questions that need follow-up]
- [Strategic considerations for future meetings or decisions]

# NEXT MEETING
[State the next meeting date if mentioned, or write "To be determined" if not specified]

CRITICAL FORMATTING RULES:
- Use # (level 1 headers) for ALL main sections
- Start document with a specific descriptive title
- Include day of week in all dates (e.g., "Wednesday 15th October 2025")
- ACTION ITEMS MUST be a properly formatted markdown table with pipes (|)
- Do not use ## (level 2 headers) for main sections
- Respect the authoritative location provided - never contradict it

Make the executive summary rich in detail and context. Focus on creating a narrative that captures the content's purpose, main discussions, and outcomes in a way that would help someone quickly understand what this was about even months later.`;

    // Format date in British format with day of week
    const meetingDate = new Date(meeting.created_at);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = daysOfWeek[meetingDate.getDay()];
    const day = meetingDate.getDate();
    const ordinalSuffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${dayOfWeek} ${day}${ordinalSuffix(day)} ${months[meetingDate.getMonth()]} ${meetingDate.getFullYear()}`;

    // Build authoritative context information from meeting metadata
    let locationContext = '';
    if (meeting.meeting_format === 'teams') {
      locationContext = '- Location: Online (Microsoft Teams)\n';
    } else if (meeting.meeting_format === 'hybrid') {
      locationContext = meeting.meeting_location 
        ? `- Location: ${meeting.meeting_location} and Online (Hybrid)\n`
        : '- Location: Hybrid (Online + on-site)\n';
    } else if (meeting.meeting_format === 'face-to-face' && meeting.meeting_location) {
      locationContext = `- Location: ${meeting.meeting_location}\n`;
    }

    const contextInfo = `**MEETING CONTEXT (AUTHORITATIVE - DO NOT CONTRADICT):**
${meeting.agenda ? `- Agenda: ${meeting.agenda}\n` : ''}${meeting.participants?.length ? `- Attendees: ${meeting.participants.join(', ')}\n` : ''}${locationContext}${meeting.meeting_format ? `- Format: ${meeting.meeting_format === 'teams' ? 'MS Teams' : meeting.meeting_format === 'hybrid' ? 'Hybrid' : 'Face to Face'}\n` : ''}${meeting.meeting_context ? `- Additional Context: ${JSON.stringify(meeting.meeting_context)}\n` : ''}
**CRITICAL INSTRUCTION: The location and format above are AUTHORITATIVE. Do not infer, state, or imply any different location even if the transcript mentions other places. Transcript location mentions are for context only.**
**IMPORTANT: Use the exact attendee names provided above. Do not modify spellings.**

`;

    const userPrompt = `Meeting Title: ${meeting.title}
Meeting Date: ${formattedDate}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

${contextInfo}
Transcript:
${cleanedTranscript}`;

    console.log('🔧 Using Lovable AI with google/gemini-2.5-flash');
    console.log('📊 System prompt length:', systemPrompt.length, 'chars');
    console.log('📊 User prompt length:', userPrompt.length, 'chars');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    console.log('📡 Lovable AI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Lovable AI API error:', response.status, errorData);
      
      // Handle specific error cases
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient AI credits. Please add credits to your workspace.');
      }
      if (response.status === 413) {
        throw new Error('Transcript too large. Please try cleaning the transcript first.');
      }
      
      throw new Error(`Lovable AI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('📦 Lovable AI response data:', JSON.stringify(data).substring(0, 500));
    
    const generatedNotes = data.choices?.[0]?.message?.content || '';
    
    if (!generatedNotes || generatedNotes.trim().length === 0) {
      console.error('⚠️ Lovable AI returned empty content!');
      console.error('Response structure:', JSON.stringify(data));
      throw new Error('Lovable AI returned empty content. This may indicate an API configuration issue.');
    }

    console.log('✅ Generated notes length:', generatedNotes.length, 'chars');
    console.log('📝 Generated preview:', generatedNotes.substring(0, 200));

    // Extract overview from the generated notes (first section after "EXECUTIVE SUMMARY")
    const overviewMatch = generatedNotes.match(/\*\*EXECUTIVE SUMMARY\*\*\s*\n(.*?)(?=\n\*\*|$)/s);
    const overview = overviewMatch ? overviewMatch[1].trim() : 'Overview not available';

    // Save or update notes in database - handle forceRegenerate properly
    if (forceRegenerate) {
      // Delete existing record first, then insert new one
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);
    }

    const { error: summaryError } = await supabase
      .from('meeting_summaries')
      .insert({
        meeting_id: meetingId,
        summary: generatedNotes,
        key_points: [],
        action_items: [],
        decisions: [],
        next_steps: []
      });

    if (summaryError) {
      console.error('❌ Error saving summary:', summaryError);
      throw summaryError;
    }

    // Generate AI overview using the dedicated function
    let aiOverview = overview; // fallback to extracted overview
    try {
      console.log('🎯 Generating AI overview...');
      const { data: overviewResult, error: overviewError } = await supabase.functions.invoke(
        'generate-meeting-overview',
        {
          body: { 
            meetingTitle: meeting.title,
            meetingNotes: generatedNotes
          }
        }
      );

      if (overviewError) {
        console.warn('⚠️ AI overview generation failed:', overviewError.message);
      } else if (overviewResult?.overview) {
        aiOverview = overviewResult.overview;
        console.log('✅ AI overview generated:', aiOverview);
      }
    } catch (overviewError) {
      console.warn('⚠️ AI overview generation error, using extracted overview:', overviewError.message);
    }

    // Generate descriptive meeting title using the transcript
    let generatedTitle = meeting.title;
    try {
      console.log('🏷️ Generating descriptive meeting title...');
      const { data: titleResult, error: titleError } = await supabase.functions.invoke(
        'generate-meeting-title',
        {
          body: { 
            transcript: cleanedTranscript,
            currentTitle: meeting.title
          }
        }
      );

      if (titleError) {
        console.warn('⚠️ Title generation failed:', titleError.message);
      } else if (titleResult?.title) {
        generatedTitle = titleResult.title;
        console.log('✅ Generated title:', generatedTitle);
      }
    } catch (titleError) {
      console.warn('⚠️ Title generation error, keeping original title:', titleError.message);
    }

    // Update meeting with completion status, word count, AI overview, and generated title
    await supabase
      .from('meetings')
      .update({ 
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: aiOverview,
        title: generatedTitle
      })
      .eq('id', meetingId);

    // Also save overview to meeting_overviews table for consistency
    await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        overview: aiOverview
      });

    // Update queue status if exists
    await supabase
      .from('meeting_notes_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('meeting_id', meetingId);

    console.log('🎉 Successfully generated and saved meeting notes');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Meeting notes generated successfully',
        notesLength: generatedNotes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in auto-generate-meeting-notes:', error.message);
    console.error('❌ Full error details:', error);
    
    // Try to update status to failed if we have meetingId
    try {
      const requestClone = req.clone();
      const { meetingId } = await requestClone.json().catch(() => ({}));
      if (meetingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('meetings')
          .update({ 
            notes_generation_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId);
          
        console.log('✅ Updated meeting status to failed for:', meetingId);
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});