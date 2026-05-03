import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
      });
      if (!__vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ---- /AUTH GUARD ----

    const { prompt, consultationData, consultationType } = await req.json();
    
    if (!prompt) {
      throw new Error('No prompt provided');
    }

    console.log('Processing AI consultation request:', prompt);

    // Build context from consultation data
    let contextPrompt = `You are an expert GP assistant helping with clinical documentation and consultation analysis. 

Consultation Context:
- Type: ${consultationType || 'General consultation'}
- Duration: ${consultationData?.duration || 'Not specified'}
- Transcript: ${consultationData?.transcript || 'No transcript available'}
- Current GP Summary: ${consultationData?.gpSummary || 'No summary available'}
- Patient Copy: ${consultationData?.patientCopy || 'No patient copy available'}

User Request: ${prompt}

IMPORTANT FORMATTING INSTRUCTIONS:
- Use HTML formatting in your response
- Use <h3> tags for main headings
- Use <h4> tags for sub-headings
- Use <strong> tags for emphasis
- Use <ul> and <li> tags for bullet points
- Use <p> tags for paragraphs
- Use <div class="bg-muted p-3 rounded-lg border-l-4 border-primary mt-4"> for important notes or clinical advice
- For referral letters, use proper letter formatting with clear sections
- For lists of recommendations, use numbered lists with <ol> and <li>
- Use <blockquote> for quotes or specific clinical guidelines

Please provide a helpful, professional response that addresses the user's request. If they're asking for:
- A referral letter: Create a professional NHS-style referral letter with proper formatting
- Missing items: Review the consultation systematically and present findings in an organized list
- Improvements: Provide specific, actionable recommendations with clear categories
- Clinical advice: Provide evidence-based medical guidance with proper structure

Format your response with clear headings, proper spacing, and professional medical structure.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert GP assistant specializing in clinical documentation, consultation analysis, and medical letter writing. Provide professional, evidence-based responses.'
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log('AI consultation response generated');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI consultation assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});