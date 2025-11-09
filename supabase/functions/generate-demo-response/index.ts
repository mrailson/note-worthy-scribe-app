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
    const { complaintReference, complaintDescription, category, patientName } = await req.json();
    
    console.log('Generating demo response for:', { complaintReference, category });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are a GP practice complaints officer generating a realistic practice response to a patient complaint for demonstration purposes. 

Generate believable, professional responses that a typical NHS GP practice would provide. Each response should:
- Be up to 100 words
- Use appropriate NHS tone (professional, empathetic, factual)
- Reference realistic actions a GP practice would take
- Be specific to the complaint category and details provided

Return ONLY a JSON object with these four fields (no markdown, no code blocks):
{
  "key_findings": "Brief summary of investigation findings",
  "actions_taken": "Immediate actions taken in response",
  "improvements_made": "Process improvements implemented",
  "additional_context": "Relevant context or mitigating circumstances"
}`;

    const userPrompt = `Generate a realistic GP practice response for this complaint:

Complaint Reference: ${complaintReference}
Category: ${category}
Patient: ${patientName || 'Not specified'}
Description: ${complaintDescription}

Provide a believable response that a real GP practice would give, including investigation findings, actions taken, improvements made, and any relevant context.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedContent = aiData.choices[0].message.content;
    
    console.log('AI generated content:', generatedContent);

    // Parse the JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const cleanContent = generatedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsedResponse = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Content:', generatedContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate response structure
    const requiredFields = ['key_findings', 'actions_taken', 'improvements_made', 'additional_context'];
    for (const field of requiredFields) {
      if (!parsedResponse[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        demoResponse: parsedResponse
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating demo response:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});