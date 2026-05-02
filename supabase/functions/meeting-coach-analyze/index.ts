import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, fullTranscript, previousAnalysis, meetingDuration, meetingContext } = await req.json();

    if (!transcript || !fullTranscript) {
      throw new Error('Missing transcript data');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Analysing meeting: ${meetingDuration} minutes, ${fullTranscript.length} chars`);

    const systemPrompt = `You are an expert executive assistant and meeting facilitator.

Analyse the transcript and provide THREE types of insights:

1. REAL-TIME COACHING (last 30 seconds only):
   - What was just discussed?
   - What clarifying question should be asked RIGHT NOW?

2. CUMULATIVE OVERVIEW (entire meeting so far):
   - Main topics covered
   - Decisions made
   - Action items with owners
   - Key discussion points

3. WRAP-UP ASSISTANT (track throughout meeting):
   - Questions raised but NOT answered
   - Issues discussed but NOT resolved
   - Topics that need clarification before ending
   - Suggested final questions to ensure completeness
   - Meeting completeness score (0-100%)

Pay special attention to:
- Questions asked by participants that weren't answered
- "We need to figure out..." statements without resolution
- Ambiguous statements needing clarification
- Action items without clear owners
- Decisions that seem tentative or unclear

Response format (JSON):
{
  "realTime": {
    "recentSummary": ["bullet 1", "bullet 2"],
    "suggestedQuestion": "question to ask now"
  },
  "overview": {
    "mainTopics": ["topic 1", "topic 2"],
    "decisions": ["decision 1", "decision 2"],
    "actionItems": ["owner: task", "owner: task"],
    "keyPoints": ["point 1", "point 2"]
  },
  "wrapUp": {
    "unansweredQuestions": ["question 1", "question 2"],
    "unresolvedIssues": ["issue 1", "issue 2"],
    "needsClarification": ["topic 1", "topic 2"],
    "suggestedFinalQuestions": ["q1", "q2", "q3"],
    "completenessScore": 65
  }
}`;

    const userPrompt = `Meeting Context:
Title: ${meetingContext?.title || 'Untitled Meeting'}
Type: ${meetingContext?.type || 'General'}
Participants: ${meetingContext?.participants?.join(', ') || 'Unknown'}
Duration: ${meetingDuration} minutes

Recent Transcript (Last 30-60s):
${transcript}

Full Meeting Transcript So Far:
${fullTranscript}

${previousAnalysis ? `Previous Wrap-Up Tracking:
Unanswered Questions: ${JSON.stringify(previousAnalysis.unansweredQuestions)}
Unresolved Issues: ${JSON.stringify(previousAnalysis.unresolvedIssues)}` : ''}

Provide comprehensive meeting coaching analysis in JSON format.`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        temperature: 0.4,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic error:', response.status, errorText);
      throw new Error(`Anthropic error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '');

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    console.log(`Analysis complete. Completeness: ${analysis.wrapUp?.completenessScore}%`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in meeting-coach-analyze:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
