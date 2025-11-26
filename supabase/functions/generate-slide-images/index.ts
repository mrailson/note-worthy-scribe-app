import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageRequest {
  imageDescription: string;
  slideTitle: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { imageDescription, slideTitle }: ImageRequest = await req.json();

    console.log(`Generating image for slide: ${slideTitle}`);

    // Determine slide type from title/description to customize visual style
    const lowerDesc = imageDescription.toLowerCase();
    const lowerTitle = slideTitle.toLowerCase();
    
    let stylePrompt = "modern, minimal, professional, flat design illustration";
    let colorScheme = "using a sophisticated blue and grey corporate color palette";
    
    if (lowerDesc.includes('metric') || lowerDesc.includes('dashboard') || lowerTitle.includes('metric')) {
      stylePrompt = "abstract data visualization, infographic style, geometric shapes representing analytics";
      colorScheme = "using vibrant blue, green, and purple accent colors on light background";
    } else if (lowerDesc.includes('action') || lowerDesc.includes('recommendation') || lowerTitle.includes('recommendation')) {
      stylePrompt = "goal-oriented visual, upward arrows, achievement icons, action-focused composition";
      colorScheme = "using energetic orange, blue, and green colors";
    } else if (lowerDesc.includes('timeline') || lowerDesc.includes('roadmap') || lowerTitle.includes('next step')) {
      stylePrompt = "horizontal timeline visualization, connected pathway, progression concept";
      colorScheme = "using sequential blue gradient tones";
    } else if (lowerDesc.includes('insight') || lowerDesc.includes('analysis')) {
      stylePrompt = "analytical concept, lightbulb moment, strategic thinking visualization";
      colorScheme = "using warm amber and teal professional tones";
    }

    // Generate image using Lovable AI (Nano banana model)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Create a professional, clean business image for an executive presentation slide about: ${imageDescription}. 
            
Style requirements:
- ${stylePrompt}
- ${colorScheme}
- Suitable for corporate PowerPoint presentations
- NO text, labels, or words in the image
- Clean white or subtle gradient background
- Professional iconography
- Modern flat design aesthetic
- High contrast for visibility
- Simple and impactful composition`
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI image generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image returned from AI');
    }

    console.log(`Image generated successfully for: ${slideTitle}`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        slideTitle: slideTitle
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in generate-slide-images function:', error);

    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
