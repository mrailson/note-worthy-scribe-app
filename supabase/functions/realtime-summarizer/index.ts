import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store ongoing transcripts in memory
const ongoingTranscripts = new Map<string, string>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, text, action } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Handle different actions
    if (action === 'add') {
      // Add text to ongoing transcript
      const existingTranscript = ongoingTranscripts.get(sessionId) || "";
      const updatedTranscript = existingTranscript + " " + text;
      ongoingTranscripts.set(sessionId, updatedTranscript);

      // Check if we should generate a summary (every ~100 words)
      const wordCount = updatedTranscript.split(" ").length;
      
      if (wordCount >= 100) {
        console.log(`Generating summary for session ${sessionId} (${wordCount} words)`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5-mini',
            messages: [
              { 
                role: 'system', 
                content: `Summarize the ongoing meeting transcript into key points and action items. Be concise but comprehensive. Focus on:
                - Key decisions made
                - Action items and who is responsible
                - Important discussion points
                - Any deadlines or next steps mentioned
                
                Format as a brief, bulleted summary.` 
              },
              { role: 'user', content: updatedTranscript }
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const summary = data.choices[0].message.content;

        console.log('Generated summary for session:', sessionId);

        return new Response(JSON.stringify({ 
          success: true,
          summary,
          wordCount,
          action: 'summary_generated'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        wordCount,
        action: 'text_added'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'clear') {
      // Clear transcript for session
      ongoingTranscripts.delete(sessionId);
      
      return new Response(JSON.stringify({ 
        success: true,
        action: 'transcript_cleared'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'get_transcript') {
      // Get current transcript for session
      const transcript = ongoingTranscripts.get(sessionId) || "";
      
      return new Response(JSON.stringify({ 
        success: true,
        transcript,
        wordCount: transcript.split(" ").length,
        action: 'transcript_retrieved'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error('Invalid action. Use "add", "clear", or "get_transcript"');
    }

  } catch (error) {
    console.error('Error in realtime-summarizer function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});