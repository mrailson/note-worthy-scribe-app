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

    // Get meeting details and transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('❌ Meeting not found:', meetingError);
      throw new Error('Meeting not found');
    }

    // Get transcript using the database function that checks all possible sources
    const { data: transcriptResult, error: transcriptError } = await supabase
      .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

    if (transcriptError) {
      console.error('❌ Error fetching transcript:', transcriptError);
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
      throw new Error('Failed to fetch transcript');
    }

    const transcriptData = transcriptResult?.[0];
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
        // For larger transcripts, use chunked cleaning approach
        console.log('📝 Large transcript detected, using chunked cleaning');
        cleanedTranscript = await cleanLargeTranscript(fullTranscript, meeting.title, supabaseUrl, supabaseServiceKey);
        transcriptUsed = 'chunked-cleaned';
        console.log('✅ Chunked cleaning completed:', fullTranscript.length, '→', cleanedTranscript.length, 'chars');
      }
    } catch (cleanError) {
      console.warn('⚠️ Transcript cleaning failed, using original:', cleanError.message);
      // Continue with original transcript if cleaning fails
      cleanedTranscript = fullTranscript;
      transcriptUsed = 'raw-fallback';
    }

    console.log('📄 Using', transcriptUsed, 'transcript for notes generation');

    // Generate notes using OpenAI
    const systemPrompt = `You are an expert meeting notes assistant. Create comprehensive, professional meeting notes from the provided transcript.

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: 31st August 2025 (not August 31, 2025) - include ordinal indicators (1st, 2nd, 3rd, etc.)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions for professional language and formatting
- Use £ symbol positioning following UK conventions

Start with a detailed Meeting Overview that provides substantial context about what this meeting covered. This overview should be comprehensive enough that someone reading it weeks later can immediately understand the main focus, key initiatives discussed, important decisions made, and critical context. Think of it as a rich summary that helps distinguish this meeting from others.

Then format the rest of your response with clear sections using emojis:

📋 Meeting Overview
Write 2-3 substantial paragraphs that capture the essence of the meeting. Include:
- Main focus areas, initiatives, or programmes discussed  
- Key decisions made and their context
- Important timelines, deadlines, or milestones mentioned
- Critical issues, concerns, or challenges raised
- Specific details that make this meeting memorable and distinguishable
- Financial, operational, or strategic implications discussed

1️⃣ Attendees
List all attendees mentioned in the meeting

2️⃣ Key Discussion Points  
Detailed breakdown of main topics with context and outcomes

3️⃣ Decisions Made
Specific decisions reached during the meeting with reasoning

4️⃣ Action Items
Specific tasks, assignments, and next steps with responsible parties and deadlines

5️⃣ Next Steps & Follow-up
Any scheduled follow-up meetings, review dates, or important future milestones

Make the overview rich in detail and context. Focus on creating a narrative that captures the meeting's purpose, main discussions, and outcomes in a way that would help someone quickly understand what this meeting was about even months later.`;

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

    const userPrompt = `Meeting Title: ${meeting.title}
Meeting Date: ${formattedDate}
Duration: ${meeting.duration_minutes || 'Not specified'} minutes

Transcript:
${cleanedTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
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

    // Extract overview from the generated notes (first section after "Meeting Overview")
    const overviewMatch = generatedNotes.match(/📋\s*Meeting Overview\s*\n(.*?)(?=\n\d️⃣|$)/s);
    const overview = overviewMatch ? overviewMatch[1].trim() : 'Overview not available';

    // Save notes to database
    const { error: summaryError } = await supabase
      .from('meeting_summaries')
      .upsert({
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

    // Update meeting with completion status, word count, and overview
    await supabase
      .from('meetings')
      .update({ 
        notes_generation_status: 'completed',
        word_count: wordCount,
        overview: overview
      })
      .eq('id', meetingId);

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
    
    // Try to update status to failed if we have meetingId
    try {
      const { meetingId } = await req.json().catch(() => ({}));
      if (meetingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('meetings')
          .update({ notes_generation_status: 'failed' })
          .eq('id', meetingId);

        await supabase
          .from('meeting_notes_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('meeting_id', meetingId);
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});