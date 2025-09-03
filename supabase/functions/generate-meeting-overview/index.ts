import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Function called');

  if (!openAIApiKey) {
    console.error('❌ OpenAI API key not found');
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
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

    const { transcript, meetingTitle, meetingNotes } = requestBody;

    if (!transcript && !meetingNotes) {
      console.log('❌ No content provided');
      return new Response(JSON.stringify({ error: 'Either transcript or meetingNotes is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = meetingNotes || transcript;
    console.log('📄 Content length:', content.length);

    const systemPrompt = `You are an expert at creating ultra-concise meeting overviews. Create a brief summary (35-50 words max) that captures:
1. What type of meeting this was
2. The main discussion points

Be factual and objective. Do not mention attendees, location, or date.`;

    const userPrompt = `Create a concise overview from this meeting titled "${meetingTitle || 'Meeting'}":

${content.substring(0, 2000)}...

Maximum 50 words. Focus on meeting purpose and main topics only.`;

    console.log('🤖 Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    console.log('📡 OpenAI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', errorData);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('✅ OpenAI response received');
    
    const overview = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('📝 Generated overview:', overview);

    return new Response(JSON.stringify({ overview }), {
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