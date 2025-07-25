import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { complaintId } = await req.json();
    if (!complaintId) {
      throw new Error('Complaint ID is required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        *,
        practice_details!inner(practice_name, address, phone, email)
      `)
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
    }

    const systemPrompt = `You are a professional NHS complaints officer writing acknowledgement letters. Generate a formal acknowledgement letter for a patient complaint that:

1. Acknowledges receipt of the complaint
2. Provides the complaint reference number
3. Summarizes the key points of the complaint
4. Explains the NHS complaints process
5. Sets expectations for timelines (20 working days)
6. Provides contact information for queries
7. Is empathetic and professional

Format as a formal letter with appropriate NHS letterhead styling.`;

    const userPrompt = `Generate an acknowledgement letter for this complaint:

Reference: ${complaint.reference_number}
Practice: ${complaint.practice_details.practice_name}
Complaint Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}

Practice Details:
Name: ${complaint.practice_details.practice_name}
Address: ${complaint.practice_details.address || 'Address not provided'}
Phone: ${complaint.practice_details.phone || 'Phone not provided'}
Email: ${complaint.practice_details.email || 'Email not provided'}

Generate a professional acknowledgement letter addressing the specific concerns raised.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const acknowledgementLetter = data.choices[0].message.content;

    // Store the acknowledgement in the database
    const { error: insertError } = await supabase
      .from('complaint_acknowledgements')
      .insert({
        complaint_id: complaintId,
        acknowledgement_letter: acknowledgementLetter,
        sent_by: null, // Will be set by the frontend
      });

    if (insertError) {
      throw new Error('Failed to store acknowledgement');
    }

    return new Response(JSON.stringify({ 
      acknowledgementLetter,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-complaint-acknowledgement function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate acknowledgement letter' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});