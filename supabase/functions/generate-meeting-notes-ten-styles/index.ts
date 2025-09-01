import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEETING_STYLES = {
  warm_welcoming: {
    name: "Warm, Welcoming Meeting Overview",
    prompt: "Summarise this meeting transcript with a friendly introduction that sets a positive tone. Include the meeting's title, date, time, location, and attendees. Briefly state the meeting's purpose in a way that makes everyone feel valued. Then summarise the discussion points with brief, clear bullet points, highlighting key decisions and follow-up actions. Conclude with a warm closing that thanks participants and notes the next meeting date."
  },
  kind_agenda_based: {
    name: "Kind Agenda-Based Summary",
    prompt: "Transform the meeting transcript into notes that are both structured and heartening. Present the agenda items as headings, and under each heading summarise the discussion in a warm, encouraging tone. Include decisions made and agreed actions, noting who is responsible. End with a kind reminder of the next steps and date."
  },
  empathetic_action_items: {
    name: "Empathetic Action-Item Summary",
    prompt: "Please provide a friendly summary that focuses on action items and decisions. Start with a short greeting and meeting details (title, date, attendees). Then list action items with a positive note on who will take them and why they're important. Use a tone that motivates and appreciates contributions. Finish with a supportive closing statement and any next meeting information."
  },
  supportive_informal: {
    name: "Supportive Informal Meeting Recap",
    prompt: "Create an informal meeting recap that reads like a friendly note. Include the meeting's basic details and a heartfelt explanation of why the meeting was held. Summarise the main ideas, questions, and decisions with compassion and encouragement. Note any action items with a focus on teamwork and follow-through. Close by thanking attendees and gently reminding them of the next meeting."
  },
  encouraging_brainstorming: {
    name: "Encouraging Brainstorming Notes",
    prompt: "Write a positive, supportive summary of this brainstorming session. Start with the meeting details and a motivating statement about the session's goals. Organise ideas into themes, highlighting the most inspiring suggestions. Capture decisions or selected ideas in an uplifting way. Conclude with action items and a warm note inviting further collaboration."
  },
  gentle_hr: {
    name: "Gentle HR Meeting Summary",
    prompt: "Craft a meeting summary that is sensitive and supportive, ideal for an HR performance or feedback discussion. Provide the meeting details, then summarise key topics (performance feedback, goals, or policy updates) in a compassionate, neutral tone. Capture decisions and next steps, focusing on growth and positivity. Wrap up with an encouraging closing."
  },
  friendly_project_update: {
    name: "Friendly Project Update Notes",
    prompt: "Summarise this project update meeting in a way that underscores teamwork and progress. Include the basic meeting details, then list each agenda item or project component with an upbeat description of what was discussed and any decisions made. Capture action items with names and deadlines, using language that acknowledges people's efforts. End with a motivating message about future collaboration."
  },
  positive_supplier: {
    name: "Positive Supplier Meeting Recap",
    prompt: "Generate a cheerful summary of a meeting with a supplier or external partner. Provide the meeting's specifics, then briefly outline each discussion point (e.g., pricing, delivery, partnership opportunities) in a friendly and respectful tone. Note any agreements or action items in a way that reinforces partnership and trust. Conclude with an expression of gratitude and a note on next steps."
  },
  bright_executive: {
    name: "Bright Executive Summary",
    prompt: "Provide a concise and warm executive summary of this meeting, focusing on key decisions and outcomes. Begin with the meeting details, then summarise the main points and actions, using language that reflects unity and shared success. Ensure that the tone remains professional but optimistic. End with next steps and a heartfelt thank-you to attendees."
  },
  cheerful_retrospective: {
    name: "Cheerful Retrospective Summary",
    prompt: "Transform the transcript into a retrospective summary that balances honesty with kindness. Note the meeting details and then divide the notes into 'What Went Well,' 'Challenges,' and 'Opportunities.' Describe each section with supportive language, giving credit to people for successes and framing challenges as opportunities for learning. Include action items for improvement, ending with an encouraging outlook."
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