import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId } = await req.json();

    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the existing complaint
    const { data: complaint, error: fetchError } = await supabase
      .from('complaints')
      .select('id, complaint_description, complaint_title')
      .eq('id', complaintId)
      .single();

    if (fetchError || !complaint) {
      throw new Error(`Failed to fetch complaint: ${fetchError?.message || 'Not found'}`);
    }

    console.log('Re-summarising complaint:', complaintId);
    console.log('Original description length:', complaint.complaint_description?.length || 0);

    const systemPrompt = `You are an expert NHS complaints processor. Your task is to create a professional, clinical summary of the complaint.

CRITICAL SUMMARISATION RULES:
- NEVER copy offensive language, profanity, or inappropriate references verbatim
- Create a summary in exactly 2-4 sentences
- Focus on factual concerns rather than emotional expression
- Write in third person, clinical tone (e.g., "The patient reports..." or "The complainant states...")
- If the patient mentions specific staff, note that staff were mentioned but do not repeat accusations verbatim
- Extract the core issue: what happened, when, impact on patient, and desired resolution if mentioned

Return ONLY the summary text, no additional explanation or formatting.`;

    const userPrompt = `Create a professional, clinical summary of this complaint:\n\n${complaint.complaint_description}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const newSummary = data.choices[0].message.content.trim();

    console.log('New summary:', newSummary);

    // Update the complaint with the new summary
    const { error: updateError } = await supabase
      .from('complaints')
      .update({ complaint_description: newSummary })
      .eq('id', complaintId);

    if (updateError) {
      throw new Error(`Failed to update complaint: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      newDescription: newSummary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in re-summarise-complaint:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
