import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { transcript, currentTitle } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is required');
    }

    console.log('📝 Generating meeting title from transcript length:', transcript.length);

    // Use first 10,000 chars of transcript for efficiency
    const transcriptExcerpt = transcript.substring(0, 10000);

    const systemPrompt = `You are a meeting title generator. Create a concise, descriptive title for a meeting based on its transcript.

REQUIREMENTS:
- Maximum 15 words
- Use British English spelling and terminology
- Capture the main topic/purpose of the meeting
- Make it specific and memorable
- Use title case (capitalise major words)
- Include key themes, projects, or initiatives mentioned
- Examples of good titles:
  * "Health Inequalities Prevention Group Q4 Planning Meeting"
  * "NHS Digital Transformation Strategy Review"
  * "Patient Safety Incident Investigation Discussion"
  * "Primary Care Network Budget Allocation Review"
  * "CQC Compliance Gap Analysis Workshop"

AVOID:
- Generic phrases like "Team Meeting" or "Discussion"
- Including dates or times (already shown separately)
- Using "Meeting" unless it adds clarity
- Abbreviations without context

Respond with ONLY the title, no explanation or quotes.`;

    const userPrompt = `Current title: ${currentTitle}

Transcript excerpt:
${transcriptExcerpt}

Generate a concise, descriptive title (max 15 words) that captures what this meeting was about:`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    let generatedTitle = data.choices?.[0]?.message?.content?.trim() || '';

    // Clean up the title
    generatedTitle = generatedTitle
      .replace(/^["']|["']$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Validate length (max 15 words)
    const wordCount = generatedTitle.split(/\s+/).length;
    if (wordCount > 15) {
      generatedTitle = generatedTitle.split(/\s+/).slice(0, 15).join(' ');
    }

    // Ensure title is not empty or too short
    if (generatedTitle.length < 5) {
      console.warn('⚠️ Generated title too short, using fallback');
      generatedTitle = currentTitle;
    }

    console.log('✅ Generated title:', generatedTitle);
    console.log('📊 Word count:', generatedTitle.split(/\s+/).length);

    return new Response(
      JSON.stringify({ title: generatedTitle }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating meeting title:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        title: null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
