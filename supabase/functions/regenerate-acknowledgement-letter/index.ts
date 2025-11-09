import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId, currentLetter, instructions, complaintDescription, referenceNumber, style } = await req.json();
    
    if (!complaintId || !currentLetter || !instructions) {
      throw new Error('Missing required parameters');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Define style-specific formatting instructions
    const styleInstructions: Record<string, string> = {
      'professional-bullet': `FORMAT AS PROFESSIONAL BULLET POINT STYLE:
- Use a blue left border on the subject line (Re: Acknowledgement...)
- Present key concerns and investigation points as clear bullet points with • symbols
- Keep paragraphs concise between bullet sections
- Use bold for section headers`,
      
      'formal-paragraph': `FORMAT AS FORMAL PARAGRAPH STYLE:
- Use traditional paragraph-based format throughout
- No bullet points or numbered lists
- Smooth transitions between paragraphs
- Professional formal business letter tone`,
      
      'numbered-summary': `FORMAT AS NUMBERED SUMMARY STYLE:
- Use numbered lists (1., 2., 3.) for key points and concerns
- Clear section headers followed by numbered items
- Concise point-by-point structure
- Easy to reference and track`,
      
      'executive-brief': `FORMAT AS EXECUTIVE BRIEF STYLE:
- Concise paragraph style with bold section headers
- Use **bold text** for key terms and important points
- Short, direct paragraphs
- Highlight critical information clearly`,
      
      'detailed-narrative': `FORMAT AS DETAILED NARRATIVE STYLE:
- Fuller, more detailed paragraphs
- Flowing narrative with smooth transitions
- Comprehensive explanations
- Professional storytelling approach`,
      
      'highlighted-points': `FORMAT AS HIGHLIGHTED KEY POINTS STYLE:
- Use text emphasis with **bold** for key concerns
- Highlight important dates and timelines
- Visual separation between sections
- Use indentation for sub-points`
    };

    const stylePrompt = style && styleInstructions[style] 
      ? `\n\n${styleInstructions[style]}` 
      : '';

    // Call Lovable AI to regenerate the acknowledgement letter
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert NHS complaints manager helping to revise acknowledgement letters.
Your task is to take the existing acknowledgement letter and modify it based on the user's instructions whilst maintaining professional NHS standards and compliance with complaints handling best practices.

CRITICAL LANGUAGE REQUIREMENT - BRITISH ENGLISH ONLY:
- MUST use British English spelling throughout
- Common examples to ALWAYS use British spelling:
  * "organisation" NOT "organization"
  * "centre" NOT "center"
  * "recognise" NOT "recognize"
  * "apologise" NOT "apologize"
  * "realise" NOT "realize"
  * "behaviour" NOT "behavior"
  * "honour" NOT "honor"
  * "favour" NOT "favor"
  * "colour" NOT "color"
  * "programme" NOT "program" (except computer programs)
  * "licence" (noun) NOT "license" (noun)
  * "practise" (verb) NOT "practice" (verb)
- Follow UK business conventions and date formats
- Double-check every word ending in -ize/-ise, -or/-our, -er/-re

CRITICAL REQUIREMENTS:
- Maintain compliance with NHS complaints handling procedures
- Preserve all essential information (reference numbers, dates, patient details, practice details)
- Keep the formal NHS letter format and structure
- Ensure professional and empathetic tone appropriate for acknowledgement letters
- Include required elements: acknowledgement of receipt, categorisation, investigation timeline (typically 20 working days)
- Keep contact information for queries
- Only modify the aspects specified in the user's instructions

NHS BEST PRACTICES FOR ACKNOWLEDGEMENT LETTERS:
- Acknowledge receipt promptly and courteously
- Confirm understanding of the complaint
- Explain the investigation process clearly
- Set realistic timelines for response
- Provide appropriate contact information
- Express empathy whilst remaining professional
- Reassure about thoroughness and impartiality
${stylePrompt}

Return ONLY the revised letter content without any preamble or explanation.`
          },
          {
            role: 'user',
            content: `Here is the current acknowledgement letter:

${currentLetter}

Complaint reference: ${referenceNumber}
Original complaint: ${complaintDescription}

Please revise this letter according to these instructions:
${instructions}

Return only the revised letter content.`
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const regeneratedLetter = data.choices?.[0]?.message?.content;

    if (!regeneratedLetter) {
      throw new Error('No content generated by AI');
    }

    return new Response(
      JSON.stringify({ regeneratedLetter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-acknowledgement-letter:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
