import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageGenerationRequest {
  prompt: string;
  conversationContext: string;
  requestType: 'chart' | 'diagram' | 'infographic' | 'calendar' | 'poster' | 'general';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { prompt, conversationContext, requestType } = await req.json() as ImageGenerationRequest;

    console.log('🎨 AI4GP Image Generation request:', { 
      prompt: prompt.substring(0, 100), 
      requestType,
      contextLength: conversationContext?.length || 0
    });

    // First, use GPT to generate an optimised DALL-E prompt based on the conversation
    const systemPrompt = `You are an expert at creating image generation prompts for DALL-E.
Your task is to create a clear, detailed prompt that will generate a professional, NHS-appropriate visual.

Guidelines:
- Create clean, professional visuals suitable for healthcare settings
- Use clear, readable typography for any text elements
- Prefer infographic-style layouts for data
- Use NHS blue (#005EB8) as a primary accent colour where appropriate
- Ensure high contrast and accessibility
- For calendars/schedules: create clear grid layouts with readable text
- For charts: use clean, modern chart styles
- For posters: use professional healthcare poster layouts
- For diagrams: use clear flow arrows and organised layouts

Based on the conversation context and user request, generate a single, detailed DALL-E prompt.
Output ONLY the prompt, nothing else.`;

    const userPromptForGPT = `User request: "${prompt}"

Conversation context:
${conversationContext}

Request type: ${requestType}

Generate a detailed DALL-E prompt to visualise this information in a professional, NHS-appropriate style.`;

    console.log('🤖 Generating optimised DALL-E prompt...');

    // Generate optimised prompt using GPT
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptForGPT }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text();
      console.error('GPT prompt generation error:', errorText);
      throw new Error(`Failed to generate image prompt: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const dallePrompt = gptData.choices[0]?.message?.content?.trim() || prompt;

    console.log('✅ Generated DALL-E prompt:', dallePrompt.substring(0, 200));

    // Now generate the image using DALL-E 3
    console.log('🖼️ Generating image with DALL-E 3...');

    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json'
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('DALL-E generation error:', errorText);
      
      // Check for content policy violation
      if (errorText.includes('content_policy_violation')) {
        return new Response(JSON.stringify({
          error: 'Image generation was blocked due to content policy. Please try rephrasing your request.',
          code: 'CONTENT_POLICY'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.data[0]?.b64_json;
    const revisedPrompt = imageData.data[0]?.revised_prompt || dallePrompt;

    if (!base64Image) {
      throw new Error('No image data received from DALL-E');
    }

    console.log('✅ Image generated successfully');

    // Generate a description for the image
    const imageUrl = `data:image/png;base64,${base64Image}`;
    
    // Create a brief description based on the request type
    const descriptions: Record<string, string> = {
      chart: 'Data visualisation chart',
      diagram: 'Process or structure diagram',
      infographic: 'Visual information summary',
      calendar: 'Schedule or calendar visualisation',
      poster: 'Professional poster or notice',
      general: 'Visual representation'
    };

    const description = descriptions[requestType] || 'Generated visual';

    return new Response(JSON.stringify({
      success: true,
      image: {
        url: imageUrl,
        alt: description,
        prompt: revisedPrompt,
        requestType
      },
      textResponse: `I've created a visual representation of the information. Here's what I generated:\n\n**${description}**\n\n_Prompt used: ${revisedPrompt.substring(0, 150)}..._\n\nYou can download this image using the button below the image.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ AI4GP Image Generation error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate image',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
