import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const systemPrompt = `You are an expert NHS policy analyst specialising in GP practice policy compliance. Your task is to analyse existing practice policies and identify:

1. POLICY TYPE DETECTION:
   - Identify the type of policy from the content
   - Match to standard NHS GP practice policy categories

2. GAP ANALYSIS:
   - Compare against current CQC requirements
   - Check for compliance with latest NHS England guidance
   - Identify missing regulatory requirements

3. OUTDATED REFERENCES:
   - Flag any references to superseded legislation
   - Identify outdated guidance documents
   - Note any references to organisations that have changed names or merged

4. MISSING SECTIONS:
   - Check for standard policy sections (Purpose, Scope, Responsibilities, etc.)
   - Identify missing procedural elements
   - Note any required training or monitoring sections that are absent

5. REVIEW DATE EXTRACTION:
   - Extract the last review date if present
   - Note if the policy appears overdue for review

You must respond in valid JSON format with the following structure:
{
  "policy_type": "string - the identified policy type",
  "gaps": ["array of identified compliance gaps"],
  "outdated_references": ["array of outdated references found"],
  "missing_sections": ["array of missing standard sections"],
  "last_review_date": "string or null - extracted review date",
  "summary": "brief summary of the analysis",
  "priority_actions": ["top 3 actions recommended"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { extracted_text } = body;

    if (!extracted_text) {
      throw new Error('extracted_text is required');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Truncate if too long
    const maxLength = 50000;
    const truncatedText = extracted_text.length > maxLength
      ? extracted_text.substring(0, maxLength) + '\n\n[Content truncated due to length]'
      : extracted_text;

    const userPrompt = `Analyse the following practice policy document and provide a comprehensive gap analysis:

---POLICY DOCUMENT---
${truncatedText}
---END DOCUMENT---

Today's date is ${new Date().toLocaleDateString('en-GB')}.

Please analyse this policy against current NHS England and CQC requirements and provide your analysis in the specified JSON format.`;

    console.log('Analysing policy gaps, text length:', extracted_text.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI returned an empty response');
    }

    const data = JSON.parse(responseText);
    const aiContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return a default structure
      analysis = {
        policy_type: 'Unknown',
        gaps: ['Unable to fully analyse - please review manually'],
        outdated_references: [],
        missing_sections: [],
        last_review_date: null,
        summary: 'Analysis could not be completed automatically',
        priority_actions: ['Manual review recommended'],
      };
    }

    console.log('Policy analysis complete:', analysis.policy_type);

    return new Response(JSON.stringify({
      success: true,
      policy_type: analysis.policy_type,
      gaps: analysis.gaps || [],
      outdated_references: analysis.outdated_references || [],
      missing_sections: analysis.missing_sections || [],
      last_review_date: analysis.last_review_date,
      summary: analysis.summary,
      priority_actions: analysis.priority_actions || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('analyse-policy-gaps error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
