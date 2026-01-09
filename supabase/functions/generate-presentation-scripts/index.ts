import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface ScriptRequest {
  topic: string;
  content: string;
  slideCount: number;
}

interface NarrationScript {
  slideNumber: number;
  title: string;
  narrationScript: string;
  estimatedDuration: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { topic, content, slideCount }: ScriptRequest = await req.json();

    console.log(`[Scripts] Generating narration scripts for: "${topic}" (${slideCount} slides)`);

    const prompt = `You are creating professional narration scripts for a healthcare presentation.

Topic: ${topic}
Number of slides: ${slideCount}

Source content:
${content.substring(0, 8000)}

Create narration scripts for each slide that:
- Are written in British English spelling and terminology
- Sound natural when read aloud by a professional narrator
- Are approximately 30-45 seconds when spoken (60-90 words per slide)
- Include natural pauses marked with "..." where appropriate
- Cover key points clearly and professionally
- Use appropriate medical/healthcare terminology
- Are engaging and educational for healthcare professionals

Return your response as valid JSON only (no markdown, no code blocks), in this exact format:
{
  "scripts": [
    {
      "slideNumber": 1,
      "title": "Title for slide 1",
      "narrationScript": "The narration text for slide 1...",
      "estimatedDuration": 35
    },
    {
      "slideNumber": 2,
      "title": "Title for slide 2", 
      "narrationScript": "The narration text for slide 2...",
      "estimatedDuration": 40
    }
  ]
}

Generate exactly ${slideCount} script entries. Only output the JSON object, nothing else.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Scripts] Claude API error: ${response.status} - ${errorText}`);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const claudeResponse = await response.json();
    const responseText = claudeResponse.content?.[0]?.text || '';

    console.log('[Scripts] Claude response received, parsing JSON...');

    // Parse the JSON response
    let scripts: NarrationScript[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scripts = parsed.scripts || [];
      }
    } catch (parseError) {
      console.error('[Scripts] JSON parse error:', parseError);
      console.log('[Scripts] Raw response:', responseText.substring(0, 500));
      
      // Generate fallback scripts
      scripts = Array.from({ length: slideCount }, (_, i) => ({
        slideNumber: i + 1,
        title: i === 0 ? topic : `Section ${i}`,
        narrationScript: i === 0 
          ? `Welcome to this presentation on ${topic}. Today we'll explore the key aspects and implications for healthcare practice.`
          : `Moving on to our next section... Here we examine further details and practical applications.`,
        estimatedDuration: 35
      }));
    }

    console.log(`[Scripts] Generated ${scripts.length} narration scripts`);

    return new Response(
      JSON.stringify({
        success: true,
        scripts,
        topic,
        slideCount: scripts.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Scripts] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate scripts',
        scripts: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
