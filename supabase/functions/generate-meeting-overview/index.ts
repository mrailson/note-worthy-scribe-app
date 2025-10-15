import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Function called');

  if (!lovableApiKey) {
    console.error('❌ Lovable AI API key not found');
    return new Response(JSON.stringify({ error: 'Lovable AI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('📝 Parsing request body...');
    const requestBody = await req.json();
    console.log('✅ Request body parsed:', { 
      hasTitle: !!requestBody.meetingTitle, 
      hasNotes: !!requestBody.meetingNotes 
    });

    const { meetingId, transcript, meetingTitle, meetingNotes } = requestBody;

    if (!meetingId) {
      console.log('❌ Meeting ID is required');
      return new Response(JSON.stringify({ error: 'Meeting ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!transcript && !meetingNotes) {
      console.log('❌ No content provided');
      return new Response(JSON.stringify({ error: 'Either transcript or meetingNotes is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = meetingNotes || transcript;
    console.log('📄 Content length:', content.length);

    const systemPrompt = `Create a comprehensive executive meeting summary using British English spellings and conventions.

Requirements:
- Use British English spellings (e.g., 'organised', 'realise', 'colour', 'centre')
- 100-150 words in a structured executive summary format
- Start with a clear opening statement of the meeting's primary focus and key outcomes
- Write in cohesive paragraphs (not bullet points) that flow naturally
- First paragraph: Main purpose, critical decisions, and overarching themes
- Second paragraph (if needed): Key challenges, actions agreed, and important details
- Include specific information: names, numbers, deadlines, key deliverables
- Maintain formal, professional executive tone
- Focus on strategic importance and business impact
- Emphasise what matters most to decision-makers and stakeholders`;

    const userPrompt = `Create a comprehensive executive summary from this meeting titled "${meetingTitle || 'Meeting'}":

${content.substring(0, 3000)}

Provide a 100-150 word executive summary covering the meeting's strategic purpose, critical decisions made, key discussion themes, important actions agreed, and any significant deadlines or deliverables mentioned.`;

    console.log('🔧 Using Lovable AI with google/gemini-2.5-flash');

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
        max_completion_tokens: 250,
      }),
    });

    console.log('📡 Lovable AI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Lovable AI API error:', errorData);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Insufficient AI credits. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: `Lovable AI API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('✅ Lovable AI response received');
    
    const overview = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('📝 Generated overview:', overview);

    // Initialize Supabase client and save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('💾 Saving overview to database...');
    
    // Upsert the overview (insert or update if exists)
    const { error: dbError } = await supabase
      .from('meeting_overviews')
      .upsert({
        meeting_id: meetingId,
        overview: overview
      }, {
        onConflict: 'meeting_id'
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: `Failed to save overview: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Overview saved successfully');

    return new Response(JSON.stringify({ overview, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Function error:', error.message);
    console.error('📚 Error stack:', error.stack);
    return new Response(JSON.stringify({ error: `Function error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});