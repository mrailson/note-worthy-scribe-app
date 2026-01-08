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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { prompt, conversationContext, requestType } = await req.json() as ImageGenerationRequest;

    console.log('🎨 AI4GP Image Generation request:', { 
      prompt: prompt.substring(0, 100), 
      requestType,
      contextLength: conversationContext?.length || 0
    });

    // Build comprehensive prompt for the Gemini image model
    const typeDescriptions: Record<string, string> = {
      chart: 'data visualisation chart with clear labels and legends',
      diagram: 'process flow diagram or structural diagram',
      infographic: 'informative visual summary with icons and key points',
      calendar: 'calendar or schedule grid layout',
      poster: 'professional notice or poster',
      general: 'image or visual'
    };

    const imagePrompt = `Create a professional ${typeDescriptions[requestType] || 'visual'}.

Context from conversation:
${conversationContext}

User request: ${prompt}

Design requirements:
- Professional, clean design with good visual hierarchy
- Clear, readable typography
- High contrast for accessibility
- Appropriate colour scheme based on the content and context
- Clean, modern design with appropriate white space
- If showing data, use clear charts with proper labels
- If showing schedules, use organised grid layouts
- Avoid cluttered designs - prioritise clarity

Content guidelines:
- Keep all content professional and workplace-appropriate
- No explicit, offensive, or inappropriate imagery
- Suitable for a professional office environment`;

    console.log('🖼️ Generating image with Lovable AI Gateway...');

    // Call Lovable AI Gateway with Gemini image model
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          { role: 'user', content: imagePrompt }
        ],
        modalities: ['image', 'text']
      }),
    });

    // Handle rate limits and payment errors
    if (response.status === 429) {
      console.error('Rate limit exceeded');
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please try again in a moment.',
        code: 'RATE_LIMIT',
        success: false
      }), { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (response.status === 402) {
      console.error('Payment required');
      return new Response(JSON.stringify({
        error: 'Usage limit reached. Please check your Lovable workspace credits.',
        code: 'PAYMENT_REQUIRED',
        success: false
      }), { 
        status: 402, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data).substring(0, 500));
      throw new Error('No image was generated. Please try rephrasing your request.');
    }

    console.log('✅ Image generated successfully');

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
        prompt: imagePrompt.substring(0, 300),
        requestType
      },
      textResponse: textContent || `I've created a ${description.toLowerCase()} based on our conversation. You can download it using the button below the image.`
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
