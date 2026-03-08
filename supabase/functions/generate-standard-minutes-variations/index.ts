import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { meeting_id, variation_type } = await req.json();

    console.log(`🎨 Generating variation: ${variation_type} for meeting: ${meeting_id}`);

    if (!meeting_id || !variation_type) {
      throw new Error('Missing meeting_id or variation_type');
    }

    // Validate variation type
    const validTypes = ['no_actions', 'black_white', 'concise', 'detailed', 'executive_brief'];
    if (!validTypes.includes(variation_type)) {
      throw new Error(`Invalid variation_type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Fetch the meeting with standard minutes
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('notes_style_3, standard_minutes_variations')
      .eq('id', meeting_id)
      .single();

    if (fetchError || !meeting) {
      console.error('❌ Error fetching meeting:', fetchError);
      throw new Error('Meeting not found');
    }

    // Check if variation already exists (except executive_brief which we want to regenerate with new AI)
    const existingVariations = meeting.standard_minutes_variations || {};
    if (existingVariations[variation_type] && variation_type !== 'executive_brief') {
      console.log(`✅ Variation already exists, returning cached version`);
      return new Response(
        JSON.stringify({
          success: true,
          variation: existingVariations[variation_type],
          cached: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    // Force regeneration for executive_brief to use new AI method
    if (variation_type === 'executive_brief') {
      console.log(`🔄 Force regenerating executive_brief with new AI method`);
    }

    const baseContent = meeting.notes_style_3;
    if (!baseContent) {
      throw new Error('No standard minutes found for this meeting');
    }

    // Generate the variation based on type
    let variationContent = '';
    
    switch (variation_type) {
      case 'no_actions':
        variationContent = await generateNoActionsVariation(baseContent);
        break;
      case 'black_white':
        variationContent = await generateBlackWhiteVariation(baseContent);
        break;
      case 'concise':
        variationContent = await generateConciseVariation(baseContent);
        break;
      case 'detailed':
        variationContent = await generateDetailedVariation(baseContent);
        break;
      case 'executive_brief':
        variationContent = await generateExecutiveBriefVariation(baseContent);
        break;
    }

    // Store the variation in the database
    const updatedVariations = {
      ...existingVariations,
      [variation_type]: variationContent
    };

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ standard_minutes_variations: updatedVariations })
      .eq('id', meeting_id);

    if (updateError) {
      console.error('❌ Error storing variation:', updateError);
      // Don't throw - we can still return the generated content
    }

    console.log(`✅ Successfully generated ${variation_type} variation`);

    return new Response(
      JSON.stringify({
        success: true,
        variation: variationContent,
        cached: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error in generate-standard-minutes-variations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Variation generation functions
async function generateNoActionsVariation(content: string): Promise<string> {
  return content
    .replace(/#{1,6}\s*ACTION ITEMS[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/gi, '')
    .replace(/#{1,6}\s*Actions[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

async function generateBlackWhiteVariation(content: string): Promise<string> {
  // The black & white variation is handled client-side via CSS
  // Just return the original content - styling will be applied during rendering
  return content;
}

async function generateConciseVariation(content: string): Promise<string> {
  return content
    .replace(/#{1,6}\s*MEETING DETAILS[\s\S]*?(?=\n#{1,6}\s|\n\n)/gi, '')
    .replace(/^([-•]\s+.+)\n\s+([-•]\s+.+\n\s+)+/gm, '$1\n')
    .replace(/\s*\([^)]{20,}\)/g, '')
    .replace(/\*\*Background:\*\*[^\n]+\n?/gi, '')
    .replace(/^(\s{2,})([-•])/gm, '$2')
    .replace(/It was (noted|agreed|discussed) that /gi, '')
    .replace(/The team (discussed|reviewed|considered) /gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

async function generateDetailedVariation(content: string): Promise<string> {
  return content
    .replace(/^(#{1,6}\s+)([A-Z].+)$/gm, '$1$2\n\n**Context:** This section details $2.')
    .replace(/(\*\*Decision:\*\*)/gi, '\n**Background & Rationale:**\nThe following decision was made after careful consideration of all available information.\n\n$1');
}

async function generateExecutiveBriefVariation(content: string): Promise<string> {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1] : 'Meeting Summary';
  
  if (!lovableApiKey) {
    console.error('❌ Lovable AI API key not found, falling back to text extraction');
    return generateExecutiveBriefFallback(content, title);
  }
  
  const systemPrompt = `Create a concise executive meeting brief using British English spellings and conventions.

Format:
1. Opening paragraph (20-30 words): Brief overview of meeting purpose and main outcome
2. Key points (3-5 bullet points): Specific decisions, actions, and deliverables

Requirements:
- Use British English spellings (e.g., 'organised', 'realise', 'colour', 'centre')
- Total: 60-80 words maximum
- Opening paragraph on its own line, followed by blank line
- Then each bullet point on separate line with • character
- Each bullet point: one clear, specific statement (8-12 words)
- Focus on key decisions, actions, and outcomes only
- Include critical details: names, deadlines, deliverables (if mentioned)
- Professional, direct tone
- NO introductory phrases or filler words

Example format:
[Paragraph describing meeting]

• [First key point]
• [Second key point]
• [Third key point]`;

  const userPrompt = `Create a concise executive brief from this meeting titled "${title}":

${content.substring(0, 3000)}

Format your response exactly like this:
[Brief paragraph describing the meeting purpose and outcome]

• [Key decision/action/deliverable]
• [Key decision/action/deliverable]
• [Key decision/action/deliverable]
• [Additional points as needed, max 5 total]

Remember: Use • bullet character, put each bullet on its own line, blank line between paragraph and bullets.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error('❌ Lovable AI API error:', response.status);
      return generateExecutiveBriefFallback(content, title);
    }

    const data = await response.json();
    const briefContent = data.choices?.[0]?.message?.content?.trim() || '';
    
    return `# Executive Brief: ${title}

${briefContent}

---
*This is a condensed executive summary. Full minutes contain additional detail.*`;

  } catch (error) {
    console.error('❌ Error generating AI executive brief:', error);
    return generateExecutiveBriefFallback(content, title);
  }
}

