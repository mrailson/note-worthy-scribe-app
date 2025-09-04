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
      .select('*')
      .eq('id', complaintId)
      .single();

    if (complaintError || !complaint) {
      throw new Error('Complaint not found');
    }

    console.log('Complaint data:', {
      id: complaint.id,
      practice_id: complaint.practice_id,
      patient_name: complaint.patient_name
    });

    // Get practice details if practice_id exists
    let practiceDetails = null;
    let signatureDetails = null;
    
    if (complaint.practice_id) {
      console.log('Fetching practice details for practice_id:', complaint.practice_id);
      const { data: practice } = await supabase
        .from('practice_details')
        .select('practice_name, address, phone, email, logo_url, practice_logo_url, footer_text, website, show_page_numbers')
        .eq('id', complaint.practice_id)
        .single();
      practiceDetails = practice;
      console.log('Retrieved practice details:', practiceDetails);
    } else {
      console.log('No practice_id found on complaint, fetching from user roles');
      
      const { data: userPractice } = await supabase
        .from('user_roles')
        .select(`
          practice_id,
          practice_details!inner (
            practice_name, 
            address, 
            phone, 
            email, 
            logo_url, 
            practice_logo_url, 
            footer_text, 
            website, 
            show_page_numbers
          )
        `)
        .eq('user_id', complaint.created_by)
        .not('practice_id', 'is', null)
        .limit(1)
        .single();
      
      if (userPractice && userPractice.practice_details) {
        practiceDetails = userPractice.practice_details;
        console.log('Retrieved practice details from user roles:', practiceDetails);
      }
    }

    // Get signature details for the user who created the complaint
    console.log('Fetching signature details for user:', complaint.created_by);
    const { data: signature } = await supabase
      .from('complaint_signatures')
      .select('*')
      .eq('user_id', complaint.created_by)
      .eq('use_for_acknowledgements', true)
      .single();
    signatureDetails = signature;
    console.log('Retrieved signature details:', signatureDetails);

    const systemPrompt = `You are a professional NHS complaints officer writing acknowledgement letters. Generate a formal acknowledgement letter for a patient complaint that:

1. Acknowledges receipt of the complaint
2. Provides the complaint reference number
3. Summarizes the key points of the complaint
4. Explains the NHS complaints process
5. Sets expectations for timelines (20 working days)
6. Provides contact information for queries
7. Is empathetic and professional

IMPORTANT FORMATTING REQUIREMENTS:
- Start directly with the date, do NOT include any practice headers or letterhead
- Use the practice branding and footer information provided
- DO NOT include practice details in a footer format with dashes (---)
- Include practice contact details naturally within the letter content or signature area only
- Format as a clean, professional NHS letter
- Include appropriate signature block with all provided signature details
- NEVER include personal email addresses or phone numbers in contact details
- Only use practice-wide email and phone numbers

Format as a formal letter with NHS styling.`;

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const userPrompt = `Generate an acknowledgement letter for this complaint:

Reference: ${complaint.reference_number}
Patient: ${complaint.patient_name}
Patient Address: ${complaint.patient_address || 'Not provided'}
Complaint Title: ${complaint.complaint_title}
Description: ${complaint.complaint_description}
Category: ${complaint.category}
Incident Date: ${complaint.incident_date}
Location/Service: ${complaint.location_service || 'Not specified'}
Date: ${currentDate}

Signature Details:
${signatureDetails ? `
Name: ${signatureDetails.name}
Title: ${signatureDetails.job_title}
Qualifications: ${signatureDetails.qualifications || ''}
Signature Text: ${signatureDetails.signature_text || ''}
` : ''}

Practice Details:
${practiceDetails ? `
Practice Name: ${practiceDetails.practice_name}
Address: ${practiceDetails.address || ''}
Phone: ${practiceDetails.phone || ''}
Email: ${practiceDetails.email || ''}
Website: ${practiceDetails.website || ''}
Footer Text: ${practiceDetails.footer_text || ''}
Show Page Numbers: ${practiceDetails.show_page_numbers ? 'Yes' : 'No'}
` : ''}

Generate a professional acknowledgement letter addressing the specific concerns raised. Include the date at the top of the letter as "${currentDate}". 

IMPORTANT: If patient address is provided, include it in the letter header after "Private & Confidential". Use the practice and signature details provided to create appropriate headers and signature blocks. If practice phone number is available, include it in the practice contact details.

CRITICAL: Never include personal email addresses or direct contact details in the signature. ${practiceDetails?.email ? `Use the practice email: ${practiceDetails.email}` : 'Use a generic practice email'} ${practiceDetails?.phone ? `and practice phone number: ${practiceDetails.phone}` : ''} for contact information.`;

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
    let acknowledgementLetter = data.choices[0].message.content;
    
    // Add practice logo URL to the letter content as HTML comment for Word export
    if (practiceDetails?.logo_url || practiceDetails?.practice_logo_url) {
      const logoUrl = practiceDetails.practice_logo_url || practiceDetails.logo_url;
      acknowledgementLetter = `<!-- logo_url: ${logoUrl} -->\n${acknowledgementLetter}`;
    }
    
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

    // Update complaint status to "under_review" after acknowledgement is generated
    const { error: statusError } = await supabase
      .from('complaints')
      .update({ 
        status: 'under_review',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', complaintId);

    if (statusError) {
      console.error('Failed to update complaint status:', statusError);
      // Don't throw error here, acknowledgement was still generated successfully
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