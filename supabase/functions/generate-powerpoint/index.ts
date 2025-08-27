import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PresentationRequest {
  topic: string;
  presentationType: string;
  slideCount?: number;
  complexityLevel?: string;
}

interface SlideContent {
  title: string;
  type: string;
  content: string[];
  notes?: string;
  meetingSection?: string;
}

interface PresentationContent {
  title: string;
  slides: SlideContent[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      throw new Error('Claude API key not configured');
    }

    const { topic, presentationType, slideCount = 10, complexityLevel = 'intermediate' }: PresentationRequest = await req.json();

    console.log(`Generating PowerPoint for topic: ${topic}, type: ${presentationType}`);

    // Define presentation-specific prompts
    const typePrompts = {
      'Clinical Guidelines': 'Create a clinical guidelines presentation focusing on evidence-based recommendations, implementation steps, and clinical pathways.',
      'Patient Education': 'Create a patient-friendly educational presentation with clear explanations, visual aids, and actionable advice.',
      'Training Materials': 'Create a comprehensive training presentation with learning objectives, key concepts, and practical exercises.',
      'Research Presentation': 'Create an academic research presentation with methodology, findings, and clinical implications.',
      'PCN Board Meetings': 'Create a Primary Care Network board meeting presentation with agenda items, performance metrics, strategic updates, and action points. Include sections for: Network Performance Dashboard, Quality Improvement Initiatives, Financial Overview, Partnership Updates, and Next Steps.',
      'Practice Partnership Meetings': 'Create a practice partnership meeting presentation covering operational updates, clinical governance, financial performance, and partnership decisions. Include sections for: Practice Performance Metrics, Clinical Quality Updates, Financial Review, Staffing Updates, and Strategic Decisions.',
      'Neighbourhood Meetings': 'Create a neighbourhood/community healthcare meeting presentation focusing on local health initiatives, community engagement, and collaborative care. Include sections for: Community Health Needs Assessment, Local Service Updates, Partnership Initiatives, Patient Feedback, and Community Action Plans.',
      'Custom Topic': 'Create a professional presentation suitable for healthcare settings.'
    };

    const specificPrompt = typePrompts[presentationType as keyof typeof typePrompts] || typePrompts['Custom Topic'];

    // Generate presentation content using Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user", 
          content: `${specificPrompt}
          
          Topic: "${topic}"
          Complexity Level: ${complexityLevel}
          Target Slide Count: ${slideCount}
          
          For meeting-type presentations, include appropriate governance structure, decision-making frameworks, and action item tracking.
          
          Create a comprehensive presentation outline with detailed content for each slide.
          
          Return ONLY valid JSON with this exact structure:
          {
            "title": "Presentation Title",
            "slides": [
              {
                "title": "Slide Title",
                "type": "title|agenda|metrics|content|comparison|decisions|actions|summary", 
                "content": ["bullet point 1", "bullet point 2", "bullet point 3"],
                "notes": "detailed presenter notes for this slide",
                "meetingSection": "governance|performance|strategic|operational"
              }
            ]
          }
          
          Ensure each slide has 3-5 meaningful bullet points and comprehensive presenter notes.`
        }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API request failed: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    let presentationContent: PresentationContent;

    try {
      // Extract the content from Claude's response
      const contentText = claudeData.content[0].text;
      
      // Find JSON within the response (handle any extra text)
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }
      
      presentationContent = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      console.error('Raw response:', claudeData.content[0].text);
      throw new Error('Failed to parse presentation content from Claude API');
    }

    console.log(`Generated presentation: "${presentationContent.title}" with ${presentationContent.slides.length} slides`);

    // Generate PowerPoint file data structure (to be processed by frontend)
    const response = {
      success: true,
      presentation: presentationContent,
      metadata: {
        topic,
        presentationType,
        slideCount: presentationContent.slides.length,
        complexityLevel,
        generatedAt: new Date().toISOString()
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-powerpoint function:', error);
    
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