import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      meetingId, 
      transcript, 
      currentTitle,
      existingActionItems = [],
      attendees,
      meetingContext
    } = await req.json();
    
    if (!meetingId || !transcript) {
      throw new Error('meetingId and transcript are required');
    }

    console.log('🔍 Extracting live insights for meeting:', meetingId);
    console.log('📝 Transcript length:', transcript.length);
    console.log('📋 Existing action items:', existingActionItems.length);

    // Use last 3000 words for efficiency during live recording
    const words = transcript.split(/\s+/);
    const recentWords = words.slice(-3000);
    const recentTranscript = recentWords.join(' ');

    // Build context for better title generation
    let contextInfo = '';
    if (attendees && attendees.length > 0) {
      contextInfo += `\nATTENDEES: ${attendees.slice(0, 5).join(', ')}`;
    }
    if (meetingContext?.agenda) {
      contextInfo += `\nAGENDA: ${meetingContext.agenda.substring(0, 300)}`;
    }

    const systemPrompt = `You extract live meeting insights from a transcript that is currently being recorded.

Return ONLY valid JSON in this exact format:
{
  "suggestedTitle": "Specific descriptive title (4-12 words)",
  "actionItems": [
    {
      "action_text": "Clear action description",
      "assignee_name": "Name mentioned or TBC",
      "due_date": "Date mentioned or TBC"
    }
  ]
}

TITLE RULES:
- Must be SPECIFIC and descriptive (4-12 words)
- NEVER use generic titles like "General Meeting", "Team Update", "Progress Review"
- Include project names, topics, or key discussion points
- Use British English spelling (organise, programme, centre)
- Use Title Case

ACTION ITEMS RULES:
- Only extract CLEAR action items with specific tasks
- Must be something someone needs to DO
- Include assignee if mentioned, otherwise use "TBC"
- Include due date if mentioned, otherwise use "TBC"
- Skip vague statements or general discussions
- Only include NEW action items not already in existingActionItems
- Maximum 5 action items per extraction

EXISTING ACTION ITEMS (do not duplicate these):
${existingActionItems.map((a: string) => `- ${a}`).join('\n') || 'None yet'}`;

    const userPrompt = `Current title: ${currentTitle || 'General Meeting'}
${contextInfo}

TRANSCRIPT (most recent ~3000 words):
${recentTranscript}

Extract a specific title and any NEW action items from this live meeting. Return JSON only.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    console.log('📤 AI response:', content.substring(0, 200));

    // Parse the JSON response
    let result: { suggestedTitle: string; actionItems: Array<{ action_text: string; assignee_name: string; due_date: string }> };
    
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      result = {
        suggestedTitle: currentTitle || 'Meeting in Progress',
        actionItems: []
      };
    }

    // Validate and clean title
    let suggestedTitle = result.suggestedTitle || currentTitle || 'Meeting in Progress';
    suggestedTitle = suggestedTitle
      .replace(/^["']|["']$/g, '')
      .replace(/^title:\s*/i, '')
      .trim();

    // Check for generic titles
    const genericPatterns = [
      /^general\s+(meeting|discussion|update)$/i,
      /^team\s+(meeting|discussion|update|call|sync)$/i,
      /^progress\s+(review|update|meeting)$/i,
      /^meeting\s+in\s+progress$/i,
      /^new\s+meeting$/i,
      /^untitled/i,
    ];
    
    const isGeneric = genericPatterns.some(p => p.test(suggestedTitle)) || suggestedTitle.length < 10;
    if (isGeneric) {
      // Keep current title if new one is generic
      suggestedTitle = currentTitle || suggestedTitle;
    }

    // Validate action items
    const actionItems = (result.actionItems || [])
      .filter((item: any) => 
        item.action_text && 
        typeof item.action_text === 'string' && 
        item.action_text.length > 5 &&
        !existingActionItems.includes(item.action_text)
      )
      .slice(0, 5);

    console.log('✅ Extracted insights - Title:', suggestedTitle);
    console.log('✅ New action items:', actionItems.length);

    return new Response(
      JSON.stringify({ 
        suggestedTitle,
        actionItems,
        isGenericTitle: isGeneric
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error extracting live insights:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        suggestedTitle: null,
        actionItems: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
