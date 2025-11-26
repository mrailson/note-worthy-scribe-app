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
  supportingFiles?: {
    name: string;
    content: string;
    type: string;
  }[];
}

interface SlideContent {
  title: string;
  type: string;
  content: string[];
  notes?: string;
  meetingSection?: string;
  imageDescription?: string;
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

    const { topic, presentationType, slideCount = 10, complexityLevel = 'intermediate', supportingFiles = [] }: PresentationRequest = await req.json();

    console.log(`Generating PowerPoint for topic: ${topic}, type: ${presentationType}, with ${supportingFiles.length} supporting files`);

    // Auto-extract topic if not provided but files exist
    let finalTopic = topic;
    if ((!topic || topic.trim() === '') && supportingFiles.length > 0) {
      finalTopic = `Executive Overview: ${supportingFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')}`;
      console.log(`Auto-generated topic: ${finalTopic}`);
    }

    // Define presentation-specific prompts
    const typePrompts = {
      'Executive Overview': `Create a high-level executive overview presentation focusing on strategic insights, key metrics, data-driven recommendations, and actionable next steps. Structure:
- Executive Summary slide with 3-4 critical takeaways
- Key Metrics slides with quantifiable data points
- Strategic Insights with evidence-based analysis
- Recommendations with clear action items
- Implementation Roadmap with timeline
Keep bullet points concise (maximum 4 per slide). Use professional British English. Each slide MUST include an imageDescription field describing a relevant professional icon, chart representation, or abstract business visual.`,
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

    // Process supporting files content
    let supportingContext = '';
    if (supportingFiles.length > 0) {
      supportingContext = '\n\nSUPPORTING DOCUMENTS CONTEXT:\n';
      supportingFiles.forEach((file, index) => {
        supportingContext += `\n=== Document ${index + 1}: ${file.name} ===\n${file.content}\n`;
      });
      supportingContext += '\nPlease incorporate relevant information from these supporting documents into the presentation content where appropriate. Extract key data, metrics, and insights.\n';
    }

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
          
          Topic: "${finalTopic}"
          Complexity Level: ${complexityLevel}
          Target Slide Count: ${slideCount}${supportingContext}
          
          CRITICAL REQUIREMENTS:
          - Use British English throughout (organisation, realise, colour, centre, etc.)
          - British healthcare terminology (GP, surgery, A&E, NHS)
          - Professional tone suitable for UK healthcare executives
          - Maximum 4 bullet points per slide
          - Each bullet must be concise and actionable
          - Each slide MUST include an "imageDescription" field describing a professional visual
          
          For Executive Overview presentations:
          - Focus on strategic value and business impact
          - Include data/metrics from documents where available
          - Clear slide types: "executive-summary", "key-metrics", "insights", "recommendations", "next-steps"
          
          Return ONLY valid JSON with this exact structure:
          {
            "title": "Presentation Title",
            "slides": [
              {
                "title": "Slide Title",
                "type": "executive-summary|key-metrics|insights|recommendations|next-steps|content", 
                "content": ["bullet point 1", "bullet point 2", "bullet point 3"],
                "notes": "detailed presenter notes",
                "imageDescription": "Description of professional image/icon/chart visual for this slide"
              }
            ]
          }
          
          Ensure imageDescription is always present and describes a relevant, professional visual.`
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
      const contentText = claudeData.content[0].text;
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

    const response = {
      success: true,
      presentation: presentationContent,
      metadata: {
        topic: finalTopic,
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
