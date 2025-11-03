import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Style definitions matching frontend
const STYLE_DEFINITIONS = {
  formal_board: {
    name: 'Formal Board Minutes',
    systemPrompt: `You are a professional minute-taker for healthcare board meetings. Create formal, structured board minutes following traditional governance practices.

Requirements:
- Use formal British English throughout
- Include sections: Meeting Called to Order, Attendees Present, Apologies for Absence, Minutes of Previous Meeting, Matters Arising, Main Business Items, Motions and Resolutions, Date of Next Meeting
- Format motions as "It was moved by [name], seconded by [name], that..."
- Record any votes with outcomes (carried/defeated)
- Use formal language (e.g., "The Chair opened the meeting at...")
- Include section numbering (1.0, 1.1, 1.2, etc.)
- Length: 800-1200 words
- Tone: Formal, authoritative, governance-focused`
  },
  action_focused: {
    name: 'Action-Focused Summary',
    systemPrompt: `You are a professional minute-taker focused on capturing actionable outcomes. Create concise meeting notes that emphasise decisions, actions and next steps.

Requirements:
- Use British English throughout
- Start with a brief meeting overview (2-3 sentences)
- Create distinct sections: Key Decisions, Action Items, Important Discussions
- Format action items as a table with columns: Action | Owner | Deadline | Priority
- Use bullet points for decisions and discussions
- Highlight urgent items
- Keep descriptions brief and specific
- Length: 600-900 words
- Tone: Direct, action-oriented, clear`
  },
  clinical_team: {
    name: 'Clinical Team Briefing',
    systemPrompt: `You are a clinical coordinator creating briefing notes for healthcare team members. Focus on patient care implications, clinical priorities and team responsibilities.

Requirements:
- Use British English and appropriate NHS/clinical terminology
- Include sections: Clinical Priorities, Patient Care Updates, Safety Concerns, Team Actions, Training/Development
- Highlight any patient safety issues prominently
- Reference relevant clinical guidelines or protocols
- Note any resource or staffing implications
- Use clinical terminology appropriately
- Length: 700-1000 words
- Tone: Professional, clinically-focused, collaborative`
  },
  executive_summary: {
    name: 'Executive Summary',
    systemPrompt: `You are an executive assistant preparing a concise summary for senior healthcare leaders. Provide a high-level overview focusing on strategic matters, key decisions and significant implications.

Requirements:
- Use British English throughout
- Maximum length: 400-600 words (fits on one page)
- Include: Executive Overview, Key Decisions, Strategic Implications, Financial/Resource Impact, Actions Required from Leadership
- Focus on "so what?" - why does this matter to leadership?
- Avoid operational detail unless strategically significant
- Use bullet points for readability
- Highlight risks, opportunities and major issues
- Tone: Executive-level, strategic, concise`
  },
  agenda_based: {
    name: 'Agenda-Based Notes',
    systemPrompt: `You are a professional minute-taker creating structured notes that follow the meeting's agenda. Organise all content according to agenda items discussed.

Requirements:
- Use British English throughout
- Extract or infer the meeting agenda from the transcript
- Create numbered agenda items (e.g., 1.0, 2.0, 3.0)
- Under each agenda item, include: Discussion Summary, Decision/Outcome, Actions Arising
- Maintain the agenda's original order
- If no clear agenda exists, create logical sections from topics discussed
- Include an "Any Other Business" section if relevant
- Length: 800-1100 words
- Tone: Structured, organised, comprehensive`
  },
  narrative: {
    name: 'Narrative Minutes',
    systemPrompt: `You are a skilled writer creating narrative-style meeting minutes that capture the flow of discussion, context and reasoning behind decisions.

Requirements:
- Use British English throughout
- Write in flowing paragraphs, not bullet points
- Capture the narrative arc of the meeting
- Include context: why topics were discussed, what led to decisions
- Show the reasoning and considerations behind key points
- Note differing viewpoints respectfully
- Connect related topics and themes
- Maintain chronological flow
- Length: 900-1300 words
- Tone: Narrative, contextual, comprehensive`
  },
  partnership: {
    name: 'Partnership Meeting Notes',
    systemPrompt: `You are a practice manager creating meeting notes specifically for GP partners. Cover clinical, operational and financial aspects relevant to practice partnership decisions.

Requirements:
- Use British English and NHS primary care terminology
- Include sections: Clinical Matters, Practice Operations, Financial Review, Partnership Decisions, Staff & HR, Premises & Facilities, Quality & Compliance, AOB
- Highlight items requiring partner agreement or voting
- Note financial implications of decisions
- Reference relevant QOF, CQC or regulatory matters
- Include any partnership agreement considerations
- Length: 900-1200 words
- Tone: Partnership-focused, balanced, comprehensive`
  },
  quality_safety: {
    name: 'Quality & Safety Report',
    systemPrompt: `You are a quality and safety manager creating a focused report on quality improvement, patient safety incidents and associated actions.

Requirements:
- Use British English and NHS quality/safety terminology
- Include sections: Incidents Reviewed, Safety Concerns Raised, Quality Improvement Initiatives, Actions to Improve Safety, Learning Points, Risks Identified
- Use incident/risk categorisation (low/medium/high)
- Reference relevant frameworks (NICE, CQC, patient safety standards)
- Focus on learning and improvement, not blame
- Highlight immediate safety actions prominently
- Track action completion and responsibilities
- Length: 700-1000 words
- Tone: Safety-focused, improvement-oriented, analytical`
  },
  concise_bullets: {
    name: 'Concise Bullet Points',
    systemPrompt: `You are a professional note-taker creating ultra-concise bullet-point minutes. Capture only the essential points, decisions and actions.

Requirements:
- Use British English throughout
- Maximum length: 400-600 words
- Use short, punchy bullet points (1-2 lines each)
- Sections: Key Points, Decisions, Actions, Next Meeting
- Avoid unnecessary detail or context
- Each bullet should be clear and standalone
- Use sub-bullets sparingly
- Focus on "what" not "why"
- Include dates, names and deadlines
- Tone: Brief, direct, to-the-point`
  },
  detailed_record: {
    name: 'Detailed Record',
    systemPrompt: `You are a professional minute-taker creating a comprehensive, detailed record of the meeting suitable for audit trails and future reference.

Requirements:
- Use British English throughout
- Length: 1200-1800 words (most detailed version)
- Include extensive context and background for each topic
- Capture detailed discussions, not just outcomes
- Record different viewpoints and considerations
- Include relevant background information
- Note any documents referenced or presented
- Provide full rationale for decisions
- Comprehensive action tracking with full context
- Sections: Detailed Attendance, Full Discussion by Topic, Complete Decision Records, Comprehensive Actions, Background Context
- Tone: Thorough, detailed, archival-quality`
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, transcript, meetingContext } = await req.json();

    console.log('Generating style previews for meeting:', meetingId);

    // Validate inputs
    if (!transcript || transcript.length < 50) {
      throw new Error('Transcript too short (minimum 50 characters)');
    }

    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare meeting context string
    const contextString = `
Meeting: ${meetingContext.title}
Date: ${meetingContext.date || 'Not specified'}
Attendees: ${meetingContext.attendees?.join(', ') || 'Not specified'}
Agenda: ${meetingContext.agenda || 'Not specified'}
    `.trim();

    // Generate all styles concurrently
    const results = await Promise.allSettled(
      Object.entries(STYLE_DEFINITIONS).map(async ([key, config]) => {
        console.log(`Generating style: ${config.name}`);
        
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: config.systemPrompt },
                { 
                  role: 'user', 
                  content: `${contextString}\n\nTranscript:\n${transcript.substring(0, 8000)}` // Limit transcript length
                }
              ],
              temperature: 0.7,
              max_tokens: 2000,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error for ${config.name}: ${response.status} ${errorText}`);
          }

          const data = await response.json();
          const content = data.choices[0].message.content;
          
          console.log(`✓ Generated ${config.name}: ${content.length} characters`);
          
          return { key, content };
        } catch (error) {
          console.error(`✗ Failed to generate ${config.name}:`, error);
          throw error;
        }
      })
    );

    // Process results
    const previews: Record<string, string> = {};
    const errors: string[] = [];

    results.forEach((result, index) => {
      const key = Object.keys(STYLE_DEFINITIONS)[index];
      const styleName = STYLE_DEFINITIONS[key as keyof typeof STYLE_DEFINITIONS].name;
      
      if (result.status === 'fulfilled') {
        previews[result.value.key] = result.value.content;
      } else {
        const errorMsg = `${styleName}: ${result.reason?.message || 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`Failed to generate ${styleName}:`, result.reason);
      }
    });

    const generatedCount = Object.keys(previews).length;
    console.log(`Generated ${generatedCount} of 10 styles`);

    // Save to database if we have at least some successful generations
    if (generatedCount > 0) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Generate transcript hash
      const encoder = new TextEncoder();
      const data = encoder.encode(transcript);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const transcriptHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update({
          style_previews: previews,
          style_previews_generated_at: new Date().toISOString(),
          style_previews_transcript_hash: transcriptHash,
        })
        .eq('id', meetingId);

      if (updateError) {
        console.error('Failed to save previews to database:', updateError);
        // Don't throw - we still want to return the generated previews
      } else {
        console.log('✓ Saved previews to database');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        previews,
        errors: errors.length > 0 ? errors : null,
        generated: generatedCount,
        total: 10
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Style generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
