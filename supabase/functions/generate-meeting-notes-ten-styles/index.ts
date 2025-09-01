import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEETING_STYLES = {
  formal_board: {
    name: "Formal board/committee minutes",
    prompt: "Summarise this transcript into formal board/committee meeting minutes. Start with the meeting title, date, start–end time, venue and a list of attendees. Use the agenda as your outline and under each agenda item write a one‑ or two‑sentence summary of the discussion and the decision taken. Record motions and votes in neutral language (e.g., 'Action: motion made, seconded and carried') and include names only when legally required. Highlight approved actions and decisions separately, showing who is responsible and any deadlines. Finish with the next meeting date. Use clear, objective language and omit direct quotations and side conversations."
  },
  informal_team: {
    name: "Informal team meeting summary",
    prompt: "Create a concise, informal meeting summary. Provide the meeting title, date/time and attendees. Write a one‑sentence meeting purpose. Use bullet points to capture the main discussion points, interesting ideas and any questions raised. List key decisions and action steps, noting who will do each task and the due date. Include a line for the next meeting date. Use a friendly tone and keep each bullet under three sentences."
  },
  agenda_based: {
    name: "Agenda‑based notes for structured meetings",
    prompt: "Generate meeting notes that follow the agenda. Begin with meeting details (title, date, time, location, attendees) and the meeting purpose. For each agenda item, create a heading and summarise the discussion, key responses, questions and decisions. Capture action items with names and deadlines. End with a summary of all decisions and a 'follow‑up' section that lists unresolved items or action items carried over from previous meetings."
  },
  narrative_complex: {
    name: "Narrative minutes for complex or negotiation meetings",
    prompt: "Write narrative‑style minutes for this strategic or negotiation meeting. Open with the meeting title, date/time, location and participants. Provide a paragraph‑style summary of the discussion that conveys the flow of topics, different viewpoints and rationales. Use objective phrasing (e.g., 'Participant expressed concerns') rather than emotional descriptions. Where appropriate, note external documents or references mentioned. Conclude with a section listing the decisions made and action items, including responsible individuals and deadlines, and include any scheduled follow‑up meeting."
  },
  resolution_style: {
    name: "Resolution‑style minutes",
    prompt: "Produce resolution‑style minutes focused on the outcomes of the meeting. State the meeting title, date/time, location and attendees. List each resolution or decision approved, along with a brief note of any motion made and the result (e.g., 'Motion to approve budget carried unanimously'). Note any assignments or deadlines arising from each decision. Omit the details of the discussion, simply stating that discussion occurred. Finish with the next meeting date."
  },
  brainstorming_session: {
    name: "Brainstorming session summary",
    prompt: "Turn this brainstorming transcript into organised notes. Include the session title, date/time and attendees. Briefly describe the objective. Group ideas under thematic headings (e.g., 'Patient‑care ideas', 'Operational improvements') and list notable ideas under each heading. Note any key questions and answers. Identify which ideas were selected for further exploration and why. Record action items with responsible people and timelines. Close with the next steps or follow‑up meeting date."
  },
  hr_performance: {
    name: "HR meeting/performance‑review summary",
    prompt: "Create a confidential HR meeting summary. Provide meeting details (title, date/time, location) and participants by role rather than name if necessary. Summarise each topic discussed (such as performance feedback, policy updates or disciplinary issues) using neutral, objective language. Document the decisions and agreed actions, including who will do what and by when. Avoid including personal opinions or verbatim remarks; instead, describe sensitive matters generically and focus on outcomes. Conclude with follow‑up steps and the next meeting date."
  },
  gp_partnership: {
    name: "GP partnership (primary care) meeting notes",
    prompt: "Summarise a GP partnership meeting. Start with the meeting title, date/time, venue and attendees (roles). State the meeting purpose. For each agenda topic (e.g., clinical updates, operational issues, supplier contracts, staffing), summarise the key points discussed, questions raised and any ideas or proposals. Highlight decisions made and action items with responsible partners and deadlines. Maintain patient confidentiality by omitting patient‑specific information. End with unresolved issues and the next meeting date."
  },
  supplier_negotiation: {
    name: "Supplier‑negotiation meeting summary",
    prompt: "Generate notes for a supplier‑negotiation meeting. Include meeting details (title, date/time, location, attendees from both sides) and a brief meeting objective. Summarise each proposal and negotiation point discussed, such as pricing, deliverables and contract terms. Record agreements reached, including pricing or terms approved, and any outstanding questions or issues that require follow‑up. List action items with responsible parties and deadlines. Use clear, factual language and avoid disclosing sensitive numbers; present the essence of the agreements instead."
  },
  executive_confidential: {
    name: "Executive session/confidential minutes",
    prompt: "Draft minutes for a confidential executive session. Provide the meeting title, date/time, location and attendees (e.g., board members). Note that the meeting was held in executive session for confidential discussions. For each agenda item, record only the action or decision taken using neutral phrasing (e.g., 'Action: motion made, seconded and carried'). Do not include details of the discussion or direct quotations. Identify any names only when legally required (e.g., when recording votes on conflicts of interest). List any approved resolutions or actions and the next meeting date."
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { transcript, settings = {}, selectedStyle } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid transcript is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If a specific style is requested, generate only that style
    if (selectedStyle && MEETING_STYLES[selectedStyle as keyof typeof MEETING_STYLES]) {
      const style = MEETING_STYLES[selectedStyle as keyof typeof MEETING_STYLES];
      
      const meetingContext = settings.title || settings.practice || settings.date || settings.time || settings.venue || settings.chair || settings.attendees
        ? `Meeting Context:\n${Object.entries(settings)
            .filter(([_, value]) => value)
            .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
            .join('\n')}\n\n`
        : '';

      const userMessage = `${meetingContext}Meeting Transcript:\n${transcript}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            {
              role: 'system',
              content: `You are a professional meeting minutes generator. ${style.prompt}\n\nFormat the output in clean markdown with appropriate headings and structure. Be thorough but concise. Maintain a professional yet warm tone throughout.`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_completion_tokens: 2000
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const generatedContent = data.choices[0].message.content;

      return new Response(JSON.stringify({ 
        style: selectedStyle,
        content: generatedContent 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate all styles if no specific style requested (for backward compatibility)
    const results: Record<string, string> = {};
    
    for (const [key, style] of Object.entries(MEETING_STYLES)) {
      try {
        const meetingContext = settings.title || settings.practice || settings.date || settings.time || settings.venue || settings.chair || settings.attendees
          ? `Meeting Context:\n${Object.entries(settings)
              .filter(([_, value]) => value)
              .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
              .join('\n')}\n\n`
          : '';

        const userMessage = `${meetingContext}Meeting Transcript:\n${transcript}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            messages: [
              {
                role: 'system',
                content: `You are a professional meeting minutes generator. ${style.prompt}\n\nFormat the output in clean markdown with appropriate headings and structure. Be thorough but concise. Maintain a professional yet warm tone throughout.`
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            max_completion_tokens: 2000
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error generating ${key}:`, errorData);
          results[key] = `Error generating ${style.name}: ${errorData.error?.message || 'Unknown error'}`;
          continue;
        }

        const data = await response.json();
        results[key] = data.choices[0].message.content;
      } catch (error) {
        console.error(`Error generating ${key}:`, error);
        results[key] = `Error generating ${style.name}: ${error.message}`;
      }
    }

    return new Response(JSON.stringify({ 
      styles: results,
      styleNames: Object.fromEntries(
        Object.entries(MEETING_STYLES).map(([key, style]) => [key, style.name])
      )
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-ten-styles function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});