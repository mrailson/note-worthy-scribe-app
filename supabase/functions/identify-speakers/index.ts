import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeakerIdentification {
  speaker: string;
  role: string;
  confidence: number;
  reasoning: string;
}

interface IdentificationResult {
  meetingType: 'consultation' | 'meeting' | 'unknown';
  speakers: SpeakerIdentification[];
  generalContext: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript, agenda, meetingTitle, attendees } = await req.json();

    if (!transcript) {
      throw new Error('Missing required field: transcript');
    }

    console.log('Analyzing transcript for speaker identification...');
    console.log('Meeting title:', meetingTitle || 'Not provided');
    console.log('Agenda provided:', !!agenda);
    console.log('Attendees provided:', !!attendees);

    const systemPrompt = `You are an expert at analyzing meeting transcripts and identifying speakers based on context, roles, and content. Your task is to:

1. Determine the meeting type (consultation, meeting, or unknown)
2. Identify speakers and assign appropriate roles/names
3. Provide confidence scores and reasoning

MEETING TYPE DETECTION:
- "consultation": Medical consultation between healthcare provider and patient
- "meeting": Business/organizational meeting with multiple participants  
- "unknown": Cannot clearly determine the type

SPEAKER IDENTIFICATION RULES:

For CONSULTATIONS:
- Look for medical terminology, symptoms, treatments, diagnoses
- Healthcare provider: Uses medical terms, asks diagnostic questions, gives advice/prescriptions
- Patient: Describes symptoms, asks health questions, responds to medical guidance
- Label as "GP/Doctor" and "Patient" respectively

For MEETINGS:
- Use agenda topics to identify who speaks about what
- Match speaking patterns to likely roles (presenter, chair, participant)
- Use attendee names if provided
- Consider subject matter expertise (e.g., financial topics = CFO/Finance team)

ANALYSIS APPROACH:
1. Read through the entire transcript
2. Identify distinct speaking patterns and voices
3. Analyze content themes and topics
4. Match speakers to appropriate roles/identities
5. Provide confidence scores (0.0-1.0) based on evidence strength

Return your analysis as a JSON object with the structure:
{
  "meetingType": "consultation|meeting|unknown",
  "speakers": [
    {
      "speaker": "Speaker 1",
      "role": "GP/Doctor|Patient|Chair|Presenter|Participant|[Name]",
      "confidence": 0.85,
      "reasoning": "Detailed explanation of why this identification was made"
    }
  ],
  "generalContext": "Brief description of the meeting/consultation context"
}

Be thorough in your analysis and provide detailed reasoning for each identification.`;

    const userPrompt = `Please analyze this transcript and identify the speakers:

TRANSCRIPT:
${transcript}

${agenda ? `AGENDA/TOPICS:
${agenda}` : ''}

${attendees ? `ATTENDEES:
${Array.isArray(attendees) ? attendees.join(', ') : attendees}` : ''}

${meetingTitle ? `MEETING TITLE:
${meetingTitle}` : ''}

Please provide your speaker identification analysis.`;

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    console.log('Raw AI analysis:', analysisText);

    // Try to parse JSON response
    let identificationResult: IdentificationResult;
    try {
      // Extract JSON from the response (in case there's additional text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        identificationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create a basic response
      identificationResult = {
        meetingType: 'unknown',
        speakers: [
          {
            speaker: 'Speaker 1',
            role: 'Participant',
            confidence: 0.5,
            reasoning: 'Could not parse detailed analysis'
          }
        ],
        generalContext: 'Analysis failed to parse properly'
      };
    }

    console.log('Successfully identified speakers:', identificationResult);

    return new Response(JSON.stringify({
      success: true,
      identification: identificationResult,
      rawAnalysis: analysisText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in identify-speakers function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});