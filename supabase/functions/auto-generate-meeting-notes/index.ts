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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
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

    // Clean the transcript before generating notes
    let cleanedTranscript = fullTranscript;
    let transcriptUsed = 'raw';
    
    try {
      console.log('🧹 Cleaning transcript...');
      
      if (fullTranscript.length <= 7000) {
        // Use GPT cleaning for smaller transcripts
        const cleanResponse = await fetch(`${supabaseUrl}/functions/v1/gpt-clean-transcript`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transcript: fullTranscript }),
        });

        if (cleanResponse.ok) {
          const cleanData = await cleanResponse.json();
          cleanedTranscript = cleanData.cleanedTranscript || fullTranscript;
          transcriptUsed = 'gpt-cleaned';
          console.log('✅ GPT cleaning completed:', cleanData.originalLength, '→', cleanData.cleanedLength, 'chars');
        } else {
          throw new Error('GPT cleaning failed');
        }
      } else {
        // For very large transcripts, skip cleaning and truncate to avoid timeouts
        console.log('📝 Large transcript detected, skipping cleaning and truncating for generation');
        cleanedTranscript = fullTranscript.slice(0, 12000);
        transcriptUsed = 'truncated-raw';
        console.log('✅ Truncation applied:', fullTranscript.length, '→', cleanedTranscript.length, 'chars');
      }
    } catch (cleanError) {
      console.warn('⚠️ Transcript cleaning failed, using original:', cleanError.message);
      // Continue with original transcript if cleaning fails
      cleanedTranscript = fullTranscript;
      transcriptUsed = 'raw-fallback';
    }

    console.log('📄 Using', transcriptUsed, 'transcript for notes generation');

    // Generate notes using OpenAI
    const systemPrompt = `You are an expert meeting minutes assistant specialising in creating comprehensive, structured business minutes from meeting transcripts.

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: Wednesday 15th October 2025 (include day of week and ordinal indicators)
- Use 24-hour time format: 14:30 (not 2:30 PM)
- Follow NHS/UK business conventions for professional language and formatting
- Use £ symbol positioning following UK conventions

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

# MINUTES

## MEETING DETAILS
Date: [Day name] [Date with ordinal] [Month] [Year]
Time: [24-hour format]
Attendees: [List all participants with roles if known]
Meeting Objective: [Brief statement of the meeting's purpose and key focus areas]

## EXECUTIVE SUMMARY
Write 2-3 comprehensive paragraphs that provide a complete overview of the meeting. This should be substantial enough that a senior manager could understand the full context without reading the detailed minutes. Include:
- The meeting's primary focus and what prompted these discussions
- Key decisions made with their reasoning and context
- Important timelines, deadlines, or milestones established
- Critical issues, concerns, or challenges raised and how they'll be addressed
- Financial, operational, or strategic implications
- Overall outcomes and next steps

## DISCUSSION SUMMARY
For each major topic discussed, create a detailed subsection with the following structure:

### [TOPIC NAME IN CAPS]
**Background:** [Context and why this topic was raised]

**Key Points:**
- [Detailed point with full context and implications]
- [Include specific numbers, dates, costs, or metrics mentioned]
- [Capture concerns, challenges, and proposed solutions]
- [Note any disagreements or alternative views discussed]

**Outcome:** [What was decided or what action will be taken]

[Repeat this structure for each major topic discussed]

## DECISIONS & RESOLUTIONS
For each decision, provide:
- **What:** [The specific decision or resolution]
- **Why:** [The reasoning and context behind the decision]
- **Impact:** [Expected outcomes and implications]
- **Owner:** [Who is responsible] (if known)
- **Deadline:** [When it should be completed] (if specified)

## ACTION ITEMS
Present in table format:

| Task | Owner | Due Date | Details |
|------|-------|----------|---------|
| [Specific actionable task] | [Responsible person/role] | [Specific date or timeframe] | [Additional context or requirements] |

## FOLLOW-UP REQUIREMENTS
**Immediate Actions (Next 48 hours):**
- [Urgent tasks with deadlines]

**Short-term Deliverables (1-2 weeks):**
- [Medium priority items with context]

**Long-term Objectives:**
- [Strategic goals and ongoing initiatives]

## OPEN ITEMS & RISKS
**Unresolved Issues:**
- [Items that require further discussion or decision]
- [Dependencies or blockers affecting progress]

**Identified Risks:**
- [Potential problems or concerns raised]
- [Resource, financial, or operational risks]

## NEXT MEETING
Date/Time: [If scheduled, or "To be scheduled"]
Focus: [Key topics for next meeting]
Preparation Required: [What participants should prepare]

IMPORTANT GUIDELINES:
- Be thorough and detailed - these minutes should serve as an official record
- Capture the nuance of discussions, not just bullet points
- Include specific numbers, costs, dates, and names when mentioned
- Note both agreement and dissent in discussions
- Structure information to be easily scannable but comprehensive when read in detail
- Use professional, formal language appropriate for business documentation`;


    // Format date in British format
    const meetingDate = new Date(meeting.created_at);
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
    const formattedDate = `${day}${ordinalSuffix(day)} ${months[meetingDate.getMonth()]} ${meetingDate.getFullYear()}`;

    // Build context information from meeting metadata
    const contextInfo = `**MEETING CONTEXT:**
${meeting.agenda ? `- Agenda: ${meeting.agenda}\n` : ''}${meeting.participants?.length ? `- Attendees: ${meeting.participants.join(', ')}\n` : ''}${meeting.meeting_location ? `- Location: ${meeting.meeting_location}\n` : ''}${meeting.meeting_format ? `- Format: ${meeting.meeting_format}\n` : ''}${meeting.meeting_context ? `- Additional Context: ${JSON.stringify(meeting.meeting_context)}\n` : ''}
**IMPORTANT: Use the exact attendee names provided above. Do not modify spellings.**

`;

    const userPrompt = `Meeting Title: ${meeting.title}
Meeting Date: ${formattedDate}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

${contextInfo}
Transcript:
${cleanedTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedNotes = data.choices[0].message.content;

    console.log('✅ Generated notes length:', generatedNotes.length, 'chars');

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

    // Update meeting with completion status, word count, and AI overview
    await supabase
      .from('meetings')
      .update({ 
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: aiOverview
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