import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

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
    const { transcript, meetingTitle, meetingDate, meetingTime, detailLevel } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const level = (detailLevel || 'standard').toString().toLowerCase();
    const detailInstructions = level === 'super' 
      ? 'Maximise detail and specificity. Extract granular points, sub-bullets, explicit attributions when available, and comprehensive context grounded ONLY in the transcript.'
      : level === 'more'
      ? 'Be more detailed than standard. Expand points with accurate specifics from the transcript, include additional sub-bullets and clearer structure.'
      : 'Use the standard level of detail: concise yet complete, avoiding unnecessary verbosity.';

    const prompt = `Create partnership meeting informal notes (detailed) from transcript.

Format the output exactly as follows:

${meetingTitle || 'Partnership Meeting'} Notes

Date: ${meetingDate || '[Meeting Date]'}
Attendees: ${meetingTime ? `Meeting held at ${meetingTime}` : 'Practice Partners and Key Staff'}

[Number]. [MAIN TOPIC IN CAPS]

[Subtopic]

- [Bullet points for key information]
- [Continue with relevant details]

[Another Subtopic]
[Paragraph text when appropriate]

[Sub-subtopic]:

- [Indented bullet points]
- [More details]

[Another Sub-subtopic]:

- [Bullet points]
- [Continue pattern]

Requirements:

1. Use numbered sections for main topics (1., 2., 3., etc.)
2. Use ALL CAPS for main section headers
3. Use sentence case for subtopics
4. Use bullet points (-) for lists, not asterisks
5. Include "Challenges Identified", "Benefits", "Concerns", "Requirements" as subsection types where relevant
6. Group related information under logical subtopics
7. End with numbered "KEY DECISIONS NEEDED", "ACTION ITEMS", and "NEXT STEPS"
8. Include a final note about implementation
9. Do not use markdown formatting (##, **, etc.) - use plain text with spacing and indentation
10. Keep explanations clear and to the point
11. Use visual structure through spacing and indentation rather than formatting symbols
12. ${detailInstructions}

Extract and organize all key discussion points, decisions, action items, and follow-up requirements from the transcript.

Transcript to analyze:
${transcript}`;

    console.log('Generating Claude meeting minutes for:', meetingTitle);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedMinutes = data.content[0].text;

    console.log('Claude meeting minutes generated successfully');

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: generatedMinutes 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-claude function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});