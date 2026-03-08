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
    
    console.log('Received style parameter:', style);
    
    if (!complaintId || !currentLetter || !instructions) {
      throw new Error('Missing required parameters');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Define style-specific formatting instructions
    const styleInstructions: Record<string, string> = {
      'professional-flowing': `FORMAT AS PROFESSIONAL FLOWING STYLE:
- Use continuous, well-structured paragraphs throughout
- Professional formal business letter tone
- Smooth transitions between paragraphs
- No bullet points, no numbered lists, no headers within the body`,
      
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
- Concise paragraph style
- Short, direct paragraphs
- Highlight critical information clearly
- No bullet points or lists`,
      
      'detailed-narrative': `FORMAT AS DETAILED NARRATIVE STYLE:
- Fuller, more detailed paragraphs
- Flowing narrative with smooth transitions
- Comprehensive explanations
- Professional storytelling approach`
    };

    const stylePrompt = style && styleInstructions[style] 
      ? `\n\nCRITICAL FORMATTING REQUIREMENT - YOU MUST FOLLOW THIS STYLE EXACTLY:\n${styleInstructions[style]}\n\nThis formatting style is MANDATORY and must be applied to the entire letter.` 
      : '';

    console.log('Using style prompt:', stylePrompt ? `Style: ${style}` : 'No specific style');

    // Call Lovable AI to regenerate the acknowledgement letter
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert NHS complaints manager helping to revise acknowledgement letters.
Your task is to take the existing acknowledgement letter and modify it based on the user's instructions whilst maintaining professional NHS standards and compliance with complaints handling best practices.

ABSOLUTE FORMAT RULES — THESE OVERRIDE EVERYTHING:
- Do NOT use any section headers, subheadings, bold headers, or titled sections anywhere in the letter body.
- Do NOT use bullet points, numbered lists, or any list formatting (unless the selected style explicitly requires numbered lists).
- Do NOT use markdown formatting of any kind (no ##, **, --, bullets).
- Write the entire letter as flowing formal paragraphs — a proper piece of posted correspondence.
- If you include any headers or bullet points (unless style requires it), the letter will be rejected.

CRITICAL LANGUAGE REQUIREMENT - BRITISH ENGLISH ONLY:
- MUST use British English spelling throughout including: judgement (not judgment), acknowledgement (not acknowledgment), organisation, centre, recognise, apologise, behaviour, colour, favour, honour, programme, cancelled, labelled, travelled, fulfil, enrol, enquiry, defence, paediatric, gynaecology, orthopaedic, anaesthetic, haematology, specialised, minimise, realise.
- Use NHS-standard terminology and UK date format (DD Month YYYY).
- Do not use American spellings or phrasing under any circumstances.

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

${style ? 'REMINDER: Apply the specified formatting style consistently throughout the ENTIRE letter. This is your PRIMARY instruction.' : ''}

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
