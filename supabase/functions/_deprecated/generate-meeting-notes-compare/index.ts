import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_PROMPT = `You are an expert NHS meeting minutes generator for UK primary care contexts. Generate professional meeting notes optimized for GP practices, PCNs, ICBs, and NHS administrative teams.

GOAL: Transform raw meeting transcripts into 6 distinct, professionally formatted outputs for UK NHS primary care audiences.

RULES:
1. UK spelling/terminology (organised, summarise, etc.)
2. NHS-appropriate language and structure
3. Professional tone suitable for clinical governance
4. Include relevant clinical/administrative context
5. Format in clean Markdown with tables where appropriate
6. Ensure outputs are distinct in style and purpose

DETAIL SCALING (1-5):
- Level 1: Ultra-brief, key points only
- Level 2: Brief, essential information
- Level 3: Standard detail level
- Level 4: Detailed, comprehensive coverage  
- Level 5: Very detailed, extensive documentation

SIX STYLES:

1. **formal_minutes**: Traditional committee-style minutes with agenda items, motions, votes, attendees. Formal NHS governance structure.

2. **action_notes**: Task-focused format highlighting WHO does WHAT by WHEN. Clear accountability and deadlines.

3. **headline_summary**: Executive summary with key decisions, risks, and outcomes. Suitable for senior leadership.

4. **narrative_newsletter**: Conversational, engaging format for wider team communication. Stories and context around decisions.

5. **decision_log**: Structured record of all decisions made, rationale, alternatives considered, and implementation plans.

6. **annotated_summary**: Detailed summary with commentary, background context, and explanatory notes for complex topics.

Each style should be professionally formatted in Markdown with appropriate headers, lists, tables, and NHS-relevant structure.`;

const COMPARE_ADDENDUM = `
COMPARE MODE - CRITICAL INSTRUCTIONS

You MUST generate ALL 6 styles for EACH detail level requested with SIGNIFICANT DIFFERENCES between levels.

DETAIL LEVEL REQUIREMENTS:
Level 1 (Ultra-brief): 2-3 bullet points max, key decisions only, no background
Level 2 (Brief): 4-6 bullet points, essential info, minimal context  
Level 3 (Standard): Normal meeting notes, balanced detail, some context
Level 4 (Detailed): Comprehensive coverage, full discussions, background context
Level 5 (Very detailed): Exhaustive documentation, all discussions, full context, quotes

EXAMPLE - Formal Minutes differences:
Level 1: "Meeting held. Discussed ICB pilot sites. Decision: Submit bid by October."
Level 3: "Meeting Minutes\n## Agenda\n1. ICB pilot sites discussion\n2. Bid submission timeline\n## Decisions\n- Agreed to submit expression of interest\n- Deadline: End of September"  
Level 5: "Meeting Minutes\n**Date:** [date]\n**Chair:** [name]\n**Attendees:** [full list]\n## 1. Welcome & Apologies\n[full section]\n## 2. ICB New Orders of Care Program\n[detailed discussion with quotes and concerns]\n## 3. Pilot Hub Sites\n[comprehensive coverage of all viewpoints]\n## Actions\n[detailed action items with owners and dates]"

Return format:
{
  "comparisons": {
    "1": {
      "formal_minutes": "[Ultra-brief formal minutes]",
      "action_notes": "[Ultra-brief action notes]", 
      "headline_summary": "[Ultra-brief summary]",
      "narrative_newsletter": "[Ultra-brief newsletter]",
      "decision_log": "[Ultra-brief decision log]",
      "annotated_summary": "[Ultra-brief annotated summary]"
    },
    "5": {
      "formal_minutes": "[Very detailed formal minutes]",
      "action_notes": "[Very detailed action notes]", 
      "headline_summary": "[Very detailed summary]",
      "narrative_newsletter": "[Very detailed newsletter]",
      "decision_log": "[Very detailed decision log]",
      "annotated_summary": "[Very detailed annotated summary]"
    }
  }
}

CRITICAL: Each level must be VISIBLY different in length and depth. Level 1 should be 10-20% the length of Level 5.
`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('Missing OpenAI API key');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { transcript, settings, levels } = body as {
      transcript: string;
      settings?: Record<string, any>;
      levels?: number[];
    };

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'transcript' (string)" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const compare_levels = (levels && levels.length ? levels : [1, 2, 3, 4, 5])
      .map((n) => Math.min(5, Math.max(1, Math.round(n))));

    const payload = {
      settings: { ...(settings || {}), controls: { ...(settings?.controls || {}), compare_levels } },
      transcript,
    };

    console.log('Making request to OpenAI with compare levels:', compare_levels);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: BASE_PROMPT + "\n" + COMPARE_ADDENDUM },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `OpenAI error: ${response.status} ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content returned from OpenAI');
      return new Response(JSON.stringify({ error: "No content returned from model." }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError, 'Raw content:', content);
      return new Response(JSON.stringify({ error: "Model did not return valid JSON.", raw: content }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!parsed?.comparisons) {
      console.error('Missing comparisons in response:', parsed);
      return new Response(JSON.stringify({ error: "Missing 'comparisons' in response.", raw: parsed }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully generated comparison results');
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-compare function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});