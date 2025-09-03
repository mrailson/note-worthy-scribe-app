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

  if (!openAIApiKey) {
    console.error('OpenAI API key not found');
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { transcript, meetingTitle, meetingNotes } = await req.json();

    if (!transcript && !meetingNotes) {
      return new Response(JSON.stringify({ error: 'Either transcript or meetingNotes is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = meetingNotes || transcript;
    const systemPrompt = `You are an expert at creating ultra-concise meeting overviews. Your task is to create a brief, factual summary that captures ONLY:
1. What type of meeting this was (the purpose/topic)
2. The main discussion points or topics covered

STRICT REQUIREMENTS:
- Maximum 50 words (aim for 35-45)
- Focus only on meeting purpose and main topics discussed
- Do NOT mention attendees, location, date, or administrative details
- Use clear, professional language
- Be factual and objective
- Start with the meeting type/purpose, then list main topics

Example format: "Team meeting focused on quarterly planning. Discussed budget allocations, resource requirements, project timelines, and performance metrics."`;

    const userPrompt = `Create a concise overview (35-50 words max) from this ${meetingTitle ? `meeting titled "${meetingTitle}"` : 'meeting'}:

${content}

Remember: Only include meeting purpose and main discussion topics. No attendees, locations, or administrative details.`;

    console.log('Calling OpenAI API for meeting overview generation...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 100,
      }),
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error response:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure');
      throw new Error('Invalid response from OpenAI API');
    }
    
    const overview = data.choices[0].message.content?.trim() || '';

    console.log('Generated overview:', overview);
    console.log('Word count:', overview.split(' ').length);

    return new Response(JSON.stringify({ overview }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-overview function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});