import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { meetingIds } = await req.json();
    
    if (!meetingIds || !Array.isArray(meetingIds)) {
      return new Response(
        JSON.stringify({ error: 'Meeting IDs array is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing limerick notes for ${meetingIds.length} meetings`);

    const results = [];

    for (const meetingId of meetingIds) {
      try {
        console.log(`Processing meeting: ${meetingId}`);

        // Get meeting transcript
        const { data: transcriptData, error: transcriptError } = await supabase
          .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });

        if (transcriptError) {
          console.error(`Failed to get transcript for meeting ${meetingId}:`, transcriptError);
          results.push({ meetingId, success: false, error: `Failed to get transcript: ${transcriptError.message}` });
          continue;
        }

        if (!transcriptData || transcriptData.length === 0 || !transcriptData[0].transcript) {
          console.log(`No transcript found for meeting ${meetingId}`);
          results.push({ meetingId, success: false, error: 'No transcript available' });
          continue;
        }

        const transcript = transcriptData[0].transcript;
        console.log(`Got transcript for meeting ${meetingId}, length: ${transcript.length}`);

        // Calculate meeting size for limerick verse scaling
        const transcriptWordCount = transcript.split(/\s+/).length;
        const limerickVerseCount = transcriptWordCount < 500 ? 1 :
                                   transcriptWordCount < 1500 ? 2 :
                                   transcriptWordCount < 3000 ? 3 :
                                   transcriptWordCount < 5000 ? 4 :
                                   transcriptWordCount < 8000 ? 5 : 6;

        console.log(`Transcript: ${transcriptWordCount} words → ${limerickVerseCount} limerick verses`);

        // Generate limerick notes using OpenAI
        if (!openAIApiKey) {
          throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are a creative meeting poet who transforms GP practice meetings into delightful limericks using British English spellings and conventions.

CRITICAL RULES:
- Write EXACTLY ${limerickVerseCount} limerick ${limerickVerseCount === 1 ? 'verse' : 'verses'}
- Each limerick MUST follow strict AABBA rhyme scheme
- Each limerick should capture a distinct aspect of the meeting
- Use British English spellings: organised, realise, colour, centre, programme, summarise
- Make them clever, fun, and medically themed where appropriate
- Each verse should be self-contained but together tell the meeting story`
              },
              {
                role: 'user',
                content: `Create ${limerickVerseCount} meeting limerick ${limerickVerseCount === 1 ? 'verse' : 'verses'} following this EXACT structure:

# 🎭 Meeting in Verse

${Array.from({length: limerickVerseCount}, (_, i) => `
## Verse ${i + 1}${i === 0 ? ' - The Opening' : i === limerickVerseCount - 1 ? ' - The Finale' : ''}
*[Write a proper limerick with AABBA rhyme scheme]*

Line one sets the scene with flair,
Line two shows the meeting's care,
Line three is short,
Line four's the retort,
Line five concludes with style to spare!
`).join('\n')}

---

## 📋 What It Actually Means
• **Key Point 1:** [Main decision/outcome in plain English]
• **Key Point 2:** [Secondary important point]
• **Key Point 3:** [Third critical insight]
${limerickVerseCount >= 4 ? '• **Key Point 4:** [Additional key point for larger meetings]' : ''}

## 📌 Action Items (The Serious Stuff)
• **[Item]** - Assigned to: [Owner] | Due: [Date]
• **[Item]** - Assigned to: [Owner] | Due: [Date]

${limerickVerseCount >= 3 ? `## 📅 Next Meeting\n• **When:** [Date/Time if mentioned]\n• **Purpose:** [What we'll cover]` : ''}

**Meeting Size:** ${limerickVerseCount} ${limerickVerseCount === 1 ? 'verse' : 'verses'} (${transcriptWordCount} words discussed)

Transcript to transform:

${transcript}`
              }
            ],
            max_tokens: Math.min(2000, 400 + (limerickVerseCount * 50)),
            temperature: 0.8,
          }),
        });

        const openAIData = await response.json();
        
        if (!response.ok) {
          console.error(`OpenAI API error for meeting ${meetingId}:`, openAIData);
          results.push({ meetingId, success: false, error: `OpenAI API error: ${openAIData.error?.message || 'Unknown error'}` });
          continue;
        }

        const limerickNotes = openAIData.choices[0].message.content;
        console.log(`Generated limerick notes for meeting ${meetingId}`);

        // Save limerick notes to meetings table (not meeting_notes_multi)
        const { error: saveError } = await supabase
          .from('meetings')
          .update({
            notes_style_5: limerickNotes, // Style 5 is the creative/limerick style
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId);

        if (saveError) {
          console.error(`Failed to save limerick notes for meeting ${meetingId}:`, saveError);
          results.push({ meetingId, success: false, error: `Failed to save notes: ${saveError.message}` });
          continue;
        }

        console.log(`Successfully saved limerick notes for meeting ${meetingId}`);
        results.push({ meetingId, success: true, message: 'Limerick notes generated and saved' });

      } catch (error) {
        console.error(`Error processing meeting ${meetingId}:`, error);
        results.push({ meetingId, success: false, error: error.message });
      }
    }

    console.log(`Completed processing ${meetingIds.length} meetings. Successful: ${results.filter(r => r.success).length}`);

    return new Response(
      JSON.stringify({ 
        message: `Processed ${meetingIds.length} meetings`,
        results,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-limerick-notes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});