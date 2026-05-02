import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { meetingId, userId, sessionId, forceGenerate = false } = await req.json();

    console.log(`Processing live notes for meeting ${meetingId}, user ${userId}, session ${sessionId}`);

    // Get accumulated transcript chunks for this session
    const { data: transcriptChunks, error: transcriptError } = await supabase
      .from('meeting_transcription_chunks')
      .select('chunk_number, transcription_text, created_at')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('chunk_number');

    if (transcriptError) {
      console.error('Error fetching transcript chunks:', transcriptError);
      throw transcriptError;
    }

    if (!transcriptChunks || transcriptChunks.length === 0) {
      console.log('No transcript chunks found, skipping note generation');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No transcript content available' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Combine transcript text
    const fullTranscript = transcriptChunks
      .map(chunk => chunk.transcription_text)
      .join(' ');

    const wordCount = fullTranscript.split(/\s+/).filter(word => word.length > 0).length;

    // Check if we need to generate notes (minimum 50 words)
    if (wordCount < 50 && !forceGenerate) {
      console.log(`Insufficient content (${wordCount} words), skipping generation`);
      return new Response(JSON.stringify({ 
        success: false, 
        message: `Insufficient transcript content (${wordCount} words)` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get existing live notes to determine version number
    const { data: existingNotes } = await supabase
      .from('live_meeting_notes')
      .select('current_version, transcript_word_count')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    // Skip if transcript hasn't grown significantly (unless forced)
    if (existingNotes && !forceGenerate) {
      const wordGrowth = wordCount - existingNotes.transcript_word_count;
      if (wordGrowth < 25) {
        console.log(`Minimal transcript growth (${wordGrowth} words), skipping generation`);
        return new Response(JSON.stringify({ 
          success: false, 
          message: `Minimal transcript growth (${wordGrowth} new words)` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const newVersionNumber = existingNotes ? existingNotes.current_version + 1 : 1;

    // Get meeting details for context - use maybeSingle to avoid errors if not found yet
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title, agenda, attendees')
      .eq('id', meetingId)
      .maybeSingle();
      
    if (meetingError) {
      console.error('Error fetching meeting details:', meetingError);
    }
    
    // If meeting not found yet, it might still be creating - continue anyway
    if (!meeting) {
      console.log('Meeting record not found yet, using fallback values');
    }

    // Generate meeting notes using OpenAI
    const systemPrompt = `You are an AI assistant that generates live meeting notes in real-time. Create professional, structured meeting notes based on the transcript provided.

CRITICAL LANGUAGE AND FORMATTING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: 31st August 2025 (not August 31, 2025) - include ordinal indicators (1st, 2nd, 3rd, etc.)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions for professional language and formatting
- Use £ symbol positioning following UK conventions

CRITICAL FORMATTING: Use markdown headers (## for sections) to ensure proper styling with blue headings:

## Meeting Overview
(brief summary of what's being discussed)

## Key Discussion Points
(main topics covered so far)

## Action Items
(any actions or tasks mentioned)

## Decisions Made
(any conclusions or decisions)

## Next Steps
(upcoming items or future actions mentioned)

Keep the notes concise but comprehensive. Focus on the most important information. This is version ${newVersionNumber} of the notes, so build upon the conversation so far.

Meeting Context:
- Title: ${meeting?.title || 'Meeting'}
- Agenda: ${meeting?.agenda || 'Not specified'}
- Attendees: ${meeting?.attendees || 'Not specified'}`;

    const userPrompt = `Please generate meeting notes based on this transcript (${wordCount} words):

${fullTranscript}

Generate clear, professional meeting notes suitable for distribution to attendees.`;

    console.log('Generating notes with OpenAI...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const openAIData = await openAIResponse.json();
    const generatedNotes = openAIData.choices[0]?.message?.content;

    if (!generatedNotes) {
      throw new Error('No notes generated from OpenAI response');
    }

    console.log('Notes generated successfully, saving to database...');

    // Save version to versions table
    const { error: versionError } = await supabase
      .from('live_meeting_notes_versions')
      .insert({
        meeting_id: meetingId,
        user_id: userId,
        session_id: sessionId,
        version_number: newVersionNumber,
        notes_content: generatedNotes,
        transcript_word_count: wordCount,
        processing_metadata: {
          generated_at: new Date().toISOString(),
          transcript_chunks: transcriptChunks.length,
          openai_model: 'gpt-4o-mini'
        }
      });

    if (versionError) {
      console.error('Error saving version:', versionError);
      throw versionError;
    }

    // Upsert current live notes
    const { error: notesError } = await supabase
      .from('live_meeting_notes')
      .upsert({
        meeting_id: meetingId,
        user_id: userId,
        session_id: sessionId,
        current_version: newVersionNumber,
        notes_content: generatedNotes,
        transcript_word_count: wordCount,
        last_updated_at: new Date().toISOString(),
        processing_status: 'generated'
      }, {
        onConflict: 'meeting_id,user_id,session_id'
      });

    if (notesError) {
      console.error('Error saving live notes:', notesError);
      throw notesError;
    }

    console.log(`Successfully generated and saved notes version ${newVersionNumber}`);

    return new Response(JSON.stringify({
      success: true,
      version: newVersionNumber,
      wordCount: wordCount,
      transcriptChunks: transcriptChunks.length,
      notesLength: generatedNotes.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in live-meeting-notes-generator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});