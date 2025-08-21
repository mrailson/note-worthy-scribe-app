import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MeetingContext {
  title: string;
  format: string;
  attendees: Array<{
    name: string;
    title?: string;
    organization?: string;
  }>;
  agenda: string;
  contextText: string;
  contextFiles: Array<{
    name: string;
    content: string;
  }>;
  transcript: string;
  duration: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { meetingContext }: { meetingContext: MeetingContext } = await req.json();

    console.log('Generating meeting notes for:', meetingContext.title);

    // Build comprehensive context for AI
    const attendeesList = meetingContext.attendees
      .map(a => `• ${a.name}${a.title ? ` - ${a.title}` : ''}${a.organization ? ` (${a.organization})` : ''}`)
      .join('\n');

    const contextFiles = meetingContext.contextFiles
      .map(f => `--- ${f.name} ---\n${f.content}`)
      .join('\n\n');

    const systemPrompt = `You are an expert meeting minutes generator. Create comprehensive, professional meeting notes from the provided meeting information and transcript.

Instructions:
- Create well-structured meeting notes with clear sections
- Extract key decisions, action items, and next steps
- Identify and organize main discussion topics
- Use professional business language
- Include participant information appropriately
- Structure content with clear headings and bullet points
- Extract concrete action items with clear ownership when mentioned
- Summarize outcomes and decisions clearly
- Format for easy scanning and reference`;

    const userPrompt = `Generate comprehensive meeting notes from this meeting:

MEETING DETAILS:
Title: ${meetingContext.title}
Format: ${meetingContext.format}
Duration: ${Math.floor(meetingContext.duration / 60)} minutes
Date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

ATTENDEES:
${attendeesList || 'No attendees listed'}

AGENDA:
${meetingContext.agenda || 'No formal agenda provided'}

${meetingContext.contextText ? `ADDITIONAL CONTEXT:
${meetingContext.contextText}` : ''}

${contextFiles ? `SUPPORTING DOCUMENTS:
${contextFiles}` : ''}

MEETING TRANSCRIPT:
${meetingContext.transcript}

Please generate structured meeting notes with the following sections:
1. Meeting Overview
2. Key Decisions Made
3. Main Discussion Points
4. Action Items (with owners when identifiable)
5. Next Steps
6. Follow-up Required

Format the output as professional meeting minutes suitable for distribution to attendees and stakeholders.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedNotes = data.choices[0].message.content;

    console.log('Meeting notes generated successfully');

    return new Response(JSON.stringify({ 
      notes: generatedNotes,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-live-meeting-notes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate meeting notes'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});