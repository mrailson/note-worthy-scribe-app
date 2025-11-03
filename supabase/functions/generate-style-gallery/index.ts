import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StylePrompt {
  styleKey: string;
  noteType: string;
  systemPrompt: string;
  temperature: number;
}

const STYLE_PROMPTS: StylePrompt[] = [
  {
    styleKey: 'notes_style_2',
    noteType: 'action_focused',
    systemPrompt: `You are an expert at creating action-focused meeting notes. Generate concise meeting notes in British English that prioritise actionable items and decisions.

Format the notes with:
- **MEETING OVERVIEW**: Brief 2-3 sentence summary
- **KEY DECISIONS**: Bullet list of decisions made
- **ACTION ITEMS**: Detailed action items with owners and deadlines
- **DISCUSSION HIGHLIGHTS**: Brief key points discussed
- **NEXT STEPS**: Clear next steps and follow-ups

Keep it practical, focused on what needs to be done. Use British English spelling and NHS terminology correctly.`,
    temperature: 0.5
  },
  {
    styleKey: 'notes_style_3',
    noteType: 'standard',
    systemPrompt: `You are an expert at creating comprehensive meeting minutes for NHS primary care settings. Generate detailed meeting notes in British English following formal NHS meeting minutes structure.

**Format Requirements:**
- Use proper British English throughout
- Include meeting metadata (date, time, location if mentioned)
- Create clear sections with markdown headers
- Use bullet points and numbered lists appropriately
- Maintain professional NHS tone

**Required Sections:**
1. MEETING DETAILS
2. EXECUTIVE SUMMARY
3. ATTENDEES
4. DISCUSSION SUMMARY
5. ACTION ITEMS (table format with columns: Action | Responsible Party | Deadline | Priority)
6. OPEN ITEMS & RISKS
7. NEXT MEETING

Focus on clinical relevance, patient care implications, and operational efficiency.`,
    temperature: 0.7
  },
  {
    styleKey: 'notes_style_4',
    noteType: 'executive',
    systemPrompt: `You are an expert at creating executive summaries for senior NHS leaders. Generate a high-level executive summary in British English suitable for board members and senior management.

Format with:
- **EXECUTIVE SUMMARY**: 3-4 sentence overview of key outcomes
- **STRATEGIC HIGHLIGHTS**: Major strategic points and decisions (3-5 bullets)
- **FINANCIAL IMPLICATIONS**: Any budget or resource impacts
- **RISKS & ISSUES**: Critical risks requiring attention
- **RECOMMENDATIONS**: Top 3 recommendations for leadership

Keep it concise (max 300 words), strategic, and focused on decision-making insights. Use British English and NHS terminology correctly.`,
    temperature: 0.6
  },
  {
    styleKey: 'notes_style_5',
    noteType: 'detailed',
    systemPrompt: `You are an expert at creating highly detailed meeting documentation. Generate comprehensive, detailed meeting notes in British English that capture every discussion point and nuance.

Format with extensive detail including:
- **CONTEXT**: Background and setting for the meeting
- **DETAILED DISCUSSION**: Chronological account of all topics discussed with quotes and specific points
- **PARTICIPANT CONTRIBUTIONS**: Note who said what and key perspectives
- **TECHNICAL DETAILS**: Any technical, clinical, or operational specifics mentioned
- **COMPLETE ACTION LOG**: Every action, task, and follow-up mentioned
- **APPENDICES**: Additional context, references, or supporting information

This is the most comprehensive style - include everything discussed. Use British English and NHS terminology correctly.`,
    temperature: 0.4
  }
];

async function generateStyleNotes(
  transcript: string,
  meetingTitle: string,
  meetingDate: string,
  stylePrompt: StylePrompt,
  openAIApiKey: string
): Promise<string> {
  console.log(`📝 Generating ${stylePrompt.noteType} notes...`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: stylePrompt.systemPrompt },
        {
          role: 'user',
          content: `Meeting Title: ${meetingTitle}\nMeeting Date: ${meetingDate}\n\nTranscript:\n${transcript}`
        }
      ],
      temperature: stylePrompt.temperature,
      max_tokens: stylePrompt.noteType === 'detailed' ? 4000 : stylePrompt.noteType === 'executive' ? 1500 : 2500
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error for ${stylePrompt.noteType}: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
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
    const { meetingId } = await req.json();

    console.log('🎨 Starting style gallery generation for meeting:', meetingId);

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Get meeting details and transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title, start_time, live_transcript_text')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error(`Meeting not found: ${meetingError?.message || 'Unknown error'}`);
    }

    // Get full transcript
    const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', {
      p_meeting_id: meetingId
    });

    let fullTranscript = meeting.live_transcript_text || '';
    if (!fullTranscript && transcriptData && Array.isArray(transcriptData)) {
      fullTranscript = transcriptData.map(seg => seg.transcript).join(' ');
    }

    if (!fullTranscript || fullTranscript.trim().length < 50) {
      console.log('⚠️ Transcript too short, skipping style generation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Transcript too short for style generation' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meetingTitle = meeting.title || 'Meeting';
    const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

    console.log(`📊 Transcript length: ${fullTranscript.length} characters`);
    console.log(`🎯 Generating ${STYLE_PROMPTS.length} different note styles...`);

    // Generate all styles in parallel
    const styleResults = await Promise.allSettled(
      STYLE_PROMPTS.map(stylePrompt => 
        generateStyleNotes(fullTranscript, meetingTitle, meetingDate, stylePrompt, openAIApiKey)
      )
    );

    // Prepare update object for meetings table
    const meetingUpdates: Record<string, string> = {};
    const multiNoteInserts: Array<{
      meeting_id: string;
      note_type: string;
      content: string;
      model_used: string;
    }> = [];

    // Process results
    styleResults.forEach((result, index) => {
      const stylePrompt = STYLE_PROMPTS[index];
      
      if (result.status === 'fulfilled') {
        const content = result.value;
        console.log(`✅ Generated ${stylePrompt.noteType}: ${content.length} characters`);
        
        // Save to meetings table
        meetingUpdates[stylePrompt.styleKey] = content;
        
        // Also save to meeting_notes_multi table
        multiNoteInserts.push({
          meeting_id: meetingId,
          note_type: stylePrompt.noteType,
          content: content,
          model_used: 'gpt-4o-mini'
        });
      } else {
        console.error(`❌ Failed to generate ${stylePrompt.noteType}:`, result.reason);
      }
    });

    // Save all styles to meetings table
    if (Object.keys(meetingUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('meetings')
        .update(meetingUpdates)
        .eq('id', meetingId);

      if (updateError) {
        console.error('❌ Error saving styles to meetings table:', updateError);
      } else {
        console.log('✅ Saved all styles to meetings table');
      }
    }

    // Save to meeting_notes_multi table
    if (multiNoteInserts.length > 0) {
      // Delete existing notes for these types
      await supabase
        .from('meeting_notes_multi')
        .delete()
        .eq('meeting_id', meetingId)
        .in('note_type', multiNoteInserts.map(n => n.note_type));

      // Insert new notes
      const { error: insertError } = await supabase
        .from('meeting_notes_multi')
        .insert(multiNoteInserts);

      if (insertError) {
        console.error('❌ Error saving to meeting_notes_multi:', insertError);
      } else {
        console.log('✅ Saved all styles to meeting_notes_multi table');
      }
    }

    const successCount = styleResults.filter(r => r.status === 'fulfilled').length;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully generated ${successCount} out of ${STYLE_PROMPTS.length} note styles`,
        styles_generated: successCount,
        total_styles: STYLE_PROMPTS.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Style gallery generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
