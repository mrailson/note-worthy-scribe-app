import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, sessionId, batchSize = 10 } = await req.json();
    console.log(`🔍 Processing low-confidence chunks for meeting: ${meetingId}, session: ${sessionId}`);
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client with service role key for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get existing high-confidence context from meeting
    const { data: contextChunks, error: contextError } = await supabase
      .from('meeting_transcription_chunks')
      .select('transcription_text, chunk_number')
      .eq('meeting_id', meetingId)
      .eq('session_id', sessionId)
      .order('chunk_number', { ascending: true });

    if (contextError) {
      console.error('Error fetching context chunks:', contextError);
      throw contextError;
    }

    const meetingContext = contextChunks?.map(c => c.transcription_text).join(' ').trim() || '';
    console.log(`📋 Meeting context (${contextChunks?.length} chunks): ${meetingContext.substring(0, 200)}...`);

    // Step 2: Get unprocessed low-confidence chunks
    const { data: lowConfidenceChunks, error: lowConfError } = await supabase
      .from('low_confidence_chunks')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('session_id', sessionId)
      .is('processed_at', null)
      .order('chunk_number', { ascending: true })
      .limit(batchSize);

    if (lowConfError) {
      console.error('Error fetching low-confidence chunks:', lowConfError);
      throw lowConfError;
    }

    if (!lowConfidenceChunks || lowConfidenceChunks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No unprocessed low-confidence chunks found',
        processedCount: 0,
        restoredCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Found ${lowConfidenceChunks.length} low-confidence chunks to process`);

    let restoredCount = 0;
    const updates = [];

    // Step 3: Process each chunk with AI contextual analysis
    for (const chunk of lowConfidenceChunks) {
      try {
        console.log(`🤖 Analyzing chunk ${chunk.chunk_number}: "${chunk.transcription_text}"`);

        const analysisPrompt = `You are an intelligent transcript analysis system. 

MEETING CONTEXT (existing high-quality transcript):
"${meetingContext}"

QUESTIONABLE CHUNK TO ANALYZE:
"${chunk.transcription_text}"
Original Confidence: ${chunk.confidence}
Filter Reason: ${chunk.filter_reason}

TASK: Determine if this questionable chunk should be restored to the main transcript.

ANALYSIS CRITERIA:
1. CONTEXTUAL RELEVANCE: Does the chunk content relate to the meeting discussion?
2. VOCABULARY MATCH: Does it use similar terms/concepts as the meeting context?
3. LOGICAL FLOW: Could this realistically fit into the conversation?
4. CONTENT QUALITY: Is it more than just noise, stutters, or filler words?
5. MEANINGFUL CONTENT: Does it add value to the transcript?

RESTORATION DECISION:
- RESTORE: If chunk is contextually relevant and meaningful (score 80-100%)
- KEEP_FILTERED: If chunk is noise, off-topic, or meaningless (score 0-79%)

Respond with JSON format:
{
  "decision": "RESTORE" or "KEEP_FILTERED",
  "confidence_score": 0-100,
  "reasoning": "Brief explanation of decision",
  "suggested_edit": "Optional corrected text if obvious typos detected"
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-2025-04-14',
            messages: [
              { role: 'system', content: 'You are an expert at analyzing transcript quality and contextual relevance. Always respond with valid JSON.' },
              { role: 'user', content: analysisPrompt }
            ],
            max_tokens: 300,
            temperature: 0.1
          }),
        });

        if (!response.ok) {
          console.error('OpenAI API error:', response.status, await response.text());
          continue;
        }

        const aiResponse = await response.json();
        const analysis = JSON.parse(aiResponse.choices[0].message.content);
        
        console.log(`🎯 AI Analysis for chunk ${chunk.chunk_number}:`, analysis);

        const shouldRestore = analysis.decision === 'RESTORE' && analysis.confidence_score >= 80;

        updates.push({
          id: chunk.id,
          contextual_relevance_score: analysis.confidence_score / 100,
          ai_suggested_restoration: shouldRestore,
          processed_at: new Date().toISOString(),
          user_edited_text: analysis.suggested_edit || null
        });

        // If AI suggests restoration, automatically restore it
        if (shouldRestore) {
          const { error: restoreError } = await supabase
            .from('meeting_transcription_chunks')
            .insert({
              meeting_id: meetingId,
              session_id: sessionId,
              user_id: chunk.user_id,
              chunk_number: chunk.chunk_number,
              transcription_text: analysis.suggested_edit || chunk.transcription_text,
              confidence: Math.min(analysis.confidence_score / 100, 0.95), // Cap at 95%
              created_at: chunk.created_at
            });

          if (restoreError) {
            console.error('Error restoring chunk:', restoreError);
          } else {
            console.log(`✅ Auto-restored chunk ${chunk.chunk_number} to main transcript`);
            restoredCount++;
            
            // Mark as restored in low_confidence_chunks
            updates[updates.length - 1].user_action = 'ai_restored';
          }
        }

      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        // Mark as processed even if failed to prevent reprocessing
        updates.push({
          id: chunk.id,
          processed_at: new Date().toISOString(),
          contextual_relevance_score: 0
        });
      }
    }

    // Step 4: Batch update all processed chunks
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('low_confidence_chunks')
          .update(update)
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating chunk:', updateError);
        }
      }
    }

    console.log(`✅ Processed ${updates.length} chunks, auto-restored ${restoredCount} chunks`);

    return new Response(JSON.stringify({
      success: true,
      processedCount: updates.length,
      restoredCount: restoredCount,
      remainingChunks: lowConfidenceChunks.length >= batchSize
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-context-restorer:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});