function generateExecutiveBriefFallback(content: string, title: string): string {
  const keyPointsMatch = content.match(/#{1,6}\s*KEY (POINTS|DISCUSSION)[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/i);
  const keyPointsSection = keyPointsMatch ? keyPointsMatch[0] : '';
  
  const decisionsMatch = content.match(/#{1,6}\s*DECISIONS[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/i);
  const decisionsSection = decisionsMatch ? decisionsMatch[0] : '';
  
  const actionsMatch = content.match(/#{1,6}\s*ACTION ITEMS[\s\S]*?(?=\n#{1,6}\s|$)/i);
  const actionsSection = actionsMatch ? actionsMatch[0] : '';
  
  const topKeyPoints = extractTopPoints(keyPointsSection, 5);
  const topDecisions = extractTopPoints(decisionsSection, 3);
  const actionsSummary = extractActionsSummary(actionsSection);
  
  return `# Executive Brief: ${title}

## Key Highlights
${topKeyPoints}

## Major Decisions
${topDecisions}

## Action Items Summary
${actionsSummary}

---
*This is a condensed executive summary. Full minutes contain additional detail.*`;
}

function extractTopPoints(section: string, count: number): string {
  if (!section) return '- No key points recorded\n';
  
  const points = section.match(/^[-•]\s+(.+)$/gm) || [];
  const topPoints = points.slice(0, count);
  
  if (topPoints.length === 0) {
    const numberedPoints = section.match(/^\d+[\.)]\s+(.+)$/gm) || [];
    return numberedPoints.slice(0, count).map((p, i) => `${i + 1}. ${p.replace(/^\d+[\.)]\s+/, '')}`).join('\n') || '- No key points recorded\n';
  }
  
  return topPoints.join('\n');
}

function extractActionsSummary(actionsSection: string): string {
  if (!actionsSection) return '- No actions assigned\n';
  
  const tableMatch = actionsSection.match(/\|(.+?)\|/g);
  if (tableMatch && tableMatch.length > 2) {
    const rows = tableMatch.slice(2);
    const summary = rows.slice(0, 5).map((row, i) => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        return `${i + 1}. ${cells[0]} - ${cells[1]}`;
      }
      return '';
    }).filter(s => s).join('\n');
    
    return summary || '- No actions assigned\n';
  }
  
  const bullets = actionsSection.match(/^[-•]\s+(.+)$/gm) || [];
  return bullets.slice(0, 5).join('\n') || '- No actions assigned\n';
}
